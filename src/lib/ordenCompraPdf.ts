// La parte visible de una Orden de Compra: la franja de color, el desglose de
// lo que se está comprando y el bloque de cómo se va a cobrar.
//
// Son dos documentos (un servicio de Marketing Premium y unos artículos de MOVI
// Store) que tienen que distinguirse de un vistazo y, a la vez, leerse igual.
// Por eso lo que cambia entre ellos es una entrada de `ORDEN_META` —color,
// etiqueta y encabezados de la tabla— y no dos diseños distintos.

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { pesos, type PlanCobro } from './cobroDesglose';

export type TipoOrden = 'servicio' | 'articulos';

type RGB = [number, number, number];

export const ORDEN_META: Record<TipoOrden, {
  /** Fondo de la franja. Oscuro a propósito: el texto encima es blanco. */
  color: RGB;
  /** Mismo tono, más claro, para la línea de remate y el encabezado de la tabla. */
  suave: RGB;
  etiqueta: string;
  columnaConcepto: string;
}> = {
  servicio: {
    color: [138, 101, 214],   // lila
    suave: [196, 175, 240],
    etiqueta: 'SERVICIO · MARKETING PREMIUM',
    columnaConcepto: 'Servicio contratado',
  },
  articulos: {
    color: [176, 130, 14],    // amarillo mostaza
    suave: [230, 197, 92],
    etiqueta: 'ARTÍCULOS · MOVI STORE',
    columnaConcepto: 'Artículo',
  },
};

const MARGEN = 14;

/**
 * Franja superior: de qué es el documento, su folio, a quién se le cobra y
 * desde cuándo. Es lo único que alguien necesita leer para saber qué tiene en
 * la mano. Devuelve la `y` en la que puede seguir el contenido.
 */
