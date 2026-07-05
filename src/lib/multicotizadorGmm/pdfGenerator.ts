import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  OptionResult,
  QuotePerson,
  MultiGmmOption,
  BnvCalculationResult,
  BnpCalculationResult,
  BxplusCalculationResult,
  FormaPago,
} from './types';
import { PRODUCT_LABELS } from './types';

// ─── Formatting ──────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null, d = 0) =>
  n == null ? '-' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

const safe = (s: string | number | undefined | null): string =>
  String(s ?? '-')
    .replace(/[–—]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^\x00-\x7F]/g, c => {
      const map: Record<string, string> = {
        '\u00e1': 'a', '\u00e9': 'e', '\u00ed': 'i', '\u00f3': 'o', '\u00fa': 'u',
        '\u00c1': 'A', '\u00c9': 'E', '\u00cd': 'I', '\u00d3': 'O', '\u00da': 'U',
        '\u00f1': 'n', '\u00d1': 'N', '\u00fc': 'u', '\u00dc': 'U',
        '\u00bf': '?', '\u00a1': '!', '\u00b0': ' grados',
      };
      return map[c] ?? c;
    });

async function toBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin);
  } catch {
    return null;
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function lighten(c: RGB, t: number): RGB { return mix(c, [255, 255, 255], t); }
function darken(c: RGB, t: number): RGB  { return mix(c, [0, 0, 0], t); }

function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function setTxt(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }

function rule(doc: jsPDF, x: number, y: number, w: number, c: RGB, h = 0.3) {
  setFill(doc, c);
  doc.rect(x, y, w, h, 'F');
}

// ─── Data extraction from typed results ──────────────────────────────────────

interface PlanSummary {
  nombre: string;
  aseguradora: string;
  estado: string;
  nivel: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro: string;
  prima_anual: number;
  totals: Partial<Record<FormaPago, number>>;
  bxCoverages: string[];
}

function extractPlan(r: OptionResult): PlanSummary {
  const res = r.result;

  if (res.product === 'BXPLUS') {
    const bx = res as BxplusCalculationResult;
    const input = (r as any).__input as import('./types').BxplusQuoteInput | undefined;
    const sa = safe(input?.suma_asegurada ?? '-');
    const ded = safe(input?.deducible ?? '-');
    const coas = safe(input?.coaseguro ? input.coaseguro + '%' : '-');
    const tope = input?.tope_coaseguro_seleccionado ? '$' + fmt(input.tope_coaseguro_seleccionado) : '-';

    const totals: Partial<Record<FormaPago, number>> = {};
    if (bx.totals) {
      (Object.keys(bx.totals) as FormaPago[]).forEach(fp => {
        totals[fp] = bx.totals[fp].total;
      });
    }

    // Coverage chips from people_results context via option label or fallback
    const chips: string[] = [];
    const bxCov = (r as any).__coverages as import('./types').BxplusCoverages | undefined;
    if (bxCov) {
      if (bxCov.reconocimiento_antiguedad) chips.push('Reconocimiento antiguedad');
      if (bxCov.medicamentos_fuera)        chips.push('Medicamentos ext.');
      if (bxCov.complicaciones_no_amparadas) chips.push('Complicaciones');
      if (bxCov.padecimientos_preexistentes) chips.push('Preexistentes');
      if (bxCov.eliminacion_deducible_accidente) chips.push('Sin ded. accidente');
      if (bxCov.multiregion)               chips.push('Multiregion');
      if (bxCov.vip)                       chips.push('Beneficio VIP');
      if (bxCov.emergencia_medica_extranjero) chips.push('Emergencias ext.');
      if (bxCov.cobertura_internacional)   chips.push('Internacional');
      if (bxCov.maternidad)                chips.push('Maternidad');
      if (bxCov.xtensuz)                   chips.push('Xtensuz');
    }

    return {
      nombre: safe(r.option_label ?? PRODUCT_LABELS.BXPLUS),
      aseguradora: 'GNP Seguros',
      estado: safe(input?.estado ?? '-'),
      nivel: safe(input?.nivel_hospitalario ?? '-'),
      suma_asegurada: sa.startsWith('$') ? sa : ('$' + fmt(parseFloat(sa.replace(/[^0-9.]/g, '')))),
      deducible: ded.startsWith('$') ? ded : ('$' + fmt(parseFloat(ded.replace(/[^0-9.]/g, '')))),
      coaseguro: coas,
      tope_coaseguro: tope,
      prima_anual: bx.prima_anual_total,
      totals,
      bxCoverages: chips,
    };
  }

  if (res.product === 'BNV') {
    const bnv = res as BnvCalculationResult;
    const totals: Partial<Record<FormaPago, number>> = {};
    if (bnv.totals) {
      (Object.keys(bnv.totals) as FormaPago[]).forEach(fp => {
        totals[fp] = bnv.totals[fp].total;
      });
    }
    const inp = (r as any).__input as import('./types').BnvQuoteInput | undefined;
    return {
      nombre: safe(r.option_label ?? PRODUCT_LABELS.BNV),
      aseguradora: 'Bupa Mexico',
      estado: inp?.region_zone ?? '-',
      nivel: '-',
      suma_asegurada: '$' + fmt(inp?.suma_asegurada ?? 0),
      deducible: '$' + fmt(inp?.deducible ?? 0),
      coaseguro: (inp?.coaseguro ?? 0) + '%',
      tope_coaseguro: inp?.tope_coaseguro ? '$' + fmt(inp.tope_coaseguro) : '-',
      prima_anual: bnv.prima_anual_total,
      totals,
      bxCoverages: [],
    };
  }

  // BNP
  const bnp = res as BnpCalculationResult;
  const totals: Partial<Record<FormaPago, number>> = {};
  if (bnp.totals) {
    (Object.keys(bnp.totals) as FormaPago[]).forEach(fp => {
      totals[fp] = bnp.totals[fp].total;
    });
  }
  const inp = (r as any).__input as import('./types').BnpQuoteInput | undefined;
  return {
    nombre: safe(r.option_label ?? PRODUCT_LABELS.BNP),
    aseguradora: 'Bupa Mexico',
    estado: inp?.region_zone ?? '-',
    nivel: '-',
    suma_asegurada: '$' + fmt(inp?.suma_asegurada ?? 0),
    deducible: '$' + fmt(inp?.deducible ?? 0),
    coaseguro: (inp?.coaseguro ?? 0) + '%',
    tope_coaseguro: '-',
    prima_anual: bnp.prima_anual_total,
    totals,
    bxCoverages: [],
  };
}

function personPrima(person: QuotePerson, r: OptionResult): number {
  const res = r.result;
  if (res.product === 'BXPLUS') {
    const bx = res as BxplusCalculationResult;
    const match = bx.people_results.find(p =>
      p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? '')
      || p.person_id === person.id
    );
    return match?.prima_total ?? 0;
  }
  if (res.product === 'BNV') {
    const bnv = res as BnvCalculationResult;
    const match = bnv.people_results.find(p =>
      p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? '')
      || p.person_id === person.id
    );
    return match ? (bnv.totals?.['Anual']?.total ?? 0) / bnv.people_results.length : 0;
  }
  const bnp = res as BnpCalculationResult;
  const match = bnp.people_results.find(p =>
    p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? '')
    || p.person_id === person.id
  );
  return match?.annual_premium ?? 0;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  optionDefs?: MultiGmmOption[],
  logoUrl?: string,
  folio?: string
): Promise<Blob> {

  // Inject inputs from optionDefs so extractPlan can read them
  if (optionDefs) {
    results.forEach(r => {
      const def = optionDefs.find(d => d.id === r.option_id);
      if (def) {
        (r as any).__input = def.input;
        if (def.product_id === 'BXPLUS') {
          (r as any).__coverages = (def.input as import('./types').BxplusQuoteInput).coverages;
        }
      }
    });
  }

  // Palette
  const accentHex = usuario?.oficina?.accent_color ?? '#1B4FD8';
  const A   = hexToRgb(accentHex);
  const AL  = lighten(A, 0.92);
  const AM  = lighten(A, 0.75);
  const AD  = darken(A,  0.12);
  const DARK:  RGB = [22,  26,  40];
  const MID:   RGB = [68,  72,  90];
  const SUB:   RGB = [118, 122, 140];
  const WHITE: RGB = [255, 255, 255];
  const LIGHT: RGB = [246, 247, 251];
  const GREEN: RGB = [16,  150, 72];
  const TEAL:  RGB = [12,  112, 140];
  const AMBER: RGB = [172, 86,  0];

  // Doc
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW  = 215.9;
  const PH  = 279.4;
  const ML  = 13;
  const MR  = 13;
  const CW  = PW - ML - MR;
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  let logoB64: string | null = null;
  if (logoUrl) logoB64 = await toBase64(logoUrl);

  const agentName  = safe(usuario?.nombre_completo ?? usuario?.nombre ?? '');
  const agentEmail = safe(usuario?.email ?? '');
  const agentPhone = safe(usuario?.telefono ?? usuario?.phone ?? '');
  const agentWeb   = safe(usuario?.oficina?.website ?? usuario?.oficina?.nombre ?? '');
  const folioStr   = folio ? 'Folio ' + folio : '';

  // Extract plan data
  const plans = results.map(r => extractPlan(r));

  // Best plan = lowest annual prima
  const bestIdx = plans.reduce((bi, p, i) =>
    (p.prima_anual > 0 && (plans[bi].prima_anual === 0 || p.prima_anual < plans[bi].prima_anual)) ? i : bi, 0);

  const COLS = Math.min(results.length, 3);
  const FH   = 8;   // footer height

  // ── Footer ─────────────────────────────────────────────────────────────────

  function drawFooter(pg: number) {
    const fy = PH - FH;
    setFill(doc, AL);
    doc.rect(0, fy, PW, FH, 'F');
    rule(doc, 0, fy, PW, AM, 0.3);
    doc.setFontSize(5.8);
    setTxt(doc, SUB);
    doc.setFont('helvetica', 'normal');
    doc.text('Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion. Documento ilustrativo, no contractual.', ML, fy + 3.2);
    if (agentWeb) doc.text(agentWeb, ML, fy + 6.2);
    doc.setFontSize(6.5);
    setTxt(doc, MID);
    doc.setFont('helvetica', 'bold');
    doc.text('Pag. ' + pg + ' / 2', PW - MR, fy + 4.8, { align: 'right' });
  }

  // ── Mini header ─────────────────────────────────────────────────────────────

  function drawMiniHeader(subtitle: string) {
    setFill(doc, A);
    doc.rect(0, 0, PW, 9, 'F');
    setFill(doc, AD);
    doc.rect(0, 8.2, PW, 0.8, 'F');
    doc.setFontSize(6.5);
    setTxt(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.text(safe('Cotizacion GMM - ' + clientName), ML, 5.8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, PW - MR, 5.8, { align: 'right' });
  }

  // ── Section label ────────────────────────────────────────────────────────────

  function sectionLabel(label: string, y: number) {
    doc.setFontSize(7);
    setTxt(doc, AD);
    doc.setFont('helvetica', 'bold');
    doc.text(safe(label).toUpperCase(), ML, y);
    rule(doc, ML, y + 1.5, CW, AM);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1  —  Header + Hero + Option cards + KPI strip + Insured table
  // ════════════════════════════════════════════════════════════════════════════

  let y = 0;

  // ── Full-bleed header ────────────────────────────────────────────────────────
  const HDR = 32;
  setFill(doc, A);
  doc.rect(0, 0, PW, HDR, 'F');

  // Dark stripe at bottom of header
  setFill(doc, AD);
  doc.rect(0, HDR - 1.2, PW, 1.2, 'F');

  // Diagonal accent stripe
  setFill(doc, lighten(A, 0.12));
  doc.triangle(PW - 60, 0, PW, 0, PW, HDR, 'F');

  // Logo or agency name
  if (logoB64) {
    try {
      doc.addImage(logoB64, 'PNG', ML, 6, 24, 12, undefined, 'FAST');
    } catch { /* skip */ }
  } else if (agentName) {
    doc.setFontSize(9);
    setTxt(doc, lighten(A, 0.70));
    doc.setFont('helvetica', 'bold');
    doc.text(agentName, ML, 11);
    if (agentWeb) {
      doc.setFontSize(7);
      setTxt(doc, lighten(A, 0.55));
      doc.setFont('helvetica', 'normal');
      doc.text(agentWeb, ML, 16);
    }
  }

  // Title (right)
  doc.setFontSize(15);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACION GMM', PW - MR, 12, { align: 'right' });
  doc.setFontSize(7.5);
  setTxt(doc, lighten(A, 0.65));
  doc.setFont('helvetica', 'normal');
  doc.text('Gastos Medicos Mayores  *  ' + today, PW - MR, 18, { align: 'right' });
  if (folioStr) {
    doc.setFontSize(7);
    setTxt(doc, lighten(A, 0.55));
    doc.text(folioStr, PW - MR, 23.5, { align: 'right' });
  }

  y = HDR + 3;

  // ── Client strip ─────────────────────────────────────────────────────────────
  setFill(doc, LIGHT);
  setDraw(doc, AM);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'FD');
  setFill(doc, A);
  doc.rect(ML, y, 2.5, 8, 'F');

  doc.setFontSize(7.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Prospecto:', ML + 5, y + 5.2);
  doc.setFont('helvetica', 'normal');
  doc.text(safe(clientName), ML + 22, y + 5.2);

  const titular = people.find(p => p.relation === 'Titular') ?? people[0];
  if (titular) {
    doc.setFontSize(7);
    setTxt(doc, MID);
    doc.text('Titular: ' + safe(titular.name) + '  *  ' + titular.age + ' anos', PW - MR, y + 5.2, { align: 'right' });
  }

  y += 12;

  // ── Hero best-option banner ───────────────────────────────────────────────────
  const bestPlan = plans[bestIdx];
  const heroH = 10;
  setFill(doc, AD);
  doc.roundedRect(ML, y, CW, heroH, 2, 2, 'F');

  doc.setFontSize(7.5);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('Recomendado: ' + bestPlan.nombre, ML + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Prima anual: $' + fmt(bestPlan.prima_anual) +
    '  *  Deducible: ' + bestPlan.deducible +
    '  *  Coaseguro: ' + bestPlan.coaseguro +
    '  *  SA: ' + bestPlan.suma_asegurada,
    ML + 4, y + 8
  );

  y += heroH + 4;

  // ── Option cards ─────────────────────────────────────────────────────────────
  const CARDW = (CW - (COLS - 1) * 3) / COLS;
  const CARDH = 38;

  // Product colour per carrier
  const prodColors: Record<string, RGB> = {
    BXPLUS: [2,   132, 199],
    BNV:    [13,  148, 136],
    BNP:    [124, 58,  237],
  };

  for (let i = 0; i < COLS; i++) {
    const r     = results[i];
    const plan  = plans[i];
    const cx    = ML + i * (CARDW + 3);
    const best  = i === bestIdx;
    const pclr  = prodColors[r.product_id] ?? A;

    // Card background
    setFill(doc, best ? AD : WHITE);
    setDraw(doc, best ? A : AM);
    doc.setLineWidth(best ? 0.6 : 0.2);
    doc.roundedRect(cx, y, CARDW, CARDH, 2, 2, 'FD');

    // Top colour accent bar
    setFill(doc, pclr);
    doc.rect(cx, y, CARDW, 3.5, 'F');
    // Round the top corners manually via clip workaround — just use rect

    // "MEJOR PRECIO" badge (best card only)
    if (best) {
      setFill(doc, GREEN);
      doc.roundedRect(cx + CARDW - 26, y - 3.5, 25, 6, 1.5, 1.5, 'F');
      doc.setFontSize(5.5);
      setTxt(doc, WHITE);
      doc.setFont('helvetica', 'bold');
      doc.text('MEJOR PRECIO', cx + CARDW - 13.5, y + 0.5, { align: 'center' });
    }

    // Product tag
    doc.setFontSize(5.2);
    setTxt(doc, best ? lighten(pclr, 0.55) : pclr);
    doc.setFont('helvetica', 'bold');
    doc.text(PRODUCT_LABELS[r.product_id] ?? r.product_id, cx + 3, y + 8);

    // Plan name
    doc.setFontSize(8.5);
    setTxt(doc, best ? WHITE : DARK);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(plan.nombre, CARDW - 6);
    doc.text(nameLines.slice(0, 2), cx + 3, y + 13.5);

    // Specs grid (3 items)
    const specY = y + 21;
    const sw = (CARDW - 6) / 3;
    const specs = [
      { lbl: 'Deducible', val: plan.deducible },
      { lbl: 'Coas.',     val: plan.coaseguro },
      { lbl: 'SA',        val: plan.suma_asegurada },
    ];
    specs.forEach((s, si) => {
      const sx = cx + 3 + si * sw;
      doc.setFontSize(5);
      setTxt(doc, best ? lighten(A, 0.65) : SUB);
      doc.setFont('helvetica', 'normal');
      doc.text(s.lbl, sx, specY);
      doc.setFontSize(6.5);
      setTxt(doc, best ? WHITE : DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(safe(s.val), sx, specY + 4.5);
    });

    // BX+ coverage chips (small, inline)
    if (r.product_id === 'BXPLUS' && plan.bxCoverages.length > 0) {
      let chipX = cx + 3;
      const chipY = specY + 8.5;
      plan.bxCoverages.slice(0, 5).forEach(chip => {
        const cw2 = doc.getTextWidth(chip) + 3;
        if (chipX + cw2 > cx + CARDW - 1.5) return;
        setFill(doc, best ? lighten(A, 0.35) : AL);
        doc.roundedRect(chipX, chipY, cw2, 3.5, 0.8, 0.8, 'F');
        doc.setFontSize(4.5);
        setTxt(doc, best ? WHITE : AD);
        doc.setFont('helvetica', 'normal');
        doc.text(chip, chipX + 1.5, chipY + 2.6);
        chipX += cw2 + 1.2;
      });
    }

    // Annual price (bottom right)
    doc.setFontSize(11);
    setTxt(doc, best ? WHITE : A);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + fmt(plan.prima_anual), cx + CARDW - 3, y + CARDH - 7, { align: 'right' });
    doc.setFontSize(5.5);
    setTxt(doc, best ? lighten(A, 0.65) : SUB);
    doc.setFont('helvetica', 'normal');
    doc.text('/anual (con IVA)', cx + CARDW - 3, y + CARDH - 3, { align: 'right' });
  }

  y += CARDH + 4;

  // ── KPI strip ─────────────────────────────────────────────────────────────────
  const kpis: Array<{ lbl: string; val: string; color: RGB }> = [
    { lbl: 'Opciones cotizadas', val: String(results.length),          color: A },
    { lbl: 'Asegurados',         val: String(people.length),           color: TEAL },
    { lbl: 'Mejor precio anual', val: '$' + fmt(bestPlan.prima_anual), color: GREEN },
    { lbl: 'Mejor deducible',    val: bestPlan.deducible,              color: AMBER },
  ];
  const KW = (CW - 9) / 4;
  const KH = 11;

  kpis.forEach((k, i) => {
    const kx = ML + i * (KW + 3);
    setFill(doc, lighten(k.color, 0.90));
    setDraw(doc, lighten(k.color, 0.72));
    doc.setLineWidth(0.2);
    doc.roundedRect(kx, y, KW, KH, 1.5, 1.5, 'FD');
    setFill(doc, k.color);
    doc.rect(kx, y, 2, KH, 'F');
    doc.setFontSize(5);
    setTxt(doc, MID);
    doc.setFont('helvetica', 'normal');
    doc.text(k.lbl, kx + 4, y + 4);
    doc.setFontSize(9);
    setTxt(doc, darken(k.color, 0.15));
    doc.setFont('helvetica', 'bold');
    doc.text(safe(k.val), kx + 4, y + 9.5);
  });

  y += KH + 5;

  // ── Insured table ────────────────────────────────────────────────────────────
  sectionLabel('Asegurados cotizados', y);
  y += 5;

  const insuredRows = people.map(p => {
    const primas = results.slice(0, 3).map(r2 => {
      const pa = personPrima(p, r2);
      return pa > 0 ? '$' + fmt(pa) : '-';
    });
    return [
      safe(p.name),
      safe(p.relation),
      safe(p.gender),
      String(p.age) + ' a.',
      ...primas,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Nombre', 'Parentesco', 'Genero', 'Edad',
      ...results.slice(0, 3).map((r2, i) => safe(r2.option_label ?? 'Op. ' + (i + 1)))]],
    body: insuredRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [220, 222, 232] as RGB, lineWidth: 0.15, textColor: DARK },
    headStyles: { fillColor: A as [number,number,number], textColor: WHITE as [number,number,number], fontStyle: 'bold', fontSize: 6.5, cellPadding: 1.7 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
    didParseCell: data => {
      if (data.section === 'body' && data.column.index >= 4 + bestIdx && data.column.index === 4 + bestIdx) {
        data.cell.styles.fillColor = lighten(A, 0.87) as [number,number,number];
        data.cell.styles.textColor = darken(A, 0.1) as [number,number,number];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  drawFooter(1);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2  —  Comparativo + Formas de Pago + Glosario + Recomendacion + Asesor
  // ════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 0;

  drawMiniHeader(folioStr || today);
  y = 10;

  // ── Plan comparison table ─────────────────────────────────────────────────────
  sectionLabel('Comparativo de planes', y);
  y += 5;

  const compFields: Array<[string, (p: PlanSummary) => string]> = [
    ['Aseguradora',    p => p.aseguradora],
    ['Suma Asegurada', p => p.suma_asegurada],
    ['Deducible',      p => p.deducible],
    ['Coaseguro',      p => p.coaseguro],
    ['Tope Coaseguro', p => p.tope_coaseguro],
    ['Estado / Zona',  p => p.estado],
    ['Nivel hosp.',    p => p.nivel],
    ['Prima anual',    p => '$' + fmt(p.prima_anual)],
  ];

  const compRows = compFields.map(([lbl, fn]) => [lbl, ...plans.slice(0, COLS).map(p => safe(fn(p)))]);

  autoTable(doc, {
    startY: y,
    head: [['Caracteristica', ...results.slice(0, COLS).map((r2, i) => safe(r2.option_label ?? 'Op. ' + (i + 1)))]],
    body: compRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [220, 222, 232] as RGB, lineWidth: 0.15, textColor: DARK },
    headStyles: { fillColor: A as [number,number,number], textColor: WHITE as [number,number,number], fontStyle: 'bold', fontSize: 6.5, cellPadding: 1.7 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: DARK as [number,number,number], cellWidth: 36 } },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === bestIdx + 1) {
        data.cell.styles.fillColor = lighten(A, 0.88) as [number,number,number];
        data.cell.styles.textColor = darken(A, 0.1) as [number,number,number];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // ── Payment forms table ───────────────────────────────────────────────────────
  sectionLabel('Formas de pago', y);
  y += 5;

  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const payRows = formasPago.map(fp => [
    fp,
    ...plans.slice(0, COLS).map(p => p.totals[fp] ? '$' + fmt(p.totals[fp]) : '-'),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Forma de pago', ...results.slice(0, COLS).map((r2, i) => safe(r2.option_label ?? 'Op. ' + (i + 1)))]],
    body: payRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [220, 222, 232] as RGB, lineWidth: 0.15, textColor: DARK },
    headStyles: { fillColor: AD as [number,number,number], textColor: WHITE as [number,number,number], fontStyle: 'bold', fontSize: 6.5, cellPadding: 1.7 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: DARK as [number,number,number], cellWidth: 36 } },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === bestIdx + 1) {
        data.cell.styles.fillColor = lighten(A, 0.88) as [number,number,number];
        data.cell.styles.textColor = darken(A, 0.1) as [number,number,number];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // ── Compact 2-column glossary ─────────────────────────────────────────────────
  sectionLabel('Glosario', y);
  y += 5;

  const glossary: Array<[string, string]> = [
    ['Suma Asegurada',  'Monto maximo que cubre la aseguradora por evento.'],
    ['Deducible',       'Cantidad que paga el asegurado antes de activar la cobertura.'],
    ['Coaseguro',       'Porcentaje del gasto a cargo del asegurado tras el deducible.'],
    ['Tope Coaseguro',  'Limite maximo del coaseguro por evento o anualidad.'],
    ['Prima',           'Costo total del seguro incluyendo IVA.'],
    ['Nivel hosp.',     'Categoria de hospitales incluidos en la red medica de la poliza.'],
  ];

  const GCW = (CW - 6) / 2;
  const half = Math.ceil(glossary.length / 2);

  function renderGlossCol(items: Array<[string, string]>, ox: number, oy: number): number {
    let gy = oy;
    items.forEach(([term, def]) => {
      doc.setFontSize(5.8);
      setTxt(doc, DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(term + ':', ox, gy);
      doc.setFont('helvetica', 'normal');
      setTxt(doc, MID);
      const lines = doc.splitTextToSize(def, GCW - 26);
      doc.text(lines, ox + 26, gy);
      gy += 4 * Math.max(1, lines.length);
    });
    return gy;
  }

  const gy1 = renderGlossCol(glossary.slice(0, half), ML, y);
  const gy2 = renderGlossCol(glossary.slice(half), ML + GCW + 6, y);
  y = Math.max(gy1, gy2) + 5;

  // ── Recommendation block ──────────────────────────────────────────────────────
  const RH = 19;
  setFill(doc, AL);
  setDraw(doc, AM);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, RH, 2, 2, 'FD');
  setFill(doc, A);
  doc.rect(ML, y, 3, RH, 'F');
  doc.setFontSize(7.5);
  setTxt(doc, AD);
  doc.setFont('helvetica', 'bold');
  doc.text('Nuestra Recomendacion', ML + 6, y + 5.5);
  doc.setFontSize(6.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'normal');
  const recText =
    'Recomendamos ' + safe(bestPlan.nombre) + ' (' + safe(plans[bestIdx].aseguradora) + ') por ofrecer la mejor relacion ' +
    'precio-cobertura. Con una suma asegurada de ' + safe(bestPlan.suma_asegurada) + ', deducible de ' +
    safe(bestPlan.deducible) + ' y coaseguro de ' + safe(bestPlan.coaseguro) +
    ', protege a ' + safe(clientName) + ' con una prima anual de $' + fmt(bestPlan.prima_anual) + '.';
  const recLines = doc.splitTextToSize(recText, CW - 12);
  doc.text(recLines.slice(0, 3), ML + 6, y + 11);

  y += RH + 4;

  // ── Advisor card ──────────────────────────────────────────────────────────────
  const AH = 19;
  setFill(doc, DARK);
  doc.roundedRect(ML, y, CW, AH, 2, 2, 'F');

  // Avatar circle
  setFill(doc, A);
  doc.circle(ML + 11.5, y + AH / 2, 6, 'F');
  const initials = agentName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'A';
  doc.setFontSize(8.5);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text(initials, ML + 11.5, y + AH / 2 + 3, { align: 'center' });

  // Info
  doc.setFontSize(9);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text(agentName || 'Tu asesor', ML + 21, y + 6.5);

  doc.setFontSize(6.5);
  setTxt(doc, lighten(A, 0.65));
  doc.setFont('helvetica', 'normal');
  const contact = [agentEmail, agentPhone, agentWeb].filter(Boolean).join('  |  ');
  doc.text(contact, ML + 21, y + 12);

  // CTA button
  setFill(doc, A);
  doc.roundedRect(PW - MR - 38, y + 4, 36, 11, 2, 2, 'F');
  doc.setFontSize(7.5);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('Solicitar poliza', PW - MR - 20, y + 10.8, { align: 'center' });

  drawFooter(2);

  return doc.output('blob');
}
