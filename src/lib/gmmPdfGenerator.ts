import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GMMQuote, GMMQuoteInsured } from './gmmTypes';
import { getCoveragePDFText, COVERAGE_LABELS } from './gmmCoverageHelp';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface AsesorInfo {
  nombre: string;
  celular: string;
}

/**
 * Genera un PDF profesional de cotización GMM BX+
 *
 * Incluye:
 * - Datos de la cotización
 * - Parámetros del plan
 * - Asegurados
 * - Coberturas (con descripción breve)
 * - Totales
 * - Pie de página con info del asesor
 */
export async function generateQuotePDF(
  quote: GMMQuote,
  insureds: GMMQuoteInsured[],
  asesor: AsesorInfo
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = 20;

  // ============================================
  // ENCABEZADO
  // ============================================
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cotización Únikuz Bx+', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  doc.text(`Fecha de emisión: ${formatDate(quote.created_at)}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 5;

  if (quote.quote_number) {
    doc.text(`Cotización No. ${quote.quote_number}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  yPosition += 8;
  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 10;

  // ============================================
  // DATOS DEL PLAN
  // ============================================
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Plan Contratado', marginLeft, yPosition);
  yPosition += 8;

  const planData = [
    ['Estado', quote.estado],
    ['Nivel Hospitalario', quote.nivel_hospitalario],
    ['Tabulador', quote.tabulador],
    ['Suma Asegurada', quote.suma_asegurada],
    ['Deducible', quote.deducible],
    ['Coaseguro', quote.coaseguro],
    ['Tope de Coaseguro', formatCurrency(quote.tope_coaseguro)],
    ['Forma de Pago', quote.forma_pago],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['Concepto', 'Valor']],
    body: planData,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: marginLeft, right: marginRight },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.5, fontStyle: 'bold' },
      1: { cellWidth: contentWidth * 0.5 },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ============================================
  // ASEGURADOS
  // ============================================
  if (pageHeight - yPosition < 60) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Asegurados', marginLeft, yPosition);
  yPosition += 8;

  const insuredsData = insureds.map(ins => [
    ins.nombre,
    ins.edad.toString(),
    ins.sexo,
    formatCurrency(ins.prima_base),
    formatCurrency(ins.prima_adicionales),
    formatCurrency(ins.prima_total),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Nombre', 'Edad', 'Sexo', 'Prima Base', 'Prima Adic.', 'Prima Total']],
    body: insuredsData,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: marginLeft, right: marginRight },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // ============================================
  // COBERTURAS ADICIONALES (CON DESCRIPCIÓN)
  // ============================================
  const coberturasActivas: { key: string; label: string; description: string }[] = [];

  const coverageMapping: Record<string, keyof GMMQuote> = {
    reconocimiento_antiguedad: 'cob_reconocimiento_antiguedad',
    medicamentos_fuera: 'cob_medicamentos_fuera',
    complicaciones_no_amparadas: 'cob_complicaciones_no_amparadas',
    padecimientos_preexistentes: 'cob_padecimientos_preexistentes',
    eliminacion_deducible_accidente: 'cob_eliminacion_deducible_accidente',
    multiregion: 'cob_multiregion',
    vip: 'cob_vip',
    emergencia_medica_extranjero: 'cob_emergencia_medica_extranjero',
    enfermedades_graves_extranjero: 'cob_enfermedades_graves_extranjero',
    cobertura_internacional: 'cob_cobertura_internacional',
    ampliacion_servicios: 'cob_ampliacion_servicios',
    ayuda_diaria: 'cob_ayuda_diaria',
    indemnizacion_eg: 'cob_indemnizacion_eg',
    maternidad: 'cob_maternidad',
    xtensuz: 'cob_xtensuz',
  };

  Object.entries(coverageMapping).forEach(([key, field]) => {
    if (quote[field]) {
      coberturasActivas.push({
        key,
        label: COVERAGE_LABELS[key] || key,
        description: getCoveragePDFText(key),
      });
    }
  });

  if (coberturasActivas.length > 0) {
    if (pageHeight - yPosition < 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('Coberturas Adicionales', marginLeft, yPosition);
    yPosition += 8;

    coberturasActivas.forEach((cob, index) => {
      if (pageHeight - yPosition < 25) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0);
      doc.text(`✓ ${cob.label}`, marginLeft + 2, yPosition);
      yPosition += 5;

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80);
      const descLines = doc.splitTextToSize(cob.description, contentWidth - 4);
      descLines.forEach((line: string) => {
        if (pageHeight - yPosition < 10) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, marginLeft + 2, yPosition);
        yPosition += 3.5;
      });

      yPosition += 3;

      if (index < coberturasActivas.length - 1) {
        doc.setDrawColor(220);
        doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
        yPosition += 3;
      }
    });

    yPosition += 8;
  }

  // ============================================
  // TOTALES
  // ============================================
  if (pageHeight - yPosition < 60) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Totales de la Cotización', marginLeft, yPosition);
  yPosition += 8;

  const totalesData = [
    ['Prima Neta Total', formatCurrency(quote.prima_neta_total)],
    ['Recargo por forma de pago', formatCurrency(quote.recargo)],
    ['Gastos de expedición', formatCurrency(quote.gastos_expedicion)],
    ['Subtotal', formatCurrency(quote.subtotal)],
    ['IVA', formatCurrency(quote.iva)],
    [{ content: 'Total a Pagar', styles: { fontStyle: 'bold' } }, { content: formatCurrency(quote.total), styles: { fontStyle: 'bold', textColor: [0, 102, 51] } }],
  ];

  if (quote.num_recibos > 1) {
    totalesData.push(
      ['Número de recibos', quote.num_recibos.toString()],
      ['Primer recibo', formatCurrency(quote.primer_recibo)],
      ['Recibos subsecuentes', formatCurrency(quote.recibos_subsecuentes || 0)]
    );
  }

  autoTable(doc, {
    startY: yPosition,
    head: [['Concepto', 'Importe']],
    body: totalesData,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: marginLeft, right: marginRight },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.6 },
      1: { cellWidth: contentWidth * 0.4, halign: 'right' },
    },
  });

  // ============================================
  // PIE DE PÁGINA (TODAS LAS PÁGINAS)
  // ============================================
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 15;

    doc.setDrawColor(200);
    doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);

    doc.setFillColor(250, 250, 250);
    doc.rect(marginLeft, footerY - 3, contentWidth, 10, 'F');

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(`Asesor: ${asesor.nombre}`, marginLeft + 2, footerY + 1);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    const footerText = `www.jiro.mx | ${asesor.celular ? `Cel. ${asesor.celular}` : ''}`;
    doc.text(footerText, marginLeft + 2, footerY + 5);
  }

  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
