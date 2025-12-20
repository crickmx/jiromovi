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
  doc.text('Cotización Comparativa', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.setFontSize(14);
  doc.text('Únikuz Bx+', pageWidth / 2, yPosition, { align: 'center' });
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
  doc.text('👥 ASEGURADOS', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  if (firstOption?.insureds && firstOption.insureds.length > 0) {
    const maxInsuredDisplay = Math.min(firstOption.insureds.length, 6);
    for (let i = 0; i < maxInsuredDisplay; i++) {
      const ins = firstOption.insureds[i];
      doc.text(`${i + 1}. ${ins.nombre} - ${ins.sexo} - ${ins.edad} años`, marginLeft + 2, yPosition);
      yPosition += 3.2;
    }
  }
  yPosition += 2;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('📊 COMPARATIVO DE OPCIONES', marginLeft, yPosition);
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
      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(0, 153, 51);
      doc.setLineWidth(0.8);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
    }
    doc.roundedRect(cardX, yPosition, cardWidth, 88, 2, 2, 'FD');

    yPosition += 4;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(`Opción ${String.fromCharCode(65 + i)}`, cardX + cardWidth / 2, yPosition, { align: 'center' });

    if (isBest) {
      yPosition += 3.5;
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 51);
      doc.text('★ MEJOR PRECIO', cardX + cardWidth / 2, yPosition, { align: 'center' });
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

  yPosition = startY + 92;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('💊 COBERTURAS BÁSICAS', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  const basicCoverages = [
    'Gastos médicos mayores',
    'Hospitalización y cirugía',
    'Medicamentos y material de curación',
    'Honorarios médicos',
    'Estudios de laboratorio y rayos X'
  ];

  for (const coverage of basicCoverages) {
    doc.text(`✓ ${coverage}`, marginLeft + 2, yPosition);
    yPosition += 3.2;
  }
  yPosition += 2;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('✨ COBERTURAS ADICIONALES', marginLeft, yPosition);
  yPosition += 4;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);

  const selectedCoverages: string[] = [];
  if (firstOption?.coberturas) {
    const coverageMap: Record<string, string> = {
      maternidad: 'Maternidad',
      enf_preex: 'Enfermedades preexistentes',
      dental: 'Gastos dentales',
      lentes: 'Lentes y aparatos auditivos',
      medicamentos: 'Medicamentos fuera del hospital',
      psicologia: 'Atención psicológica',
      ambulancia: 'Servicio de ambulancia',
      terapias: 'Terapias de rehabilitación',
      urgencias_ext: 'Urgencias en el extranjero',
      muerte_accidental: 'Muerte accidental',
    };

    for (const [key, label] of Object.entries(coverageMap)) {
      if (firstOption.coberturas[key] === 'SI') {
        selectedCoverages.push(label);
        if (selectedCoverages.length >= 15) break;
      }
    }
  }

  if (selectedCoverages.length > 0) {
    const maxCoverages = Math.min(selectedCoverages.length, 15);
    const halfPoint = Math.ceil(maxCoverages / 2);
    const colWidth = contentWidth / 2;

    for (let i = 0; i < maxCoverages; i++) {
      const xPos = i < halfPoint ? marginLeft + 2 : marginLeft + colWidth + 2;
      const yPos = yPosition + ((i % halfPoint) * 3.2);
      doc.text(`✓ ${selectedCoverages[i]}`, xPos, yPos);
    }
    yPosition += (halfPoint * 3.2) + 2;
  } else {
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Sin coberturas adicionales seleccionadas', marginLeft + 2, yPosition);
    yPosition += 4;
  }

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
    'Este documento es una cotización y no constituye una póliza de seguro. Sujeto a aprobación médica.',
    pageWidth / 2,
    footerY + 12,
    { align: 'center' }
  );

  return doc.output('blob');
}
