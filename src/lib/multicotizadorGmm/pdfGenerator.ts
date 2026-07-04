import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuotePerson, FormaPago, OptionResult, ProductId } from './types';
import { PRODUCT_LABELS } from './types';
import type { BxplusQuoteInput, BnvQuoteInput, BnpQuoteInput } from './types';
import { COVERAGE_PDF_TEXTS } from '../gmmCoverageHelp';

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function fmt(value: number | null | undefined): string {
  const n = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function safe(value: any, def = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return !isNaN(n) && isFinite(n) ? n : def;
}

interface MultiGmmOption {
  id: string;
  label: string;
  product_id: ProductId;
  input: BxplusQuoteInput | BnvQuoteInput | BnpQuoteInput;
}

async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise(r => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result as string);
      fr.onerror = () => r(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return [isNaN(r) ? 14 : r, isNaN(g) ? 35 : g, isNaN(b) ? 226 : b];
}

function lighten(rgb: [number, number, number], a: number): [number, number, number] {
  return [
    Math.min(255, rgb[0] + Math.round((255 - rgb[0]) * a)),
    Math.min(255, rgb[1] + Math.round((255 - rgb[1]) * a)),
    Math.min(255, rgb[2] + Math.round((255 - rgb[2]) * a)),
  ];
}

function darken(rgb: [number, number, number], a: number): [number, number, number] {
  return [
    Math.max(0, rgb[0] - Math.round(rgb[0] * a)),
    Math.max(0, rgb[1] - Math.round(rgb[1] * a)),
    Math.max(0, rgb[2] - Math.round(rgb[2] * a)),
  ];
}

// ─────────────────────────────────────────────
// Low-level draw primitives
// ─────────────────────────────────────────────

function rrect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: 'S'|'F'|'FD' = 'FD') {
  doc.roundedRect(x, y, w, h, r, r, style);
}

/** White card with subtle drop shadow */
function card(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  opts?: { fill?: [number,number,number]; border?: [number,number,number]; r?: number; lw?: number; shadow?: boolean }
) {
  const r = opts?.r ?? 3;
  if (opts?.shadow !== false) {
    doc.setFillColor(210, 212, 220);
    rrect(doc, x + 0.5, y + 0.5, w, h, r, 'F');
  }
  doc.setFillColor(...(opts?.fill ?? [255, 255, 255]));
  doc.setDrawColor(...(opts?.border ?? [218, 220, 230]));
  doc.setLineWidth(opts?.lw ?? 0.2);
  rrect(doc, x, y, w, h, r, 'FD');
}

/** Filled pill badge; returns badge width */
function badge(
  doc: jsPDF,
  x: number, y: number,
  text: string,
  bg: [number,number,number],
  fg: [number,number,number],
  fs = 4.8
): number {
  const prev = doc.getFontSize();
  doc.setFontSize(fs);
  const tw = doc.getTextWidth(text);
  const bw = tw + 5; const bh = fs * 0.54 + 2.2;
  doc.setFillColor(...bg);
  rrect(doc, x, y, bw, bh, bh / 2, 'F');
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...fg);
  doc.text(text, x + 2.5, y + bh - 1.1);
  doc.setFontSize(prev);
  return bw;
}

/** Left-accented section label */
function sectionLabel(doc: jsPDF, label: string, x: number, y: number, accent: [number,number,number]) {
  doc.setFillColor(...accent);
  doc.rect(x, y - 3.2, 1.8, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text(label.toUpperCase(), x + 4.5, y + 1.5);
}

/** Thin horizontal rule */
function rule(doc: jsPDF, x: number, y: number, w: number, color: [number,number,number] = [220,222,230]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.15);
  doc.line(x, y, x + w, y);
}

// ─────────────────────────────────────────────
// Business logic helpers
// ─────────────────────────────────────────────

const COBERTURAS = [
  { key: 'reconocimiento_antiguedad',     label: 'Reconocimiento de antiguedad' },
  { key: 'medicamentos_fuera',            label: 'Medicamentos ambulatorios' },
  { key: 'complicaciones_no_amparadas',   label: 'Complicaciones no amparadas' },
  { key: 'padecimientos_preexistentes',   label: 'Padecimientos preexistentes' },
  { key: 'eliminacion_deducible_accidente', label: 'Sin deducible por accidente' },
  { key: 'multiregion',                   label: 'Multiregion' },
  { key: 'vip',                           label: 'Beneficio VIP' },
  { key: 'emergencia_medica_extranjero',  label: 'Emergencias en el extranjero' },
  { key: 'enfermedades_graves_extranjero', label: 'Enf. graves en extranjero' },
  { key: 'cobertura_internacional',       label: 'Cobertura internacional' },
  { key: 'ampliacion_servicios',          label: 'Ampliacion de servicios' },
  { key: 'ayuda_diaria',                  label: 'Ayuda diaria hospitalizacion' },
  { key: 'indemnizacion_eg',              label: 'Indemnizacion enf. graves' },
  { key: 'maternidad',                    label: 'Maternidad' },
  { key: 'xtensuz',                       label: 'Xtensuz' },
];

