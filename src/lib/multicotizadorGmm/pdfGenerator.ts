import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuotePerson, FormaPago, OptionResult, ProductId } from './types';
import { PRODUCT_LABELS } from './types';
import type { BxplusQuoteInput, BnvQuoteInput, BnpQuoteInput } from './types';
import { COVERAGE_PDF_TEXTS } from '../gmmCoverageHelp';

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

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
    Math.max(0, rgb[0] - Math.round(rgb[0] * amount)),
    Math.max(0, rgb[1] - Math.round(rgb[1] * amount)),
    Math.max(0, rgb[2] - Math.round(rgb[2] * amount)),
  ];
}

// ─────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────

function drawRoundedRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  r: number,
  style: 'S' | 'F' | 'FD' = 'FD'
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

function drawCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  opts?: {
    fillColor?: [number, number, number];
    borderColor?: [number, number, number];
    radius?: number;
    shadow?: boolean;
    lineWidth?: number;
  }
) {
  const r = opts?.radius ?? 3;
  const shadow = opts?.shadow ?? true;
  if (shadow) {
    doc.setFillColor(215, 215, 220);
    doc.setDrawColor(215, 215, 220);
    drawRoundedRect(doc, x + 0.4, y + 0.4, w, h, r, 'F');
  }
  doc.setFillColor(...(opts?.fillColor || [255, 255, 255]));
  doc.setDrawColor(...(opts?.borderColor || [220, 220, 228]));
  doc.setLineWidth(opts?.lineWidth ?? 0.2);
  drawRoundedRect(doc, x, y, w, h, r, 'FD');
}

function drawBadge(
  doc: jsPDF,
  x: number, y: number,
  text: string,
  bgColor: [number, number, number],
  textColor: [number, number, number],
  fontSize = 5
): number {
  const prev = doc.getFontSize();
  doc.setFontSize(fontSize);
  const tw = doc.getTextWidth(text);
  const bw = tw + 5;
  const bh = fontSize * 0.55 + 2;
  doc.setFillColor(...bgColor);
  drawRoundedRect(doc, x, y, bw, bh, bh / 2, 'F');
  doc.setFontSize(fontSize);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...textColor);
  doc.text(text, x + 2.5, y + bh - 1.1);
  doc.setFontSize(prev);
  return bw;
}

function drawAccentLine(
  doc: jsPDF,
  x: number, y: number, w: number,
  color: [number, number, number],
  thickness = 0.8
) {
  doc.setDrawColor(...color);
  doc.setLineWidth(thickness);
  doc.line(x, y, x + w, y);
}

function drawSectionLabel(
  doc: jsPDF,
  label: string,
  x: number, y: number,
  accent: [number, number, number]
) {
  // Left accent bar
  doc.setFillColor(...accent);
  doc.rect(x, y - 3, 1.5, 5.5, 'F');

  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text(label.toUpperCase(), x + 4, y + 1.5);
}

// ─────────────────────────────────────────────
// Business logic helpers
// ─────────────────────────────────────────────

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

const NIVEL_DISPLAY_MAP: Record<string, string> = {
  'Alto': 'Elite',
  'Medio': 'Plus',
  'Basico': 'Estandar',
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

function getOptionPlanInfo(opt: OptionResult, def?: MultiGmmOption): Record<string, string> {
  const input = def?.input;
  if (!input) return {};

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
    };
  } else {
    const bnp = input as BnpQuoteInput;
    return {
      producto: 'Bupa Nacional Plus',
      region: bnp.region_zone || '-',
      suma_asegurada: formatSumaMDP(bnp.suma_asegurada),
      deducible: formatDeducibleMiles(bnp.deducible),
      coaseguro: `${bnp.coaseguro || 0}%`,
    };
  }
}

