import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { QuoteCalculationMultiResult, QuoteOptionResult } from './gmmTypes';

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

interface ComparativeQuote {
  folio?: string;
  created_at: string;
  asegurado_principal: string;
  result: QuoteCalculationMultiResult;
}

export async function generateComparativeQuotePDF(
  quote: ComparativeQuote,
  asesor: AsesorInfo
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = 15;

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cotizacion Comparativa', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.setFontSize(14);
  doc.text('Unikuz Bx+', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  doc.text(`Fecha: ${formatDate(quote.created_at)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 3.5;
  if (quote.folio) {
    doc.text(`Folio: ${quote.folio}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 3.5;
  }
  doc.text(`Cliente: ${quote.asegurado_principal}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  const options = quote.result.options;
  const firstOption = options[0];

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COMPARATIVO DE OPCIONES', marginLeft, yPosition);
  yPosition += 5;

  const bestIndex = options.reduce((minIdx, opt, idx) =>
    opt.totales.total_pagar < options[minIdx].totales.total_pagar ? idx : minIdx
  , 0);

  const numOptions = options.length;
  const cardWidth = numOptions === 2 ? (contentWidth / 2 - 2) : (contentWidth / 3 - 2);
  const startY = yPosition;

  for (let i = 0; i < numOptions && i < 3; i++) {
    const opt = options[i];
    const cardX = marginLeft + (i * (cardWidth + 3));
    const isBest = i === bestIndex;

    yPosition = startY;

    if (isBest) {
      doc.setDrawColor(0, 153, 51);
      doc.setLineWidth(0.8);
      doc.roundedRect(cardX, yPosition, cardWidth, 95, 2, 2, 'S');
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, yPosition, cardWidth, 95, 2, 2, 'FD');
    }

    yPosition += 4;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(`Opcion ${String.fromCharCode(65 + i)}`, cardX + cardWidth / 2, yPosition, { align: 'center' });

    if (isBest) {
      yPosition += 3.5;
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 51);
      doc.text('* MEJOR PRECIO', cardX + cardWidth / 2, yPosition, { align: 'center' });
    }

    yPosition += 5;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60);
    doc.text('Estado:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(String(opt.plan.estado || '-'), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Nivel:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(String(opt.plan.nivel_hospitalario || '-'), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Tabulador:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(String(opt.plan.tabulador || '-'), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Suma Aseg:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    const saText = String(opt.plan.suma_asegurada || '-');
    const truncatedSA = saText.length > 12 ? saText.substring(0, 12) : saText;
    doc.text(truncatedSA, cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Deducible:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    const dedText = String(opt.plan.deducible || '-');
    const truncatedDed = dedText.length > 12 ? dedText.substring(0, 12) : dedText;
    doc.text(truncatedDed, cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Coaseguro:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(String(opt.plan.coaseguro || '-'), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'bold');
    doc.text('Tope Coas:', cardX + 2, yPosition);
    doc.setFont(undefined, 'normal');
    const topeText = opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro) : '-';
    const truncatedTope = topeText.length > 12 ? topeText.substring(0, 10) + '..' : topeText;
    doc.text(truncatedTope, cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 5;

    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(cardX + 2, yPosition, cardX + cardWidth - 2, yPosition);
    yPosition += 3.5;

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 204);
    doc.text('Prima Neta:', cardX + 2, yPosition);
    doc.text(formatCurrency(opt.totales.prima_neta), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(60);
    doc.setFontSize(7);
    doc.text('+ Gastos Exp:', cardX + 2, yPosition);
    doc.text(formatCurrency(opt.totales.gastos_expedicion), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.2;

    doc.text('+ Recargo:', cardX + 2, yPosition);
    doc.text(formatCurrency(opt.totales.recargo), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.2;

    doc.text('+ IVA (16%):', cardX + 2, yPosition);
    doc.text(formatCurrency(opt.totales.iva), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 4;

    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.3);
    doc.line(cardX + 2, yPosition, cardX + cardWidth - 2, yPosition);
    yPosition += 3.5;

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('TOTAL:', cardX + 2, yPosition);
    doc.text(formatCurrency(opt.totales.total_pagar), cardX + cardWidth - 2, yPosition, { align: 'right' });
    yPosition += 3.5;

    doc.setFontSize(6.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`Pago: ${opt.totales.forma_pago}`, cardX + cardWidth / 2, yPosition, { align: 'center' });
  }

  yPosition = startY + 99;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('ASEGURADOS', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  if (firstOption?.insureds && firstOption.insureds.length > 0) {
    const numInsuredCols = Math.min(numOptions, 3);
    const colWidth = contentWidth / numInsuredCols;

    const maxInsuredDisplay = Math.min(firstOption.insureds.length, 6);
    const startYAsegurados = yPosition;

    for (let i = 0; i < numInsuredCols; i++) {
      const opt = options[i];
      const colX = marginLeft + (i * colWidth);
      yPosition = startYAsegurados;

      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text(`Opcion ${String.fromCharCode(65 + i)}`, colX + colWidth / 2, yPosition, { align: 'center' });
      yPosition += 3.5;

      doc.setFont(undefined, 'normal');
      doc.setTextColor(60);

      if (opt.insureds && opt.insureds.length > 0) {
        for (let j = 0; j < maxInsuredDisplay; j++) {
          const ins = opt.insureds[j];
          const primaIndividual = ins.prima_neta || 0;

          const insuredName = ins.nombre.length > 12 ? ins.nombre.substring(0, 12) + '...' : ins.nombre;
          doc.setFontSize(6.5);
          doc.text(`${j + 1}. ${insuredName}`, colX + 1, yPosition);
          yPosition += 2.8;

          doc.setFontSize(6);
          doc.setTextColor(100);
          doc.text(`   ${ins.sexo} - ${ins.edad} anos`, colX + 1, yPosition);
          yPosition += 2.5;

          doc.setTextColor(0, 102, 204);
          doc.text(`   Prima: ${formatCurrency(primaIndividual)}`, colX + 1, yPosition);
          yPosition += 3.5;
        }
      }
    }

    yPosition = startYAsegurados + (maxInsuredDisplay * 8.8) + 2;
  }

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS BASICAS', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  const basicCoverages = [
    'Gastos medicos mayores',
    'Hospitalizacion y cirugia',
    'Medicamentos y material de curacion',
    'Honorarios medicos',
    'Estudios de laboratorio y rayos X'
  ];

  const halfBasic = Math.ceil(basicCoverages.length / 2);
  const colWidth = contentWidth / 2;

  for (let i = 0; i < basicCoverages.length; i++) {
    const xPos = i < halfBasic ? marginLeft + 2 : marginLeft + colWidth + 2;
    const yPos = yPosition + ((i % halfBasic) * 3.2);
    doc.text(`[X] ${basicCoverages[i]}`, xPos, yPos);
  }
  yPosition += (halfBasic * 3.2) + 2;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('COBERTURAS ADICIONALES', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  const allCoverages: Array<{ key: string; label: string }> = [
    { key: 'maternidad', label: 'Maternidad' },
    { key: 'enf_preex', label: 'Enfermedades preexistentes' },
    { key: 'dental', label: 'Gastos dentales' },
    { key: 'lentes', label: 'Lentes y aparatos auditivos' },
    { key: 'medicamentos', label: 'Medicamentos fuera del hospital' },
    { key: 'psicologia', label: 'Atencion psicologica' },
    { key: 'ambulancia', label: 'Servicio de ambulancia' },
    { key: 'terapias', label: 'Terapias de rehabilitacion' },
    { key: 'urgencias_ext', label: 'Urgencias en el extranjero' },
    { key: 'muerte_accidental', label: 'Muerte accidental' },
  ];

  const numCoverageCols = Math.min(numOptions, 3);
  const coverageColWidth = contentWidth / numCoverageCols;
  const startYCoverages = yPosition;

  for (let i = 0; i < numCoverageCols; i++) {
    const opt = options[i];
    const colX = marginLeft + (i * coverageColWidth);
    yPosition = startYCoverages;

    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 204);
    doc.text(`Opcion ${String.fromCharCode(65 + i)}`, colX + coverageColWidth / 2, yPosition, { align: 'center' });
    yPosition += 3.5;

    doc.setFont(undefined, 'normal');

    for (const coverage of allCoverages) {
      const isIncluded = opt.coberturas && opt.coberturas[coverage.key] === 'SI';

      if (isIncluded) {
        doc.setTextColor(0, 153, 51);
        doc.text('[X]', colX + 1, yPosition);
      } else {
        doc.setTextColor(200, 0, 0);
        doc.text('[ ]', colX + 1, yPosition);
      }

      doc.setTextColor(60);
      const truncatedLabel = coverage.label.length > 22 ? coverage.label.substring(0, 22) + '...' : coverage.label;
      doc.text(truncatedLabel, colX + 6, yPosition);
      yPosition += 3.2;
    }
  }

  yPosition = startYCoverages + (allCoverages.length * 3.2) + 2;

  const footerY = pageHeight - 18;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY);

  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Asesor:', marginLeft, footerY + 4);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  doc.text(asesor.nombre, marginLeft + 12, footerY + 4);
  if (asesor.celular) {
    doc.text(`Tel: ${asesor.celular}`, marginLeft, footerY + 8);
  }

  doc.setFont(undefined, 'italic');
  doc.setTextColor(100);
  doc.setFontSize(6.5);
  doc.text(
    'Este documento es una cotizacion y no constituye una poliza de seguro. Sujeto a aprobacion medica.',
    pageWidth / 2,
    footerY + 12,
    { align: 'center' }
  );

  return doc.output('blob');
}
