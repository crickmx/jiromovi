import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommissionDetail, CommissionBatch } from './commissionTypes';
import { formatCurrency, formatDate } from './commissionUtils';

export async function generateCommissionPDF(
  agentDetails: CommissionDetail[],
  batch: CommissionBatch
): Promise<Blob> {
  if (agentDetails.length === 0) {
    throw new Error('No hay detalles para generar el PDF');
  }

  const agent = agentDetails[0].agent;
  if (!agent) {
    throw new Error('No se encontró la información del agente');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  doc.addImage(
    'https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png',
    'PNG',
    15,
    10,
    40,
    15
  );

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(formatDate(new Date().toISOString()), pageWidth - 15, 15, { align: 'right' });

  doc.setFontSize(18);
  doc.setTextColor(0);
  yPosition = 35;
  doc.text('Comprobante de Comisiones', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(`Periodo: ${formatDate(batch.date_from)} al ${formatDate(batch.date_to)}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Agente:', 15, yPosition);
  doc.setFont(undefined, 'bold');
  doc.text(agent.name, 40, yPosition);
  doc.setFont(undefined, 'normal');

  yPosition += 7;
  doc.text('Email:', 15, yPosition);
  doc.text(agent.email, 40, yPosition);

  yPosition += 7;
  doc.text('Oficina:', 15, yPosition);
  doc.text(agent.office?.name || 'N/A', 40, yPosition);

  yPosition += 7;
  doc.text('Régimen Fiscal:', 15, yPosition);
  doc.text(agent.fiscal_regime?.name || 'N/A', 40, yPosition);

  yPosition += 15;

  let totalBruta = 0;
  let totalImpuestos = 0;
  let totalNeta = 0;

  const ramoMap = new Map<string, { bruta: number; impuestos: number; neta: number; count: number }>();
  const aseguradoraMap = new Map<string, { bruta: number; impuestos: number; neta: number; count: number }>();

  agentDetails.forEach(detail => {
    const bruta = detail.is_manual_adjusted
      ? (detail.adjusted_commission_bruta || 0)
      : detail.commission_bruta;

    const impuestos = detail.is_manual_adjusted
      ? (detail.adjusted_impuestos_json || detail.impuestos_json)
      : detail.impuestos_json;

    const neta = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    const impuestosTotal = (impuestos.iva_retenido || 0) + (impuestos.isr || 0) + (impuestos.otros || 0);

    totalBruta += bruta;
    totalImpuestos += impuestosTotal;
    totalNeta += neta;

    if (!ramoMap.has(detail.ramo)) {
      ramoMap.set(detail.ramo, { bruta: 0, impuestos: 0, neta: 0, count: 0 });
    }
    const ramoData = ramoMap.get(detail.ramo)!;
    ramoData.bruta += bruta;
    ramoData.impuestos += impuestosTotal;
    ramoData.neta += neta;
    ramoData.count++;

    if (!aseguradoraMap.has(detail.aseguradora)) {
      aseguradoraMap.set(detail.aseguradora, { bruta: 0, impuestos: 0, neta: 0, count: 0 });
    }
    const asegData = aseguradoraMap.get(detail.aseguradora)!;
    asegData.bruta += bruta;
    asegData.impuestos += impuestosTotal;
    asegData.neta += neta;
    asegData.count++;
  });

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Resumen Global', 15, yPosition);
  yPosition += 8;

  autoTable(doc, {
    startY: yPosition,
    head: [['Concepto', 'Monto']],
    body: [
      ['Comisión Bruta', formatCurrency(totalBruta)],
      ['Impuestos', formatCurrency(totalImpuestos)],
      [{ content: 'Comisión Neta', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalNeta), styles: { fontStyle: 'bold', textColor: [0, 128, 0] } }]
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    margin: { left: 15, right: 15 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Totales por Ramo', 15, yPosition);
  yPosition += 8;

  const ramoRows: any[] = [];
  ramoMap.forEach((data, ramo) => {
    ramoRows.push([
      ramo,
      data.count.toString(),
      formatCurrency(data.bruta),
      formatCurrency(data.impuestos),
      formatCurrency(data.neta)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Ramo', 'Pólizas', 'Bruta', 'Impuestos', 'Neta']],
    body: ramoRows,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    margin: { left: 15, right: 15 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Totales por Aseguradora', 15, yPosition);
  yPosition += 8;

  const aseguradoraRows: any[] = [];
  aseguradoraMap.forEach((data, aseguradora) => {
    aseguradoraRows.push([
      aseguradora,
      data.count.toString(),
      formatCurrency(data.bruta),
      formatCurrency(data.impuestos),
      formatCurrency(data.neta)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Aseguradora', 'Pólizas', 'Bruta', 'Impuestos', 'Neta']],
    body: aseguradoraRows,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    margin: { left: 15, right: 15 }
  });

  if ((doc as any).lastAutoTable.finalY > 220) {
    doc.addPage();
    yPosition = 20;
  } else {
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Desglose por Póliza', 15, yPosition);
  yPosition += 8;

  const polizaRows: any[] = [];
  agentDetails.forEach(detail => {
    const neta = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    polizaRows.push([
      detail.poliza,
      detail.ramo,
      detail.aseguradora,
      formatCurrency(detail.prima_base),
      detail.concepto || '',
      formatCurrency(neta)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Póliza', 'Ramo', 'Aseguradora', 'Prima', 'Concepto', 'Comisión']],
    body: polizaRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 8 }
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (pageHeight - finalY < 40) {
    doc.addPage();
    yPosition = 20;
  } else {
    yPosition = finalY + 15;
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont(undefined, 'normal');
  const footerText = 'Este documento es un comprobante de comisiones generado por MOVI Digital. Para cualquier aclaración, contacte a su gerente.';
  const footerLines = doc.splitTextToSize(footerText, pageWidth - 30);
  footerLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
  });

  yPosition += 5;
  doc.text(`MOVI Digital | www.movi.digital | contacto@movi.digital`, pageWidth / 2, yPosition, { align: 'center' });

  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
