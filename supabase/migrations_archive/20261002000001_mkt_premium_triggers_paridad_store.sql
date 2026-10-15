-- Marketing Premium: las reglas de trámite alcanzan a las de MOVI Store.
--
-- Las dos pantallas hacen lo mismo pero Marketing se construyó copiando a Store
-- a mano, y en la copia quedaron fuera dos cosas. Desde el 2026-10-02 las dos
-- comparten el motor (`src/lib/tramiteTriggers.ts`), así que basta con darles
-- las columnas para que el comportamiento sea idéntico.
--
-- 1. `forma_pago_filtro` — Store filtra por método Y por forma de pago; Marketing
--    solo por método. Aquí la "forma" es el plan: mensual o anual.
-- 2. La fuente `adjunto_comprobante` en el mapeo de campos — hoy el comprobante
--    en PDF se adjunta SIEMPRE, incluso a trámites internos que no lo necesitan.
--    Con esto se decide regla por regla, igual que el `adjunto_oc` de Store.
--
-- Nada de esto rompe lo que ya existe: una columna nula y un valor nuevo del
-- CHECK significan "como antes".

-- ─── 1. Filtro por forma de pago (plan) ──────────────────────────────────────

ALTER TABLE public.mkt_premium_triggers
  ADD COLUMN IF NOT EXISTS forma_pago_filtro text[];

COMMENT ON COLUMN public.mkt_premium_triggers.forma_pago_filtro IS
  'Planes a los que aplica la regla (mensual/anual). NULL o vacío = cualquiera, igual que metodo_pago_filtro.';

-- ─── 2. Adjuntar el comprobante solo cuando se pida ──────────────────────────

DO $$
DECLARE
  nombre_check text;
BEGIN
  -- El CHECK de `fuente` se creó sin nombre explícito, así que se busca por su
  -- definición en vez de adivinar cómo lo bautizó Postgres.
  SELECT con.conname INTO nombre_check
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'mkt_premium_trigger_campos'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%fuente%';

  IF nombre_check IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.mkt_premium_trigger_campos DROP CONSTRAINT %I', nombre_check);
  END IF;

  ALTER TABLE public.mkt_premium_trigger_campos
    ADD CONSTRAINT mkt_premium_trigger_campos_fuente_check
    CHECK (fuente IN ('vacio', 'template', 'adjunto_comprobante'));
END $$;

COMMENT ON COLUMN public.mkt_premium_trigger_campos.fuente IS
  'vacio = no se llena · template = texto con {{placeholders}} · adjunto_comprobante = adjunta el PDF del comprobante al trámite (equivalente al adjunto_oc de Store).';
