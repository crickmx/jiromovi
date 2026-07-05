import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OptionResult, QuotePerson, MultiGmmOption } from './types';

// ─── Formatting helpers ───────────────────────────────────────────────────

const fmt = (n: number | undefined | null, d = 0) =>
  n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const safe = (s: string) =>
  (s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/\u2022/g, '*');

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

// ─── Colour helpers ───────────────────────────────────────────────────────

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten([r, g, b]: RGB, t: number): RGB {
  return [
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t),
  ];
}

function darken([r, g, b]: RGB, t: number): RGB {
  return [Math.round(r * (1 - t)), Math.round(g * (1 - t)), Math.round(b * (1 - t))];
}

function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function setTxt(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }

function rule(doc: jsPDF, x: number, y: number, w: number, c: RGB) {
  setDraw(doc, c);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + w, y);
}

// ─── Business logic ───────────────────────────────────────────────────────

const PRODUCT_TAG: Record<string, string> = {
  BXPLUS: 'BX+ Unikuz',
  BNV: 'Bupa Vital',
  BNP: 'Bupa Plus',
};

interface PlanMeta {
  nombre: string;
  aseguradora: string;
  deducible: any;
  coaseguro: any;
  topeCoaseguro: any;
  sumaAsegurada: any;
  primas: Record<string, number>;
  hospitalNetwork: string;
}

function planInfo(r: OptionResult): PlanMeta {
  const p = r.result as any;
  if (r.product_id === 'BXPLUS') {
    const q = p.quote ?? {};
    return {
      nombre: safe(q.plan_name ?? r.option_label ?? 'BX+ Unikuz'),
      aseguradora: 'GNP Seguros',
      deducible: q.deductible ?? '—',
      coaseguro: q.coinsurance ?? '—',
      topeCoaseguro: q.coinsurance_cap ?? '—',
      sumaAsegurada: q.sum_assured ?? '—',
      primas: (q.payment_options ?? {}) as Record<string, number>,
      hospitalNetwork: q.hospital_network ?? '—',
    };
  }
  const q = p.cotizacion ?? p;
  return {
    nombre: safe(q.plan ?? r.option_label ?? (r.product_id === 'BNV' ? 'Bupa Nacional Vital' : 'Bupa Nacional Plus')),
    aseguradora: 'Bupa Mexico',
    deducible: q.deducible ?? '—',
    coaseguro: q.coaseguro ?? '—',
    topeCoaseguro: q.tope_coaseguro ?? '—',
    sumaAsegurada: q.suma_asegurada ?? '—',
    primas: (q.formas_pago ?? {}) as Record<string, number>,
    hospitalNetwork: q.red_hospitalaria ?? '—',
  };
}

function getAnual(primas: Record<string, number>): number {
  return primas['Anual'] ?? primas['anual'] ?? primas['ANUAL'] ?? primas['Annual'] ?? 0;
}

function personPrima(person: QuotePerson, r: OptionResult): number {
  const p = r.result as any;
  if (r.product_id === 'BXPLUS') {
    const list: Array<{ name?: string; annual?: number }> = p.quote?.insured_list ?? [];
    const m = list.find(i =>
      (i.name ?? '').toLowerCase().includes((person.name ?? '').toLowerCase().split(' ')[0])
    );
    return m?.annual ?? 0;
  }
  const members: Array<{ nombre?: string; prima_anual?: number }> =
    p.cotizacion?.miembros ?? p.miembros ?? [];
  const m = members.find(i =>
    (i.nombre ?? '').toLowerCase().includes((person.name ?? '').toLowerCase().split(' ')[0])
  );
  return m?.prima_anual ?? 0;
}

function fmtSA(v: any): string {
  if (typeof v === 'number') return '$' + fmt(v) + ' MXN';
  if (typeof v === 'string' && v.includes('USD')) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    if (!isNaN(n)) return '$' + fmt(n) + ' MXN';
  }
  return v ?? '—';
}

