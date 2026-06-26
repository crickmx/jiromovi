import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuotePerson, FormaPago, OptionResult, ProductId } from './types';
import { PRODUCT_LABELS, BXPLUS_COVERAGE_LABELS } from './types';
import type { BxplusQuoteInput, BnvQuoteInput, BnpQuoteInput } from './types';

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

function safeString(value: any, defaultValue: string = '-'): string {
  return value != null && String(value).trim() !== '' ? String(value) : defaultValue;
}

interface AsesorInfo {
  nombre: string;
  celular?: string;
  web_slug?: string;
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

const COBERTURAS_ADICIONALES = [
  { key: 'reconocimiento_antiguedad', label: 'Reconocimiento de antiguedad', description: 'Periodo de espera reducido' },
  { key: 'medicamentos_fuera', label: 'Medicamentos ambulatorios', description: 'Reembolso fuera del hospital' },
  { key: 'complicaciones_no_amparadas', label: 'Complicaciones no amparadas', description: 'Derivadas de padecimientos excluidos' },
  { key: 'padecimientos_preexistentes', label: 'Padecimientos preexistentes', description: 'Previos a la poliza' },
  { key: 'eliminacion_deducible_accidente', label: 'Sin deducible por accidente', description: 'Elimina deducible en accidentes' },
  { key: 'multiregion', label: 'Multiregion', description: 'Diferentes estados de la republica' },
  { key: 'vip', label: 'Beneficio VIP', description: 'Servicios premium' },
  { key: 'emergencia_medica_extranjero', label: 'Emergencias en extranjero', description: 'Cobertura internacional de urgencias' },
  { key: 'enfermedades_graves_extranjero', label: 'Enf. graves en extranjero', description: 'Tratamiento fuera de Mexico' },
  { key: 'cobertura_internacional', label: 'Cobertura internacional', description: 'Atencion en cualquier pais' },
  { key: 'ampliacion_servicios', label: 'Ampliacion de servicios', description: 'Servicios medicos adicionales' },
  { key: 'ayuda_diaria', label: 'Ayuda diaria hospitalizacion', description: 'Pago por dia hospitalizado' },
  { key: 'indemnizacion_eg', label: 'Indemnizacion enf. graves', description: 'Pago unico al diagnostico' },
  { key: 'maternidad', label: 'Maternidad', description: 'Gastos de parto y complicaciones' },
  { key: 'xtensuz', label: 'Xtensuz', description: 'Extension de servicios' },
];

function getOptionPlanInfo(opt: OptionResult, optionDef?: MultiGmmOption): Record<string, string> {
  const input = optionDef?.input;
  if (!input) return {};

  if (opt.product_id === 'BXPLUS') {
    const bx = input as BxplusQuoteInput;
    return {
      producto: 'BX+',
      estado: bx.estado || '-',
      nivel: bx.nivel_hospitalario || '-',
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
      suma_asegurada: String(bnv.suma_asegurada || '-'),
      deducible: String(bnv.deducible || '-'),
      coaseguro: String(bnv.coaseguro || '-'),
      tope_coaseguro: String(bnv.tope_coaseguro || '-'),
    };
  } else {
    const bnp = input as BnpQuoteInput;
    return {
      producto: 'Bupa Nacional Plus',
      region: bnp.region_zone || '-',
      suma_asegurada: String(bnp.suma_asegurada || '-'),
      deducible: String(bnp.deducible || '-'),
      coaseguro: String(bnp.coaseguro || '-'),
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
  const margin = 8;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const validOptions = results.filter(r => !r.result.error);
  const numOptions = Math.min(validOptions.length, 3);

  if (numOptions === 0) {
    doc.setFontSize(12);
    doc.text('No hay opciones validas para generar PDF', margin, 30);
    return doc.output('blob');
  }

  // ============================================
  // HEADER
  // ============================================
  const headerHeight = 18;

  if (logoUrl) {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, yPos, 25, 12);
      } catch { /* skip */ }
    }
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Comparativo de Opciones GMM', pageWidth / 2, yPos + 7, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  const infoX = pageWidth - margin;
  if (folio) {
    doc.text(`Folio: ${folio}`, infoX, yPos + 4, { align: 'right' });
  }
  doc.text(`${formatDate(new Date())}`, infoX, yPos + 8, { align: 'right' });
  if (clientName) {
    doc.text(`Cliente: ${clientName}`, infoX, yPos + 12, { align: 'right' });
  }

  yPos += headerHeight;

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 3;

  // ============================================
  // TABLA COMPARATIVA
  // ============================================

  const bestIndex = validOptions.reduce((minIdx, opt, idx) => {
    const currentTotal = safeNumber(opt.result.totals?.['Anual']?.total);
    const minTotal = safeNumber(validOptions[minIdx]?.result.totals?.['Anual']?.total);
    return currentTotal > 0 && currentTotal < minTotal ? idx : minIdx;
  }, 0);

  const tableData: any[][] = [];

  // SECCION 1: INFORMACION DEL PLAN
  const headerRow = ['INFORMACION DEL PLAN'];
  for (let i = 0; i < numOptions; i++) {
    const isBest = numOptions > 1 && i === bestIndex;
    const productLabel = PRODUCT_LABELS[validOptions[i].product_id] || validOptions[i].product_id;
    headerRow.push(isBest ? `\u2605 ${validOptions[i].option_label}\n(${productLabel})` : `${validOptions[i].option_label}\n(${productLabel})`);
  }
  tableData.push(headerRow);

  // Plan detail rows
  const planFields: { label: string; getter: (opt: OptionResult, idx: number) => string }[] = [
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
        return info.nivel || info.producto || '-';
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
      label: 'Tope de Coaseguro',
      getter: (opt) => {
        const def = optionDefs?.find(d => d.id === opt.option_id);
        const info = getOptionPlanInfo(opt, def);
        return info.tope_coaseguro || '-';
      },
    },
  ];