const NIVEL_MAP: Record<string, string> = { Alto: 'Elite', Medio: 'Plus', Basico: 'Estandar' };

function fmtSA(val: number) { return val ? fmt(val * 1_000_000) : '-'; }
function fmtDed(val: number) { return val ? fmt(val * 1_000) : '-'; }
function fmtTope(val: number) { return val ? fmt(val) : 'Sin tope'; }
function fmtCoas(val: string) {
  if (!val || val === '-') return '-';
  if (val.includes('%')) return val;
  const n = parseFloat(val);
  if (!isNaN(n) && n < 1) return `${(n * 100).toFixed(0)}%`;
  if (!isNaN(n)) return `${n}%`;
  return val;
}
function fmtAmt(val: string) {
  if (!val || val === '-') return '-';
  if (val.includes('$')) return val;
  const n = parseFloat(val.replace(/,/g, ''));
  return !isNaN(n) ? fmt(n) : val;
}

function planInfo(opt: OptionResult, def?: MultiGmmOption): Record<string, string> {
  const inp = def?.input;
  if (!inp) return {};
  if (opt.product_id === 'BXPLUS') {
    const bx = inp as BxplusQuoteInput;
    return {
      producto: 'BX+ Unikuz',
      estado: bx.estado || '-',
      nivel: NIVEL_MAP[bx.nivel_hospitalario] || bx.nivel_hospitalario || '-',
      tabulador: bx.tabulador || '-',
      suma_asegurada: bx.suma_asegurada || '-',
      deducible: bx.deducible || '-',
      coaseguro: bx.coaseguro || '-',
      tope_coaseguro: bx.tope_coaseguro_seleccionado ? fmt(bx.tope_coaseguro_seleccionado) : '-',
    };
  } else if (opt.product_id === 'BNV') {
    const b = inp as BnvQuoteInput;
    return {
      producto: 'Bupa Nacional Vital',
      region: b.region_zone || '-',
      suma_asegurada: fmtSA(b.suma_asegurada),
      deducible: fmtDed(b.deducible),
      coaseguro: `${b.coaseguro || 0}%`,
      tope_coaseguro: fmtTope(b.tope_coaseguro),
    };
  } else {
    const b = inp as BnpQuoteInput;
    return {
      producto: 'Bupa Nacional Plus',
      region: b.region_zone || '-',
      suma_asegurada: fmtSA(b.suma_asegurada),
      deducible: fmtDed(b.deducible),
      coaseguro: `${b.coaseguro || 0}%`,
    };
  }
}

function optionCoverages(opt: OptionResult, def?: MultiGmmOption): Record<string, boolean> {
  if (opt.product_id === 'BXPLUS' && def) {
    return ((def.input as BxplusQuoteInput).coverages || {}) as Record<string, boolean>;
  }
  return {};
}

function personPrima(opt: OptionResult, i: number): number {
  const pr = opt.result.people_results[i];
  if (!pr) return 0;
  if ('prima_total'    in pr) return (pr as any).prima_total    || 0;
  if ('discounted_rate' in pr) return (pr as any).discounted_rate || 0;
  if ('annual_premium' in pr) return (pr as any).annual_premium  || 0;
  return 0;
}

// ─────────────────────────────────────────────
// Footer — applied to every page at the end
// ─────────────────────────────────────────────

function applyFooters(
  doc: jsPDF,
  accent: [number,number,number],
  webSlug: string,
  total: number
) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 10;

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);

    // Separator line
    doc.setDrawColor(208, 210, 220);
    doc.setLineWidth(0.15);
    doc.line(M, PH - 13.5, PW - M, PH - 13.5);

    // Legal note
    doc.setFontSize(4.0);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(155, 158, 168);
    const nota = 'Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion de cada aseguradora. Coberturas conforme a Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
    const lines = doc.splitTextToSize(nota, PW - M * 2 - 26);
    let ny = PH - 11;
    for (const l of lines) { doc.text(l, M, ny); ny += 2.2; }

    // Page number
    doc.setFontSize(4.8);
    doc.setTextColor(168, 170, 180);
    doc.text(`Pag. ${p} / ${total}`, PW - M, PH - 9.8, { align: 'right' });

    // Web slug (accent color, right side)
    if (webSlug) {
      doc.setFontSize(5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(`agentedeseguros.website/${webSlug}`, PW - M, PH - 6.2, { align: 'right' });
    }

    // Thin bottom accent bar
    doc.setFillColor(...accent);
    doc.rect(0, PH - 1.8, PW, 1.8, 'F');
  }
}

