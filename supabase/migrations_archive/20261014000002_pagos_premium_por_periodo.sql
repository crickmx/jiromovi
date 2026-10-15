-- Un pago de Premium pertenece a una contratación, no solo a una persona.
--
-- `store_pedido_pagos` apunta al pedido; `mkt_premium_pagos` solo apuntaba al
-- usuario. Así no había forma de saber de QUÉ contratación era un pago: la
-- bitácora tenía que deducirlo por fechas, y un periodo con la fecha mal
-- capturada —hay uno que dice 2050— dejaba sus pagos fuera y mostraba al
-- agente como si no hubiera pagado nada.
--
-- Y si alguien contrata, cancela y vuelve a contratar, los pagos del primer
-- periodo y los del segundo eran indistinguibles.

ALTER TABLE public.mkt_premium_pagos
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES public.mkt_premium_periodos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.mkt_premium_pagos.periodo_id IS
  'Contratación a la que corresponde el pago. Equivale a store_pedido_pagos.pedido_id. Nulo solo en pagos viejos de agentes que no tienen ningún periodo registrado.';

CREATE INDEX IF NOT EXISTS idx_mkt_premium_pagos_periodo
  ON public.mkt_premium_pagos(periodo_id) WHERE periodo_id IS NOT NULL;

-- ── Lo que ya existe se reparte con la misma regla que usaba la bitácora ────
-- El periodo más reciente que ya había empezado cuando se pagó; y si el pago es
-- anterior a todos (fecha mal capturada), el primero de ese agente. Así ningún
-- pago se queda huérfano.
UPDATE public.mkt_premium_pagos mp
SET periodo_id = COALESCE(
  (SELECT p.id FROM public.mkt_premium_periodos p
    WHERE p.usuario_id = mp.usuario_id AND p.fecha_inicio <= mp.fecha
    ORDER BY p.fecha_inicio DESC LIMIT 1),
  (SELECT p.id FROM public.mkt_premium_periodos p
    WHERE p.usuario_id = mp.usuario_id
    ORDER BY p.fecha_inicio ASC LIMIT 1)
)
WHERE mp.periodo_id IS NULL;

-- ── La bitácora deja de adivinar ────────────────────────────────────────────
-- Se recrea entera porque cambia de dónde salen los pagos de Premium.
DROP VIEW IF EXISTS public.bitacora_comercial_view;
DROP VIEW IF EXISTS public.mkt_premium_pagos_por_periodo;

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
  NULL::text                                          AS plan,
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
  per.plan                                            AS plan,
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
  -- Ahora el pago dice a qué periodo pertenece: ya no hay que deducirlo.
  SELECT periodo_id, SUM(monto) AS pagado
  FROM public.mkt_premium_pagos
  WHERE periodo_id IS NOT NULL
  GROUP BY periodo_id
) pg ON pg.periodo_id = per.id;

COMMENT ON VIEW public.bitacora_comercial_view IS
  'Bitácora comercial: pedidos de MOVI Store y periodos de Marketing Premium en una sola tabla. Se filtra por `modulo`, `oficina_id` o por nombre. `destino_id` es a donde lleva el clic: el pedido en Store, el agente en Premium.';