  for (const field of planFields) {
    const row = [field.label];
    validOptions.slice(0, numOptions).forEach((opt) => {
      row.push(field.getter(opt, 0));
    });
    tableData.push(row);
  }

  // SECCION 2: ASEGURADOS
  const aseguradosHeaderRow = ['ASEGURADOS'];
  for (let i = 0; i < numOptions; i++) aseguradosHeaderRow.push('');
  tableData.push(aseguradosHeaderRow);

  for (let i = 0; i < people.length; i++) {
    const insuredRow = [`${people[i].name || `Asegurado ${i + 1}`}`];
    validOptions.slice(0, numOptions).forEach((opt) => {
      const prima = getPersonPrima(opt, i);
      insuredRow.push(`${people[i].gender}, ${people[i].age} anos\nPrima: ${formatCurrency(prima)}`);
    });
    tableData.push(insuredRow);
  }

  // SECCION 3: COBERTURAS BASICAS
  const coberturasBasicasRow = ['COBERTURAS BASICAS'];
  for (let i = 0; i < numOptions; i++) coberturasBasicasRow.push('');
  tableData.push(coberturasBasicasRow);

  const coberturasBasicasTexto = [
    '\u2713 Hospitalizacion',
    '\u2713 Honorarios medicos',
    '\u2713 Medicamentos en hospital',
    '\u2713 Cirugias',
    '\u2713 Analisis clinicos',
    '\u2713 Estudios de gabinete',
    '\u2713 Ambulancia terrestre y aerea',
    '\u2713 Terapias fisicas',
    '\u2713 Enfermeria privada',
    '\u2713 Urgencias por accidente',
    '\u2713 Urgencias por enfermedad',
    '\u2713 Gastos funerarios',
    '\u2713 Segunda opinion medica',
  ].join('\n');

  const cobBasicaRow = [coberturasBasicasTexto];
  for (let i = 0; i < numOptions; i++) cobBasicaRow.push('\u2713 INCLUIDAS');
  tableData.push(cobBasicaRow);

