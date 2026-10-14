-- Una sola bitácora para MOVI Store y Marketing Premium, con filtros.
--
-- Eran dos vistas separadas, una por módulo, y para ver todo lo que un agente
-- debe había que mirar en dos pantallas. Ahora es una sola tabla con una
-- columna `modulo` para filtrar, más la oficina del solicitante para poder
-- cortar por oficina.
--
-- De paso se arreglan dos cosas de la versión anterior:
--
--   1. Los pagos de Premium se atribuían al periodo por rango de fechas
--      (`pago.fecha >= periodo.fecha_inicio`). Un periodo con la fecha mal
--      capturada —hay uno que dice 2050— dejaba FUERA todos sus pagos, y en
--      la pantalla se veía como si el agente no hubiera pagado nada.
--
--   2. El precio del plan estaba escrito a mano como 200 / 2000. Desde el
--      2026-10-02 el plan mensual son 12 cobros de $200 = $2,400, así que la
--      bitácora decía "$0 de $200" mientras el panel de pagos decía $2,400.

-- ── Cuánto cuesta un periodo completo ───────────────────────────────────────
-- Mismo criterio que `montoDelPlan()` en src/lib/mktPremiumPagos.ts: el precio
-- es POR COBRO y el mensual tiene 12. Si cambia allá, cambia aquí.
CREATE OR REPLACE FUNCTION public.mkt_premium_monto_periodo(p_plan text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
           WHEN 'anual'   THEN 2000::numeric
           WHEN 'mensual' THEN 200::numeric * 12
           ELSE 0::numeric
         END;
$$;

-- ── A qué periodo pertenece cada pago ───────────────────────────────────────
-- `mkt_premium_pagos` no referencia el periodo, así que hay que deducirlo. La
-- regla: el periodo más reciente que ya había empezado cuando se pagó; y si el
-- pago es anterior a todos (fecha mal capturada), el primero de ese agente.
-- Así ningún pago se pierde, que era el problema de la ventana de fechas.
CREATE OR REPLACE VIEW public.mkt_premium_pagos_por_periodo
WITH (security_invoker = true) AS
SELECT
  mp.id AS pago_id,
  mp.monto,
  COALESCE(
    (SELECT p.id FROM public.mkt_premium_periodos p
      WHERE p.usuario_id = mp.usuario_id AND p.fecha_inicio <= mp.fecha
      ORDER BY p.fecha_inicio DESC LIMIT 1),
    (SELECT p.id FROM public.mkt_premium_periodos p
      WHERE p.usuario_id = mp.usuario_id
      ORDER BY p.fecha_inicio ASC LIMIT 1)
  ) AS periodo_id
FROM public.mkt_premium_pagos mp;

COMMENT ON VIEW public.mkt_premium_pagos_por_periodo IS
  'Cada pago de Premium con el periodo al que corresponde. Ningún pago queda fuera: si su fecha es anterior a todos los periodos del agente, se atribuye al primero.';

-- ── La bitácora, los dos módulos en una sola tabla ──────────────────────────
-- `security_invoker = true`: no crea ninguna regla de permisos. Cada quien ve
-- lo que la RLS de store_pedidos / mkt_premium_* ya le deja ver.
DROP VIEW IF EXISTS public.bitacora_comercial_view;
CREATE VIEW public.bitacora_comercial_view
WITH (security_invoker = true) AS

-- MOVI Store: una fila por pedido
SELECT
  'store'::text                                       AS modulo,
  p.id                                                AS id,
  p.id::text                                          AS destino_id,   -- /store/pedidos/<id>
  p.folio_oc                                          AS folio,
  p.created_at                                        AS fecha,
  p.usuario_id                                        AS solicitante_id,
  sol.nombre_completo                                 AS solicitante_nombre,
  sol.oficina_id                                      AS oficina_id,
  ofi.nombre                                          AS oficina_nombre,
  resp.nombre_completo                                AS responsable_nombre,
  COALESCE(d.cantidad_total, 0)                       AS cantidad,
  COALESCE(d.monto_total, 0)                          AS monto,
  p.forma_pago                                        AS forma_pago,
  p.metodo_pago::text                                 AS metodo_pago,
  COALESCE(pg.pagado, 0)                              AS pagado,
  COALESCE(d.monto_total, 0) - COALESCE(pg.pagado, 0) AS saldo,
  true                                                AS activo,
  CASE
    WHEN COALESCE(d.monto_total, 0) = 0 THEN 'sin_monto'
    WHEN abs(COALESCE(pg.pagado, 0) - COALESCE(d.monto_total, 0)) <= 0.01 THEN 'al_corriente'
    WHEN COALESCE(pg.pagado, 0) > COALESCE(d.monto_total, 0) THEN 'a_favor'
    ELSE 'debe'
  END                                                 AS estado_pago
FROM public.store_pedidos p
LEFT JOIN public.usuarios sol  ON sol.id  = p.usuario_id
LEFT JOIN public.oficinas ofi  ON ofi.id  = sol.oficina_id
LEFT JOIN public.usuarios resp ON resp.id = p.responsable_pago_id
LEFT JOIN (
  SELECT pedido_id, SUM(cantidad) AS cantidad_total, SUM(cantidad * precio_unitario) AS monto_total
  FROM public.store_pedidos_detalle GROUP BY pedido_id
) d ON d.pedido_id = p.id
LEFT JOIN (
  SELECT pedido_id, SUM(monto) AS pagado
  FROM public.store_pedido_pagos GROUP BY pedido_id
) pg ON pg.pedido_id = p.id

UNION ALL

-- Marketing Premium: una fila por periodo contratado
SELECT
  'premium'::text                                     AS modulo,
  per.id                                              AS id,
  per.usuario_id::text                                AS destino_id,   -- ficha del agente
  per.folio                                           AS folio,
  per.fecha_inicio::timestamptz                       AS fecha,
  per.usuario_id                                      AS solicitante_id,
  u.nombre_completo                                   AS solicitante_nombre,
  u.oficina_id                                        AS oficina_id,
  ofi.nombre                                          AS oficina_nombre,
  u.nombre_completo                                   AS responsable_nombre,
  1                                                   AS cantidad,
  public.mkt_premium_monto_periodo(per.plan)          AS monto,
  COALESCE(per.frecuencia_pago, per.plan)             AS forma_pago,
  per.metodo_pago                                     AS metodo_pago,
  COALESCE(pg.pagado, 0)                              AS pagado,
  public.mkt_premium_monto_periodo(per.plan) - COALESCE(pg.pagado, 0) AS saldo,
  (per.fecha_fin IS NULL)                             AS activo,
  CASE
    WHEN per.plan IS NULL THEN 'sin_plan'
    WHEN abs(COALESCE(pg.pagado, 0) - public.mkt_premium_monto_periodo(per.plan)) <= 0.01 THEN 'al_corriente'
    WHEN COALESCE(pg.pagado, 0) > public.mkt_premium_monto_periodo(per.plan) THEN 'a_favor'
    ELSE 'debe'
  END                                                 AS estado_pago
FROM public.mkt_premium_periodos per
LEFT JOIN public.usuarios u    ON u.id   = per.usuario_id
LEFT JOIN public.oficinas ofi  ON ofi.id = u.oficina_id
LEFT JOIN (
  SELECT periodo_id, SUM(monto) AS pagado
  FROM public.mkt_premium_pagos_por_periodo
  WHERE periodo_id IS NOT NULL
  GROUP BY periodo_id
) pg ON pg.periodo_id = per.id;

COMMENT ON VIEW public.bitacora_comercial_view IS
  'Bitácora comercial: pedidos de MOVI Store y periodos de Marketing Premium en una sola tabla. Se filtra por `modulo`, `oficina_id` o por nombre. `destino_id` es a donde lleva el clic: el pedido en Store, el agente en Premium.';
