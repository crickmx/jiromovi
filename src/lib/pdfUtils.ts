import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommissionDetail, CommissionBatch } from './commissionTypes';
import { formatCurrency, formatDate, getWeekNumber } from './commissionUtils';
import {
  calcularDesgloseFiscal as calcularDesgloseFiscalCore,
  normalizarRegimenFiscal,
  agruparComisionesPorRamo,
  type DesgloseFiscal,
  type RamoResumen,
  type RegimenFiscal
} from './commissionFiscalCalculations';
import { getOfficeLogo } from './logoUtils';

interface PdfFiscalRow {
  label: string;
  value: string;
  isBold?: boolean;
  isTotal?: boolean;
}

/**
 * CRÍTICO: Consultar el desglose fiscal DESDE LA BASE DE DATOS
 *
 * Esta función NO CALCULA NADA. Consulta la función de base de datos
 * calcular_desglose_fiscal_asimilados() que es la ÚNICA fuente de verdad
 * para los cálculos fiscales de ASIMILADOS.
 *
 * @param batchId - ID del lote de comisiones
 * @param usuarioId - ID del usuario
 * @returns DesgloseFiscal consultado desde la base de datos
 */
async function obtenerDesgloseFiscalDesdeDB(
  batchId: string,
  usuarioId: string
): Promise<DesgloseFiscal> {
  const { supabase } = await import('./supabase');

  const { data, error } = await supabase.rpc('calcular_desglose_fiscal_asimilados', {
    p_batch_id: batchId
  });

  if (error) {
    console.error('Error al consultar desglose fiscal:', error);
    throw new Error('Error al obtener el desglose fiscal desde la base de datos');
  }

  if (!data) {
    throw new Error('No se recibieron datos del desglose fiscal');
  }

  // El resultado viene como JSON de la función de base de datos
  return {
    vida: parseFloat(data.vida) || 0,
    sinVida: parseFloat(data.sin_vida) || 0,
    retContable: parseFloat(data.ret_contable) || 0,
    costoDispersion: parseFloat(data.dispersion) || 0,
    iva: parseFloat(data.iva) || 0,
    retIsr: 0, // No usado en ASIMILADOS
    retIva: 0, // No usado en ASIMILADOS
    isrVida: parseFloat(data.isr_vida) || 0,
    isrDanios: parseFloat(data.isr_danios) || 0,
    isrTotal: parseFloat(data.isr_total) || 0,
    totalAPagar: parseFloat(data.total_pagar) || 0,
  };
}

/**
 * Genera las filas para el PDF de desglose fiscal.
 * Solo muestra los campos FINALES, SIN valores intermedios como
 * Comisión Base, Vida, Sin Vida, ISR Vida, ISR Daños.
 * Muestra TODAS las filas relevantes, incluso si son $0.00
 */
function getPdfFiscalRows(regimen: RegimenFiscal, desgloseFiscal: DesgloseFiscal): PdfFiscalRow[] {
  const rows: PdfFiscalRow[] = [];

  switch (regimen) {
    case 'HONORARIOS':
      // Siempre mostrar IVA, Retenciones (incluso si son 0)
      rows.push({
        label: 'IVA',
        value: `+ ${formatCurrency(desgloseFiscal.iva)}`
      });
      rows.push({
        label: 'Ret. ISR',
        value: `- ${formatCurrency(desgloseFiscal.retIsr)}`
      });
      rows.push({
        label: 'Ret. IVA',
        value: `- ${formatCurrency(desgloseFiscal.retIva)}`
      });
      break;

    case 'ASIMILADOS':
      // Siempre mostrar Ret. Contable, Costo Dispersión, IVA, ISR Total
      rows.push({
        label: 'Ret. Contable',
        value: `- ${formatCurrency(desgloseFiscal.retContable)}`
      });
      rows.push({
        label: 'Costo Dispersión',
        value: `- ${formatCurrency(desgloseFiscal.costoDispersion)}`
      });
      rows.push({
        label: 'IVA',
        value: formatCurrency(desgloseFiscal.iva)
      });
      rows.push({
        label: 'ISR Total',
        value: `- ${formatCurrency(desgloseFiscal.isrTotal)}`
      });
      break;

    case 'RESICO':
      // Siempre mostrar IVA, Retenciones (incluso si son 0)
      rows.push({
        label: 'IVA',
        value: `+ ${formatCurrency(desgloseFiscal.iva)}`
      });
      rows.push({
        label: 'Ret. ISR',
        value: `- ${formatCurrency(desgloseFiscal.retIsr)}`
      });
      rows.push({
        label: 'Ret. IVA',
        value: `- ${formatCurrency(desgloseFiscal.retIva)}`
      });
      break;
  }

  // Total a Pagar siempre se muestra al final
  rows.push({
    label: 'Total a Pagar',
    value: formatCurrency(desgloseFiscal.totalAPagar),
    isBold: true,
    isTotal: true
  });

  return rows;
}

