import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuotePerson, FormaPago, OptionResult, ProductId } from './types';
import { PRODUCT_LABELS } from './types';
import type { BxplusQuoteInput, BnvQuoteInput, BnpQuoteInput } from './types';
import { COVERAGE_PDF_TEXTS } from '../gmmCoverageHelp';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return !isNaN(num) && isFinite(num) ? num : defaultValue;
}

interface MultiGmmOption {
  id: string;
  label: string;
  product_id: ProductId;
  input: BxplusQuoteInput | BnvQuoteInput | BnpQuoteInput;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [isNaN(r) ? 14 : r, isNaN(g) ? 35 : g, isNaN(b) ? 226 : b];
}

function lightenColor(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.min(255, rgb[0] + Math.round((255 - rgb[0]) * amount)),
    Math.min(255, rgb[1] + Math.round((255 - rgb[1]) * amount)),
    Math.min(255, rgb[2] + Math.round((255 - rgb[2]) * amount)),
  ];
}

function darkenColor(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.max(0, Math.round(rgb[0] * (1 - amount))),
    Math.max(0, Math.round(rgb[1] * (1 - amount))),
    Math.max(0, Math.round(rgb[2] * (1 - amount))),
  ];
}

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: 'S' | 'F' | 'FD' = 'FD'
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: {
    fillColor?: [number, number, number];
    borderColor?: [number, number, number];
    radius?: number;
    shadow?: boolean;
  }
) {
  const radius = options?.radius ?? 3;
  if (options?.shadow !== false) {
    doc.setFillColor(220, 220, 225);
    doc.setDrawColor(220, 220, 225);
    drawRoundedRect(doc, x + 0.5, y + 0.5, w, h, radius, 'F');
  }
  doc.setFillColor(...(options?.fillColor || [255, 255, 255]));
  doc.setDrawColor(...(options?.borderColor || [225, 225, 232]));
  doc.setLineWidth(0.25);
  drawRoundedRect(doc, x, y, w, h, radius, 'FD');
}

// ── Plan info extractors ──────────────────────────────────────────────────────

const NIVEL_DISPLAY_MAP: Record<string, string> = {
  Alto: 'Elite',
  Medio: 'Plus',
  Basico: 'Estandar',
};

function formatSumaMDP(val: number): string {
  if (!val) return '-';
  return formatCurrency(val * 1_000_000);
}

function formatDeducibleMiles(val: number): string {
  if (!val) return '-';
  return formatCurrency(val * 1_000);
}

function formatTopeCoaseguro(val: number): string {
  if (!val) return 'Sin tope';
  return formatCurrency(val);
}

function formatCoaseguroDisplay(val: string): string {
  if (!val || val === '-') return '-';
  if (val.includes('%')) return val;
  const num = parseFloat(val);
  if (!isNaN(num) && num < 1) return `${(num * 100).toFixed(0)}%`;
  if (!isNaN(num)) return `${num}%`;
  return val;
}

function formatAmountDisplay(val: string): string {
  if (!val || val === '-') return '-';
  if (val.includes('$')) return val;
  const num = parseFloat(val.replace(/,/g, ''));
  if (!isNaN(num)) return formatCurrency(num);
  return val;
}

interface PlanInfo {
  producto: string;
  estado?: string;
  region?: string;
  nivel?: string;
  tabulador?: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro?: string;
  asistencia_extranjero?: boolean;
  maternidad?: boolean;
}

function getOptionPlanInfo(opt: OptionResult, optionDef?: MultiGmmOption): PlanInfo {
  const input = optionDef?.input;
  if (!input) return { producto: opt.product_id, suma_asegurada: '-', deducible: '-', coaseguro: '-' };

  if (opt.product_id === 'BXPLUS') {
    const bx = input as BxplusQuoteInput;
    return {
      producto: 'BX+ Unikuz',
      estado: bx.estado || '-',
      nivel: NIVEL_DISPLAY_MAP[bx.nivel_hospitalario] || bx.nivel_hospitalario || '-',
      tabulador: bx.tabulador || '-',
      suma_asegurada: bx.suma_asegurada || '-',
      deducible: bx.deducible || '-',
      coaseguro: bx.coaseguro || '-',
      tope_coaseguro: bx.tope_coaseguro_seleccionado ? formatCurrency(bx.tope_coaseguro_seleccionado) : '-',
    };
  } else if (opt.product_id === 'BNV') {
    const bnv = input as BnvQuoteInput;
    return {
      producto: 'Bupa Nacional Vital',
      region: bnv.region_zone || '-',
      suma_asegurada: formatSumaMDP(bnv.suma_asegurada),
      deducible: formatDeducibleMiles(bnv.deducible),
      coaseguro: `${bnv.coaseguro || 0}%`,
      tope_coaseguro: formatTopeCoaseguro(bnv.tope_coaseguro),
      asistencia_extranjero: bnv.asistencia_extranjero,
    };
  } else {
    const bnp = input as BnpQuoteInput;
    return {
      producto: 'Bupa Nacional Plus',
      region: bnp.region_zone || '-',
      suma_asegurada: formatSumaMDP(bnp.suma_asegurada),
      deducible: formatDeducibleMiles(bnp.deducible),
      coaseguro: `${bnp.coaseguro || 0}%`,
      asistencia_extranjero: bnp.asistencia_extranjero,
      maternidad: bnp.maternidad_titular || bnp.maternidad_conyuge,
    };
  }
}

