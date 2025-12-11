import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommissionDetail, CommissionBatch } from './commissionTypes';
import { formatCurrency, formatDate } from './commissionUtils';

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
}

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

  try {
    const logoBase64 = await loadImageAsBase64('https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png');
    doc.addImage(logoBase64, 'PNG', 15, 10, 40, 15);
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
  }

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

  yPosition += 15;

  let totalCommission = 0;

  const ramoMap = new Map<string, { commission: number; count: number }>();
  const aseguradoraMap = new Map<string, { commission: number; count: number }>();

  agentDetails.forEach(detail => {
    const commission = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    totalCommission += commission;

    if (!ramoMap.has(detail.ramo)) {
      ramoMap.set(detail.ramo, { commission: 0, count: 0 });
    }
    const ramoData = ramoMap.get(detail.ramo)!;
    ramoData.commission += commission;
    ramoData.count++;

    if (!aseguradoraMap.has(detail.aseguradora)) {
      aseguradoraMap.set(detail.aseguradora, { commission: 0, count: 0 });
    }
    const asegData = aseguradoraMap.get(detail.aseguradora)!;
    asegData.commission += commission;
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
      ['Total Pólizas', agentDetails.length.toString()],
      [{ content: 'Comisión Total', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalCommission), styles: { fontStyle: 'bold', textColor: [0, 128, 0] } }]
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
      formatCurrency(data.commission)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Ramo', 'Pólizas', 'Comisión']],
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
      formatCurrency(data.commission)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Aseguradora', 'Pólizas', 'Comisión']],
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
    const commission = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    polizaRows.push([
      detail.poliza,
      detail.nombre_asegurado || '-',
      detail.concepto || '-',
      detail.ramo,
      detail.aseguradora,
      formatCurrency(detail.prima_neta),
      formatCurrency(detail.importe_base),
      `${detail.porcentaje_comision.toFixed(2)}%`,
      formatCurrency(commission)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Póliza', 'Asegurado', 'Descripción', 'Ramo', 'Aseguradora', 'Prima Neta', 'Base Com.', '% Com.', 'Comisión']],
    body: polizaRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 6 },
    columnStyles: {
      2: { cellWidth: 20 }
    }
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

export async function generateOrdenDePagoPDF(
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

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = 20;

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('ORDEN DE PAGO', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;

  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0);

  const col1X = marginLeft;
  const col2X = pageWidth / 2 + 10;

  doc.setFont(undefined, 'bold');
  doc.text('Nombre del Agente:', col1X, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(agent.name, col1X + 40, yPosition);

  doc.setFont(undefined, 'bold');
  doc.text('Número de Semana:', col2X, yPosition);
  doc.setFont(undefined, 'normal');
  const weekNumber = Math.ceil((new Date(batch.date_from).getTime() - new Date(new Date(batch.date_from).getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  doc.text(`Semana ${weekNumber}`, col2X + 40, yPosition);

  yPosition += 6;

  doc.setFont(undefined, 'bold');
  doc.text('Oficina:', col1X, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(agent.office?.name || 'N/A', col1X + 40, yPosition);

  doc.setFont(undefined, 'bold');
  doc.text('Periodo:', col2X, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(`${formatDate(batch.date_from)} al ${formatDate(batch.date_to)}`, col2X + 40, yPosition);

  yPosition += 10;

  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 8;

  const ramoMap = new Map<string, { primaTotal: number; comisionNeta: number }>();
  let primaGravada = 0;
  let primaNoGravada = 0;
  let totalComisionNeta = 0;
  let totalPrimaTotal = 0;

  agentDetails.forEach(detail => {
    const comision = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    const prima = detail.prima_neta;

    if (!ramoMap.has(detail.ramo)) {
      ramoMap.set(detail.ramo, { primaTotal: 0, comisionNeta: 0 });
    }

    const ramoData = ramoMap.get(detail.ramo)!;
    ramoData.primaTotal += prima;
    ramoData.comisionNeta += comision;
    totalComisionNeta += comision;
    totalPrimaTotal += prima;

    if (detail.ramo.toLowerCase() === 'vida') {
      primaNoGravada += prima;
    } else {
      primaGravada += prima;
    }
  });

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Total de comisiones por ramo', marginLeft, yPosition);

  yPosition += 5;

  const ramoRows: any[] = [];
  ramoMap.forEach((data, ramo) => {
    ramoRows.push([
      ramo,
      formatCurrency(data.primaTotal),
      formatCurrency(data.comisionNeta)
    ]);
  });
  ramoRows.push([
    { content: 'TOTAL', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(totalPrimaTotal), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(totalComisionNeta), styles: { fontStyle: 'bold', textColor: [0, 128, 0] } }
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Ramo', 'Prima Total', 'Comisión Neta']],
    body: ramoRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: marginLeft, right: pageWidth - marginLeft - 65 },
    tableWidth: 65
  });

  const ramoTableFinalY = (doc as any).lastAutoTable.finalY;

  const primaBoxX = pageWidth - marginRight - 60;
  const primaBoxY = yPosition;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0);
  doc.text('Prima Gravada:', primaBoxX, primaBoxY + 5);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(primaGravada), primaBoxX + 30, primaBoxY + 5);

  doc.setFont(undefined, 'bold');
  doc.text('Prima No Gravada:', primaBoxX, primaBoxY + 11);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(primaNoGravada), primaBoxX + 30, primaBoxY + 11);

  doc.setDrawColor(200);
  doc.rect(primaBoxX - 2, primaBoxY, 58, 15);

  yPosition = Math.max(ramoTableFinalY, primaBoxY + 15) + 8;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Desglose por póliza', marginLeft, yPosition);

  yPosition += 5;

  const maxPolizas = 30;
  const polizasToShow = agentDetails.slice(0, maxPolizas);
  const hasMorePolizas = agentDetails.length > maxPolizas;

  const polizaRows: any[] = [];
  polizasToShow.forEach(detail => {
    const comision = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    polizaRows.push([
      detail.poliza,
      detail.ramo,
      detail.aseguradora,
      detail.nombre_asegurado || '-',
      formatCurrency(detail.prima_neta),
      formatCurrency(comision)
    ]);
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Póliza', 'Ramo', 'Aseguradora', 'Contratante', 'Prima', 'Comisión Neta']],
    body: polizaRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: marginLeft, right: marginRight },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 40 },
      3: { cellWidth: 50 },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' }
    }
  });

  const polizaTableFinalY = (doc as any).lastAutoTable.finalY;

  if (hasMorePolizas) {
    yPosition = polizaTableFinalY + 3;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont(undefined, 'italic');
    doc.text(
      `Nota: Se muestran solo ${maxPolizas} pólizas. Existen ${agentDetails.length - maxPolizas} pólizas adicionales en este periodo.`,
      marginLeft,
      yPosition
    );
  }

  const desgloseFiscalBoxY = polizaTableFinalY + (hasMorePolizas ? 6 : 3);
  const availableHeight = pageHeight - desgloseFiscalBoxY - 10;

  if (availableHeight > 20) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('Desglose Fiscal (según régimen)', marginLeft, desgloseFiscalBoxY + 5);

    yPosition = desgloseFiscalBoxY + 12;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80);
    doc.text(`Régimen fiscal del agente: ${agent.fiscal_regime?.name || 'No especificado'}`, marginLeft + 2, yPosition);

    yPosition += 6;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont(undefined, 'italic');
    const placeholderText = 'Este espacio está reservado para el desglose fiscal específico según el régimen de este agente';
    const lines = doc.splitTextToSize(placeholderText, contentWidth - 10);
    lines.forEach((line: string) => {
      if (yPosition < pageHeight - 10) {
        doc.text(line, marginLeft + 2, yPosition);
        yPosition += 4;
      }
    });

    yPosition += 2;
    const secondLine = '(RESICO, Honorarios o Asimilados). Las fórmulas y montos serán integrados posteriormente.';
    const lines2 = doc.splitTextToSize(secondLine, contentWidth - 10);
    lines2.forEach((line: string) => {
      if (yPosition < pageHeight - 10) {
        doc.text(line, marginLeft + 2, yPosition);
        yPosition += 4;
      }
    });

    doc.setDrawColor(200);
    doc.setFillColor(250, 250, 250);
    doc.rect(marginLeft, desgloseFiscalBoxY, contentWidth, Math.min(availableHeight, yPosition - desgloseFiscalBoxY + 2), 'FD');
  }

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