  // SECCION 4: COBERTURAS ADICIONALES
  const coberturasAddHeaderRow = ['COBERTURAS ADICIONALES'];
  for (let i = 0; i < numOptions; i++) coberturasAddHeaderRow.push('');
  tableData.push(coberturasAddHeaderRow);

  for (const cobertura of COBERTURAS_ADICIONALES) {
    const cobRow = [`${cobertura.label}\n${cobertura.description}`];
    validOptions.slice(0, numOptions).forEach((opt) => {
      const def = optionDefs?.find(d => d.id === opt.option_id);
      const coverages = getOptionCoverages(opt, def);
      const isIncluded = coverages[cobertura.key] === true;
      cobRow.push(isIncluded ? '\u2713 SI' : '\u2717 NO');
    });
    tableData.push(cobRow);
  }

  // SECCION 5: TOTALES
  const totalHeaderRow = ['TOTAL A PAGAR'];
  for (let i = 0; i < numOptions; i++) totalHeaderRow.push('');
  tableData.push(totalHeaderRow);

  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  for (const fp of formasPago) {
    const row = [`Pago ${fp}`];
    validOptions.slice(0, numOptions).forEach(opt => {
      const t = opt.result.totals?.[fp];
      if (t) {
        const numRecibos = (t as any).num_recibos || 1;
        if (numRecibos > 1) {
          const primerPago = (t as any).primer_pago || t.total;
          const subsecuentes = (t as any).pagos_subsecuentes || t.total;
          row.push(`${formatCurrency(t.total)}\n1er: ${formatCurrency(primerPago)}\nSubsec: ${formatCurrency(subsecuentes)}`);
        } else {
          row.push(formatCurrency(t.total));
        }
      } else {
        row.push('-');
      }
    });
    tableData.push(row);
  }

  // ============================================
  // GENERAR TABLA CON AUTOTABLE
  // ============================================

  const labelColWidth = 70;
  const availableWidth = contentWidth - labelColWidth;
  const optionColWidth = numOptions === 1
    ? availableWidth * 0.4
    : availableWidth / numOptions;

  const columnStyles: any = {
    0: {
      cellWidth: labelColWidth,
      fontStyle: 'bold',
      fontSize: 6.5,
      fillColor: [240, 240, 245],
    },
  };

  for (let i = 1; i <= numOptions; i++) {
    columnStyles[i] = {
      cellWidth: optionColWidth,
      halign: 'center',
      fontSize: 6.5,
    };
  }