interface ImageData {
  base64: string;
  width: number;
  height: number;
}

async function loadImageAsBase64(url: string): Promise<string> {
  const imageData = await loadImageWithDimensions(url);
  return imageData.base64;
}

async function loadImageWithDimensions(url: string): Promise<ImageData> {
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
        resolve({
          base64: dataURL,
          width: img.width,
          height: img.height
        });
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

/**
 * Calcula las dimensiones del logo manteniendo la proporción de aspecto
 * @param originalWidth Ancho original de la imagen
 * @param originalHeight Alto original de la imagen
 * @param maxWidth Ancho máximo deseado en el PDF
 * @param maxHeight Alto máximo deseado en el PDF
 * @returns Objeto con las dimensiones finales y posición centrada
 */
function calculateLogoDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; x: number; y: number } {
  const aspectRatio = originalWidth / originalHeight;

  let finalWidth = maxWidth;
  let finalHeight = maxWidth / aspectRatio;

  // Si la altura excede el máximo, ajustar por altura
  if (finalHeight > maxHeight) {
    finalHeight = maxHeight;
    finalWidth = maxHeight * aspectRatio;
  }

  // Centrar horizontalmente si es más pequeño que maxWidth
  const x = 15 + (maxWidth - finalWidth) / 2;
  const y = 10;

  return { width: finalWidth, height: finalHeight, x, y };
}