export function dibujarFranja(doc: jsPDF, datos: {
  tipo: TipoOrden;
  folio: string;
  cargoA: string;
  oficina?: string | null;
  fecha: string | Date;
}): number {
  const meta = ORDEN_META[datos.tipo];
  const ancho = doc.internal.pageSize.getWidth();
  const alto = 44;

  doc.setFillColor(...meta.color);
  doc.rect(0, 0, ancho, alto, 'F');
  doc.setFillColor(...meta.suave);
  doc.rect(0, alto, ancho, 2.5, 'F');

  doc.setTextColor(255, 255, 255);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE COMPRA', MARGEN, 16);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.etiqueta, MARGEN, 23.5);

  // El folio, a la derecha y en grande: es el dato que se dicta y se busca.
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('FOLIO', ancho - MARGEN, 12, { align: 'right' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.folio || 'SIN FOLIO', ancho - MARGEN, 20, { align: 'right' });

  // Separador interno, para que el renglón de abajo se lea como otro bloque.
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, 29, ancho - MARGEN, 29);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('SE LE COBRA A', MARGEN, 34.5);
  doc.text('FECHA DE CREACIÓN', ancho - MARGEN, 34.5, { align: 'right' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  const quien = datos.oficina ? `${datos.cargoA}  ·  ${datos.oficina}` : datos.cargoA;
  doc.text(quien, MARGEN, 40.5);
  doc.text(
    format(new Date(datos.fecha), "d 'de' MMMM yyyy", { locale: es }),
    ancho - MARGEN, 40.5, { align: 'right' },
  );

  doc.setTextColor(0, 0, 0);
  return alto + 14;
}

export interface ConceptoOrden {
  concepto: string;
  detalle?: string | null;
  cantidad: number;
  precioUnitario: number;
}

/** Qué incluye exactamente la orden. Es la pregunta que el PDF viejo no contestaba. */
export function tablaConceptos(doc: jsPDF, y: number, tipo: TipoOrden, filas: ConceptoOrden[]): number {
  const meta = ORDEN_META[tipo];
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('QUÉ INCLUYE', MARGEN, y);
  y += 2;
  doc.setDrawColor(...meta.color);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [[meta.columnaConcepto, 'Cantidad', 'Precio unit.', 'Importe']],
    body: filas.map(f => [
      f.detalle ? `${f.concepto}\n${f.detalle}` : f.concepto,
      String(f.cantidad),
      pesos(f.precioUnitario),
      pesos(f.cantidad * f.precioUnitario),
    ]),
    theme: 'grid',
    headStyles: { fillColor: meta.color, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: MARGEN, right: MARGEN },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/**
 * Cómo se va a cobrar: total, en cuántas, cada cuándo y —lo que de verdad
 * importa— cuánto se le descuenta cada vez. Ese número va en grande porque es
 * el que la gente busca.
 */
export function bloqueCobro(doc: jsPDF, y: number, tipo: TipoOrden, datos: {
  plan: PlanCobro;
  metodo?: string | null;
  responsable?: string | null;
}): number {
  const meta = ORDEN_META[tipo];
  const ancho = doc.internal.pageSize.getWidth();
  const anchoCaja = ancho - MARGEN * 2;
  const { plan } = datos;
  const alto = plan.ultimaAjusta ? 45 : 37;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CÓMO SE VA A COBRAR', MARGEN, y);
  y += 4;

  doc.setFillColor(249, 248, 253);
  doc.setDrawColor(...meta.color);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGEN, y, anchoCaja, alto, 2, 2, 'FD');

  // Tres columnas: total, en cuántas y cada cuándo, y el descuento por vez.
  const col1 = MARGEN + 8;
  const col2 = MARGEN + anchoCaja * 0.37;
  const col3 = MARGEN + anchoCaja * 0.68;
  let fila = y + 9;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 120);
  doc.text('TOTAL', col1, fila);
  doc.text('PARCIALIDADES', col2, fila);
  doc.text('SE LE DESCUENTA CADA VEZ', col3, fila);

  fila += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(pesos(plan.total), col1, fila);
  doc.text(String(plan.parcialidades), col2, fila);
  doc.setFontSize(17);
  doc.setTextColor(...meta.color);
  doc.text(pesos(plan.montoPorParcialidad), col3, fila);

  // Debajo de "parcialidades", cada cuándo. Puesto como etiqueta y no como
  // frase ("Cada mensual" se lee mal con los nombres del catálogo).
  fila += 5.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 100);
  doc.text(plan.frecuencia || 'Pago único', col2, fila);

  fila += 7;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 70);
  if (datos.metodo) {
    doc.setFont('helvetica', 'bold');
    doc.text('Método:', col1, fila);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.metodo, col1 + 18, fila);
  }
  if (datos.responsable) {
    doc.setFont('helvetica', 'bold');
    doc.text('Responsable del pago:', col2, fila);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.responsable, col2 + 40, fila);
  }

  if (plan.ultimaAjusta) {
    fila += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 130);
    doc.text(
      `La última parcialidad es de ${pesos(plan.ultimaParcialidad)} para que la suma dé el total exacto.`,
      col1, fila,
    );
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + alto + 12;
}

/** Bloque de etiqueta/valor, para los datos que no entran en la franja. */
export function bloqueDatos(doc: jsPDF, y: number, tipo: TipoOrden, titulo: string, campos: [string, string][]): number {
  const meta = ORDEN_META[tipo];
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, MARGEN, y);
  y += 2;
  doc.setDrawColor(...meta.color);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 7;

  doc.setFontSize(9.5);
  for (const [etiqueta, valor] of campos) {
    doc.setFont('helvetica', 'bold');
    doc.text(etiqueta, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    const texto = doc.splitTextToSize(valor || '—', ancho - MARGEN - 62);
    doc.text(texto, 62, y);
    y += Math.max(1, texto.length) * 5.2;
  }
  return y + 6;
}

/** Pie: quién lo generó y cuándo se bajó. Igual en los dos documentos. */
export function pieDocumento(doc: jsPDF, generadoPor?: string | null) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 140, 150);
  doc.text('Documento interno de control — MOVI Digital', ancho / 2, alto - 16, { align: 'center' });
  if (generadoPor) {
    doc.text(`Generado por: ${generadoPor}`, ancho / 2, alto - 11.5, { align: 'center' });
  }
  doc.text(
    `Descargado el ${format(new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}`,
    ancho / 2, alto - 7, { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);
}