  autoTable(doc, {
    startY: yPos,
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },
    columnStyles,
    margin: { left: margin, right: margin },
    didParseCell: function (data) {
      const rowText = String(data.cell.raw || '');

      // Section headers
      if (data.column.index === 0 && (
        rowText.includes('INFORMACION') ||
        rowText.includes('ASEGURADOS') ||
        rowText.includes('COBERTURAS BASICAS') ||
        rowText.includes('COBERTURAS ADICIONALES') ||
        rowText.includes('TOTAL A PAGAR')
      )) {
        data.cell.styles.fillColor = [0, 51, 102];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
        data.cell.styles.cellPadding = 1.5;
      }

      // Option headers (first row)
      if (data.row.index === 0 && data.column.index > 0) {
        const isBest = rowText.includes('\u2605');
        data.cell.styles.fillColor = isBest ? [0, 153, 51] : [0, 102, 204];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7.5;
      }

      // Basic coverages list in left column
      if (data.column.index === 0 && rowText.includes('\u2713 Hospitalizacion')) {
        data.cell.styles.textColor = [0, 153, 51];
        data.cell.styles.fontSize = 5.5;
        data.cell.styles.valign = 'top';
        data.cell.styles.cellPadding = 2;
      }

      // Basic coverages: INCLUIDAS
      if (data.column.index > 0 && rowText === '\u2713 INCLUIDAS') {
        data.cell.styles.textColor = [0, 153, 51];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle';
      }

      // Coverage check marks
      if (data.column.index > 0 && (rowText.includes('\u2713 SI') || rowText.includes('\u2717 NO'))) {
        if (rowText.includes('\u2713 SI')) {
          data.cell.styles.textColor = [0, 153, 51];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 6;
        } else {
          data.cell.styles.textColor = [200, 50, 50];
          data.cell.styles.fontSize = 6;
        }
      }

      // Coverage descriptions in left column (smaller text)
      if (data.column.index === 0 && rowText.includes('\n') &&
          !rowText.includes('COBERT') && !rowText.includes('ASEGURADOS') &&
          !rowText.includes('INFORMACION') && !rowText.includes('TOTAL') &&
          !rowText.includes('\u2713 Hospitalizacion')) {
        data.cell.styles.fontSize = 5;
        data.cell.styles.textColor = [100, 100, 100];
      }

      // Payment totals - highlight
      if (data.column.index === 0 && rowText.startsWith('Pago ')) {
        data.cell.styles.fillColor = [255, 250, 230];
      }
      if (data.column.index > 0 && rowText.includes('$') && String(tableData[data.row.index]?.[0]).startsWith('Pago ')) {
        data.cell.styles.fillColor = [255, 250, 230];
        data.cell.styles.textColor = [0, 102, 51];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 6.5;
      }

      // Asegurados label rows
      if (data.column.index === 0 && !rowText.includes('ASEGURADOS') &&
          tableData.findIndex(r => r[0] === 'ASEGURADOS') !== -1) {
        const asegIdx = tableData.findIndex(r => r[0] === 'ASEGURADOS');
        const cobIdx = tableData.findIndex(r => r[0] === 'COBERTURAS BASICAS');
        if (data.row.index > asegIdx && data.row.index < cobIdx) {
          data.cell.styles.fillColor = [245, 245, 250];
        }
      }
    },
    didDrawCell: function (data) {
      if (data.row.index === 0 && data.column.index > 0) {
        const cellText = String(data.cell.raw || '');
        if (cellText.includes('\u2605')) {
          doc.setDrawColor(0, 153, 51);
          doc.setLineWidth(0.6);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
        }
      }
    },
  });

  // ============================================
  // FOOTER
  // ============================================

  const footerStartY = pageHeight - margin - 10;

  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, footerStartY - 2, pageWidth - margin, footerStartY - 2);

  doc.setFontSize(4.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(60);
  doc.text('Notas importantes:', margin, footerStartY + 1);

  doc.setFontSize(4);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  const notaText = 'Cotizacion valida 15 dias. Aceptacion sujeta a politicas de suscripcion. Coberturas segun Condiciones Generales CNSF. Documento ilustrativo, no contractual.';
  const notaLines = doc.splitTextToSize(notaText, contentWidth);
  let notaY = footerStartY + 3;
  notaLines.forEach((line: string) => {
    doc.text(line, margin, notaY);
    notaY += 2;
  });

  const contactY = pageHeight - margin - 2;
  doc.setDrawColor(220);
  doc.setLineWidth(0.1);
  doc.line(margin, contactY - 1.5, pageWidth - margin, contactY - 1.5);

  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);

  const asesor: AsesorInfo = {
    nombre: usuario?.nombre_publico || usuario?.nombre || 'Asesor',
    celular: usuario?.celular_laboral || usuario?.celular,
    web_slug: usuario?.web_slug,
  };

  const contactParts: string[] = [];
  if (asesor.nombre) contactParts.push(asesor.nombre);
  if (asesor.web_slug) contactParts.push(`agentedeseguros.website/${asesor.web_slug}`);
  if (asesor.celular) contactParts.push(asesor.celular);

  const contactText = contactParts.join('  |  ');
  doc.text(contactText, pageWidth / 2, contactY, { align: 'center' });

  return doc.output('blob');
}
