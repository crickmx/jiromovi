import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { StorePedidoCompleto } from './storeTypes';
import { supabase } from './supabase';
import { getDisplayName } from './utils';

/**
 * Genera un folio único alfanumérico de 8 caracteres para una Orden de Compra
 */
export async function generarFolioOC(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generar_folio_oc');

    if (error) {
      console.error('Error generando folio OC:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error al generar folio OC:', error);
    throw new Error('No se pudo generar el folio de Orden de Compra');
  }
}

/**
 * Genera el PDF de Orden de Compra para un pedido
 */
export async function generarPDFOrdenCompra(pedido: StorePedidoCompleto): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Encabezado
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE COMPRA', pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Folio: ${pedido.folio_oc || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // Información general
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de emisión:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(
    format(pedido.oc_generada_en ? new Date(pedido.oc_generada_en) : new Date(), 'dd/MM/yyyy HH:mm', { locale: es }),
    60,
    yPos
  );

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Estatus:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(pedido.estatus?.nombre || 'N/A', 60, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de pedido:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(pedido.created_at), 'dd/MM/yyyy', { locale: es }), 60, yPos);

  yPos += 12;

  // Datos del solicitante
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL SOLICITANTE', 14, yPos);
  yPos += 2;
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre Completo:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  const nombreCompleto = getDisplayName(pedido.usuario) || 'N/A';
  doc.text(nombreCompleto, 60, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Usuario SICAS:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(pedido.usuario?.nombre_sicas || 'Sin usuario SICAS relacionado', 60, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Rol:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(pedido.usuario?.rol || 'N/A', 60, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Oficina:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(pedido.usuario?.oficina || 'N/A', 60, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(pedido.usuario?.email_laboral || 'N/A', 60, yPos);

  if (pedido.usuario?.celular_laboral || pedido.usuario?.telefono) {
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Teléfono:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(pedido.usuario?.celular_laboral || pedido.usuario?.telefono || 'N/A', 60, yPos);
  }

  if (pedido.direccion_entrega) {
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Dirección:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    const splitDireccion = doc.splitTextToSize(pedido.direccion_entrega, pageWidth - 74);
    doc.text(splitDireccion, 60, yPos);
    yPos += (splitDireccion.length - 1) * 5;
  }

  yPos += 12;

  // Detalle del pedido
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DEL PEDIDO', 14, yPos);
  yPos += 2;
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 8;

  // Tabla de productos
  const tableData = pedido.detalle.map((item) => {
    const subtotal = item.cantidad * item.precio_unitario;
    return [
      item.producto?.titulo || 'Producto sin nombre',
      item.producto?.categoria?.nombre || 'N/A',
      item.cantidad.toString(),
      `$${item.precio_unitario.toFixed(2)}`,
      `$${subtotal.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Producto', 'Categoría', 'Cantidad', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Totales
  const totalArticulos = pedido.detalle.reduce((sum, item) => sum + item.cantidad, 0);
  const totalMonto = pedido.detalle.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total de artículos:', pageWidth - 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(totalArticulos.toString(), pageWidth - 14, yPos, { align: 'right' });

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', pageWidth - 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`$${totalMonto.toFixed(2)}`, pageWidth - 14, yPos, { align: 'right' });

  yPos += 12;

  // Información de pago (si existe)
  if (pedido.forma_pago || pedido.metodo_pago) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE PAGO', 14, yPos);
    yPos += 2;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (pedido.responsable_pago) {
      doc.setFont('helvetica', 'bold');
      doc.text('Responsable de pago:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(pedido.responsable_pago.nombre_completo || pedido.responsable_pago.nombre || 'N/A', 60, yPos);
      yPos += 6;
    }

    if (pedido.forma_pago) {
      doc.setFont('helvetica', 'bold');
      doc.text('Forma de pago:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(pedido.forma_pago, 60, yPos);
      yPos += 6;
    }

    if (pedido.metodo_pago) {
      doc.setFont('helvetica', 'bold');
      doc.text('Método de pago:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(pedido.metodo_pago, 60, yPos);
      yPos += 6;

      if (pedido.metodo_pago === 'Otro' && pedido.metodo_pago_otro_detalle) {
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle:', 14, yPos);
        doc.setFont('helvetica', 'normal');
        const splitDetalle = doc.splitTextToSize(pedido.metodo_pago_otro_detalle, pageWidth - 74);
        doc.text(splitDetalle, 60, yPos);
        yPos += splitDetalle.length * 5;
      }
    }

    yPos += 6;
  }

  // Observaciones
  if (pedido.observaciones_oc) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES', 14, yPos);
    yPos += 2;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitObservaciones = doc.splitTextToSize(pedido.observaciones_oc, pageWidth - 28);
    doc.text(splitObservaciones, 14, yPos);
    yPos += splitObservaciones.length * 5 + 6;
  }

  // Notas del usuario
  if (pedido.notas_usuario) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS DEL SOLICITANTE', 14, yPos);
    yPos += 2;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitNotas = doc.splitTextToSize(pedido.notas_usuario, pageWidth - 28);
    doc.text(splitNotas, 14, yPos);
    yPos += splitNotas.length * 5 + 6;
  }

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Documento interno para control de MOVI Digital / Store', pageWidth / 2, pageHeight - 20, {
    align: 'center',
  });

  if (pedido.oc_generada_por_usuario?.nombre_completo) {
    doc.text(
      `Generado por: ${pedido.oc_generada_por_usuario.nombre_completo}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' }
    );
  }

  doc.text(
    `Fecha de descarga: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Descargar PDF
  const filename = `Orden_Compra_${pedido.folio_oc || pedido.id.substring(0, 8)}.pdf`;
  doc.save(filename);
}

/**
 * Valida que un pedido tenga toda la información necesaria para generar OC
 */
export function validarDatosPagoCompletos(pedido: StorePedidoCompleto): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (!pedido.forma_pago) {
    errores.push('Debe seleccionar una forma de pago');
  }

  if (!pedido.metodo_pago) {
    errores.push('Debe seleccionar un método de pago');
  }

  if (pedido.metodo_pago === 'Otro' && !pedido.metodo_pago_otro_detalle?.trim()) {
    errores.push('Debe especificar el detalle del método de pago "Otro"');
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}
