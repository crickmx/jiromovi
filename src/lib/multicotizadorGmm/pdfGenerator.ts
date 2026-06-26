import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuotePerson, FormaPago, OptionResult, ProductId } from './types';
import { PRODUCT_LABELS } from './types';
import type { BxplusQuoteInput, BnvQuoteInput, BnpQuoteInput } from './types';
import { COVERAGE_PDF_TEXTS } from '../gmmCoverageHelp';

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

// BNV/BNP store suma_asegurada in millions (MDP) and deducible in thousands
function formatSumaMDP(val: number): string {
  if (!val) return '-';
  return formatCurrency(val * 1000000);
}

function formatDeducibleMiles(val: number): string {
  if (!val) return '-';
  return formatCurrency(val * 1000);
}

function formatTopeCoaseguro(val: number): string {
  if (!val) return 'Sin tope';
  return formatCurrency(val);
}

const NIVEL_DISPLAY_MAP: Record<string, string> = {
  'Alto': 'Elite',
  'Medio': 'Plus',
  'Basico': 'Estandar',
};

function getOptionPlanInfo(opt: OptionResult, optionDef?: MultiGmmOption): Record<string, string> {
  const input = optionDef?.input;
  if (!input) return {};

  if (opt.product_id === 'BXPLUS') {
    const bx = input as BxplusQuoteInput;
    const nivelDisplay = NIVEL_DISPLAY_MAP[bx.nivel_hospitalario] || bx.nivel_hospitalario || '-';
    return {
      producto: 'BX+',
      estado: bx.estado || '-',
      nivel: nivelDisplay,
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

// Draw a rounded rectangle
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

// Draw a card with subtle shadow effect
function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { fillColor?: [number, number, number]; borderColor?: [number, number, number]; radius?: number }
) {
  const radius = options?.radius ?? 2;
  // Shadow
  doc.setFillColor(230, 230, 230);
  doc.setDrawColor(230, 230, 230);
  drawRoundedRect(doc, x + 0.3, y + 0.3, w, h, radius, 'F');
  // Card body
  doc.setFillColor(...(options?.fillColor || [255, 255, 255]));
  doc.setDrawColor(...(options?.borderColor || [225, 225, 230]));
  doc.setLineWidth(0.2);
  drawRoundedRect(doc, x, y, w, h, radius, 'FD');
}

// Draw a colored badge
function drawBadge(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  bgColor: [number, number, number],
  textColor: [number, number, number]
) {
  const textWidth = doc.getTextWidth(text);
  const badgeW = textWidth + 4;
  const badgeH = 4.5;
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...bgColor);
  drawRoundedRect(doc, x, y, badgeW, badgeH, 1.5, 'F');
  doc.setFontSize(5.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...textColor);
  doc.text(text, x + 2, y + 3.2);
  return badgeW;
}

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  optionDefs?: MultiGmmOption[],
  logoUrl?: string,
  folio?: string
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const validOptions = results.filter(r => !r.result.error);
  const numOptions = Math.min(validOptions.length, 3);

  if (numOptions === 0) {
    doc.setFontSize(12);
    doc.text('No hay opciones validas para generar PDF', margin, 30);
    return doc.output('blob');
  }

  // Resolve accent color
  const accentHex = usuario?.oficina?.accent_color || '#0E23E2';
  const accent = hexToRgb(accentHex);
  const accentLight = lightenColor(accent, 0.92);
  const accentMid = lightenColor(accent, 0.7);

  // Find best option (lowest annual total)
  const bestIndex = validOptions.reduce((minIdx, opt, idx) => {
    const currentTotal = safeNumber(opt.result.totals?.['Anual']?.total);
    const minTotal = safeNumber(validOptions[minIdx]?.result.totals?.['Anual']?.total);
    return currentTotal > 0 && (minTotal <= 0 || currentTotal < minTotal) ? idx : minIdx;
  }, 0);

  // ================================================================
  // PAGE 1: HEADER + EXECUTIVE SUMMARY + PLAN COMPARISON
  // ================================================================

  // HEADER BAR
  const headerH = 16;
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageWidth, headerH, 'F');

  // Logo in header
  if (logoUrl) {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, 2, 22, 12);
      } catch { /* skip */ }
    }
  }

  // Title
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Propuesta Comercial - Gastos Medicos Mayores', pageWidth / 2, 8, { align: 'center' });

  // Subtitle info
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(255, 255, 255);
  const subtitleParts: string[] = [];
  if (folio) subtitleParts.push(`Folio: ${folio}`);
  subtitleParts.push(formatDate(new Date()));
  doc.text(subtitleParts.join('  |  '), pageWidth / 2, 13, { align: 'center' });

  yPos = headerH + 5;

  // CLIENT NAME CARD
  if (clientName) {
    drawCard(doc, margin, yPos, contentWidth, 10, { fillColor: accentLight, borderColor: accentMid as [number, number, number] });
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('CLIENTE:', margin + 4, yPos + 6.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(clientName, margin + 24, yPos + 6.5);
    yPos += 13;
  }

  // EXECUTIVE SUMMARY CARDS (one per option)
  const cardGap = 3;
  const cardW = (contentWidth - cardGap * (numOptions - 1)) / numOptions;
  const cardH = 28;

  for (let i = 0; i < numOptions; i++) {
    const opt = validOptions[i];
    const def = optionDefs?.find(d => d.id === opt.option_id);
    const info = getOptionPlanInfo(opt, def);
    const cardX = margin + i * (cardW + cardGap);
    const isBest = numOptions > 1 && i === bestIndex;

    const fillColor: [number, number, number] = isBest ? accentLight : [250, 250, 252];
    const borderColor: [number, number, number] = isBest ? accent : [210, 210, 220];
    drawCard(doc, cardX, yPos, cardW, cardH, { fillColor, borderColor });

    // Option label + product badge
    let labelX = cardX + 3;
    const labelY = yPos + 5;
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(opt.option_label, labelX, labelY);

    // Product badge
    const productLabel = PRODUCT_LABELS[opt.product_id] || opt.product_id;
    const badgeY = labelY + 1.5;
    drawBadge(doc, labelX, badgeY, productLabel, accent, [255, 255, 255]);

    // Best option badge
    if (isBest) {
      const badgeText = 'MEJOR PRECIO';
      const bw = doc.getTextWidth(badgeText) + 4;
      drawBadge(doc, cardX + cardW - bw - 3, yPos + 2, badgeText, [22, 163, 74], [255, 255, 255]);
    }

    // Key details
    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    let detailY = yPos + 13;
    const detailLines = [
      `SA: ${formatAmountDisplay(info.suma_asegurada || '-')}`,
      `Deducible: ${formatAmountDisplay(info.deducible || '-')}`,
      `Coaseguro: ${formatCoaseguroDisplay(info.coaseguro || '-')}`,
    ];
    for (const line of detailLines) {
      doc.text(line, labelX, detailY);
      detailY += 3.5;
    }

    // Annual total (bold, large)
    const total = safeNumber(opt.result.totals?.['Anual']?.total);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text(formatCurrency(total), labelX, yPos + cardH - 3);
    doc.setFontSize(4.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('/ anual', labelX + doc.getTextWidth(formatCurrency(total)) + 1, yPos + cardH - 3);
  }

  yPos += cardH + 5;

  // ================================================================
  // INSURED PERSONS SECTION
  // ================================================================
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('ASEGURADOS', margin, yPos + 3);
  yPos += 5;

  // Persons table
  const personHeaders = ['Nombre', 'Parentesco', 'Genero', 'Edad'];
  for (let i = 0; i < numOptions; i++) {
    personHeaders.push(validOptions[i].option_label);
  }

  const personRows: any[][] = [];
  for (let i = 0; i < people.length; i++) {
    const row: string[] = [
      people[i].name || `Asegurado ${i + 1}`,
      people[i].relation,
      people[i].gender,
      String(people[i].age),
    ];
    for (let j = 0; j < numOptions; j++) {
      const prima = getPersonPrima(validOptions[j], i);
      row.push(formatCurrency(prima));
    }
    personRows.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [personHeaders],
    body: personRows,
    theme: 'plain',
    styles: {
      fontSize: 6,
      cellPadding: 2,
      lineColor: [230, 230, 235],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: accent as any,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5.5,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 12 },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index >= 4) {
        data.cell.styles.halign = 'right';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = accent as any;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // ================================================================
  // PLAN DETAILS COMPARISON TABLE
  // ================================================================
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('DETALLE DE PLANES', margin, yPos + 3);
  yPos += 5;

  const planDetailFields: { label: string; getter: (opt: OptionResult) => string }[] = [
    {
      label: 'Producto',
      getter: (opt) => PRODUCT_LABELS[opt.product_id] || opt.product_id,
    },
    {
      label: 'Estado / Region',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return info.estado || info.region || '-';
      },
    },
    {
      label: 'Nivel Hospitalario',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return info.nivel || '-';
      },
    },
    {
      label: 'Suma Asegurada',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return formatAmountDisplay(info.suma_asegurada || '-');
      },
    },
    {
      label: 'Deducible',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return formatAmountDisplay(info.deducible || '-');
      },
    },
    {
      label: 'Coaseguro',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return formatCoaseguroDisplay(info.coaseguro || '-');
      },
    },
    {
      label: 'Tope Coaseguro',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return info.tope_coaseguro || '-';
      },
    },
  ];

  const planHead = ['Caracteristica'];
  for (let i = 0; i < numOptions; i++) planHead.push(validOptions[i].option_label);

  const planBody: string[][] = [];
  for (const field of planDetailFields) {
    const row = [field.label];
    for (let i = 0; i < numOptions; i++) {
      row.push(field.getter(validOptions[i]));
    }
    planBody.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [planHead],
    body: planBody,
    theme: 'striped',
    styles: {
      fontSize: 6,
      cellPadding: 2,
      lineColor: [230, 230, 235],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [60, 60, 75],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Check page space for coverages
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = margin;
  }

  // ================================================================
  // COBERTURAS ADICIONALES (DIFFERENTIAL COMPARISON)
  // ================================================================
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('COBERTURAS ADICIONALES', margin, yPos + 3);
  yPos += 5;

  const covHead = ['Cobertura'];
  for (let i = 0; i < numOptions; i++) covHead.push(validOptions[i].option_label);

  const covBody: any[][] = [];
  for (const cob of COBERTURAS_ADICIONALES) {
    const row: string[] = [cob.label];
    for (let i = 0; i < numOptions; i++) {
      const def = optionDefs?.find(d => d.id === validOptions[i].option_id);
      const coverages = getOptionCoverages(validOptions[i], def);
      if (validOptions[i].product_id !== 'BXPLUS') {
        row.push('N/A');
      } else {
        row.push(coverages[cob.key] === true ? 'Si' : '-');
      }
    }
    covBody.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [covHead],
    body: covBody,
    theme: 'plain',
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      lineColor: [230, 230, 235],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: accent as any,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5.5,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 255],
    },
    columnStyles: {
      0: { cellWidth: 50, fontSize: 5.5 },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index > 0) {
        const val = String(data.cell.raw);
        data.cell.styles.halign = 'center';
        data.cell.styles.fontSize = 7;
        if (val === 'Si') {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === '-') {
          data.cell.styles.textColor = [200, 60, 60];
        } else {
          data.cell.styles.textColor = [160, 160, 160];
          data.cell.styles.fontSize = 5.5;
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // ================================================================
  // PAGE 2: COST BREAKDOWN + ADVISOR INFO
  // ================================================================
  doc.addPage();
  yPos = margin;

  // Section header
  doc.setFillColor(...accent);
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('RESUMEN DE COSTOS Y FORMAS DE PAGO', margin + 4, yPos + 4.8);
  yPos += 11;

  // Cost summary cards per option
  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const costCardW = (contentWidth - cardGap * (numOptions - 1)) / numOptions;

  for (let i = 0; i < numOptions; i++) {
    const opt = validOptions[i];
    const cardX = margin + i * (costCardW + cardGap);
    const isBest = numOptions > 1 && i === bestIndex;

    // Card title
    const titleCardH = 8;
    const titleFill: [number, number, number] = isBest ? accent : [60, 60, 75];
    doc.setFillColor(...titleFill);
    drawRoundedRect(doc, cardX, yPos, costCardW, titleCardH, 2, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(opt.option_label, cardX + costCardW / 2, yPos + 5.3, { align: 'center' });

    if (isBest) {
      doc.setFontSize(4.5);
      doc.text('\u2605 RECOMENDADA', cardX + costCardW / 2, yPos + titleCardH - 1, { align: 'center' });
    }
  }

  yPos += 12;

  // Payment breakdown table
  const payHead = ['Forma de Pago'];
  for (let i = 0; i < numOptions; i++) payHead.push(validOptions[i].option_label);

  const payBody: string[][] = [];
  for (const fp of formasPago) {
    const row = [fp];
    for (let i = 0; i < numOptions; i++) {
      const t = validOptions[i].result.totals?.[fp];
      if (t) {
        const numRecibos = (t as any).num_recibos || 1;
        if (numRecibos > 1) {
          const primerPago = (t as any).primer_pago || t.total;
          const subsecuentes = (t as any).pagos_subsecuentes || t.total;
          row.push(`Total: ${formatCurrency(t.total)}\n1er pago: ${formatCurrency(primerPago)}\nSubsec: ${formatCurrency(subsecuentes)}`);
        } else {
          row.push(formatCurrency(t.total));
        }
      } else {
        row.push('-');
      }
    }
    payBody.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [payHead],
    body: payBody,
    theme: 'grid',
    styles: {
      fontSize: 6,
      cellPadding: 2.5,
      lineColor: [210, 210, 220],
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 240, 245],
      textColor: [40, 40, 50],
      fontStyle: 'bold',
      fontSize: 6,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
        if (data.row.index === 0) {
          data.cell.styles.fillColor = accentLight;
          data.cell.styles.textColor = accent as any;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 7;
        }
      }
      if (data.section === 'body' && data.column.index === 0 && data.row.index === 0) {
        data.cell.styles.fillColor = accentLight;
        data.cell.styles.textColor = accent as any;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // ================================================================
  // COVERAGE DESCRIPTIONS (only for included BX+ coverages)
  // ================================================================
  const hasBxplus = validOptions.some(o => o.product_id === 'BXPLUS');
  if (hasBxplus) {
    const allCoverageKeys = new Set<string>();
    for (let i = 0; i < numOptions; i++) {
      if (validOptions[i].product_id === 'BXPLUS') {
        const def = optionDefs?.find(d => d.id === validOptions[i].option_id);
        const covs = getOptionCoverages(validOptions[i], def);
        Object.entries(covs).forEach(([k, v]) => { if (v) allCoverageKeys.add(k); });
      }
    }

    if (allCoverageKeys.size > 0) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text('DESCRIPCION DE COBERTURAS ADICIONALES INCLUIDAS', margin, yPos + 3);
      yPos += 6;

      doc.setFontSize(5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(70, 70, 70);

      for (const key of allCoverageKeys) {
        const label = COBERTURAS_ADICIONALES.find(c => c.key === key)?.label || key;
        const desc = COVERAGE_PDF_TEXTS[key] || '';

        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(`\u2022 ${label}`, margin + 2, yPos);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(90, 90, 90);
        const descLines = doc.splitTextToSize(desc, contentWidth - 8);
        yPos += 3;
        descLines.forEach((line: string) => {
          doc.text(line, margin + 4, yPos);
          yPos += 2.5;
        });
        yPos += 1.5;
      }
    }
  }

  // ================================================================
  // ADVISOR CONTACT CARD
  // ================================================================
  if (yPos > pageHeight - 35) {
    doc.addPage();
    yPos = margin;
  }

  yPos += 3;
  const contactCardH = 18;
  drawCard(doc, margin, yPos, contentWidth, contactCardH, { fillColor: accentLight, borderColor: accentMid as [number, number, number] });

  const asesorNombre = usuario?.nombre_publico || usuario?.nombre || 'Asesor';
  const asesorCelular = usuario?.celular_laboral || usuario?.celular || '';
  const asesorWebSlug = usuario?.web_slug || '';
  const asesorEmail = usuario?.email_laboral || usuario?.email || '';

  // Accent bar on left side
  doc.setFillColor(...accent);
  doc.rect(margin, yPos, 2, contactCardH, 'F');

  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('TU ASESOR', margin + 6, yPos + 5);

  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text(asesorNombre, margin + 6, yPos + 10);

  doc.setFontSize(5.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80, 80, 80);
  const contactDetails: string[] = [];
  if (asesorCelular) contactDetails.push(asesorCelular);
  if (asesorEmail) contactDetails.push(asesorEmail);
  if (asesorWebSlug) contactDetails.push(`agentedeseguros.website/${asesorWebSlug}`);
  doc.text(contactDetails.join('  |  '), margin + 6, yPos + 14);

  // Profile image if available
  if (usuario?.imagen_perfil_url) {
    const profileBase64 = await loadImageAsBase64(usuario.imagen_perfil_url);
    if (profileBase64) {
      try {
        const imgX = margin + contentWidth - 16;
        doc.addImage(profileBase64, 'PNG', imgX, yPos + 2, 14, 14);
      } catch { /* skip */ }
    }
  }

  yPos += contactCardH + 5;

  // ================================================================
  // FOOTER - Notes + QR
  // ================================================================
  const footerY = pageHeight - 18;

  // If we're past the footer area, ensure footer is on last page
  if (yPos > footerY - 5) {
    doc.addPage();
  }

  const totalPages = doc.getNumberOfPages();
  // Apply footer to all pages
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Divider line
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    // Legal notes
    doc.setFontSize(4.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(130, 130, 130);
    const notaText = 'Cotizacion valida 15 dias. Aceptacion sujeta a politicas de suscripcion. Coberturas segun Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
    const notaLines = doc.splitTextToSize(notaText, contentWidth - 30);
    let notaY = pageHeight - 15;
    notaLines.forEach((line: string) => {
      doc.text(line, margin, notaY);
      notaY += 2.5;
    });

    // Page number
    doc.setFontSize(5);
    doc.setTextColor(160, 160, 160);
    doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

    // QR-like web reference
    if (asesorWebSlug) {
      doc.setFontSize(5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...accent);
      doc.text(`agentedeseguros.website/${asesorWebSlug}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    // Accent bottom bar
    doc.setFillColor(...accent);
    doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');
  }

  return doc.output('blob');
}
