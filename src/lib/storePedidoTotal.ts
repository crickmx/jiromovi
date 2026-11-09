/**
 * EL total de un pedido de MOVI Store. Uno solo, para todo el proyecto.
 *
 * Antes de esto el total se sumaba en SEIS lugares por su cuenta: la pantalla
 * del pedido, la Orden de Compra, la lista de pedidos, el pedido completo, el
 * `{{monto_total}}` de los avisos y la vista `store_bitacora_view`. Mientras
 * todos sumaran lo mismo no se notaba; al agregar el costo de envío (09/11) se
 * volvió el problema de siempre: basta que uno no lo sume para que el cliente
 * vea un total y se le cobre otro. Es el bug que ya se pagó en octubre con
 * Marketing Premium ("$0 de $200" en la bitácora contra $2,400 en el panel).
 *
 * Vive aparte de `storeUtils` a propósito: ahí dentro vive `supabase`, y este
 * archivo tiene que poder correrse fuera del navegador para su comprobación.
 * Su gemelo en SQL es el subselect de `store_bitacora_view`.
 */

/** Lo mínimo que hace falta de un renglón del pedido para sumarlo. */
export interface LineaDePedido {
  cantidad?: number | null;
  precio_unitario?: number | string | null;
}

/** Un número de dinero que puede venir como texto desde PostgREST. */
function monto(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * A centavos y de vuelta. Sumar flotantes de dinero deja basura
 * (19.99 * 3 = 59.97000000000001), y `estado_pago` compara contra el pagado
 * con una tolerancia de un centavo: sin esto, un pedido exacto puede salir
 * "debe" por una millonésima.
 */
function aCentavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Lo que suman los artículos, sin envío. Es `articulos` en la bitácora. */
export function importeArticulos(lineas: readonly LineaDePedido[] | null | undefined): number {
  if (!lineas) return 0;
  return aCentavos(lineas.reduce((suma, l) => suma + monto(l.cantidad) * monto(l.precio_unitario), 0));
}

/**
 * El total que se le cobra al cliente: artículos + envío.
 *
 * El envío es un cargo AL CLIENTE y por eso entra aquí. No confundir con
 * `store_pedido_gastos`, que es lo que JIRO gasta (margen) y nunca se suma al
 * total — por eso un pedido puede decir "Total $650.00" y "Costo $686.12" sin
 * contradecirse.
 */
export function totalDelPedido(
  lineas: readonly LineaDePedido[] | null | undefined,
  costoEnvio?: number | string | null
): number {
  return aCentavos(importeArticulos(lineas) + monto(costoEnvio));
}

// ── Autocomprobación ───────────────────────────────────────────────────────
// `npx tsx src/lib/storePedidoTotal.test.mjs`
// Un error aquí no da síntoma: el total se ve igual de normal, solo está mal.
