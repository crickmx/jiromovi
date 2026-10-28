// PDF del precio de referencia Auna Oncosalud PLUS, con marca compartida:
// logo del agente a la izquierda y logo de Auna a la derecha. Contenido,
// leyendas y paleta siguen la calculadora oficial de Auna (28/10).
import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
import {
  AVISO_IMPORTANTE,
  AVISO_NO_OFICIAL,
  AVISO_REFERENCIA,
  AVISO_PRIVACIDAD,
  NOTAS_REFERENCIA,
  LIMITE_ANUAL,
  PRODUCTO,
  CLAVE_AGENTE,
  RECARGO_MENSUAL,
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
  /** Clave del agente / promotor ante Auna. Si no viene, DTJIRO. */
  claveAgente?: string;
  region?: string;
}

// Paleta oficial Auna 2026 (Pantone 3125C, 382C, Black 7C).
export const AUNA = [0, 176, 202] as const;        // Turquesa Auna — color principal
const AUNA_DEEP = [0, 147, 168] as const;          // para tablas secundarias
const AUNA_LIME = [190, 214, 0] as const;          // Verde Auna — solo con texto gris oscuro encima
const AUNA_NARANJA = [255, 105, 0] as const;       // aviso de "no oficial"
export const NAVY = [61, 57, 53] as const;         // Gris oscuro Auna — tinta principal
export const GRIS = [117, 114, 109] as const;

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
export async function marcaCompartida(
  doc: jsPDF,
  agente: AgentePdf,
  folio: string,
  leyendaPie = 'Seguro Oncosalud · Auna Seguros, S.A. · www.aunaseguros.com.mx',
) {
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
      doc.text(leyendaPie, M, PH - 7);
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
  const ancho = PW - 2 * M;
  const mensual = r.formaPago === 'mensual';
  const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const { encabezado, pie } = await marcaCompartida(doc, agente, datos.folio);
  const nuevaPagina = (yy: number, alto: number) => {
    if (yy + alto <= PH - 20) return yy;
    doc.addPage(); encabezado(); return 36;
  };

  // ── Página 1 ──────────────────────────────────────────────────────────────
  encabezado();
  let y = 37;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...NAVY);
  doc.text(`Precio de Referencia · ${PRODUCTO}`, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text(fechaLarga(datos.fecha), PW - M, y, { align: 'right' });
  y += 4;

  // Aviso "no es cotización oficial" (naranja Auna)
  doc.setFillColor(255, 241, 228);
  doc.rect(M, y, ancho, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AUNA_NARANJA);
  doc.text(AVISO_NO_OFICIAL, M + 2.5, y + 4.6);
  y += 11;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...GRIS);
  const lRef = doc.splitTextToSize(AVISO_REFERENCIA, ancho);
  doc.text(lRef, M, y);
  y += lRef.length * 3 + 3;

  // Datos del ejercicio
  const par = (etq: string, val: string, x: number, yy: number, alinear: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    const t = `${etq}: `;
    // El ancho se mide con la fuente con la que se dibuja cada parte.
    if (alinear === 'left') {
      doc.text(t, x, yy);
      const anchoEtq = doc.getTextWidth(t);
      doc.setFont('helvetica', 'normal');
      doc.text(val, x + anchoEtq, yy);
    } else {
      doc.setFont('helvetica', 'normal');
      const anchoVal = doc.getTextWidth(val);
      doc.text(val, x, yy, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(t, x - anchoVal, yy, { align: 'right' });
    }
  };
  doc.setFontSize(8.8);
  par('Referencia', datos.folio, M, y);
  par('Región', datos.region || '—', PW - M, y, 'right');
  y += 5;
  par('Clave', datos.claveAgente || CLAVE_AGENTE, M, y);
  par('Agente', agente.nombre || '—', PW - M, y + 5, 'right');
  par('Forma de pago', mensual ? 'Mensual' : 'Anual', PW - M, y, 'right');
  y += 5;
  par('Cliente / prospecto', datos.cliente.toUpperCase(), M, y);
  y += 4;

  // Coberturas
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Coberturas', 'Periodo de carencia', 'Deducible', 'Copago']],
    body: [
      ['Cobertura de Diagnóstico', '180 días', '$0', '0%'],
      ['Cobertura de Tratamiento Oncológico', '180 días', '$0', '0%'],
      ['Consulta Preventiva', '180 días', '$0', '0%'],
      ['Chequeo Oncológico', '180 días', '$0', '0%'],
    ],
    headStyles: { fillColor: [...AUNA], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [...NAVY] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    theme: 'grid',
    styles: { lineColor: [226, 232, 240], lineWidth: 0.2, cellPadding: 1.4 },
  });
  y = finY() + 3.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...GRIS);
  doc.text(`Límite anual por asegurado: ${fmt(LIMITE_ANUAL)} MXN  ·  Tipo de red: Red Cerrada  ·  Vigencia: Anual`, M, y);
  y += 4;

  // Asegurados
  const hayExtra = r.lineas.some(l => l.extraprima > 0);
  const recargoPct = `${(RECARGO_MENSUAL * 100).toFixed(1)}%`;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [[
      'Asegurado', 'Parentesco', 'Sexo', 'Nacimiento', 'Edad',
      ...(hayExtra ? ['Extraprima'] : []),
      'Ref. Prima base',
      ...(mensual ? [`Ref. Prima + recargo ${recargoPct}`] : []),
    ]],
    body: r.lineas.map(l => [
      l.nombre.toUpperCase(),
      l.parentesco,
      l.sexo === 'F' ? 'Femenino' : 'Masculino',
      fechaCorta(l.fechaNacimiento),
      `${l.edad ?? ''} (${l.quinquenio ?? '—'})`,
      ...(hayExtra ? [l.extraprima > 0 ? `${Math.round(l.extraprimaPct * 100)}%` : '—'] : []),
      fmt(l.primaNeta),
      ...(mensual ? [fmt(l.primaConRecargo)] : []),
    ]),
    headStyles: { fillColor: [...AUNA_DEEP], textColor: 255, fontSize: 7.8 },
    bodyStyles: { fontSize: 7.8, textColor: [...NAVY] },
    columnStyles: {
      2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' },
      [hayExtra ? 5 : -1]: { halign: 'center' },
      [hayExtra ? 6 : 5]: { halign: 'right' },
      [hayExtra ? 7 : 6]: { halign: 'right' },
    },
    theme: 'grid',
    styles: { lineColor: [226, 232, 240], lineWidth: 0.2, cellPadding: 1.4 },
  });
  y = finY() + 4;

  // Desglose
  const filas: [string, string][] = [['Ref. Prima neta total', fmt(r.primaNetaTotal)]];
  if (r.descuento > 0) filas.push([`Ref. Descuento en la prima (${r.descuentoPct}%)`, `- ${fmt(r.descuento)}`]);
  if (mensual) {
    filas.push([`Ref. Recargo por pago mensual (${recargoPct} por asegurado)`, fmt(r.recargoFraccionado)]);
    filas.push(['Ref. Prima neta + recargo', fmt(r.primaNetaTotal - r.descuento + r.recargoFraccionado)]);
  }
  filas.push(['Ref. Derechos de emisión (una sola vez por póliza)', fmt(r.derechos)]);
  filas.push(['Ref. Subtotal', fmt(r.subtotal)]);
  filas.push(['Ref. IVA (16%)', fmt(r.iva)]);
  y = nuevaPagina(y, filas.length * 5 + 30);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: filas,
    theme: 'plain',
    bodyStyles: { fontSize: 8.6, textColor: [...NAVY], cellPadding: 1.1 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });
  y = finY() + 1.5;
  // Total: verde Auna, texto SIEMPRE gris oscuro encima (regla de marca)
  doc.setFillColor(...AUNA_LIME);
  doc.rect(M, y, ancho, 10, 'F');
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text('Ref. Prima total', M + 3.5, y + 6.6);
  doc.text(fmt(r.primaTotal), PW - M - 3.5, y + 6.6, { align: 'right' });
  y += 15;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...NAVY);
  doc.text(mensual
    ? `Ref. Primer recibo (incluye derechos de emisión): ${fmt(r.primerRecibo)}     Ref. Recibos subsecuentes (x11): ${fmt(r.reciboSubsecuente ?? 0)}`
    : `Ref. Primer recibo (pago de contado, cubre la vigencia anual completa): ${fmt(r.primerRecibo)}`, M, y);
  y += 4;
  doc.setFontSize(6.8); doc.setTextColor(...GRIS);
  doc.text('* REF.- Referencia de precio', M, y);
  y += 5;

  // Aviso importante (pedido por JIRO)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
  const lAviso = doc.splitTextToSize(AVISO_IMPORTANTE, ancho - 9);
  const avisoH = lAviso.length * 3.4 + 10;
  y = nuevaPagina(y, avisoH);
  doc.setFillColor(255, 251, 235); doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.35);
  doc.roundedRect(M, y, ancho, avisoH, 2, 2, 'FD');
  doc.setFillColor(245, 158, 11); doc.rect(M, y, 1.5, avisoH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(146, 64, 14);
  doc.text('Aviso importante sobre su cotización:', M + 4.5, y + 5.2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(120, 53, 15);
  doc.text(lAviso, M + 4.5, y + 9.4);
  y += avisoH + 4;

  if (r.requiereSuscripcion || hayExtra) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2);
    const txt = r.requiereSuscripcion
      ? 'Con base en el cuestionario médico, uno o más asegurados requieren valoración de la suscripción médica de la aseguradora antes de confirmar precio y condiciones.'
      : 'Las extraprimas mostradas son preliminares conforme a la matriz de casos frecuentes; la aseguradora las confirma en la suscripción médica.';
    const l = doc.splitTextToSize(txt, ancho);
    y = nuevaPagina(y, l.length * 3.2);
    doc.setTextColor(...GRIS);
    doc.text(l, M, y);
    y += l.length * 3.2 + 2;
  }

  // Información importante a considerar + privacidad
  y = nuevaPagina(y, 40);
  doc.setDrawColor(...AUNA); doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8); doc.setTextColor(...NAVY);
  doc.text('Información Importante a Considerar', M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...GRIS);
  NOTAS_REFERENCIA.forEach((n, i) => {
    const l = doc.splitTextToSize(`${i + 1}. ${n}`, ancho);
    y = nuevaPagina(y, l.length * 3.2);
    doc.text(l, M, y);
    y += l.length * 3.2 + 0.8;
  });
  y += 1.5;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.9);
  const lPriv = doc.splitTextToSize(AVISO_PRIVACIDAD, ancho);
  y = nuevaPagina(y, lPriv.length * 3);
  doc.text(lPriv, M, y);

  // ── Alcance, red y condiciones (sigue donde quedó si cabe) ───────────────
  y += lPriv.length * 3 + 8;
  y = nuevaPagina(y, 70);
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
  bloque('Condiciones del precio de referencia', [
    '• Validez de 30 días naturales. Sujeto a las políticas de aceptación y al proceso de suscripción médica y administrativa de Auna Seguros.',
    '• Edad máxima de aceptación: 70 años 11 meses. Dependientes: cónyuge, padres/madres e hijos/as (hijos/as hasta 24 años 11 meses); hasta 5 dependientes por póliza.',
    `• Tarifas sin descuento vigentes al ${VIGENCIA_TARIFAS}, sujetas a cambio sin previo aviso. Primas netas por persona; recargo por pago mensual 9.5% por asegurado; derechos de emisión $250 + IVA, una sola vez por póliza; IVA 16%.`,
    '• Consulte las Condiciones Generales con el detalle de cobertura, alcance, limitaciones y exclusiones en www.aunaseguros.com.mx y auna.org/mx/oncosalud.',
  ]);

  pie();
  return doc.output('blob');
}