function getOptionCoverages(opt: OptionResult, optionDef?: MultiGmmOption): Record<string, boolean> {
  if (opt.product_id === 'BXPLUS' && optionDef) {
    const bx = optionDef.input as BxplusQuoteInput;
    return (bx.coverages || {}) as Record<string, boolean>;
  }
  return {};
}

function getPersonPrima(opt: OptionResult, personIndex: number): number {
  const pr = opt.result.people_results[personIndex];
  if (!pr) return 0;
  if ('prima_total' in pr) return (pr as any).prima_total || 0;
  if ('discounted_rate' in pr) return (pr as any).discounted_rate || 0;
  if ('annual_premium' in pr) return (pr as any).annual_premium || 0;
  return 0;
}

const COBERTURAS_ADICIONALES = [
  { key: 'reconocimiento_antiguedad', label: 'Reconocimiento de antiguedad' },
  { key: 'medicamentos_fuera', label: 'Medicamentos ambulatorios' },
  { key: 'complicaciones_no_amparadas', label: 'Complicaciones no amparadas' },
  { key: 'padecimientos_preexistentes', label: 'Padecimientos preexistentes' },
  { key: 'eliminacion_deducible_accidente', label: 'Sin deducible por accidente' },
  { key: 'multiregion', label: 'Multiregion' },
  { key: 'vip', label: 'Beneficio VIP' },
  { key: 'emergencia_medica_extranjero', label: 'Emergencias en extranjero' },
  { key: 'enfermedades_graves_extranjero', label: 'Enf. graves en extranjero' },
  { key: 'cobertura_internacional', label: 'Cobertura internacional' },
  { key: 'ampliacion_servicios', label: 'Ampliacion de servicios' },
  { key: 'ayuda_diaria', label: 'Ayuda diaria hospitalizacion' },
  { key: 'indemnizacion_eg', label: 'Indemnizacion enf. graves' },
  { key: 'maternidad', label: 'Maternidad' },
  { key: 'xtensuz', label: 'Xtensuz' },
];

// ── Footer helper ──────────────────────────────────────────────────────────────

function applyFooters(
  doc: jsPDF,
  accent: [number, number, number],
  asesorWebSlug: string,
  pageWidth: number,
  pageHeight: number,
  margin: number
) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const lineY = pageHeight - 14;
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, lineY, pageWidth - margin, lineY);

    doc.setFontSize(5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(150, 150, 155);
    const nota = 'Cotizacion valida 15 dias. Aceptacion sujeta a politicas de suscripcion de la aseguradora. Coberturas segun Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
    const notaLines = doc.splitTextToSize(nota, pageWidth - margin * 2 - 30);
    let ny = lineY + 3;
    notaLines.forEach((line: string) => { doc.text(line, margin, ny); ny += 2.3; });

    doc.setFontSize(5);
    doc.setTextColor(170, 170, 175);
    doc.text(`Pag. ${p} / ${totalPages}`, pageWidth - margin, lineY + 3, { align: 'right' });

    if (asesorWebSlug) {
      doc.setFontSize(5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(`agentedeseguros.website/${asesorWebSlug}`, pageWidth - margin, lineY + 6.5, { align: 'right' });
    }

    doc.setFillColor(...accent);
    doc.rect(0, pageHeight - 1.5, pageWidth, 1.5, 'F');
  }
}

// ── Section heading ───────────────────────────────────────────────────────────