function getOptionCoverages(opt: OptionResult, def?: MultiGmmOption): Record<string, boolean> {
  if (opt.product_id === 'BXPLUS' && def) {
    const bx = def.input as BxplusQuoteInput;
    return (bx.coverages || {}) as Record<string, boolean>;
  }
  return {};
}

function getPersonPrima(opt: OptionResult, idx: number): number {
  const pr = opt.result.people_results[idx];
  if (!pr) return 0;
  if ('prima_total' in pr) return (pr as any).prima_total || 0;
  if ('discounted_rate' in pr) return (pr as any).discounted_rate || 0;
  if ('annual_premium' in pr) return (pr as any).annual_premium || 0;
  return 0;
}

// ─────────────────────────────────────────────
// Footer (applied to every page at the end)
// ─────────────────────────────────────────────

function applyFooters(
  doc: jsPDF,
  accent: [number, number, number],
  webSlug: string,
  totalPages: number
) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cw = PW - margin * 2;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Thin separator
    doc.setDrawColor(210, 210, 218);
    doc.setLineWidth(0.15);
    doc.line(margin, PH - 14, PW - margin, PH - 14);

    // Legal note
    doc.setFontSize(4.2);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(155, 155, 160);
    const nota = 'Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion de cada aseguradora. Coberturas conforme a Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
    const noteLines = doc.splitTextToSize(nota, cw - 28);
    let ny = PH - 11.5;
    for (const line of noteLines) {
      doc.text(line, margin, ny);
      ny += 2.3;
    }

    // Page number
    doc.setFontSize(5);
    doc.setTextColor(170, 170, 175);
    doc.text(`${p} / ${totalPages}`, PW - margin, PH - 10, { align: 'right' });

    // Web slug
    if (webSlug) {
      doc.setFontSize(5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(`agentedeseguros.website/${webSlug}`, PW - margin, PH - 6, { align: 'right' });
    }

    // Bottom accent bar
    doc.setFillColor(...accent);
    doc.rect(0, PH - 1.5, PW, 1.5, 'F');
  }
}

// ─────────────────────────────────────────────
// PAGE HEADER (accent band + logo + folio)
// ─────────────────────────────────────────────