// ─────────────────────────────────────────────
// Repeating mini-header (pages 2+)
// ─────────────────────────────────────────────

function miniHeader(
  doc: jsPDF,
  accent: [number,number,number],
  subtitle: string,
  clientName: string
): number {
  const PW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...accent);
  doc.rect(0, 0, PW, 7.5, 'F');
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(subtitle, 10, 5.2);
  if (clientName) {
    doc.setFontSize(5.8);
    doc.setFont(undefined, 'normal');
    doc.text(clientName, PW - 10, 5.2, { align: 'right' });
  }
  return 11;
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
  const M = 10;
  const CW = PW - M * 2;
  const FTR = 16; // footer reserve

  const valid = results.filter(r => !r.result.error);
  const N = Math.min(valid.length, 4);
  if (N === 0) {
    doc.setFontSize(11);
    doc.text('No hay opciones validas para generar PDF.', M, 30);
    return doc.output('blob');
  }

  // ── Branding palette
  const accentHex = usuario?.oficina?.accent_color || '#0E23E2';
  const A = hexToRgb(accentHex);               // accent full
  const AL = lighten(A, 0.91);                 // accent super light bg
  const AM = lighten(A, 0.72);                 // accent mid border
  const AD = darken(A, 0.10);                  // accent dark
  const DARK: [number,number,number] = [28,30,40];
  const MID: [number,number,number]  = [72,75,90];
  const SUB: [number,number,number]  = [120,124,138];
  const BG1: [number,number,number]  = [250,250,254]; // subtle page bg for cards
  const GREEN: [number,number,number]= [22,163,74];
  const RED: [number,number,number]  = [205,55,55];
  const AMBER: [number,number,number]= [180,90,0];
  const TEAL: [number,number,number] = [14,116,144];

  // ── Load images
  const logoB64   = logoUrl ? await toBase64(logoUrl) : null;
  const photoB64  = usuario?.imagen_perfil_url ? await toBase64(usuario.imagen_perfil_url) : null;

  // ── Advisor data
  const asesorNombre  = usuario?.nombre_publico || usuario?.nombre || 'Tu Asesor';
  const asesorTel     = usuario?.celular_laboral || usuario?.celular || '';
  const asesorEmail   = usuario?.email_laboral   || usuario?.email  || '';
  const asesorWebSlug = usuario?.web_slug || '';

  // ── Best option index (lowest annual total)
  const bestIdx = valid.reduce((mi, o, i) => {
    const cur  = safe(o.result.totals?.['Anual']?.total);
    const best = safe(valid[mi]?.result.totals?.['Anual']?.total);
    return cur > 0 && (best <= 0 || cur < best) ? i : mi;
  }, 0);

  // ── Highest SA index
  const highSAIdx = (() => {
    let mx = -1, idx = -1;
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === valid[i].option_id);
      const info = planInfo(valid[i], def);
      const raw = info.suma_asegurada || '-';
      const n = parseFloat(raw.replace(/[$,\s]/g, '')) || 0;
      if (n > mx) { mx = n; idx = i; }
    }
    return idx;
  })();

  const GAP = 3;                              // gap between option cards
  const CW_OPT = (CW - GAP * (N - 1)) / N;  // option card width

  // ════════════════════════════════════════════════════════
  // PAGE 1  —  Portada comercial + resumen ejecutivo
  // ════════════════════════════════════════════════════════

  // ── Full-bleed header gradient band
  const HDR_H = 20;
  doc.setFillColor(...A);
  doc.rect(0, 0, PW, HDR_H, 'F');
  // lighter right wash
  doc.setFillColor(...lighten(A, 0.2));
  doc.rect(PW * 0.5, 0, PW * 0.5, HDR_H, 'F');

  // logo
  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', M, 3, 25, 14); } catch { /* skip */ }
  }

  // title block
  const titleX = logoB64 ? 40 : M;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Propuesta Comercial', titleX, 9);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Gastos Medicos Mayores', titleX, 14);

  // folio + date right side
  const metaX = PW - M;
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  const metaParts: string[] = [];
  if (folio) metaParts.push(`Folio ${folio}`);
  metaParts.push(fmtDate(new Date()));
  metaParts.push('Vigencia 15 dias');
  doc.text(metaParts.join('  ·  '), metaX, 9, { align: 'right' });

  let Y = HDR_H + 4;

  // ── Client strip
  card(doc, M, Y, CW, 11, { fill: AL, border: AM, r: 3, shadow: false, lw: 0.3 });
  // left accent bar
  doc.setFillColor(...A);
  doc.roundedRect(M, Y, 2, 11, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...A);
  doc.text('CLIENTE', M + 5.5, Y + 4.5);
  doc.setFontSize(9.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...DARK);
  doc.text(clientName || 'Sin nombre', M + 5.5, Y + 9.2);
  // insured summary right side
  if (people.length) {
    doc.setFontSize(5.2);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...MID);
    const ps = people.map(p => `${p.name}${p.name ? ' (' : ''}${p.age} a.${p.name ? ')' : ''}`).join('  ·  ');
    doc.text(ps, PW - M - 2, Y + 6.5, { align: 'right' });
  }
  Y += 15;

  // ── Option cards — premium visual cards
  const OPT_H = 36;
  for (let i = 0; i < N; i++) {
    const opt = valid[i];
    const def = optionDefs?.find(d => d.id === opt.option_id);
    const info = planInfo(opt, def);
    const cx = M + i * (CW_OPT + GAP);
    const isBest = i === bestIdx;
    const isHighSA = i === highSAIdx && highSAIdx !== bestIdx;

    // Card body
    card(doc, cx, Y, CW_OPT, OPT_H, {
      fill: isBest ? AL : [255, 255, 255],
      border: isBest ? A : [218, 220, 232],
      r: 4,
      lw: isBest ? 0.5 : 0.2,
    });

    // Top accent stripe on best card
    if (isBest) {
      doc.setFillColor(...A);
      doc.roundedRect(cx, Y, CW_OPT, 3.5, 4, 4, 'F');
      doc.rect(cx, Y + 1.8, CW_OPT, 1.8, 'F');
    }

    const TX = cx + 3.5;
    let TY = Y + (isBest ? 7 : 5);

    // Option label
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...DARK);
    doc.text(opt.option_label, TX, TY);
    TY += 4.2;

    // Product badge
    badge(doc, TX, TY, PRODUCT_LABELS[opt.product_id] || opt.product_id, A, [255,255,255], 4.5);
    TY += 5.2;

    // Status badge
    if (isBest) {
      badge(doc, TX, TY, '★  MEJOR PRECIO', GREEN, [255,255,255], 4.5);
      TY += 5.2;
    } else if (isHighSA) {
      badge(doc, TX, TY, '↑  MAYOR COBERTURA', TEAL, [255,255,255], 4.5);
      TY += 5.2;
    } else if (N >= 3 && i === Math.floor(N / 2) && !isBest) {
      badge(doc, TX, TY, '✦  RECOMENDADA', AMBER, [255,255,255], 4.5);
      TY += 5.2;
    }

    // Specs: SA / Deducible / Coaseguro
    const specs: [string, string][] = [
      ['SA', fmtAmt(info.suma_asegurada || '-')],
      ['Ded.', fmtAmt(info.deducible || '-')],
      ['Coas.', fmtCoas(info.coaseguro || '-')],
    ];
    if (info.nivel && info.nivel !== '-') specs.push(['Nivel', info.nivel]);
    if (info.region && info.region !== '-') specs.push(['Region', info.region]);

    doc.setFontSize(5.0);
    for (const [lbl, val] of specs) {
      if (TY > Y + OPT_H - 9) break;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...SUB);
      doc.text(`${lbl}:`, TX, TY);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...DARK);
      const labelW = doc.getTextWidth(`${lbl}:`) + 1.5;
      doc.text(val, TX + labelW, TY);
      TY += 3.2;
    }

    // Annual total — prominent bottom
    const total = safe(opt.result.totals?.['Anual']?.total);
    const totalStr = fmt(total);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...(isBest ? A : AD));
    doc.text(totalStr, TX, Y + OPT_H - 3.5);
    const tw = doc.getTextWidth(totalStr);
    doc.setFontSize(4.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...SUB);
    doc.text('/ anual', TX + tw + 1, Y + OPT_H - 3.5);
  }

  Y += OPT_H + 6;

  // ── RESUMEN RAPIDO — 4 mini KPI stat cards
  sectionLabel(doc, 'Resumen Rapido', M, Y + 2, A);
  Y += 7;

  const kpiGap = 3;
  const kpiW = (CW - kpiGap * 3) / 4;
  const kpiH = 15;

  // Gather KPI values
  const bestOpt     = valid[bestIdx];
  const bestTotal   = safe(bestOpt?.result.totals?.['Anual']?.total);
  const lowestDed   = (() => {
    let min = Infinity, opt = '';
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === valid[i].option_id);
      const info = planInfo(valid[i], def);
      const raw = info.deducible || '-';
      const n = parseFloat(raw.replace(/[$,\s]/g, '')) || Infinity;
      if (n < min) { min = n; opt = valid[i].option_label; }
    }
    return { val: min === Infinity ? '-' : fmt(min), label: opt };
  })();
  const highSA = (() => {
    let mx = -1, lbl = '';
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === valid[i].option_id);
      const info = planInfo(valid[i], def);
      const n = parseFloat((info.suma_asegurada || '-').replace(/[$,\s]/g, '')) || 0;
      if (n > mx) { mx = n; lbl = valid[i].option_label; }
    }
    return { val: mx > 0 ? fmt(mx) : '-', label: lbl };
  })();

  const kpis: { title: string; value: string; sub: string; accent: [number,number,number] }[] = [
    { title: 'Mejor Precio',       value: fmt(bestTotal),    sub: bestOpt?.option_label || '-',    accent: GREEN },
    { title: 'Menor Deducible',    value: lowestDed.val,     sub: lowestDed.label,                 accent: TEAL },
    { title: 'Mayor Cobertura',    value: highSA.val,        sub: highSA.label,                    accent: A },
    { title: 'Recomendada',        value: bestOpt?.option_label || '-', sub: PRODUCT_LABELS[bestOpt?.product_id] || '-', accent: AMBER },
  ];

  for (let i = 0; i < 4; i++) {
    const kx = M + i * (kpiW + kpiGap);
    const kpi = kpis[i];
    card(doc, kx, Y, kpiW, kpiH, { fill: lighten(kpi.accent, 0.93), border: lighten(kpi.accent, 0.70), r: 3, shadow: false });
    // top micro bar
    doc.setFillColor(...kpi.accent);
    doc.roundedRect(kx, Y, kpiW, 2, 3, 3, 'F');
    doc.rect(kx, Y + 1, kpiW, 1, 'F');

    doc.setFontSize(4.8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...kpi.accent);
    doc.text(kpi.title.toUpperCase(), kx + 3, Y + 5.5);

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...darken(kpi.accent, 0.08));
    const lines = doc.splitTextToSize(kpi.value, kpiW - 6);
    doc.text(lines[0] || kpi.value, kx + 3, Y + 10);

    doc.setFontSize(4.2);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...SUB);
    doc.text(kpi.sub, kx + 3, Y + 13.5);
  }

  Y += kpiH + 5;

  // ── Insured persons
  if (people.length > 0 && Y < PH - FTR - 28) {
    sectionLabel(doc, 'Asegurados', M, Y + 2, A);
    Y += 7;

    const pHead = ['Nombre', 'Parentesco', 'Genero', 'Edad', ...valid.slice(0, N).map(o => o.option_label)];
    const pRows = people.map((p, pi) => [
      p.name || `Asegurado ${pi + 1}`,
      p.relation, p.gender, `${p.age} a.`,
      ...valid.slice(0, N).map(o => fmt(personPrima(o, pi))),
    ]);

    autoTable(doc, {
      startY: Y,
      head: [pHead],
      body: pRows,
      theme: 'plain',
      styles: { fontSize: 5.5, cellPadding: 1.8, lineColor: [222, 224, 234], lineWidth: 0.1, valign: 'middle' },
      headStyles: { fillColor: A as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.2 },
      alternateRowStyles: { fillColor: BG1 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 3: { halign: 'center', cellWidth: 10 } },
      margin: { left: M, right: M },
      didParseCell(d) {
        if (d.section === 'body' && d.column.index >= 4) {
          d.cell.styles.halign = 'right';
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = A as any;
        }
      },
    });
    Y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ════════════════════════════════════════════════════════
  // PAGE 2  —  Comparativa de planes y coberturas
  // ════════════════════════════════════════════════════════

  doc.addPage();
  Y = miniHeader(doc, A, 'Comparativa de Planes  ·  Gastos Medicos Mayores', clientName);

  // ── Plan characteristics table
  sectionLabel(doc, 'Caracteristicas del Plan', M, Y + 2, A);
  Y += 7;

  const planFields: { label: string; get: (o: OptionResult) => string }[] = [
    { label: 'Producto',           get: o => PRODUCT_LABELS[o.product_id] || o.product_id },
    { label: 'Estado / Region',    get: o => { const i = planInfo(o, optionDefs?.find(d=>d.id===o.option_id)); return i.estado || i.region || '-'; } },
    { label: 'Nivel Hospitalario', get: o => planInfo(o, optionDefs?.find(d=>d.id===o.option_id)).nivel || '-' },
    { label: 'Suma Asegurada',     get: o => fmtAmt(planInfo(o, optionDefs?.find(d=>d.id===o.option_id)).suma_asegurada || '-') },
    { label: 'Deducible',          get: o => fmtAmt(planInfo(o, optionDefs?.find(d=>d.id===o.option_id)).deducible || '-') },
    { label: 'Coaseguro',          get: o => fmtCoas(planInfo(o, optionDefs?.find(d=>d.id===o.option_id)).coaseguro || '-') },
    { label: 'Tope Coaseguro',     get: o => planInfo(o, optionDefs?.find(d=>d.id===o.option_id)).tope_coaseguro || '-' },
  ];

  autoTable(doc, {
    startY: Y,
    head: [['Caracteristica', ...valid.slice(0, N).map(o => o.option_label)]],
    body: planFields.map(f => [f.label, ...valid.slice(0, N).map(o => f.get(o))]),
    theme: 'striped',
    styles: { fontSize: 5.8, cellPadding: 2.0, lineColor: [222, 224, 234], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: [30, 32, 44] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5, halign: 'center' },
    alternateRowStyles: { fillColor: BG1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36, textColor: MID as any } },
    margin: { left: M, right: M },
    didParseCell(d) {
      if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center';
      if (d.section === 'head' && d.column.index === bestIdx + 1) d.cell.styles.fillColor = A as any;
    },
  });
  Y = (doc as any).lastAutoTable.finalY + 6;

  // ── Coverage comparison
  sectionLabel(doc, 'Coberturas Adicionales', M, Y + 2, A);
  Y += 7;

  const covBody = COBERTURAS.map(c => {
    const row: string[] = [c.label];
    for (let i = 0; i < N; i++) {
      const def = optionDefs?.find(d => d.id === valid[i].option_id);
      const covs = optionCoverages(valid[i], def);
      if (valid[i].product_id !== 'BXPLUS') row.push('—');
      else row.push(covs[c.key] === true ? '✓' : '✗');
    }
    return row;
  });

  autoTable(doc, {
    startY: Y,
    head: [['Cobertura', ...valid.slice(0, N).map(o => o.option_label)]],
    body: covBody,
    theme: 'plain',
    styles: { fontSize: 5.5, cellPadding: 1.6, lineColor: [225, 227, 236], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: A as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.2, halign: 'center' },
    alternateRowStyles: { fillColor: BG1 },
    columnStyles: { 0: { cellWidth: 50, fontSize: 5.5, textColor: MID as any } },
    margin: { left: M, right: M },
    didParseCell(d) {
      if (d.section === 'body' && d.column.index > 0) {
        d.cell.styles.halign = 'center';
        const v = String(d.cell.raw);
        if (v === '✓') {
          d.cell.styles.textColor = GREEN as any;
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fontSize = 8;
        } else if (v === '✗') {
          d.cell.styles.textColor = RED as any;
          d.cell.styles.fontSize = 7;
        } else {
          d.cell.styles.textColor = [190, 192, 202] as any;
          d.cell.styles.fontSize = 5.5;
        }
      }
    },
  });
  Y = (doc as any).lastAutoTable.finalY + 6;

  // ── Glossary
  if (Y < PH - FTR - 26) {
    sectionLabel(doc, 'Glosario de Terminos', M, Y + 2, A);
    Y += 7;

    const glossary: [string, string][] = [
      ['Suma Asegurada',   'Limite maximo que cubre la aseguradora por evento o anualidad.'],
      ['Deducible',        'Cantidad a cargo del asegurado antes de que opere la cobertura.'],
      ['Coaseguro',        'Porcentaje del gasto cubierto que paga el asegurado despues del deducible.'],
      ['Tope Coaseguro',   'Monto maximo de coaseguro que pagara el asegurado por evento.'],
    ];

    // Two-column layout
    const gcw = (CW - 5) / 2;
    let gx = M; let gy = Y;
    for (let gi = 0; gi < glossary.length; gi++) {
      const [term, def] = glossary[gi];
      if (gi === 2) { gx = M + gcw + 5; gy = Y; }
      doc.setFontSize(5.3);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${term}:`, gx + 2, gy);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...SUB);
      const dlines = doc.splitTextToSize(def, gcw - 6);
      for (const dl of dlines) {
        gy += 3.3;
        doc.text(dl, gx + 2, gy);
      }
      gy += 4;
    }
  }

  // ════════════════════════════════════════════════════════
  // PAGE 3  —  Formas de pago, recomendacion, asesor
  // ════════════════════════════════════════════════════════

  doc.addPage();
  Y = miniHeader(doc, A, 'Formas de Pago y Recomendacion  ·  Gastos Medicos Mayores', clientName);

  // ── Payment forms — visual cards per forma de pago
  sectionLabel(doc, 'Formas de Pago', M, Y + 2, A);
  Y += 7;

  const FORMAS: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const FORMA_SUB: Record<FormaPago, string> = { Anual: '1 pago al año', Semestral: '2 pagos / año', Trimestral: '4 pagos / año', Mensual: '12 pagos / año' };

  // Per-forma-de-pago mini cards row
  const fpGap = 3;
  const fpW = (CW - fpGap * (FORMAS.length - 1)) / FORMAS.length;
  const fpH = 10;

  for (let fi = 0; fi < FORMAS.length; fi++) {
    const fp = FORMAS[fi];
    const isAnual = fp === 'Anual';
    const fx = M + fi * (fpW + fpGap);
    card(doc, fx, Y, fpW, fpH, {
      fill: isAnual ? AL : [255, 255, 255],
      border: isAnual ? A : [218, 220, 232],
      r: 3,
      lw: isAnual ? 0.4 : 0.15,
      shadow: false,
    });
    if (isAnual) {
      doc.setFillColor(...A);
      doc.roundedRect(fx, Y, fpW, 2, 3, 3, 'F');
      doc.rect(fx, Y + 1, fpW, 1, 'F');
    }
    doc.setFontSize(5.8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...(isAnual ? A : DARK));
    doc.text(fp, fx + fpW / 2, Y + (isAnual ? 6.2 : 5.5), { align: 'center' });
    doc.setFontSize(4.3);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...SUB);
    doc.text(FORMA_SUB[fp], fx + fpW / 2, Y + fpH - 2, { align: 'center' });
  }
  Y += fpH + 3;

  // Payment breakdown table
  const payHead = ['Forma de Pago', ...valid.slice(0, N).map(o => o.option_label)];
  const payBody: string[][] = FORMAS.map(fp => {
    const row = [`${fp} (${FORMA_SUB[fp]})`];
    for (let i = 0; i < N; i++) {
      const t = valid[i].result.totals?.[fp];
      if (!t) { row.push('-'); continue; }
      const nr = (t as any).num_recibos || 1;
      if (nr > 1) {
        const p1 = (t as any).primer_pago || t.total;
        const ps = (t as any).pagos_subsecuentes || t.total;
        row.push(`${fmt(t.total)}\n1er: ${fmt(p1)}  Sub: ${fmt(ps)}`);
      } else {
        row.push(fmt(t.total));
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: Y,
    head: [payHead],
    body: payBody,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 2.2, lineColor: [210, 213, 224], lineWidth: 0.12, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [28, 30, 44] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5, halign: 'center' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 34, textColor: MID as any } },
    margin: { left: M, right: M },
    didParseCell(d) {
      if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'right';
      // Highlight Anual row
      if (d.section === 'body' && d.row.index === 0) {
        d.cell.styles.fillColor = AL;
        d.cell.styles.textColor = A as any;
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = 6.2;
      }
      // Best option column header highlight
      if (d.section === 'head' && d.column.index === bestIdx + 1) d.cell.styles.fillColor = A as any;
    },
  });
  Y = (doc as any).lastAutoTable.finalY + 7;

  // ── Nuestra Recomendacion — premium editorial block
  if (Y < PH - FTR - 36) {
    const recH = 30;
    card(doc, M, Y, CW, recH, { fill: AL, border: AM, r: 4, shadow: false, lw: 0.3 });

    // left accent bar
    doc.setFillColor(...A);
    doc.roundedRect(M, Y, 2.5, recH, 1, 1, 'F');

    // star icon area
    doc.setFontSize(13);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...lighten(A, 0.4));
    doc.text('★', M + 6, Y + 13);

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...A);
    doc.text('NUESTRA RECOMENDACION', M + 15, Y + 6);

    const recOpt = valid[bestIdx];
    const recDef = optionDefs?.find(d => d.id === recOpt?.option_id);
    const recInfo = planInfo(recOpt, recDef);

    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...DARK);
    doc.text(recOpt?.option_label || '-', M + 15, Y + 12);

    doc.setFontSize(5.8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...MID);
    const recText = `Recomendamos ${recOpt?.option_label || 'esta opcion'} porque ofrece la mejor relacion entre precio, suma asegurada y beneficios incluidos. Con una suma asegurada de ${fmtAmt(recInfo.suma_asegurada || '-')}, un deducible de ${fmtAmt(recInfo.deducible || '-')} y un coaseguro del ${fmtCoas(recInfo.coaseguro || '-')}, es una alternativa solida para proteger a ${clientName || 'tu familia'} con una prima anual de ${fmt(safe(recOpt?.result.totals?.['Anual']?.total))}. Una inversion razonable para una cobertura amplia y respaldo profesional.`;
    const recLines = doc.splitTextToSize(recText, CW - 22);
    let ry = Y + 17;
    for (const rl of recLines) {
      if (ry > Y + recH - 3) break;
      doc.text(rl, M + 15, ry);
      ry += 3.1;
    }

    Y += recH + 7;
  }

  // ── Advisor card — signature professional
  const adH = 24;
  if (Y > PH - FTR - adH - 5) { doc.addPage(); Y = M + 2; }

  card(doc, M, Y, CW, adH, { fill: [255, 255, 255], border: AM, r: 4, shadow: true, lw: 0.25 });
  doc.setFillColor(...A);
  doc.roundedRect(M, Y, 2.5, adH, 1, 1, 'F');

  // Profile photo
  let photoPlaced = false;
  if (photoB64) {
    try {
      const ps = 18;
      const px = M + CW - ps - 3;
      const py = Y + (adH - ps) / 2;
      doc.addImage(photoB64, 'PNG', px, py, ps, ps);
      doc.setDrawColor(...AM);
      doc.setLineWidth(0.4);
      doc.circle(px + ps / 2, py + ps / 2, ps / 2, 'S');
      photoPlaced = true;
    } catch { /* skip */ }
  }

  const adTextW = photoPlaced ? CW - 26 : CW - 10;
  const adX = M + 7;

  doc.setFontSize(5.2);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...A);
  doc.text('TU ASESOR DE CONFIANZA', adX, Y + 5.5);

  doc.setFontSize(9.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...DARK);
  doc.text(asesorNombre, adX, Y + 12);

  doc.setFontSize(5.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...MID);
  const adDetails: string[] = [];
  if (asesorTel)     adDetails.push(`Tel: ${asesorTel}`);
  if (asesorEmail)   adDetails.push(asesorEmail);
  const adLine = adDetails.join('   |   ');
  if (adLine) doc.text(adLine, adX, Y + 17);

  if (asesorWebSlug) {
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...A);
    doc.text(`agentedeseguros.website/${asesorWebSlug}`, adX, Y + 21.5);
  }

  Y += adH + 6;

  // ── CTA strip — call to action
  if (Y < PH - FTR - 11) {
    doc.setFillColor(...A);
    doc.roundedRect(M, Y, CW, 11, 3, 3, 'F');
    // subtle right shimmer
    doc.setFillColor(...lighten(A, 0.2));
    doc.roundedRect(M + CW * 0.5, Y, CW * 0.5, 11, 3, 3, 'F');

    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('¿Listo para proteger a tu familia?', PW / 2, Y + 5.5, { align: 'center' });
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Contacta a tu asesor hoy mismo para contratar o resolver cualquier duda.', PW / 2, Y + 9, { align: 'center' });
    Y += 11 + 5;
  }

  // ── BX+ coverage descriptions (extra page if needed)
  const hasBX = valid.some(o => o.product_id === 'BXPLUS');
  if (hasBX) {
    const allKeys = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (valid[i].product_id === 'BXPLUS') {
        const def = optionDefs?.find(d => d.id === valid[i].option_id);
        const covs = optionCoverages(valid[i], def);
        Object.entries(covs).forEach(([k, v]) => { if (v) allKeys.add(k); });
      }
    }

    if (allKeys.size > 0) {
      doc.addPage();
      let cy = miniHeader(doc, A, 'Coberturas Adicionales Incluidas  ·  BX+ Unikuz', clientName);
      sectionLabel(doc, 'Descripcion de Coberturas', M, cy + 2, A);
      cy += 8;

      for (const key of allKeys) {
        const lbl = COBERTURAS.find(c => c.key === key)?.label || key;
        const desc = COVERAGE_PDF_TEXTS[key] || 'Cobertura adicional conforme a condiciones de la poliza.';

        if (cy > PH - FTR - 14) { doc.addPage(); cy = M; }

        const ch = 15;
        card(doc, M, cy, CW, ch, { fill: AL, border: AM, r: 2, shadow: false, lw: 0.15 });
        doc.setFillColor(...A);
        doc.rect(M, cy, 1.5, ch, 'F');

        doc.setFontSize(6.2);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...DARK);
        doc.text(lbl, M + 5, cy + 5.5);

        doc.setFontSize(5.0);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...MID);
        const dlines = doc.splitTextToSize(desc, CW - 8);
        let dy = cy + 9.5;
        for (const dl of dlines) {
          if (dy > cy + ch - 1.5) break;
          doc.text(dl, M + 5, dy);
          dy += 2.5;
        }
        cy += ch + 3;
      }
    }
  }

  // ── Apply footers to all pages
  applyFooters(doc, A, asesorWebSlug, doc.getNumberOfPages());

  return doc.output('blob');
}
