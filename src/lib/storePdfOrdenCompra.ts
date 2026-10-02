// Orden de Compra de artículos: lo que se pidió en MOVI Store.
//
// Comparte diseño con la Orden de Compra de servicios de Marketing Premium
// (`mktPremiumPdf.ts`): misma franja, mismo desglose, mismo bloque de cobro.
// Lo único que las distingue a propósito es el color —mostaza aquí, lila allá—
// y la palabra ARTÍCULOS en la franja, para no confundirlas nunca.

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { StorePedidoCompleto } from './storeTypes';
import { supabase } from './supabase';
import { getDisplayName } from './utils';
import { desglosarFormaPago, planDeCobro, pesos } from './cobroDesglose';
import { dibujarFranja, tablaConceptos, bloqueCobro, bloqueDatos, pieDocumento } from './ordenCompraPdf';

/**
 * Folio de la Orden de Compra: `ARTMKT-00118-POL-MGL`.
 *
 * Necesita al dueño del pedido porque el folio lleva su oficina y sus
 * iniciales — por eso ya no se puede generar "a secas".
 */
export async function generarFolioOC(usuarioId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generar_folio_oc', { p_usuario_id: usuarioId });
  if (error) {
    console.error('Error generando folio OC:', error);
    throw new Error('No se pudo generar el folio de Orden de Compra');
  }
  return data as string;
}

export function construirPDFOrdenCompra(pedido: StorePedidoCompleto): jsPDF {
  const doc = new jsPDF();
  const ancho = doc.internal.pageSize.getWidth();

  let y = dibujarFranja(doc, {
    tipo: 'articulos',
    folio: pedido.folio_oc || 'SIN FOLIO',
    cargoA: getDisplayName(pedido.usuario) || 'Sin solicitante',
    oficina: pedido.usuario?.oficina,
    fecha: pedido.created_at,
  });

  y = tablaConceptos(doc, y, 'articulos', pedido.detalle.map(item => ({
    concepto: item.producto?.titulo || 'Producto sin nombre',
    detalle: item.producto?.categoria?.nombre || null,
    cantidad: item.cantidad,
    precioUnitario: item.precio_unitario,
  })));

  const totalPiezas = pedido.detalle.reduce((s, i) => s + i.cantidad, 0);
  const total = pedido.detalle.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalPiezas} pieza${totalPiezas === 1 ? '' : 's'} en total`, 14, y - 3);
  doc.text(`Importe: ${pesos(total)}`, ancho - 14, y - 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 5;

  const { parcialidades, frecuencia } = desglosarFormaPago(pedido.forma_pago);
  const metodo = pedido.metodo_pago === 'Otro' && pedido.metodo_pago_otro_detalle
    ? `Otro — ${pedido.metodo_pago_otro_detalle}`
    : pedido.metodo_pago;

  y = bloqueCobro(doc, y, 'articulos', {
    plan: planDeCobro(total, parcialidades, frecuencia),
    metodo,
    responsable: pedido.responsable_pago?.nombre_completo || pedido.responsable_pago?.nombre || null,
  });

  y = bloqueDatos(doc, y, 'articulos', 'DATOS DEL SOLICITANTE', [
    ['Usuario SICAS:', pedido.usuario?.nombre_sicas || 'Sin usuario SICAS relacionado'],
    ['Rol:', pedido.usuario?.rol || '—'],
    ['Correo:', pedido.usuario?.email_laboral || '—'],
    ['Teléfono:', pedido.usuario?.celular_laboral || pedido.usuario?.telefono || '—'],
    ['Entrega en:', pedido.direccion_entrega || '—'],
    ['Estatus del pedido:', pedido.estatus?.nombre || '—'],
    ['Fecha del pedido:', format(new Date(pedido.created_at), 'dd/MM/yyyy', { locale: es })],
  ]);

  const notas: [string, string][] = [];
  if (pedido.observaciones_oc) notas.push(['Observaciones:', pedido.observaciones_oc]);
  if (pedido.notas_usuario) notas.push(['Notas del solicitante:', pedido.notas_usuario]);
  if (notas.length > 0) bloqueDatos(doc, y, 'articulos', 'NOTAS', notas);

  pieDocumento(doc, pedido.oc_generada_por_usuario?.nombre_completo);
  return doc;
}

/** Botón "Descargar OC". */
export function generarPDFOrdenCompra(pedido: StorePedidoCompleto): void {
  const doc = construirPDFOrdenCompra(pedido);
  doc.save(`Orden_Compra_Articulos_${pedido.folio_oc || pedido.id.substring(0, 8)}.pdf`);
}

/**
 * Genera la Orden de Compra y la sube a Storage para adjuntarla al trámite que
 * creó un trigger. No depende de que alguien haya dado clic en "Descargar OC".
 */
export async function subirPDFOrdenCompra(
  pedido: StorePedidoCompleto,
  ticketId: string
): Promise<{ nombre: string; url: string; tipo: string; tamano: number }> {
  const doc = construirPDFOrdenCompra(pedido);
  const blob = doc.output('blob');
  const nombre = `Orden_Compra_Articulos_${pedido.folio_oc || pedido.id.substring(0, 8)}.pdf`;
  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;

  const { error: upErr } = await supabase.storage.from('ticket-archivos').upload(path, blob, {
    contentType: 'application/pdf',
  });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(path);
  return { nombre, url: publicUrl, tipo: 'application/pdf', tamano: blob.size };
}

/** Valida que un pedido tenga lo necesario para generar su Orden de Compra. */
export function validarDatosPagoCompletos(pedido: StorePedidoCompleto): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];
  if (!pedido.forma_pago) errores.push('Debe seleccionar una forma de pago');
  if (!pedido.metodo_pago) errores.push('Debe seleccionar un método de pago');
  if (pedido.metodo_pago === 'Otro' && !pedido.metodo_pago_otro_detalle?.trim()) {
    errores.push('Debe especificar el detalle del método de pago "Otro"');
  }
  return { valido: errores.length === 0, errores };
}
