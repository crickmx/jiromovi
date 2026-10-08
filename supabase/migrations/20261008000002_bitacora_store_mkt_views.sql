/*
  # Bitácora compartida Store + Marketing Premium

  Dos vistas, una por módulo, cada una junta en una sola fila lo que hoy
  vive repartido en varias tablas: folio, fecha, solicitante, responsable,
  cantidad/monto, forma de pago/plazo, y un resumen de pagos aplicados
  (pagado/saldo/estatus). No crean ninguna regla de permisos nueva:
  `security_invoker = true` hace que cada vista corra con los privilegios
  de quien consulta, así que la RLS que YA existe en store_pedidos/
  store_pedido_pagos/mkt_premium_pagos/mkt_premium_periodos aplica tal
  cual -- "los mismos permisos que ya existen", sin tabla de acceso nueva.

  El resumen de pagos usa el mismo criterio de estado que
  src/lib/mktPremiumPagos.ts::saldoPremium() (tolerancia de ±0.01 por
  redondeo de centavos), para que Store y Marketing hablen el mismo
  idioma de "al corriente / debe / a favor".
*/

CREATE OR REPLACE VIEW public.store_bitacora_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.folio_oc                                       AS folio,
  p.created_at                                     AS fecha,
  p.usuario_id                                     AS solicitante_id,
  sol.nombre_completo                              AS solicitante_nombre,
  p.responsable_pago_id                            AS responsable_id,
  resp.nombre_completo                             AS responsable_nombre,
  COALESCE(d.cantidad_total, 0)                    AS cantidad,
  COALESCE(d.monto_total, 0)                        AS monto,
  p.forma_pago,
  p.metodo_pago::text                               AS metodo_pago,
  COALESCE(pg.pagado, 0)                            AS pagado,
  COALESCE(d.monto_total, 0) - COALESCE(pg.pagado, 0) AS saldo,
  CASE
    WHEN COALESCE(d.monto_total, 0) = 0 THEN 'sin_monto'
    WHEN COALESCE(pg.pagado, 0) >= COALESCE(d.monto_total, 0) - 0.01
     AND COALESCE(pg.pagado, 0) <= COALESCE(d.monto_total, 0) + 0.01 THEN 'al_corriente'
    WHEN COALESCE(pg.pagado, 0) > COALESCE(d.monto_total, 0) + 0.01 THEN 'a_favor'
    ELSE 'debe'
  END                                                AS estado_pago
FROM public.store_pedidos p
LEFT JOIN public.usuarios sol  ON sol.id  = p.usuario_id
LEFT JOIN public.usuarios resp ON resp.id = p.responsable_pago_id
LEFT JOIN (
  SELECT pedido_id, SUM(cantidad) AS cantidad_total, SUM(cantidad * precio_unitario) AS monto_total
  FROM public.store_pedidos_detalle GROUP BY pedido_id
) d ON d.pedido_id = p.id
LEFT JOIN (
  SELECT pedido_id, SUM(monto) AS pagado
  FROM public.store_pedido_pagos GROUP BY pedido_id
) pg ON pg.pedido_id = p.id;

COMMENT ON VIEW public.store_bitacora_view IS 'Bitácora de MOVI Store: una fila por pedido, con cantidad/monto ya sumados de store_pedidos_detalle y pagos ya sumados de store_pedido_pagos. security_invoker=true: hereda la RLS real de cada tabla.';

CREATE OR REPLACE VIEW public.mkt_premium_bitacora_view
WITH (security_invoker = true) AS
SELECT
  per.id,
  per.folio,
  per.fecha_inicio::timestamptz                     AS fecha,
  per.usuario_id                                     AS solicitante_id,
  u.nombre_completo                                  AS solicitante_nombre,
  per.usuario_id                                      AS responsable_id,
  u.nombre_completo                                   AS responsable_nombre,
  1                                                    AS cantidad,
  CASE per.plan WHEN 'anual' THEN 2000 WHEN 'mensual' THEN 200 ELSE 0 END
                                                        AS monto,
  COALESCE(per.frecuencia_pago, per.plan)              AS forma_pago,
  per.metodo_pago,
  COALESCE(pg.pagado, 0)                               AS pagado,
  (CASE per.plan WHEN 'anual' THEN 2000 WHEN 'mensual' THEN 200 ELSE 0 END) - COALESCE(pg.pagado, 0)
                                                        AS saldo,
  per.fecha_fin,
  (per.fecha_fin IS NULL)                              AS activo,
  CASE
    WHEN per.plan IS NULL THEN 'sin_plan'
    WHEN COALESCE(pg.pagado, 0) >= (CASE per.plan WHEN 'anual' THEN 2000 WHEN 'mensual' THEN 200 ELSE 0 END) - 0.01
     AND COALESCE(pg.pagado, 0) <= (CASE per.plan WHEN 'anual' THEN 2000 WHEN 'mensual' THEN 200 ELSE 0 END) + 0.01 THEN 'al_corriente'
    WHEN COALESCE(pg.pagado, 0) > (CASE per.plan WHEN 'anual' THEN 2000 WHEN 'mensual' THEN 200 ELSE 0 END) + 0.01 THEN 'a_favor'
    ELSE 'debe'
  END                                                   AS estado_pago
FROM public.mkt_premium_periodos per
LEFT JOIN public.usuarios u ON u.id = per.usuario_id
LEFT JOIN LATERAL (
  SELECT SUM(monto) AS pagado
  FROM public.mkt_premium_pagos mp
  WHERE mp.usuario_id = per.usuario_id
    AND mp.fecha >= per.fecha_inicio
    AND mp.fecha <  COALESCE(per.fecha_fin, CURRENT_DATE + 1)
) pg ON true;

COMMENT ON VIEW public.mkt_premium_bitacora_view IS 'Bitácora de Marketing Premium: una fila por periodo (mkt_premium_periodos). Los pagos de mkt_premium_pagos se atribuyen al periodo por rango de fecha, porque la tabla de pagos no referencia el periodo directamente. El precio (200/2000) está hardcodeado igual que PRECIO_PREMIUM en src/lib/mktPremiumPagos.ts -- si ese valor cambia, cambiarlo también aquí.';