const fmtDed  = (v: any) => typeof v === 'number' ? '$' + fmt(v) : (v ?? '—');
const fmtCoas = (v: any) => typeof v === 'number' ? v + '%' : (v ?? '—');
const fmtTope = (v: any) => typeof v === 'number' ? '$' + fmt(v) : (v ?? '—');

function bxCoverageChips(r: OptionResult): string[] {
  const q = (r.result as any).quote;
  if (!q) return [];
  const map: Array<[string, string]> = [
    ['maternity', 'Maternidad'], ['dental', 'Dental'], ['vision', 'Vision'],
    ['mental_health', 'Salud Mental'], ['preventive', 'Preventivo'],
    ['international', 'Internacional'], ['emergency_abroad', 'Emergencia Ext.'],
    ['ambulance', 'Ambulancia'], ['telemedicine', 'Telemedicina'],
    ['nutrition', 'Nutricion'], ['chronic_disease', 'Enf. Cronicas'],
  ];
  return map.filter(([k]) => q[k]).map(([, v]) => v);
}

// ─── Main export ──────────────────────────────────────────────────────────

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  _optionDefs?: MultiGmmOption[],
  logoUrl?: string,
  folio?: string
): Promise<Blob> {

  // Palette
  const accentHex: string = usuario?.oficina?.accent_color ?? '#1D4ED8';
  const A   = hexToRgb(accentHex);
  const AL  = lighten(A, 0.91);
  const AM  = lighten(A, 0.72);
  const AD  = darken(A, 0.10);
  const DARK:  RGB = [28,  30,  40];
  const MID:   RGB = [72,  75,  90];
  const SUB:   RGB = [120, 124, 138];
  const GREEN: RGB = [22,  163, 74];
  const AMBER: RGB = [180, 90,  0];
  const TEAL:  RGB = [14,  116, 144];
  const WHITE: RGB = [255, 255, 255];
  const LIGHT: RGB = [245, 246, 250];

  // Doc setup
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW = 215.9;
  const PH = 279.4;
  const ML = 12;
  const MR = 12;
  const CW = PW - ML - MR;
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  let logoB64: string | null = null;
  if (logoUrl) logoB64 = await toBase64(logoUrl);

  const agentName  = safe(usuario?.nombre_completo ?? usuario?.nombre ?? 'Asesor');
  const agentEmail = safe(usuario?.email ?? '');
  const agentPhone = safe(usuario?.telefono ?? usuario?.phone ?? '');
  const agentWeb   = safe(usuario?.oficina?.website ?? usuario?.oficina?.nombre ?? '');
  const folioStr   = folio ? 'Folio: ' + folio : '';

  const bestIdx = results.reduce((bi, r, i) => {
    const pa = getAnual(planInfo(r).primas);
    const pb = getAnual(planInfo(results[bi]).primas);
    return pa > 0 && (pb === 0 || pa < pb) ? i : bi;
  }, 0);
  const best = planInfo(results[bestIdx]);

  // ── Footer ──────────────────────────────────────────────────────────────

  const FH = 9;

  function drawFooter(pg: number) {
    const fy = PH - FH;
    setFill(doc, AL);
    doc.rect(0, fy, PW, FH, 'F');
    rule(doc, 0, fy, PW, AM);
    doc.setFontSize(6.2);
    setTxt(doc, SUB);
    doc.setFont('helvetica', 'normal');
    doc.text('Cotizacion con fines informativos. Sujeto a emision y aceptacion de la aseguradora.', ML, fy + 3.6);
    if (agentWeb) doc.text(agentWeb, ML, fy + 6.8);
    doc.setFontSize(7);
    setTxt(doc, MID);
    doc.setFont('helvetica', 'bold');
    doc.text(pg + ' / 2', PW - MR, fy + 5.5, { align: 'right' });
  }

  // ── Mini-header (page 2) ─────────────────────────────────────────────────

  const MHH = 10;

  function drawMiniHeader() {
    setFill(doc, A);
    doc.rect(0, 0, PW, MHH, 'F');
    doc.setFontSize(7);
    setTxt(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.text(safe('Cotizacion GMM - ' + clientName), ML, 6.5);
    doc.setFont('helvetica', 'normal');
    if (folioStr) doc.text(folioStr, PW - MR, 6.5, { align: 'right' });
  }

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ════════════════════════════════════════════════════════════════════════

  let y = 0;

  // Full-bleed header
  const HDR = 34;
  setFill(doc, A);
  doc.rect(0, 0, PW, HDR, 'F');
  setFill(doc, AD);
  doc.rect(0, HDR - 1.5, PW, 1.5, 'F');

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', ML, 5, 28, 14, undefined, 'FAST'); } catch { /* skip */ }
  } else {
    doc.setFontSize(12);
    setTxt(doc, WHITE);
    doc.setFont('helvetica', 'bold');
    doc.text(agentWeb || agentName, ML, 14);
  }

  doc.setFontSize(16);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACION DE SEGURO GMM', PW - MR, 12, { align: 'right' });
  doc.setFontSize(7.5);
  setTxt(doc, AL);
  doc.setFont('helvetica', 'normal');
  doc.text('Gastos Medicos Mayores  •  ' + today, PW - MR, 18, { align: 'right' });
  if (folioStr) doc.text(folioStr, PW - MR, 23.5, { align: 'right' });

  y = HDR + 3.5;

  // Client strip
  setFill(doc, LIGHT);
  setDraw(doc, AM);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, y, CW, 8.5, 1.5, 1.5, 'FD');
  doc.setFontSize(8);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Prospecto:', ML + 3, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(safe(clientName), ML + 23, y + 5.5);

  const contratante = people.find(p => p.relationship === 'Contratante' || p.parentesco === 'Contratante');
  if (contratante) {
    const age = contratante.dob
      ? new Date().getFullYear() - new Date(contratante.dob).getFullYear()
      : null;
    doc.setFontSize(7);
    setTxt(doc, MID);
    const txt = age
      ? 'Titular: ' + safe(contratante.name ?? '') + '  •  ' + age + ' anos'
      : safe(contratante.name ?? '');
    doc.text(txt, PW - MR, y + 5.5, { align: 'right' });
  }

  y += 12;

  // Hero recommendation banner
  const bestAnual = getAnual(best.primas);
  setFill(doc, AD);
  doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
  doc.setFontSize(7.5);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('Recomendado: ' + best.nombre + '  (' + (PRODUCT_TAG[results[bestIdx].product_id] ?? results[bestIdx].product_id) + ')', ML + 4, y + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Prima anual: $' + fmt(bestAnual, 0) +
    '  •  Deducible: ' + safe(String(fmtDed(best.deducible))) +
    '  •  Coaseguro: ' + safe(String(fmtCoas(best.coaseguro))) +
    '  •  SA: ' + safe(fmtSA(best.sumaAsegurada)),
    ML + 4,
    y + 8.2
  );

  y += 14;

  // Option cards
  const COLS  = Math.min(results.length, 3);
  const CARDW = (CW - (COLS - 1) * 3) / COLS;
  const CARDH = 34;

  for (let i = 0; i < COLS; i++) {
    const r    = results[i];
    const info = planInfo(r);
    const anual = getAnual(info.primas);
    const cx   = ML + i * (CARDW + 3);
    const isBest = i === bestIdx;

    setFill(doc, isBest ? AD : LIGHT);
    setDraw(doc, isBest ? A : AM);
    doc.setLineWidth(isBest ? 0.55 : 0.2);
    doc.roundedRect(cx, y, CARDW, CARDH, 2, 2, 'FD');

    if (isBest) {
      setFill(doc, GREEN);
      setDraw(doc, GREEN);
      doc.roundedRect(cx + CARDW - 23, y - 3, 22, 5, 1.5, 1.5, 'FD');
      doc.setFontSize(5);
      setTxt(doc, WHITE);
      doc.setFont('helvetica', 'bold');
      doc.text('RECOMENDADO', cx + CARDW - 12, y + 0, { align: 'center' });
    }

    doc.setFontSize(5.2);
    setTxt(doc, isBest ? AL : SUB);
    doc.setFont('helvetica', 'bold');
    doc.text(PRODUCT_TAG[r.product_id] ?? r.product_id, cx + 3, y + 4.5);

    doc.setFontSize(8);
    setTxt(doc, isBest ? WHITE : DARK);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(info.nombre, CARDW - 5);
    doc.text(nameLines.slice(0, 2), cx + 3, y + 9);

    const specY = y + 16.5;
    const sw = (CARDW - 6) / 3;
    const specs = [
      { lbl: 'Deducible', val: fmtDed(info.deducible) },
      { lbl: 'Coas.',     val: fmtCoas(info.coaseguro) },
      { lbl: 'Tope',      val: fmtTope(info.topeCoaseguro) },
    ];
    specs.forEach((s, si) => {
      const sx = cx + 3 + si * sw;
      doc.setFontSize(5);
      setTxt(doc, isBest ? AL : SUB);
      doc.setFont('helvetica', 'normal');
      doc.text(s.lbl, sx, specY);
      doc.setFontSize(6.5);
      setTxt(doc, isBest ? WHITE : DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(safe(String(s.val)), sx, specY + 4);
    });

    // BX+ coverage chips
    if (r.product_id === 'BXPLUS') {
      const chips = bxCoverageChips(r).slice(0, 5);
      let chipX = cx + 3;
      const chipY = specY + 7;
      chips.forEach(chip => {
        const cw2 = doc.getTextWidth(chip) + 3;
        if (chipX + cw2 > cx + CARDW - 1.5) return;
        setFill(doc, isBest ? lighten(A, 0.40) : AL);
        doc.roundedRect(chipX, chipY, cw2, 3.8, 0.8, 0.8, 'F');
        doc.setFontSize(4.8);
        setTxt(doc, isBest ? WHITE : AD);
        doc.setFont('helvetica', 'normal');
        doc.text(chip, chipX + 1.5, chipY + 2.8);
        chipX += cw2 + 1.2;
      });
    }

    // Annual price
    doc.setFontSize(9.5);
    setTxt(doc, isBest ? WHITE : A);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + fmt(anual, 0), cx + CARDW - 3, y + CARDH - 7.5, { align: 'right' });
    doc.setFontSize(5);
    setTxt(doc, isBest ? AL : SUB);
    doc.setFont('helvetica', 'normal');
    doc.text('/anual', cx + CARDW - 3, y + CARDH - 3.5, { align: 'right' });

    // SA footnote
    doc.setFontSize(5);
    setTxt(doc, isBest ? AL : SUB);
    doc.setFont('helvetica', 'normal');
    doc.text('SA: ' + safe(fmtSA(info.sumaAsegurada)), cx + 3, y + CARDH - 2.5);
  }

  y += CARDH + 4;

  // 4 KPI mini cards
  const kpis: Array<{ label: string; value: string; color: RGB }> = [
    { label: 'Opciones',          value: String(results.length),   color: A },
    { label: 'Asegurados',        value: String(people.length),    color: TEAL },
    { label: 'Menor prima anual', value: '$' + fmt(bestAnual, 0),  color: GREEN },
    { label: 'Mejor deducible',   value: safe(String(fmtDed(best.deducible))), color: AMBER },
  ];

  const KW = (CW - 9) / 4;
  const KH = 11;

  kpis.forEach((k, i) => {
    const kx = ML + i * (KW + 3);
    setFill(doc, lighten(k.color, 0.88));
    setDraw(doc, lighten(k.color, 0.70));
    doc.setLineWidth(0.2);
    doc.roundedRect(kx, y, KW, KH, 1.5, 1.5, 'FD');
    setFill(doc, k.color);
    doc.rect(kx, y, 2, KH, 'F');
    doc.setFontSize(5);
    setTxt(doc, MID);
    doc.setFont('helvetica', 'normal');
    doc.text(k.label, kx + 4, y + 4);
    doc.setFontSize(8.5);
    setTxt(doc, darken(k.color, 0.15));
    doc.setFont('helvetica', 'bold');
    doc.text(safe(k.value), kx + 4, y + 9.5);
  });

  y += KH + 4;

  // Insured table
  doc.setFontSize(7.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Asegurados cotizados', ML, y + 3.5);
  rule(doc, ML, y + 5, CW, AM);
  y += 7;

  const insuredRows = people.map(p => {
    const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : null;
    const primas = results.slice(0, 3).map(r => {
      const pa = personPrima(p, r);
      return pa > 0 ? '$' + fmt(pa, 0) : '—';
    });
    return [
      safe(p.name ?? ''),
      safe(p.relationship ?? (p as any).parentesco ?? '—'),
      age ? age + ' anos' : (p.dob ? fmtDate(p.dob) : '—'),
      ...primas,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Nombre', 'Parentesco', 'Edad', ...results.slice(0, 3).map((r, i) => safe(r.option_label ?? 'Op. ' + (i + 1)))]],
    body: insuredRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.2, cellPadding: 1.4, lineColor: [220, 222, 230] as RGB, lineWidth: 0.15 },
    headStyles: { fillColor: A as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: 'bold', fontSize: 6.2, cellPadding: 1.6 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
  });

  drawFooter(1);

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 2
  // ════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 0;

  drawMiniHeader();
  y = MHH + 4;

  // Plan comparison table
  doc.setFontSize(7.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparativo de Planes', ML, y + 3.5);
  rule(doc, ML, y + 5, CW, AM);
  y += 8;

  const compRows = [
    ['Aseguradora',    ...results.slice(0, 3).map(r => safe(planInfo(r).aseguradora))],
    ['Suma Asegurada', ...results.slice(0, 3).map(r => safe(fmtSA(planInfo(r).sumaAsegurada)))],
    ['Deducible',      ...results.slice(0, 3).map(r => safe(String(fmtDed(planInfo(r).deducible))))],
    ['Coaseguro',      ...results.slice(0, 3).map(r => safe(String(fmtCoas(planInfo(r).coaseguro))))],
    ['Tope coaseguro', ...results.slice(0, 3).map(r => safe(String(fmtTope(planInfo(r).topeCoaseguro))))],
    ['Red hospitalaria', ...results.slice(0, 3).map(r => safe(planInfo(r).hospitalNetwork))],
    ['Prima anual',    ...results.slice(0, 3).map(r => '$' + fmt(getAnual(planInfo(r).primas), 0))],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Caracteristica', ...results.slice(0, 3).map((r, i) => safe(r.option_label ?? 'Op. ' + (i + 1)))]],
    body: compRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.2, cellPadding: 1.4, lineColor: [220, 222, 230] as RGB, lineWidth: 0.15 },
    headStyles: { fillColor: A as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: 'bold', fontSize: 6.2, cellPadding: 1.6 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: DARK as [number,number,number], cellWidth: 38 } },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === bestIdx + 1) {
        data.cell.styles.fillColor = lighten(A, 0.85) as [number,number,number];
        data.cell.styles.textColor = darken(A, 0.1) as [number,number,number];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Payment forms table
  doc.setFontSize(7.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Formas de Pago', ML, y + 3.5);
  rule(doc, ML, y + 5, CW, AM);
  y += 8;

  const formasPago = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const payRows = formasPago.map(fp => [
    fp,
    ...results.slice(0, 3).map(r => {
      const primas = planInfo(r).primas;
      const v = primas[fp] ?? primas[fp.toLowerCase()] ?? primas[fp.toUpperCase()];
      return v ? '$' + fmt(v as number, 0) : '—';
    }),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Forma de Pago', ...results.slice(0, 3).map((r, i) => safe(r.option_label ?? 'Op. ' + (i + 1)))]],
    body: payRows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 6.2, cellPadding: 1.4, lineColor: [220, 222, 230] as RGB, lineWidth: 0.15 },
    headStyles: { fillColor: AD as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: 'bold', fontSize: 6.2, cellPadding: 1.6 },
    alternateRowStyles: { fillColor: LIGHT as [number,number,number] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: DARK as [number,number,number], cellWidth: 38 } },
    tableLineColor: AM as [number,number,number],
    tableLineWidth: 0.2,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === bestIdx + 1) {
        data.cell.styles.fillColor = lighten(A, 0.85) as [number,number,number];
        data.cell.styles.textColor = darken(A, 0.1) as [number,number,number];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Compact 2-column glossary
  doc.setFontSize(7.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Glosario', ML, y + 3.5);
  rule(doc, ML, y + 5, CW, AM);
  y += 8;

  const glossary: Array<[string, string]> = [
    ['Suma Asegurada', 'Monto maximo de cobertura por evento.'],
    ['Deducible',      'Cantidad que el asegurado paga antes de activar el seguro.'],
    ['Coaseguro',      'Porcentaje a cargo del asegurado despues del deducible.'],
    ['Tope coaseguro', 'Limite maximo del coaseguro por evento.'],
    ['Prima',          'Costo del seguro en el periodo seleccionado.'],
    ['Red hospitalaria','Hospitales y medicos con convenio en la poliza.'],
  ];

  const GCW = (CW - 5) / 2;
  const half = Math.ceil(glossary.length / 2);

  function renderGlossCol(items: Array<[string, string]>, ox: number, oy: number): number {
    let gy = oy;
    items.forEach(([term, def]) => {
      doc.setFontSize(5.8);
      setTxt(doc, DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(safe(term) + ':', ox, gy);
      doc.setFont('helvetica', 'normal');
      setTxt(doc, MID);
      const lines = doc.splitTextToSize(safe(def), GCW - 28);
      doc.text(lines, ox + 28, gy);
      gy += 4.2 * Math.max(1, lines.length);
    });
    return gy;
  }

  const gy1 = renderGlossCol(glossary.slice(0, half), ML, y);
  const gy2 = renderGlossCol(glossary.slice(half), ML + GCW + 5, y);
  y = Math.max(gy1, gy2) + 4;

  // Recommendation block
  const RH = 17;
  setFill(doc, AL);
  setDraw(doc, AM);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, RH, 2, 2, 'FD');
  setFill(doc, A);
  doc.rect(ML, y, 3, RH, 'F');

  doc.setFontSize(7.5);
  setTxt(doc, AD);
  doc.setFont('helvetica', 'bold');
  doc.text('Nuestra Recomendacion', ML + 6, y + 5);

  doc.setFontSize(6.5);
  setTxt(doc, DARK);
  doc.setFont('helvetica', 'normal');
  const recText =
    'El plan ' + safe(best.nombre) + ' ofrece la mejor relacion costo-beneficio para el perfil cotizado, ' +
    'con suma asegurada de ' + safe(fmtSA(best.sumaAsegurada)) + ', deducible de ' +
    safe(String(fmtDed(best.deducible))) + ' y coaseguro de ' + safe(String(fmtCoas(best.coaseguro))) +
    ' con tope de ' + safe(String(fmtTope(best.topeCoaseguro))) + '.';
  const recLines = doc.splitTextToSize(recText, CW - 12);
  doc.text(recLines.slice(0, 2), ML + 6, y + 10.5);

  y += RH + 4;

  // Advisor card
  const AH = 17;
  setFill(doc, DARK);
  doc.roundedRect(ML, y, CW, AH, 2, 2, 'F');

  setFill(doc, A);
  doc.circle(ML + 10.5, y + AH / 2, 5.5, 'F');
  doc.setFontSize(8);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  const initials = agentName.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  doc.text(initials, ML + 10.5, y + AH / 2 + 2.8, { align: 'center' });

  doc.setFontSize(8);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text(agentName, ML + 19, y + 6.5);

  doc.setFontSize(6.5);
  setTxt(doc, lighten(A, 0.65));
  doc.setFont('helvetica', 'normal');
  const contactParts = [agentEmail, agentPhone, agentWeb].filter(Boolean);
  doc.text(contactParts.join('  |  '), ML + 19, y + 12);

  setFill(doc, A);
  doc.roundedRect(PW - MR - 36, y + 3.5, 34, 10, 2, 2, 'F');
  doc.setFontSize(7);
  setTxt(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text('Solicitar Poliza', PW - MR - 19, y + 10, { align: 'center' });

  drawFooter(2);

  return doc.output('blob');
}
