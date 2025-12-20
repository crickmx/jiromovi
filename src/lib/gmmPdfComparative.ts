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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  let yPosition = 20;

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cotización Comparativa - Únikuz Bx+', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  doc.text(`Fecha de emisión: ${formatDate(quote.created_at)}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;

  if (quote.folio) {
    doc.text(`Cotización No. ${quote.folio}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }

  doc.text(`Asegurado Principal: ${quote.asegurado_principal}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 10;

  const options = quote.result.options;

  const headers = ['Concepto', ...options.map((_, i) => `Opción ${String.fromCharCode(65 + i)}`)];

  const rows: string[][] = [];

  rows.push([
    'Estado',
    ...options.map(opt => opt.plan.estado || '-')
  ]);

  rows.push([
    'Nivel Hospitalario',
    ...options.map(opt => opt.plan.nivel_hospitalario || '-')
  ]);

  rows.push([
    'Tabulador',
    ...options.map(opt => opt.plan.tabulador || '-')
  ]);

  rows.push([
    'Suma Asegurada',
    ...options.map(opt => opt.plan.suma_asegurada || '-')
  ]);

  rows.push([
    'Deducible',
    ...options.map(opt => opt.plan.deducible || '-')
  ]);

  rows.push([
    'Coaseguro',
    ...options.map(opt => opt.plan.coaseguro || '-')
  ]);

  rows.push([
    'Tope Coaseguro',
    ...options.map(opt => opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro) : '-')
  ]);

  rows.push(['', ...Array(options.length).fill('')]);

  rows.push([
    'Prima Neta',
    ...options.map(opt => formatCurrency(opt.totales.prima_neta))
  ]);

  rows.push([
    'Gastos Expedición',
    ...options.map(opt => formatCurrency(opt.totales.gastos_expedicion))
  ]);

  rows.push([
    'Recargo',
    ...options.map(opt => formatCurrency(opt.totales.recargo))
  ]);

  rows.push([
    'Subtotal',
    ...options.map(opt => formatCurrency(opt.totales.subtotal))
  ]);

  rows.push([
    'IVA (16%)',
    ...options.map(opt => formatCurrency(opt.totales.iva))
  ]);

  rows.push([
    'Total a Pagar',
    ...options.map(opt => formatCurrency(opt.totales.total_pagar))
  ]);

  rows.push([
    'Forma de Pago',
    ...options.map(opt => opt.totales.forma_pago)
  ]);

  const bestIndex = options.reduce((minIdx, opt, idx) =>
    opt.totales.total_pagar < options[minIdx].totales.total_pagar ? idx : minIdx
  , 0);

  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: rows,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'left' },
      [bestIndex + 1]: { fillColor: [220, 252, 231] },
    },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 3 && data.column.index > 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
      }
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 102, 0);
  doc.text(
    `✓ La Opción ${String.fromCharCode(65 + bestIndex)} ofrece el mejor precio`,
    marginLeft,
    yPosition
  );

  yPosition += 15;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Asegurados:', marginLeft, yPosition);
  yPosition += 5;

  const firstOption = options[0];
  if (firstOption && firstOption.insureds && firstOption.insureds.length > 0) {
    firstOption.insureds.forEach((ins: any, idx: number) => {
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60);
      doc.text(
        `${idx + 1}. ${ins.nombre} - ${ins.sexo} - ${ins.edad} años`,
        marginLeft + 5,
        yPosition
      );
      yPosition += 5;
    });
  }

  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200);
  doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Asesor:', marginLeft, footerY);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  doc.text(asesor.nombre, marginLeft, footerY + 4);
  if (asesor.celular) {
    doc.text(`Tel: ${asesor.celular}`, marginLeft, footerY + 8);
  }

  doc.setFont(undefined, 'italic');
  doc.setTextColor(100);
  doc.setFontSize(7);
  doc.text(
    'Este documento es una cotización y no constituye una póliza de seguro.',
    pageWidth / 2,
    footerY + 10,
    { align: 'center' }
  );

  return doc.output('blob');
}
