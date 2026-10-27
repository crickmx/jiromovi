// PDF de la cotización Auna Oncosalud Plus, con marca compartida:
// logo del agente a la izquierda y logo de Auna a la derecha.
import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
import {
  AVISO_IMPORTANTE,
  LIMITE_ANUAL,
  VIGENCIA_TARIFAS,
  type ResultadoCotizacion,
} from './aunaOncoCotizador';

// jspdf-autotable se publica como CommonJS (ver ordenCompraPdf.ts).
export const autoTable = ((autoTableImport as unknown as { default?: typeof autoTableImport }).default
  ?? autoTableImport) as typeof autoTableImport;

export interface AgentePdf {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  oficina?: string | null;
  logoUrl?: string | null;
}

/** Datos del agente para el PDF a partir de su fila de `usuarios` (con oficina). */
export function agenteDesdeUsuario(u: {
  nombre?: string | null; apellidos?: string | null; nombre_publico?: string | null; nombre_completo?: string | null;
  celular_laboral?: string | null; celular_personal?: string | null; email_laboral?: string | null; email?: string | null;
  oficina?: { nombre?: string | null } | null;
} | null | undefined, logoUrl: string | null): AgentePdf {
  return {
    nombre: u?.nombre_publico || u?.nombre_completo || [u?.nombre, u?.apellidos].filter(Boolean).join(' ') || '',
    telefono: u?.celular_laboral || u?.celular_personal || null,
    email: u?.email_laboral || u?.email || null,
    oficina: u?.oficina?.nombre ?? null,
    logoUrl,
  };
}

export interface DatosPdf {
  folio: string;
  cliente: string;
  fecha: Date;
  resultado: ResultadoCotizacion;
  agente: AgentePdf;
}

export const AUNA = [31, 179, 201] as const;      // turquesa de las tablas de Auna
const AUNA_LIME = [181, 230, 29] as const;
export const NAVY = [15, 23, 42] as const;
export const GRIS = [100, 116, 139] as const;

export const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
export const fechaLarga = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
export const fechaCorta = (iso: string) => {
  if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

async function cargarImagen(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string | null>(resolve => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
    if (!data) return null;
    const dims = await new Promise<{ w: number; h: number } | null>(resolve => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = data;
    });
    return dims ? { data, ...dims } : null;
  } catch {
    return null;
  }
}

function dibujarLogo(doc: jsPDF, img: { data: string; w: number; h: number }, x: number, y: number, maxW: number, maxH: number, alinear: 'izq' | 'der') {
  const escala = Math.min(maxW / img.w, maxH / img.h);
  const w = img.w * escala;
  const h = img.h * escala;
  const fmtImg = img.data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  doc.addImage(img.data, fmtImg, alinear === 'izq' ? x : x - w, y + (maxH - h) / 2, w, h);
}

const COBERTURAS_ALCANCE: [string, string][] = [
  ['Fase diagnóstica ambulatoria y hospitalaria', 'Estudios de imagen, laboratorio y cirugías para obtener biopsia y establecer el diagnóstico definitivo.'],
  ['Honorarios profesionales', 'Consultas, interconsultas, procedimientos y cirugías por la Red de proveedores.'],
  ['Quimioterapia y radioterapia', 'Medicamentos quimioterápicos convencionales e insumos; radioterapia ambulatoria u hospitalaria.'],
  ['Complicaciones del tratamiento', 'Hasta 4 semanas post-quimioterapia o terapia biológica y 8 semanas post-radioterapia.'],
  ['Hormonoterapia, albúmina y servicios de apoyo', 'Hormonoterapia convencional y compleja; exámenes de control y seguimiento.'],
  ['Medicina nuclear y PET Scan', 'Incluye la sustancia radiactiva (FDG o 68Ga-PSMA) cuando la indica la Red.'],
  ['Transfusiones, NPT y NET', 'Hemoderivados; nutrición parenteral o enteral hasta 3 semanas en hospitalización.'],
  ['Trasplante de médula ósea histocompatible', 'No incluye búsqueda de donantes ni trasplante haploidéntico.'],
  ['Cirugía reconstructiva, prótesis y reconstrucción mamaria', 'Según condiciones (mujeres menores de 70 años no fumadoras para mama).'],
  ['Psicología en cáncer y terapia física', 'Terapia física hasta 12 sesiones.'],
  ['Segunda opinión médica nacional e internacional', 'Revisión del expediente por especialistas.'],
  ['Consulta preventiva y chequeo oncológico', 'Una consulta preventiva y un chequeo oncológico anual según edad y sexo.'],
  ['Servicio de acompañamiento', 'Orientación desde la sospecha de cáncer y durante el tratamiento.'],
];