function drawSectionHeading(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  accent: [number, number, number]
) {
  doc.setFillColor(...accent);
  drawRoundedRect(doc, x, y, w, 7, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(text, x + 5, y + 4.8);
  return y + 10;
}

// ── Page guard ────────────────────────────────────────────────────────────────

function ensureSpace(doc: jsPDF, yPos: number, needed: number, pageHeight: number, margin: number): number {
  if (yPos + needed > pageHeight - 18) {
    doc.addPage();
    return margin;
  }
  return yPos;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  optionDefs?: MultiGmmOption[],
  logoUrl?: string,
  folio?: string
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 10;
  const cw         = pageWidth - margin * 2;

  const validOptions = results.filter(r => !r.result.error);
  const numOptions   = Math.min(validOptions.length, 3);

  if (numOptions === 0) {
    doc.setFontSize(12);
    doc.text('No hay opciones validas para generar PDF', margin, 30);
    return doc.output('blob');
  }

  // ── Branding ─────────────────────────────────────────────────────────────
  const accentHex  = usuario?.oficina?.accent_color || '#0E23E2';
  const accent     = hexToRgb(accentHex);
  const accentLight = lightenColor(accent, 0.92);
  const accentDark  = darkenColor(accent, 0.15);

  // Find best (lowest annual total) and highest coverage (most additional coverages)
  const bestIndex = validOptions.reduce((minIdx, opt, idx) => {
    const cur = safeNumber(opt.result.totals?.['Anual']?.total);
    const min = safeNumber(validOptions[minIdx]?.result.totals?.['Anual']?.total);
    return cur > 0 && (min <= 0 || cur < min) ? idx : minIdx;
  }, 0);

  const coverageCount = (opt: OptionResult, def?: MultiGmmOption) => {
    const covs = getOptionCoverages(opt, def);
    return Object.values(covs).filter(Boolean).length;
  };

  const mostCoverageIndex = validOptions.reduce((maxIdx, opt, idx) => {
    const def = optionDefs?.find(d => d.id === opt.option_id);
    const cur = coverageCount(opt, def);
    const max = coverageCount(validOptions[maxIdx], optionDefs?.find(d => d.id === validOptions[maxIdx].option_id));
    return cur > max ? idx : maxIdx;
  }, 0);

  const asesorNombre   = usuario?.nombre_publico || usuario?.nombre || 'Asesor';
  const asesorCelular  = usuario?.celular_laboral || usuario?.celular || '';
  const asesorWebSlug  = usuario?.web_slug || '';
  const asesorEmail    = usuario?.email_laboral || usuario?.email || '';

  // Build QR target URL: WhatsApp if phone available, otherwise web profile
  const qrTargetUrl = asesorWebSlug
    ? `https://agentedeseguros.website/${asesorWebSlug}`
    : asesorCelular
    ? `https://wa.me/52${asesorCelular.replace(/\D/g, '')}`
    : null;

  const qrApiUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrTargetUrl)}&format=png&margin=2`
    : null;

  // Preload images
  const [logoBase64, profileBase64, bxLogoBase64, bupaLogoBase64, qrBase64] = await Promise.all([
    logoUrl ? loadImageAsBase64(logoUrl) : Promise.resolve(null),
    usuario?.imagen_perfil_url ? loadImageAsBase64(usuario.imagen_perfil_url) : Promise.resolve(null),
    loadImageAsBase64('/logo-bx.png'),
    loadImageAsBase64('/logo-bupa.png'),
    qrApiUrl ? loadImageAsBase64(qrApiUrl) : Promise.resolve(null),
  ]);

  // ================================================================
  // PAGE 1: COVER
  // ================================================================

  // Full-height gradient strip left side (decorative)
  doc.setFillColor(...accentDark);
  doc.rect(0, 0, 18, pageHeight, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 0, 14, pageHeight, 'F');

  // Top accent bar
  doc.setFillColor(...accent);
  doc.rect(14, 0, pageWidth - 14, 6, 'F');

  // Logo area
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', 20, 18, 50, 22); } catch { /* skip */ }
  } else {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text(usuario?.oficina?.nombre || 'Seguros', 20, 34);
  }

  // Large title block
  const titleY = 55;
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 35, 45);
  doc.text('Propuesta', 20, titleY);
  doc.text('Comercial', 20, titleY + 12);

  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...accent);
  doc.text('Gastos Medicos Mayores', 20, titleY + 22);

  // Divider line
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(20, titleY + 26, 120, titleY + 26);

  // Client info card
  const ciY = titleY + 33;
  drawCard(doc, 20, ciY, pageWidth - 30, 32, {
    fillColor: accentLight,
    borderColor: lightenColor(accent, 0.7) as [number, number, number],
    radius: 4,
    shadow: false,
  });

  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('PREPARADO PARA', 26, ciY + 8);

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(25, 30, 40);
  doc.text(clientName || 'Cliente', 26, ciY + 17);

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(90, 95, 105);
  const infoItems: string[] = [];
  if (folio) infoItems.push(`Folio: ${folio}`);
  infoItems.push(`Fecha: ${formatDate(new Date())}`);
  infoItems.push('Vigencia cotizacion: 15 dias');
  doc.text(infoItems.join('   •   '), 26, ciY + 24);

  // Number of options badge
  const badgeY = ciY + 36;
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(80, 85, 95);
  doc.text(`${numOptions} opcion${numOptions > 1 ? 'es' : ''} de plan incluida${numOptions > 1 ? 's' : ''}`, 26, badgeY + 3);

  // Insurer logos on cover
  const logoSectionY = ciY + 44;
  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(130, 135, 145);
  doc.text('ASEGURADORAS EN ESTA PROPUESTA', 20, logoSectionY);

  const uniqueProducts = [...new Set(validOptions.map(o => o.product_id))];
  let logoX = 20;
  for (const pid of uniqueProducts) {
    const isB = pid === 'BXPLUS';
    const img = isB ? bxLogoBase64 : bupaLogoBase64;
    if (img) {
      try {
        doc.addImage(img, 'PNG', logoX, logoSectionY + 4, isB ? 22 : 28, 10);
        logoX += isB ? 30 : 36;
      } catch { /* skip */ }
    } else {
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(PRODUCT_LABELS[pid], logoX, logoSectionY + 11);
      logoX += 50;
    }
  }

  // QR code block
  if (qrBase64 && qrTargetUrl) {
    const qrSize = 30;
    const qrX = pageWidth - margin - qrSize;
    const qrBlockY = logoSectionY - 2;

    try {
      doc.addImage(qrBase64, 'PNG', qrX, qrBlockY, qrSize, qrSize);
    } catch { /* skip */ }

    doc.setFontSize(5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('ESCANEA PARA', qrX + qrSize / 2, qrBlockY + qrSize + 4, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 105, 115);
    const qrLabel = asesorWebSlug ? 'VER MI PERFIL' : 'CONTACTAR POR WHATSAPP';
    doc.text(qrLabel, qrX + qrSize / 2, qrBlockY + qrSize + 7.5, { align: 'center' });
  }

  // Advisor strip at bottom of cover
  const advisorStripY = pageHeight - 52;
  doc.setFillColor(...accent);
  drawRoundedRect(doc, 20, advisorStripY, pageWidth - 30, 38, 4, 'F');

  if (profileBase64) {
    try {
      doc.addImage(profileBase64, 'PNG', 25, advisorStripY + 5, 20, 20);
    } catch { /* skip */ }
  }

  const adX = profileBase64 ? 50 : 26;
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(200, 215, 255);
  doc.text('TU ASESOR DE CONFIANZA', adX, advisorStripY + 10);

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(asesorNombre, adX, advisorStripY + 19);

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(200, 215, 255);
  const contactParts: string[] = [];
  if (asesorCelular) contactParts.push(asesorCelular);
  if (asesorEmail) contactParts.push(asesorEmail);
  doc.text(contactParts.join('   |   '), adX, advisorStripY + 27);

  if (asesorWebSlug) {
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(200, 215, 255);
    doc.text(`agentedeseguros.website/${asesorWebSlug}`, adX, advisorStripY + 34);
  }

  // Bottom accent
  doc.setFillColor(...accent);
  doc.rect(0, pageHeight - 1.5, pageWidth, 1.5, 'F');

  // ================================================================
  // PAGE 2+: CONTENT PAGES
  // ================================================================
  doc.addPage();

  // Reusable page header (mini)
  function drawPageHeader(yP: number): number {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageWidth, 10, 'F');

    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', margin, 0.5, 18, 9); } catch { /* skip */ }
    }

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Propuesta Comercial GMM', pageWidth / 2, 6.5, { align: 'center' });

    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    const hparts: string[] = [];
    if (clientName) hparts.push(clientName);
    if (folio) hparts.push(`Folio: ${folio}`);
    doc.text(hparts.join('   |   '), pageWidth - margin, 6.5, { align: 'right' });

    return yP + 14;
  }

  let y = drawPageHeader(0);

  // ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────────

  y = drawSectionHeading(doc, 'RESUMEN EJECUTIVO', margin, y, cw, accent);

  const cardGap = 4;
  const cardW   = (cw - cardGap * (numOptions - 1)) / numOptions;
  const execCardH = 52;

  // Badge labels per option
  const badgeInfo: { label: string; icon: string; color: [number, number, number] }[] = validOptions.map((opt, i) => {
    const def = optionDefs?.find(d => d.id === opt.option_id);
    if (numOptions === 1) return { label: 'RECOMENDADO', icon: 'R', color: [22, 163, 74] };
    if (i === bestIndex) return { label: 'MEJOR PRECIO', icon: '$', color: [22, 163, 74] };
    if (i === mostCoverageIndex && i !== bestIndex) return { label: 'MAYOR PROTECCION', icon: '+', color: [7, 89, 133] };
    return { label: 'OPCION ' + opt.option_label, icon: 'i', color: [90, 100, 115] };
  });

  for (let i = 0; i < numOptions; i++) {
    const opt   = validOptions[i];
    const def   = optionDefs?.find(d => d.id === opt.option_id);
    const info  = getOptionPlanInfo(opt, def);
    const badge = badgeInfo[i];
    const cx    = margin + i * (cardW + cardGap);

    const isRecommended = numOptions === 1 || i === bestIndex;
    const borderColor: [number, number, number] = isRecommended ? badge.color : [210, 215, 225];
    const fillColor: [number, number, number]   = isRecommended ? lightenColor(badge.color, 0.93) : [252, 252, 255];

    drawCard(doc, cx, y, cardW, execCardH, { fillColor, borderColor, radius: 4 });

    // Colored top strip
    doc.setFillColor(...badge.color);
    drawRoundedRect(doc, cx, y, cardW, 10, 4, 'F');
    doc.setFillColor(...badge.color);
    doc.rect(cx, y + 6, cardW, 4, 'F');

    doc.setFontSize(6.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(badge.label, cx + cardW / 2, y + 6.5, { align: 'center' });

    // Option label
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(25, 30, 40);
    doc.text(opt.option_label, cx + 4, y + 16);

    // Product name + insurer logo
    const productLogoB64 = opt.product_id === 'BXPLUS' ? bxLogoBase64 : bupaLogoBase64;
    if (productLogoB64) {
      try {
        const lw = opt.product_id === 'BXPLUS' ? 14 : 18;
        doc.addImage(productLogoB64, 'PNG', cx + cardW - lw - 3, y + 11, lw, 7);
      } catch { /* skip */ }
    }

    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(90, 95, 105);
    doc.text(PRODUCT_LABELS[opt.product_id], cx + 4, y + 21);

    // Plan parameters
    doc.setFontSize(5.5);
    doc.setTextColor(70, 75, 85);
    const params = [
      `SA: ${formatAmountDisplay(info.suma_asegurada || '-')}`,
      `Deducible: ${formatAmountDisplay(info.deducible || '-')}`,
      `Coaseguro: ${formatCoaseguroDisplay(info.coaseguro || '-')}`,
    ];
    if (info.tope_coaseguro && info.tope_coaseguro !== '-') params.push(`Tope: ${info.tope_coaseguro}`);
    let paramY = y + 27;
    for (const p of params) {
      doc.text(p, cx + 4, paramY);
      paramY += 3.8;
    }

    // Annual total
    const total = safeNumber(opt.result.totals?.['Anual']?.total);
    const totalStr = formatCurrency(total);
    doc.setFontSize(9.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...badge.color);
    doc.text(totalStr, cx + 4, y + execCardH - 5);
    doc.setFontSize(5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(130, 135, 145);
    doc.text('anual c/IVA', cx + doc.getTextWidth(totalStr) + 6, y + execCardH - 5);
  }

  y += execCardH + 8;

  // ── ASEGURADOS ─────────────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 10 + people.length * 12, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);

  y = drawSectionHeading(doc, 'ASEGURADOS', margin, y, cw, accent);

  for (let pi = 0; pi < people.length; pi++) {
    const person = people[pi];
    const rowH = 12;
    y = ensureSpace(doc, y, rowH + 1, pageHeight, margin);
    if (y === margin) y = drawPageHeader(0);

    const fillC: [number, number, number] = pi % 2 === 0 ? [249, 250, 252] : [255, 255, 255];
    drawCard(doc, margin, y, cw, rowH, { fillColor: fillC, radius: 2, shadow: false });

    // Relation dot indicator
    const dotColor: [number, number, number] =
      person.relation === 'Titular'     ? accent :
      person.relation === 'Conyuge'     ? [16, 148, 148] :
      person.relation === 'Hijo'        ? [134, 60, 200] :
      [100, 100, 100];
    doc.setFillColor(...dotColor);
    doc.circle(margin + 4.5, y + rowH / 2, 2, 'F');

    // Name + meta
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(25, 30, 40);
    doc.text(person.name || `Asegurado ${pi + 1}`, margin + 9, y + 5);

    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(110, 115, 125);
    doc.text(`${person.relation}  •  ${person.gender}  •  ${person.age} años`, margin + 9, y + 9);

    // Primas per option
    const primaW = 28;
    for (let oi = 0; oi < numOptions; oi++) {
      const prima = getPersonPrima(validOptions[oi], pi);
      const ox = margin + cw - (numOptions - oi) * (primaW + 2);
      doc.setFontSize(5.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(formatCurrency(prima), ox + primaW, y + 5, { align: 'right' });

      doc.setFontSize(4.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(160, 165, 175);
      doc.text(validOptions[oi].option_label, ox + primaW, y + 9, { align: 'right' });
    }

    y += rowH + 1.5;
  }

  y += 5;

  // ── DETALLE DEL PLAN ────────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 50, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);

  y = drawSectionHeading(doc, 'DETALLE DE PLANES', margin, y, cw, accent);

  const planFields: { label: string; getter: (i: PlanInfo) => string }[] = [
    { label: 'Producto',         getter: i => i.producto },
    { label: 'Estado / Region',  getter: i => i.estado || i.region || '-' },
    { label: 'Nivel hospitalario', getter: i => i.nivel || '-' },
    { label: 'Suma asegurada',   getter: i => formatAmountDisplay(i.suma_asegurada) },
    { label: 'Deducible',        getter: i => formatAmountDisplay(i.deducible) },
    { label: 'Coaseguro',        getter: i => formatCoaseguroDisplay(i.coaseguro) },
    { label: 'Tope coaseguro',   getter: i => i.tope_coaseguro || '-' },
  ];

  const planHead = ['Caracteristica', ...validOptions.map(o => o.option_label)];
  const planBody = planFields.map(f => {
    return [f.label, ...validOptions.map(opt => {
      const def = optionDefs?.find(d => d.id === opt.option_id);
      return f.getter(getOptionPlanInfo(opt, def));
    })];
  });

  autoTable(doc, {
    startY: y,
    head: [planHead],
    body: planBody,
    theme: 'striped',
    styles: { fontSize: 6.5, cellPadding: 2.5, lineColor: [230, 232, 238], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: [50, 55, 70], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [247, 248, 252] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: [60, 65, 80] } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── COBERTURAS BASICAS ──────────────────────────────────────────────────────

  y = ensureSpace(doc, y, 50, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);

  y = drawSectionHeading(doc, 'COBERTURAS BASICAS INCLUIDAS', margin, y, cw, accent);

  const basicCoverages = [
    'Hospitalizacion', 'Honorarios medicos', 'Medicamentos en hospital',
    'Cirugia y anestesia', 'Analisis clinicos', 'Estudios de gabinete',
    'Ambulancias terrestre y aerea', 'Terapias fisicas', 'Enfermeria privada',
    'Urgencias por accidente', 'Urgencias por enfermedad', 'Gastos funerarios',
    'Segunda opinion medica',
  ];

  // Icon grid: 4 per row
  const icoCols = 4;
  const icoW    = cw / icoCols;
  const icoH    = 8;

  basicCoverages.forEach((cov, ci) => {
    const col   = ci % icoCols;
    const row   = Math.floor(ci / icoCols);
    const bx2   = margin + col * icoW;
    const by2   = y + row * (icoH + 1);

    if (by2 + icoH > pageHeight - 18) return; // skip if overflow (rare)

    doc.setFillColor(230, 255, 235);
    drawRoundedRect(doc, bx2 + 0.5, by2, icoW - 1, icoH, 2, 'F');

    doc.setFontSize(6);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 130, 60);
    doc.text('\u2713', bx2 + 3, by2 + 5.5);

    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(35, 40, 50);
    const txt = doc.splitTextToSize(cov, icoW - 11);
    doc.text(txt[0], bx2 + 8, by2 + 5.5);
  });

  const icoRows = Math.ceil(basicCoverages.length / icoCols);
  y += icoRows * (icoH + 1) + 8;

  // Note: all options include all basic coverages
  y = ensureSpace(doc, y, 6, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);
  doc.setFontSize(6);
  doc.setFont(undefined, 'italic');
  doc.setTextColor(100, 105, 115);
  doc.text('Todas las opciones incluyen las coberturas basicas listadas. Detalles en Condiciones Generales CNSF.', margin, y);
  y += 8;

  // ── COBERTURAS DIFERENCIALES ────────────────────────────────────────────────

  y = ensureSpace(doc, y, 20, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);

  y = drawSectionHeading(doc, 'COBERTURAS ADICIONALES Y DIFERENCIALES', margin, y, cw, accent);

  const covHead2 = ['Cobertura adicional', ...validOptions.map(o => o.option_label)];
  const covBody2: any[][] = [];

  for (const cob of COBERTURAS_ADICIONALES) {
    const row: any[] = [cob.label];
    let anyRelevant = false;
    for (let i = 0; i < numOptions; i++) {
      const def  = optionDefs?.find(d => d.id === validOptions[i].option_id);
      const covs = getOptionCoverages(validOptions[i], def);
      if (validOptions[i].product_id !== 'BXPLUS') {
        row.push('N/A');
      } else {
        const has = covs[cob.key] === true;
        if (has) anyRelevant = true;
        row.push(has ? 'SI' : 'NO');
      }
    }
    // Only include rows where at least one BX+ option exists
    const hasBx = validOptions.some(o => o.product_id === 'BXPLUS');
    if (hasBx) covBody2.push(row);
  }

  if (covBody2.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [covHead2],
      body: covBody2,
      theme: 'plain',
      styles: { fontSize: 6, cellPadding: 2, lineColor: [230, 232, 238], lineWidth: 0.1, valign: 'middle' },
      headStyles: { fillColor: [50, 55, 70], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'normal', fontSize: 6, textColor: [55, 60, 75] } },
      margin: { left: margin, right: margin },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index > 0) {
          const v = String(data.cell.raw);
          data.cell.styles.halign = 'center';
          data.cell.styles.fontSize = 7;
          data.cell.styles.fontStyle = 'bold';
          if (v === 'SI') {
            data.cell.styles.textColor = [22, 130, 60];
          } else if (v === 'NO') {
            data.cell.styles.textColor = [190, 50, 50];
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.fontSize = 6;
          } else {
            data.cell.styles.textColor = [180, 185, 195];
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.fontSize = 5.5;
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(6);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(130, 135, 145);
    doc.text('Las opciones presentadas no incluyen coberturas adicionales diferenciadas.', margin, y + 4);
    y += 10;
  }

  // ── DESCRIPCION DE COBERTURAS INCLUIDAS ─────────────────────────────────────

  const hasBxplus = validOptions.some(o => o.product_id === 'BXPLUS');
  if (hasBxplus) {
    const allCoverageKeys = new Set<string>();
    for (const opt of validOptions) {
      if (opt.product_id === 'BXPLUS') {
        const def  = optionDefs?.find(d => d.id === opt.option_id);
        const covs = getOptionCoverages(opt, def);
        Object.entries(covs).forEach(([k, v]) => { if (v) allCoverageKeys.add(k); });
      }
    }

    if (allCoverageKeys.size > 0) {
      y = ensureSpace(doc, y, 20, pageHeight, margin);
      if (y === margin) y = drawPageHeader(0);

      y = drawSectionHeading(doc, 'QUE INCLUYE CADA COBERTURA ADICIONAL', margin, y, cw, accent);

      for (const key of allCoverageKeys) {
        const label = COBERTURAS_ADICIONALES.find(c => c.key === key)?.label || key;
        const desc  = COVERAGE_PDF_TEXTS[key] || '';
        const descLines = doc.splitTextToSize(desc, cw - 12);
        const blockH = 4.5 + descLines.length * 3;

        y = ensureSpace(doc, y, blockH + 3, pageHeight, margin);
        if (y === margin) y = drawPageHeader(0);

        doc.setFillColor(...accentLight);
        drawRoundedRect(doc, margin, y, cw, blockH, 2, 'F');

        doc.setFontSize(6.5);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...accent);
        doc.text(`\u2022 ${label}`, margin + 3, y + 4.5);

        doc.setFontSize(5.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(70, 75, 85);
        let ty = y + 4.5 + 3.5;
        for (const line of descLines) {
          doc.text(line, margin + 5, ty);
          ty += 3;
        }

        y += blockH + 2.5;
      }
      y += 4;
    }
  }

  // ================================================================
  // PAGE: RESUMEN ECONOMICO
  // ================================================================

  doc.addPage();
  y = drawPageHeader(0);

  y = drawSectionHeading(doc, 'RESUMEN ECONOMICO', margin, y, cw, accent);

  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const formaLabels: Record<FormaPago, string> = {
    Anual: 'Anual',
    Semestral: 'Semestral (2 pagos)',
    Trimestral: 'Trimestral (4 pagos)',
    Mensual: 'Mensual (12 pagos)',
  };

  for (let i = 0; i < numOptions; i++) {
    const opt    = validOptions[i];
    const badge  = badgeInfo[i];
    const cardY  = y;

    y = ensureSpace(doc, y, 60, pageHeight, margin);
    if (y === margin) { y = drawPageHeader(0); }

    // Option header
    doc.setFillColor(...badge.color);
    drawRoundedRect(doc, margin, y, cw, 10, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${opt.option_label}  —  ${PRODUCT_LABELS[opt.product_id]}`, margin + 5, y + 6.5);
    doc.setFontSize(6);
    doc.text(badge.label, margin + cw - 5, y + 6.5, { align: 'right' });
    y += 13;

    // Prima neta breakdown (first breakdown row)
    const anualTotals = opt.result.totals?.['Anual'];
    if (anualTotals) {
      const breakdownRows: [string, string][] = [];
      if ('prima_neta' in anualTotals) breakdownRows.push(['Prima neta', formatCurrency((anualTotals as any).prima_neta)]);
      if ('recargo' in anualTotals) breakdownRows.push(['Recargo', formatCurrency((anualTotals as any).recargo)]);
      if ('gastos_expedicion' in anualTotals) breakdownRows.push(['Gastos de expedicion', formatCurrency((anualTotals as any).gastos_expedicion)]);
      if ('asistencia_extranjero' in anualTotals && (anualTotals as any).asistencia_extranjero > 0) breakdownRows.push(['Asistencia extranjero', formatCurrency((anualTotals as any).asistencia_extranjero)]);
      if ('catastrofica_extranjero' in anualTotals && (anualTotals as any).catastrofica_extranjero > 0) breakdownRows.push(['Catastrofica extranjero', formatCurrency((anualTotals as any).catastrofica_extranjero)]);
      if ('derecho_poliza' in anualTotals) breakdownRows.push(['Derecho de poliza', formatCurrency((anualTotals as any).derecho_poliza)]);
      if ('iva' in anualTotals) breakdownRows.push(['IVA (16%)', formatCurrency((anualTotals as any).iva)]);

      if (breakdownRows.length > 0) {
        autoTable(doc, {
          startY: y,
          body: breakdownRows,
          theme: 'plain',
          styles: { fontSize: 6, cellPadding: 1.8, lineColor: [235, 237, 242], lineWidth: 0.1 },
          columnStyles: {
            0: { cellWidth: 60, textColor: [80, 85, 95] },
            1: { halign: 'right', textColor: [40, 45, 55], fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 1;
      }
    }

    // Payment forms table
    const payRows: any[][] = [];
    for (const fp of formasPago) {
      const t = opt.result.totals?.[fp];
      if (!t) continue;
      const nr = (t as any).num_recibos || 1;
      let detail = formatCurrency(t.total);
      if (nr > 1) {
        const pp = (t as any).primer_pago || t.total;
        const ps = (t as any).pagos_subsecuentes || t.total;
        detail = `Total: ${formatCurrency(t.total)}\n1er pago: ${formatCurrency(pp)} / Subsec: ${formatCurrency(ps)}`;
      }
      payRows.push([formaLabels[fp], detail]);
    }

    autoTable(doc, {
      startY: y,
      head: [['Forma de pago', 'Importe']],
      body: payRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2.5, lineColor: [225, 228, 235], lineWidth: 0.15, overflow: 'linebreak' },
      headStyles: { fillColor: [240, 242, 248], textColor: [50, 55, 70], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold', textColor: [55, 60, 75] },
        1: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didParseCell(data) {
        if (data.section === 'body' && data.row.index === 0) {
          data.cell.styles.fillColor = lightenColor(badge.color, 0.92);
          if (data.column.index === 1) {
            data.cell.styles.textColor = badge.color;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 7.5;
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Advisor contact card ───────────────────────────────────────────────────

  y = ensureSpace(doc, y, 28, pageHeight, margin);
  if (y === margin) y = drawPageHeader(0);

  const acardH = 22;
  doc.setFillColor(...accent);
  drawRoundedRect(doc, margin, y, cw, acardH, 4, 'F');

  if (profileBase64) {
    try { doc.addImage(profileBase64, 'PNG', margin + 5, y + 3, 16, 16); } catch { /* skip */ }
  }

  const atx = profileBase64 ? margin + 25 : margin + 8;

  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(200, 215, 255);
  doc.text('TU ASESOR', atx, y + 7);

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(asesorNombre, atx, y + 14);

  doc.setFontSize(6.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(200, 215, 255);
  const cParts: string[] = [];
  if (asesorCelular) cParts.push(asesorCelular);
  if (asesorEmail)   cParts.push(asesorEmail);
  if (asesorWebSlug) cParts.push(`agentedeseguros.website/${asesorWebSlug}`);
  doc.text(cParts.join('   |   '), atx, y + 20);

  y += acardH + 8;

  // ── Apply footers to all pages ─────────────────────────────────────────────

  applyFooters(doc, accent, asesorWebSlug, pageWidth, pageHeight, margin);

  return doc.output('blob');
}