export async function generateCommissionPDF(
  agentDetails: CommissionDetail[],
  batch: CommissionBatch
): Promise<Blob> {
  if (agentDetails.length === 0) {
    throw new Error('No hay detalles para generar el PDF');
  }

  // Los datos vienen con el campo 'agent' o 'usuario' dependiendo de la query
  const usuario = (agentDetails[0] as any).agent || (agentDetails[0] as any).usuario;
  if (!usuario) {
    throw new Error('No se encontró la información del agente');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Cargar el logo de oficina del usuario con dimensiones correctas
  try {
    const logoUrl = await getOfficeLogo(usuario.id);
    const logoData = await loadImageWithDimensions(logoUrl);

    // Calcular dimensiones manteniendo proporción (max 40mm ancho x 20mm alto)
    const dimensions = calculateLogoDimensions(
      logoData.width,
      logoData.height,
      40,
      20
    );

    doc.addImage(
      logoData.base64,
      'PNG',
      dimensions.x,
      dimensions.y,
      dimensions.width,
      dimensions.height
    );
  } catch (error) {
    console.warn('No se pudo cargar el logo de oficina:', error);
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
  const dateFrom = batch.period_start || batch.date_from;
  const dateTo = batch.period_end || batch.date_to;
  doc.text(`Periodo: ${formatDate(dateFrom)} al ${formatDate(dateTo)}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Agente:', 15, yPosition);
  doc.setFont(undefined, 'bold');
  const vendorName = agentDetails[0].vendor_name_raw || `${usuario.nombre} ${usuario.apellidos}`.trim();
  doc.text(vendorName, 40, yPosition);
  doc.setFont(undefined, 'normal');

  yPosition += 7;
  doc.text('Email:', 15, yPosition);
  doc.text(usuario.email_laboral, 40, yPosition);

  yPosition += 7;
  doc.text('Oficina:', 15, yPosition);
  doc.text((usuario as any).oficina?.nombre || 'N/A', 40, yPosition);

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

  // Los datos vienen con el campo 'agent' o 'usuario' dependiendo de la query
  const usuario = (agentDetails[0] as any).agent || (agentDetails[0] as any).usuario;
  if (!usuario) {
    throw new Error('No se encontró la información del agente');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPosition = 15;

  // Cargar el logo de oficina del usuario con dimensiones correctas
  try {
    const logoUrl = await getOfficeLogo(usuario.id);
    const logoData = await loadImageWithDimensions(logoUrl);

    // Calcular dimensiones manteniendo proporción (max 35mm ancho x 18mm alto)
    const dimensions = calculateLogoDimensions(
      logoData.width,
      logoData.height,
      35,
      18
    );

    doc.addImage(
      logoData.base64,
      'PNG',
      marginLeft,
      8,
      dimensions.width,
      dimensions.height
    );
  } catch (error) {
    console.warn('No se pudo cargar el logo de oficina:', error);
  }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('ORDEN DE PAGO', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;

  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 7;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0);
  doc.text('Agente:', marginLeft, yPosition);
  doc.setFont(undefined, 'normal');
  const vendorNameOrden = agentDetails[0].vendor_name_raw || `${usuario.nombre} ${usuario.apellidos}`.trim();
  doc.text(vendorNameOrden, marginLeft + 18, yPosition);

  yPosition += 5;

  doc.setFont(undefined, 'bold');
  doc.text('Oficina:', marginLeft, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text((usuario as any).oficina?.nombre || 'N/A', marginLeft + 18, yPosition);

  yPosition += 5;

  const dateFrom = batch.period_start || batch.date_from;
  const dateTo = batch.period_end || batch.date_to;

  let weekNumber = 0;
  if (dateFrom) {
    const [year, month, day] = dateFrom.split('-').map(Number);
    const dateFromLocal = new Date(year, month - 1, day);
    weekNumber = getWeekNumber(dateFromLocal);
  }

  doc.setFont(undefined, 'bold');
  doc.text('Semana:', marginLeft, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(`${weekNumber}`, marginLeft + 18, yPosition);

  doc.setFont(undefined, 'bold');
  doc.text('Periodo:', marginLeft + 45, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(`${formatDate(dateFrom)} al ${formatDate(dateTo)}`, marginLeft + 61, yPosition);

  yPosition += 8;

  doc.setDrawColor(200);
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);

  yPosition += 7;

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

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Resumen por Ramo', marginLeft, yPosition);

  yPosition += 4;

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
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: marginLeft, right: marginRight }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 6;

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0);
  doc.text('Prima Gravada:', marginLeft, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(primaGravada), marginLeft + 35, yPosition);

  doc.setFont(undefined, 'bold');
  doc.text('Prima No Gravada:', marginLeft + 80, yPosition);
  doc.setFont(undefined, 'normal');
  doc.text(formatCurrency(primaNoGravada), marginLeft + 115, yPosition);

  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Desglose de Pólizas', marginLeft, yPosition);

  yPosition += 4;

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
    head: [['Póliza', 'Ramo', 'Aseguradora', 'Contratante', 'Prima', 'Comisión']],
    body: polizaRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 7 },
    styles: { fontSize: 6, cellPadding: 1 },
    margin: { left: marginLeft, right: marginRight }
  });

  const polizaTableFinalY = (doc as any).lastAutoTable.finalY;

  yPosition = polizaTableFinalY + 4;

  if (hasMorePolizas) {
    doc.setFontSize(6);
    doc.setTextColor(120);
    doc.setFont(undefined, 'italic');
    const noteText = `Nota: Se muestran solo ${maxPolizas} pólizas. Existen ${agentDetails.length - maxPolizas} pólizas adicionales en este periodo.`;
    const noteLines = doc.splitTextToSize(noteText, contentWidth);
    noteLines.forEach((line: string) => {
      doc.text(line, marginLeft, yPosition);
      yPosition += 3;
    });
    yPosition += 2;
  }

  // ============================================================================
  // SISTEMA CORRECTO: USAR VALORES AGREGADOS DE commission_batches
  // ============================================================================
  // Los valores fiscales (ISR, IVA, retenciones) deben calcularse sobre el TOTAL
  // del lote, NO sumando valores individuales de cada póliza.
  // La función calculate_batch_fiscal_aggregates calcula correctamente sobre el total.

  const { supabase } = await import('./supabase');
  const usuario_id = agentDetails[0].usuario_id;

  // Obtener los valores fiscales AGREGADOS del lote desde commission_batches
  const { data: batchData, error: batchError } = await supabase
    .from('commission_batches')
    .select('regimen_fiscal, commission_vida, commission_sinvida, commission_total, retencion_contable, costo_dispersion, iva, ret_isr, ret_iva, total_neto, calculated_at')
    .eq('id', batch.id)
    .single();

  if (batchError || !batchData) {
    throw new Error('No se encontraron datos fiscales del lote');
  }

  if (!batchData.calculated_at) {
    throw new Error('El lote no tiene valores fiscales calculados. Por favor recalcula el lote.');
  }

  const regimenFiscalName = batchData.regimen_fiscal || 'HONORARIOS';
  const regimenFiscal = normalizarRegimenFiscal(regimenFiscalName);

  const agentFullName = `${usuario.nombre} ${usuario.apellidos}`.trim();
  console.log(`[PDF] Generando para ${agentFullName}: Régimen fiscal = ${regimenFiscalName} (normalizado: ${regimenFiscal})`);

  // Usar los valores AGREGADOS del lote
  const desgloseFiscal: DesgloseFiscal = {
    vida: parseFloat(batchData.commission_vida as any) || 0,
    sinVida: parseFloat(batchData.commission_sinvida as any) || 0,
    retContable: parseFloat(batchData.retencion_contable as any) || 0,
    costoDispersion: parseFloat(batchData.costo_dispersion as any) || 0,
    iva: parseFloat(batchData.iva as any) || 0,
    retIsr: parseFloat(batchData.ret_isr as any) || 0,
    retIva: parseFloat(batchData.ret_iva as any) || 0,
    isrVida: 0, // No usado en HONORARIOS/RESICO
    isrDanios: 0, // No usado en HONORARIOS/RESICO
    isrTotal: parseFloat(batchData.ret_isr as any) || 0,
    totalAPagar: parseFloat(batchData.total_neto as any) || 0,
  };

  console.log(`[PDF] ${regimenFiscal} - Valores AGREGADOS del lote:`, desgloseFiscal);

  console.log('[PDF] Desglose fiscal final:', desgloseFiscal);

  // Usar la función de allowlist para generar solo los campos permitidos
  const fiscalRows = getPdfFiscalRows(regimenFiscal, desgloseFiscal);
  console.log(`[PDF] Filas fiscales generadas: ${fiscalRows.length}`, fiscalRows);

  // Si no hay espacio en la página actual, crear una nueva
  const availableSpace = pageHeight - yPosition - 8;
  if (availableSpace < 50) {
    console.log('[PDF] Espacio insuficiente, creando nueva página');
    doc.addPage();
    yPosition = 20;
  }

  // Siempre mostrar el Cálculo Fiscal
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('Cálculo Fiscal (Resumen)', marginLeft, yPosition);

  yPosition += 4;

  // Convertir a formato de tabla con estilos
  const desgloseFiscalRows: any[] = fiscalRows.map(row => {
    if (row.isTotal) {
      // Fila de Total con estilo destacado
      return [
        { content: row.label, styles: { fontStyle: 'bold', fillColor: [0, 102, 51], textColor: [255, 255, 255] } },
        { content: row.value, styles: { fontStyle: 'bold', fillColor: [0, 102, 51], textColor: [255, 255, 255] } }
      ];
    } else if (row.isBold) {
      // Fila en negrita
      return [
        { content: row.label, styles: { fontStyle: 'bold' } },
        { content: row.value, styles: { fontStyle: 'bold' } }
      ];
    } else {
      // Fila normal
      return [row.label, row.value];
    }
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Concepto', 'Importe']],
    body: desgloseFiscalRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: marginLeft, right: marginRight },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.6 },
      1: { cellWidth: contentWidth * 0.4, halign: 'right' }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 3;

  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  doc.text(`Régimen fiscal: ${regimenFiscalName}`, marginLeft, yPosition);

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