export const MARGEN = 14;

/**
 * Encabezado y pie de marca compartida (logo del agente + Auna), comunes a la
 * cotización y a la solicitud de emisión. `pie()` se llama al final: numera.
 */
export async function marcaCompartida(doc: jsPDF, agente: AgentePdf, folio: string) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = MARGEN;
  const [logoAgente, logoAuna] = await Promise.all([
    agente.logoUrl ? cargarImagen(agente.logoUrl) : Promise.resolve(null),
    cargarImagen('/logo-auna.png'),
  ]);

  const encabezado = () => {
    if (logoAgente) dibujarLogo(doc, logoAgente, M, 8, 48, 16, 'izq');
    else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY);
      doc.text(agente.oficina || agente.nombre, M, 18);
    }
    if (logoAuna) dibujarLogo(doc, logoAuna, PW - M, 9, 38, 13, 'der');
    // separador vertical "marca compartida"
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.line(PW / 2, 9, PW / 2, 23);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
    doc.text('EN ALIANZA CON', PW / 2 + 3, 17);
    // franja turquesa + lima
    doc.setFillColor(...AUNA); doc.rect(0, 27, PW * 0.82, 1.6, 'F');
    doc.setFillColor(...AUNA_LIME); doc.rect(PW * 0.82, 27, PW * 0.18, 1.6, 'F');
  };

  const pie = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240); doc.line(M, PH - 16, PW - M, PH - 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRIS);
      const contacto = [agente.nombre, agente.telefono, agente.email].filter(Boolean).join('  ·  ');
      doc.text(`Tu asesor: ${contacto}`, M, PH - 11);
      doc.text('Seguro Oncosalud operado por Dentegra Seguros Dentales, S.A. · www.auna.org/mx/oncosalud', M, PH - 7);
      doc.text(`Folio ${folio} · ${i}/${total}`, PW - M, PH - 11, { align: 'right' });
    }
  };

  return { encabezado, pie };
}