function drawPageHeader(
  doc: jsPDF,
  accent: [number, number, number],
  logoBase64: string | null,
  title: string,
  subtitle: string
): number {
  const PW = doc.internal.pageSize.getWidth();
  const headerH = 18;

  // Gradient-like header: fill + slightly lighter right portion
  doc.setFillColor(...accent);
  doc.rect(0, 0, PW, headerH, 'F');

  // Subtle right fade strip
  const lighter = lightenColor(accent, 0.18);
  doc.setFillColor(...lighter);
  doc.rect(PW * 0.55, 0, PW * 0.45, headerH, 'F');

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 10, 2.5, 24, 13);
    } catch { /* skip */ }
  }

  // Title
  doc.setFontSize(11.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  const titleX = logoBase64 ? 38 : 10;
  doc.text(title, titleX, 9);

  // Subtitle
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
  doc.text(subtitle, titleX, 14.5);
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  return headerH;
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

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
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 10;          // margin
  const CW = PW - M * 2; // content width
  const FOOTER_RESERVE = 16;

  const validOptions = results.filter(r => !r.result.error);
  const N = Math.min(validOptions.length, 4);

  if (N === 0) {
    doc.setFontSize(11);
    doc.text('No hay opciones validas para generar PDF.', M, 30);
    return doc.output('blob');
  }

  // Branding colors
  const accentHex = usuario?.oficina?.accent_color || '#0E23E2';
  const accent = hexToRgb(accentHex);
  const accentLight = lightenColor(accent, 0.92);
  const accentMid = lightenColor(accent, 0.72);
  const accentDark = darkenColor(accent, 0.12);

  // Load logo
  const logoBase64 = logoUrl ? await loadImageAsBase64(logoUrl) : null;

  // Asesor data
  const asesorNombre = usuario?.nombre_publico || usuario?.nombre || 'Tu Asesor';
  const asesorCelular = usuario?.celular_laboral || usuario?.celular || '';
  const asesorEmail = usuario?.email_laboral || usuario?.email || '';
  const asesorWebSlug = usuario?.web_slug || '';

  // Load advisor profile image
  const profileBase64 = usuario?.imagen_perfil_url
    ? await loadImageAsBase64(usuario.imagen_perfil_url)
    : null;

  // Best option: lowest annual total
  const bestIdx = validOptions.reduce((minI, opt, i) => {
    const cur = safeNumber(opt.result.totals?.['Anual']?.total);
    const best = safeNumber(validOptions[minI]?.result.totals?.['Anual']?.total);
    return cur > 0 && (best <= 0 || cur < best) ? i : minI;
  }, 0);

  // Highest suma asegurada option
  const highestSAIdx = (() => {
    let maxSA = -1, idx = -1;
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === validOptions[i].option_id);
      const info = getOptionPlanInfo(validOptions[i], def);
      const raw = info.suma_asegurada || '-';
      let num = 0;
      if (raw.includes('$')) {
        num = parseFloat(raw.replace(/[$,\s]/g, ''));
      } else {
        num = parseFloat(raw.replace(/,/g, '')) || 0;
      }
      if (num > maxSA) { maxSA = num; idx = i; }
    }
    return idx;
  })();

  // Card gap + width utility
  const cardGap = 3;
  const cardW = (CW - cardGap * (N - 1)) / N;

  // ══════════════════════════════════════════════════
  // PAGE 1 — Executive Cover
  // ══════════════════════════════════════════════════

  const subtitleP1Parts: string[] = [];
  if (folio) subtitleP1Parts.push(`Folio ${folio}`);
  subtitleP1Parts.push(formatDate(new Date()));
  subtitleP1Parts.push('Vigencia 15 dias');

  let yPos = drawPageHeader(
    doc, accent, logoBase64,
    'Propuesta Comercial · Gastos Medicos Mayores',
    subtitleP1Parts.join('  ·  ')
  );
  yPos += 5;

  // ── Client info strip
  drawCard(doc, M, yPos, CW, 11, {
    fillColor: accentLight,
    borderColor: accentMid,
    radius: 3,
    shadow: false,
  });
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('CLIENTE', M + 4, yPos + 4.5);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(22, 22, 30);
  doc.text(clientName || 'Sin nombre', M + 22, yPos + 4.8);

  if (people.length > 0) {
    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(90, 90, 100);
    const personSummary = people.map(p => `${p.name} (${p.age} a.)`).join(' · ');
    doc.text(personSummary, M + 22, yPos + 8.8);
  }
  yPos += 15;

  // ── Option cards (per option)
  const optCardH = 34;

  for (let i = 0; i < N; i++) {
    const opt = validOptions[i];
    const def = optionDefs?.find(d => d.id === opt.option_id);
    const info = getOptionPlanInfo(opt, def);
    const cx = M + i * (cardW + cardGap);
    const isBest = i === bestIdx;
    const isHighSA = i === highestSAIdx && highestSAIdx !== bestIdx;

    const fillBg: [number, number, number] = isBest ? accentLight : [252, 252, 255];
    const borderC: [number, number, number] = isBest ? accent : [210, 215, 225];

    drawCard(doc, cx, yPos, cardW, optCardH, {
      fillColor: fillBg, borderColor: borderC, radius: 4,
      lineWidth: isBest ? 0.5 : 0.2,
    });

    // Top accent stripe on best card
    if (isBest) {
      doc.setFillColor(...accent);
      doc.roundedRect(cx, yPos, cardW, 3, 4, 4, 'F');
      doc.rect(cx, yPos + 1.5, cardW, 1.5, 'F');
    }

    let textY = yPos + (isBest ? 6 : 4.5);
    const textX = cx + 4;

    // Option label
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 22, 30);
    doc.text(opt.option_label, textX, textY);
    textY += 4.5;

    // Product badge
    drawBadge(doc, textX, textY, PRODUCT_LABELS[opt.product_id] || opt.product_id, accent, [255, 255, 255], 4.8);
    textY += 5;

    // Status badges
    if (isBest) {
      drawBadge(doc, textX, textY, '★ MEJOR PRECIO', [22, 163, 74], [255, 255, 255], 4.8);
      textY += 5;
    } else if (isHighSA) {
      drawBadge(doc, textX, textY, '↑ MAYOR COBERTURA', [14, 116, 144], [255, 255, 255], 4.8);
      textY += 5;
    } else if (N >= 3 && i === Math.floor(N / 2) && !isBest) {
      drawBadge(doc, textX, textY, '✦ RECOMENDADA', [180, 80, 0], [255, 255, 255], 4.8);
      textY += 5;
    }

    // Key plan specs
    const specs: [string, string][] = [
      ['SA', formatAmountDisplay(info.suma_asegurada || '-')],
      ['Deducible', formatAmountDisplay(info.deducible || '-')],
      ['Coaseguro', formatCoaseguroDisplay(info.coaseguro || '-')],
    ];
    if (info.nivel && info.nivel !== '-') specs.push(['Nivel', info.nivel]);
    if (info.region && info.region !== '-') specs.push(['Region', info.region]);

    doc.setFontSize(5.3);
    for (const [label, val] of specs) {
      if (textY > yPos + optCardH - 9) break;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(110, 110, 120);
      doc.text(`${label}:`, textX, textY);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 30, 40);
      doc.text(val, textX + 16, textY);
      textY += 3.3;
    }

    // Annual total (prominent)
    const total = safeNumber(opt.result.totals?.['Anual']?.total);
    const totalStr = formatCurrency(total);
    doc.setFontSize(9.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...(isBest ? accent : accentDark));
    doc.text(totalStr, textX, yPos + optCardH - 3);
    const totalW = doc.getTextWidth(totalStr);
    doc.setFontSize(5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(130, 130, 140);
    doc.text('/ anual', textX + totalW + 1, yPos + optCardH - 3);
  }

  yPos += optCardH + 6;

  // ── Resumen rapido (quick-glance annualized comparison)
  drawSectionLabel(doc, 'Resumen Rapido', M, yPos + 2, accent);
  yPos += 7;

  const summaryHead = ['', ...validOptions.slice(0, N).map(o => o.option_label)];
  const summaryRows: string[][] = [
    ['Prima neta anual', ...validOptions.slice(0, N).map(o => formatCurrency(safeNumber(o.result.totals?.['Anual']?.prima_neta)))],
    ['IVA', ...validOptions.slice(0, N).map(o => formatCurrency(safeNumber(o.result.totals?.['Anual']?.iva)))],
    ['Total anual', ...validOptions.slice(0, N).map(o => formatCurrency(safeNumber(o.result.totals?.['Anual']?.total)))],
    ['Mensual aprox.', ...validOptions.slice(0, N).map(o => {
      const t = o.result.totals?.['Mensual'];
      return t ? formatCurrency(safeNumber((t as any).primer_pago || t.total)) : '-';
    })],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [summaryHead],
    body: summaryRows,
    theme: 'plain',
    styles: { fontSize: 6, cellPadding: 2.2, lineColor: [225, 225, 232], lineWidth: 0.12, valign: 'middle' },
    headStyles: { fillColor: [38, 38, 48], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.8, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 247, 252] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32, textColor: [60, 60, 70] } },
    margin: { left: M, right: M },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
        if (data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 7;
          data.cell.styles.textColor = accent as any;
          data.cell.styles.fillColor = accentLight;
        }
        if (data.row.index === 3) {
          data.cell.styles.textColor = [80, 80, 90] as any;
          data.cell.styles.fontStyle = 'italic';
        }
      }
      if (data.section === 'head' && data.column.index > 0 && data.column.index - 1 === bestIdx) {
        data.cell.styles.fillColor = accent as any;
        data.cell.styles.textColor = [255, 255, 255] as any;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // ── Insured persons compact table
  if (people.length > 0) {
    if (yPos > PH - FOOTER_RESERVE - 30) {
      doc.addPage();
      yPos = M + 2;
    }

    drawSectionLabel(doc, 'Asegurados', M, yPos + 2, accent);
    yPos += 7;

    const personHead = ['Nombre', 'Parentesco', 'Genero', 'Edad', ...validOptions.slice(0, N).map(o => o.option_label)];
    const personRows: any[][] = people.map((p, pi) => [
      p.name || `Asegurado ${pi + 1}`,
      p.relation,
      p.gender,
      `${p.age} a.`,
      ...validOptions.slice(0, N).map(o => formatCurrency(getPersonPrima(o, pi))),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [personHead],
      body: personRows,
      theme: 'plain',
      styles: { fontSize: 5.8, cellPadding: 2, lineColor: [225, 225, 232], lineWidth: 0.12, valign: 'middle' },
      headStyles: { fillColor: accent as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 34 },
        3: { halign: 'center', cellWidth: 10 },
      },
      margin: { left: M, right: M },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index >= 4) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = accent as any;
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // ══════════════════════════════════════════════════
  // PAGE 2 — Plan Details & Coverages
  // ══════════════════════════════════════════════════

  doc.addPage();
  yPos = M;

  // Minimal repeating header
  doc.setFillColor(...accent);
  doc.rect(0, 0, PW, 8, 'F');
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Comparativa de Planes  ·  Gastos Medicos Mayores', M, 5.5);
  if (clientName) {
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text(clientName, PW - M, 5.5, { align: 'right' });
  }
  yPos = 13;

  // ── Plan characteristics comparison
  drawSectionLabel(doc, 'Caracteristicas del Plan', M, yPos + 2, accent);
  yPos += 7;

  const planFields: { label: string; getter: (opt: OptionResult) => string }[] = [
    { label: 'Producto', getter: o => PRODUCT_LABELS[o.product_id] || o.product_id },
    {
      label: 'Estado / Region',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        const info = getOptionPlanInfo(o, d);
        return info.estado || info.region || '-';
      },
    },
    {
      label: 'Nivel Hospitalario',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        return getOptionPlanInfo(o, d).nivel || '-';
      },
    },
    {
      label: 'Suma Asegurada',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        return formatAmountDisplay(getOptionPlanInfo(o, d).suma_asegurada || '-');
      },
    },
    {
      label: 'Deducible',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        return formatAmountDisplay(getOptionPlanInfo(o, d).deducible || '-');
      },
    },
    {
      label: 'Coaseguro',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        return formatCoaseguroDisplay(getOptionPlanInfo(o, d).coaseguro || '-');
      },
    },
    {
      label: 'Tope Coaseguro',
      getter: o => {
        const d = optionDefs?.find(dd => dd.id === o.option_id);
        return getOptionPlanInfo(o, d).tope_coaseguro || '-';
      },
    },
  ];

  const planHead = ['Caracteristica', ...validOptions.slice(0, N).map(o => o.option_label)];
  const planBody = planFields.map(f => [f.label, ...validOptions.slice(0, N).map(o => f.getter(o))]);

  autoTable(doc, {
    startY: yPos,
    head: [planHead],
    body: planBody,
    theme: 'striped',
    styles: { fontSize: 6, cellPadding: 2.2, lineColor: [225, 225, 232], lineWidth: 0.12, valign: 'middle' },
    headStyles: { fillColor: [32, 32, 44], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.8, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 247, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38, textColor: [50, 50, 60] } },
    margin: { left: M, right: M },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'center';
      }
      // Highlight best option column header
      if (data.section === 'head' && data.column.index > 0 && data.column.index - 1 === bestIdx) {
        data.cell.styles.fillColor = accent as any;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 6;

  // ── BX+ Additional coverages
  drawSectionLabel(doc, 'Coberturas Adicionales', M, yPos + 2, accent);
  yPos += 7;

  const covHead = ['Cobertura', ...validOptions.slice(0, N).map(o => o.option_label)];
  const covBody: any[][] = COBERTURAS_ADICIONALES.map(cob => {
    const row: string[] = [cob.label];
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === validOptions[i].option_id);
      const covs = getOptionCoverages(validOptions[i], def);
      if (validOptions[i].product_id !== 'BXPLUS') {
        row.push('—');
      } else {
        row.push(covs[cob.key] === true ? '✓' : '·');
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: yPos,
    head: [covHead],
    body: covBody,
    theme: 'plain',
    styles: { fontSize: 5.8, cellPadding: 1.8, lineColor: [228, 228, 235], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: accent as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5, halign: 'center' },
    alternateRowStyles: { fillColor: [250, 250, 255] },
    columnStyles: { 0: { cellWidth: 50, fontSize: 5.8, textColor: [55, 55, 65] } },
    margin: { left: M, right: M },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'center';
        data.cell.styles.fontSize = 7.5;
        const v = String(data.cell.raw);
        if (v === '✓') {
          data.cell.styles.textColor = [22, 163, 74] as any;
          data.cell.styles.fontStyle = 'bold';
        } else if (v === '·') {
          data.cell.styles.textColor = [200, 55, 55] as any;
          data.cell.styles.fontSize = 10;
        } else {
          data.cell.styles.textColor = [185, 185, 195] as any;
          data.cell.styles.fontSize = 6;
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 6;

  // ── Glossary microcopy (compact)
  if (yPos < PH - FOOTER_RESERVE - 30) {
    drawSectionLabel(doc, 'Glosario', M, yPos + 2, accent);
    yPos += 7;

    const glossary = [
      ['Suma Asegurada', 'Limite maximo que la aseguradora cubre por evento o anualidad.'],
      ['Deducible', 'Cantidad a cargo del asegurado antes de que inicie la cobertura.'],
      ['Coaseguro', 'Porcentaje del gasto medico que corre a cargo del asegurado despues del deducible.'],
      ['Tope de Coaseguro', 'Monto maximo de coaseguro que pagara el asegurado por evento.'],
      ['Derecho de Poliza', 'Costo fijo administrativo que se suma a la prima.'],
    ];

    doc.setFontSize(5.3);
    let glossY = yPos;
    for (const [term, def] of glossary) {
      if (glossY > PH - FOOTER_RESERVE - 8) break;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 50);
      doc.text(`${term}:`, M + 2, glossY);
      const termW = doc.getTextWidth(`${term}:`);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(90, 90, 100);
      const defLines = doc.splitTextToSize(def, CW - termW - 8);
      doc.text(defLines[0] || '', M + 2 + termW + 2, glossY);
      glossY += 3.5;
    }
    yPos = glossY + 2;
  }

  // ══════════════════════════════════════════════════
  // PAGE 3 — Payment Forms, Recommendation, Advisor
  // ══════════════════════════════════════════════════

  doc.addPage();
  yPos = M;

  // Minimal repeating header
  doc.setFillColor(...accent);
  doc.rect(0, 0, PW, 8, 'F');
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Formas de Pago & Recomendacion  ·  Gastos Medicos Mayores', M, 5.5);
  if (clientName) {
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text(clientName, PW - M, 5.5, { align: 'right' });
  }
  yPos = 13;

  // ── Payment breakdown cards
  drawSectionLabel(doc, 'Formas de Pago', M, yPos + 2, accent);
  yPos += 7;

  const formas: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const formaIcons: Record<FormaPago, string> = {
    Anual: '1 pago',
    Semestral: '2 pagos',
    Trimestral: '4 pagos',
    Mensual: '12 pagos',
  };

  const payHead = ['Forma de Pago', ...validOptions.slice(0, N).map(o => o.option_label)];
  const payBody: string[][] = formas.map(fp => {
    const fpLabel = `${fp} (${formaIcons[fp]})`;
    const cols = validOptions.slice(0, N).map(o => {
      const t = o.result.totals?.[fp];
      if (!t) return '-';
      const nr = (t as any).num_recibos || 1;
      if (nr > 1) {
        const p1 = (t as any).primer_pago || t.total;
        const ps = (t as any).pagos_subsecuentes || t.total;
        return `Total: ${formatCurrency(t.total)}\n1er pago: ${formatCurrency(p1)}\nSubsec.: ${formatCurrency(ps)}`;
      }
      return formatCurrency(t.total);
    });
    return [fpLabel, ...cols];
  });

  autoTable(doc, {
    startY: yPos,
    head: [payHead],
    body: payBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 2.5, lineColor: [212, 215, 224], lineWidth: 0.15, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [32, 32, 44], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.8, halign: 'center' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32, textColor: [50, 50, 60] } },
    margin: { left: M, right: M },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
      // Anual row highlighted
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.fillColor = accentLight;
        if (data.column.index === 0) {
          data.cell.styles.textColor = accent as any;
        } else {
          data.cell.styles.textColor = accent as any;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 6.5;
        }
      }
      // Best column header
      if (data.section === 'head' && data.column.index > 0 && data.column.index - 1 === bestIdx) {
        data.cell.styles.fillColor = accent as any;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // ── Nuestra Recomendacion block
  if (yPos < PH - FOOTER_RESERVE - 45) {
    const recCardH = 28;
    drawCard(doc, M, yPos, CW, recCardH, {
      fillColor: accentLight,
      borderColor: accentMid,
      radius: 4,
      shadow: false,
    });

    // Left bar
    doc.setFillColor(...accent);
    doc.roundedRect(M, yPos, 2.5, recCardH, 1, 1, 'F');

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('NUESTRA RECOMENDACION', M + 7, yPos + 6);

    // Recommended option name
    const recOpt = validOptions[bestIdx];
    const recTotal = safeNumber(recOpt?.result.totals?.['Anual']?.total);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 22, 30);
    doc.text(recOpt?.option_label || '-', M + 7, yPos + 12);

    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(70, 70, 80);
    const recDef = optionDefs?.find(d => d.id === recOpt?.option_id);
    const recInfo = getOptionPlanInfo(recOpt, recDef);

    const recText = `Con una suma asegurada de ${formatAmountDisplay(recInfo.suma_asegurada || '-')}, deducible de ${formatAmountDisplay(recInfo.deducible || '-')} y coaseguro del ${formatCoaseguroDisplay(recInfo.coaseguro || '-')}, esta opcion ofrece la mejor relacion precio-cobertura para ${clientName || 'su familia'}. Prima anual total: ${formatCurrency(recTotal)}.`;
    const recLines = doc.splitTextToSize(recText, CW - 16);
    let recY = yPos + 17;
    for (const line of recLines) {
      if (recY > yPos + recCardH - 3) break;
      doc.text(line, M + 7, recY);
      recY += 3.2;
    }

    yPos += recCardH + 7;
  }

  // ── Advisor card (CTA)
  const advisorCardH = 22;
  if (yPos > PH - FOOTER_RESERVE - advisorCardH - 5) {
    doc.addPage();
    yPos = M + 2;
  }

  drawCard(doc, M, yPos, CW, advisorCardH, {
    fillColor: [252, 252, 255],
    borderColor: accentMid,
    radius: 4,
  });

  // Left accent bar
  doc.setFillColor(...accent);
  doc.roundedRect(M, yPos, 2.5, advisorCardH, 1, 1, 'F');

  // Advisor photo
  let photoX = M + CW - 18;
  if (profileBase64) {
    try {
      const imgSize = 17;
      doc.addImage(profileBase64, 'PNG', photoX, yPos + 2.5, imgSize, imgSize);
      // Subtle circular border effect
      doc.setDrawColor(...accentMid);
      doc.setLineWidth(0.4);
      doc.circle(photoX + imgSize / 2, yPos + 2.5 + imgSize / 2, imgSize / 2, 'S');
    } catch { /* skip */ }
  }

  const adX = M + 7;
  doc.setFontSize(5.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('TU ASESOR DE CONFIANZA', adX, yPos + 5.5);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(18, 18, 26);
  doc.text(asesorNombre, adX, yPos + 11.5);

  doc.setFontSize(5.8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(75, 75, 88);
  let adY = yPos + 15.5;
  if (asesorCelular) {
    doc.text(`Tel: ${asesorCelular}`, adX, adY);
    adY += 3;
  }
  if (asesorEmail) {
    doc.text(asesorEmail, adX, adY);
    adY += 3;
  }
  if (asesorWebSlug) {
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text(`agentedeseguros.website/${asesorWebSlug}`, adX, adY);
  }

  yPos += advisorCardH + 5;

  // ── CTA strip
  if (yPos < PH - FOOTER_RESERVE - 12) {
    doc.setFillColor(...accent);
    doc.roundedRect(M, yPos, CW, 10, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('¿Listo para proteger a tu familia?  Contacta a tu asesor hoy mismo.', PW / 2, yPos + 6.5, { align: 'center' });
  }

  // ─────────────────────────────────────────────
  // BX+ Coverage descriptions (additional pages if needed)
  // ─────────────────────────────────────────────
  const hasBxplus = validOptions.some(o => o.product_id === 'BXPLUS');
  if (hasBxplus) {
    const allCovKeys = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (validOptions[i].product_id === 'BXPLUS') {
        const def = optionDefs?.find(d => d.id === validOptions[i].option_id);
        const covs = getOptionCoverages(validOptions[i], def);
        Object.entries(covs).forEach(([k, v]) => { if (v) allCovKeys.add(k); });
      }
    }

    if (allCovKeys.size > 0) {
      doc.addPage();
      let cy = M;

      doc.setFillColor(...accent);
      doc.rect(0, 0, PW, 8, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Descripcion de Coberturas Adicionales BX+ Unikuz', M, 5.5);
      cy = 13;

      drawSectionLabel(doc, 'Coberturas Incluidas en su Cotizacion', M, cy + 2, accent);
      cy += 8;

      for (const key of allCovKeys) {
        const labelEntry = COBERTURAS_ADICIONALES.find(c => c.key === key);
        const label = labelEntry?.label || key;
        const desc = COVERAGE_PDF_TEXTS[key] || 'Cobertura adicional conforme a condiciones de la poliza.';

        if (cy > PH - FOOTER_RESERVE - 12) {
          doc.addPage();
          cy = M;
        }

        // Coverage entry
        drawCard(doc, M, cy, CW, 14, {
          fillColor: accentLight,
          borderColor: accentMid,
          radius: 2,
          shadow: false,
          lineWidth: 0.15,
        });

        doc.setFillColor(...accent);
        doc.rect(M, cy, 1.5, 14, 'F');

        doc.setFontSize(6.5);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(22, 22, 30);
        doc.text(label, M + 5, cy + 5);

        doc.setFontSize(5.2);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 90);
        const descLines = doc.splitTextToSize(desc, CW - 8);
        let dy = cy + 9;
        for (const line of descLines) {
          if (dy > cy + 13) break;
          doc.text(line, M + 5, dy);
          dy += 2.5;
        }

        cy += 16;
      }
    }
  }

  // Apply footers to all pages
  applyFooters(doc, accent, asesorWebSlug, doc.getNumberOfPages());

  return doc.output('blob');
}