export async function generarPdfAunaOnco(datos: DatosPdf): Promise<Blob> {
  const { resultado: r, agente } = datos;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = MARGEN;

  const { encabezado, pie } = await marcaCompartida(doc, agente, datos.folio);

  // ── Página 1 ──────────────────────────────────────────────────────────────
  encabezado();
  let y = 38;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...NAVY);
  doc.text('Cotización Oncosalud Plus', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text(`${fechaLarga(datos.fecha)}  ·  Folio ${datos.folio}`, PW - M, y, { align: 'right' });
  y += 7;
  doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(`Estimado(a) cliente: `, M, y);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.cliente.toUpperCase(), M + doc.getTextWidth('Estimado(a) cliente: '), y);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  const intro = doc.splitTextToSize('Gracias por considerarnos para la protección oncológica de usted y su familia. A continuación encontrará la descripción de beneficios, costos y el alcance del seguro cotizado.', PW - 2 * M);
  doc.text(intro, M, y);
  y += intro.length * 3.8 + 3;

  // Coberturas
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [[{ content: 'PROGRAMA ONCOSALUD PLUS', colSpan: 4, styles: { halign: 'center' } }], ['Coberturas', 'Periodo de carencia', 'Deducible', 'Copago']],
    body: [
      ['Cobertura de Diagnóstico', '180 días', '$0', '0%'],
      ['Cobertura de Tratamiento Oncológico', '180 días', '$0', '0%'],
      ['Consulta Preventiva', '180 días', '$0', '0%'],
      ['Chequeo Oncológico', '180 días', '$0', '0%'],
      [{ content: 'Límite anual por asegurado', styles: { fontStyle: 'bold' } }, { content: fmt(LIMITE_ANUAL), colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }],
      [{ content: 'Red', styles: { fontStyle: 'bold' } }, { content: 'Cerrada · Vigencia anual', colSpan: 3, styles: { halign: 'center' } }],
    ],
    headStyles: { fillColor: [...AUNA], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [...NAVY] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    theme: 'grid',
    styles: { lineColor: [226, 232, 240], lineWidth: 0.2, cellPadding: 1.8 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // Asegurados
  const hayExtra = r.lineas.some(l => l.extraprima > 0);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [[
      'Asegurado', 'Género', 'Fecha de nacimiento', 'Edad',
      ...(hayExtra ? ['Extraprima'] : []),
      'Prima neta',
    ]],
    body: r.lineas.map(l => [
      l.nombre.toUpperCase(),
      l.sexo === 'F' ? 'Femenino' : 'Masculino',
      fechaCorta(l.fechaNacimiento),
      String(l.edad ?? ''),
      ...(hayExtra ? [l.extraprima > 0 ? `${Math.round(l.extraprimaPct * 100)}% (${fmt(l.extraprima)})` : '—'] : []),
      fmt(l.primaNeta),
    ]),
    headStyles: { fillColor: [...AUNA], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [...NAVY] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, [hayExtra ? 5 : 4]: { halign: 'right' }, ...(hayExtra ? { 4: { halign: 'right' } } : {}) },
    theme: 'grid',
    styles: { lineColor: [226, 232, 240], lineWidth: 0.2, cellPadding: 1.8 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // Desglose
  const filas: [string, string][] = [
    ['Forma de pago', r.formaPago === 'anual' ? 'Anual (contado)' : 'Mensual (12 recibos)'],
    ['Prima neta total de la póliza', fmt(r.primaNetaTotal)],
  ];
  if (r.descuento > 0) filas.push([`Descuento en la prima (${r.descuentoPct}%)`, `- ${fmt(r.descuento)}`]);
  filas.push(['Recargo por pago fraccionado', fmt(r.recargoFraccionado)]);
  filas.push(['Derechos de póliza', fmt(r.derechos)]);
  filas.push(['Subtotal', fmt(r.subtotal)]);
  filas.push(['I.V.A. (16%)', fmt(r.iva)]);
  const anchoDesglose = 105;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: PW - M - anchoDesglose },
    body: [...filas, ['Prima total de la póliza', fmt(r.primaTotal)]],
    theme: 'plain',
    bodyStyles: { fontSize: 8.5, textColor: [...NAVY], cellPadding: 1.5 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (h) => {
      if (h.row.index === filas.length) {
        h.cell.styles.fillColor = [...AUNA];
        h.cell.styles.textColor = 255;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.fontSize = 10;
      } else if (h.row.index % 2 === 0) {
        h.cell.styles.fillColor = [241, 250, 252];
      }
    },
  });
  const finDesglose = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Tarjeta de recibos a la derecha del desglose
  const cx = M + anchoDesglose + 6;
  const cw = PW - M - cx;
  doc.setFillColor(15, 23, 42); doc.roundedRect(cx, y, cw, finDesglose - y, 3, 3, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(r.formaPago === 'anual' ? 'PAGO ÚNICO' : 'PRIMER RECIBO', cx + 5, y + 8);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(fmt(r.primerRecibo), cx + 5, y + 17);
  if (r.reciboSubsecuente != null) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('11 RECIBOS SUBSECUENTES DE', cx + 5, y + 27);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(fmt(r.reciboSubsecuente), cx + 5, y + 35);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(203, 213, 225);
  doc.text(doc.splitTextToSize('Incluye IVA. Los derechos de póliza se cobran en el primer recibo.', cw - 10), cx + 5, finDesglose - 7);
  y = finDesglose + 6;

  // Aviso importante
  // El ancho de línea depende del tamaño de letra: fijarlo antes de partir.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const avisoLineas = doc.splitTextToSize(AVISO_IMPORTANTE, PW - 2 * M - 10);
  const avisoH = avisoLineas.length * 3.6 + 12;
  if (y + avisoH > PH - 20) { doc.addPage(); encabezado(); y = 36; }
  doc.setFillColor(255, 251, 235); doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.4);
  doc.roundedRect(M, y, PW - 2 * M, avisoH, 2.5, 2.5, 'FD');
  doc.setFillColor(245, 158, 11); doc.rect(M, y, 1.6, avisoH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(146, 64, 14);
  doc.text('Aviso importante sobre su cotización:', M + 5, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 53, 15);
  doc.text(avisoLineas, M + 5, y + 11);
  y += avisoH + 4;

  if (r.requiereSuscripcion || hayExtra) {
    const txt = r.requiereSuscripcion
      ? 'Con base en el cuestionario médico, uno o más asegurados requieren valoración de la suscripción médica de la aseguradora antes de confirmar precio y condiciones.'
      : 'Las extraprimas mostradas son preliminares conforme a la matriz de casos frecuentes; la aseguradora las confirma en la suscripción médica.';
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    const l = doc.splitTextToSize(txt, PW - 2 * M);
    if (y + l.length * 3.6 > PH - 20) { doc.addPage(); encabezado(); y = 36; }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
    doc.text(l, M, y);
  }

  // ── Página 2: alcance, red y notas ────────────────────────────────────────
  doc.addPage();
  encabezado();
  y = 38;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY);
  doc.text('Alcance de los beneficios', M, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M },
    head: [['Cobertura', 'Alcance']],
    body: COBERTURAS_ALCANCE,
    headStyles: { fillColor: [...AUNA], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [...NAVY] },
    columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' } },
    theme: 'grid',
    styles: { lineColor: [226, 232, 240], lineWidth: 0.2, cellPadding: 1.8 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  const bloque = (titulo: string, texto: string[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
    if (y > PH - 40) { doc.addPage(); encabezado(); y = 38; }
    doc.text(titulo, M, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(71, 85, 105);
    for (const t of texto) {
      const l = doc.splitTextToSize(t, PW - 2 * M);
      if (y + l.length * 3.4 > PH - 20) { doc.addPage(); encabezado(); y = 38; }
      doc.text(l, M, y);
      y += l.length * 3.4 + 1.2;
    }
    y += 2;
  };

  bloque('Red cerrada de proveedores', [
    '• Doctors Hospital Auna (DH). C. Ecuador 2331, Balcones de Galerías, 64620 Monterrey, N.L.',
    '• Doctors Hospital East Auna (DHE). Av. Prol. Francisco I. Madero 6060, Libertad, 67130 Guadalupe, N.L.',
    '• OCA Hospital Auna - Organización Clínica América (OCAH). Pino Suárez No. 645, Col. Centro, Monterrey, N.L., C.P. 64000',
  ]);
  bloque('Definiciones', [
    'Periodo de carencia: 180 días desde el inicio de vigencia antes de que entren en vigor las coberturas. Lo diagnosticado durante ese periodo no queda cubierto.',
    'Deducible y copago: $0 y 0% en red cerrada para el plan cotizado. No aplica deducible en la renovación anual.',
    'Límite anual: monto máximo de beneficio por asegurado por vigencia anual, reinstalable en la renovación.',
  ]);
  bloque('Notas', [
    '1. Este documento no es una póliza de seguro; es una cotización y no representa garantía de aceptación de cobertura por parte de Dentegra Seguros Dentales, S.A.',
    '2. Sujeta a políticas de aceptación y proceso de suscripción médica y administrativa. Validez de 30 días naturales.',
    '3. Para contratar, el solicitante debe ser mayor de edad y llenar la solicitud y el cuestionario de salud. Edad máxima de aceptación: 70 años 11 meses.',
    `4. Tarifas sin descuento vigentes al ${VIGENCIA_TARIFAS}, sujetas a cambio sin previo aviso. Primas netas por persona; derechos de póliza $250 + IVA; IVA 16%.`,
    '5. Consulte las Condiciones Generales con el detalle de cobertura, alcance, limitaciones y exclusiones, y el Aviso de Privacidad en www.dentegra.com.mx y auna.org/mx/oncosalud.',
  ]);

  pie();
  return doc.output('blob');
}

