/*
  # Historial de periodos de Marketing Premium

  `usuarios.mkt_premium_folio` es una sola columna que se regenera y se
  sobreescribe en cada activación/desactivación -- hoy NO existe ningún
  registro de los periodos pasados. Para la bitácora compartida
  Store+Marketing (pedida por Ricardo 2026-10-08), que debe mostrar
  historial completo, hace falta esta tabla nueva.

  IMPORTANTE: los periodos que ya se desactivaron ANTES de esta migración
  no se pueden recuperar -- ese dato nunca se guardó en ningún lado. El
  backfill de abajo solo captura el estado PRESENTE (quién tiene Premium
  activo hoy); el historial real empieza a acumularse desde ahora.
*/

CREATE TABLE IF NOT EXISTS public.mkt_premium_periodos (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id         uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  folio              text        NOT NULL,
  plan               text,
  frecuencia_pago    text,
  metodo_pago        text,
  fecha_inicio       date,
  fecha_fin          date,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mkt_premium_periodos IS 'Un periodo = una contratación de Premium (activación hasta desactivación). fecha_fin NULL = periodo activo. Alimentada por trigger, no se edita a mano.';

CREATE INDEX IF NOT EXISTS idx_mkt_premium_periodos_usuario ON public.mkt_premium_periodos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mkt_premium_periodos_activo ON public.mkt_premium_periodos(usuario_id) WHERE fecha_fin IS NULL;

ALTER TABLE public.mkt_premium_periodos ENABLE ROW LEVEL SECURITY;

-- Mismo criterio de acceso que mkt_premium_pagos (equipo de Marketing con
-- acceso, vía mkt_puede_administrar() ya existente).
CREATE POLICY "mkt_premium_periodos_select" ON public.mkt_premium_periodos
  FOR SELECT TO authenticated USING (mkt_puede_administrar());

-- Solo el trigger (SECURITY DEFINER) escribe aquí; nadie más inserta/edita a mano.
CREATE POLICY "mkt_premium_periodos_service" ON public.mkt_premium_periodos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Backfill: captura el estado presente (quién tiene Premium activo hoy),
-- con el folio y fechas que ya existen en usuarios. No reconstruye periodos
-- pasados -- ese dato no existe.
INSERT INTO public.mkt_premium_periodos (usuario_id, folio, plan, frecuencia_pago, metodo_pago, fecha_inicio)
SELECT id, mkt_premium_folio, mkt_premium_plan, mkt_premium_frecuencia_pago, mkt_premium_metodo_pago,
       COALESCE(mkt_premium_fecha_inicio, created_at::date)
FROM public.usuarios
WHERE plan_mkt_premium = true
  AND mkt_premium_folio IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.mkt_premium_periodos p
    WHERE p.usuario_id = usuarios.id AND p.fecha_fin IS NULL
  );

-- Trigger: abre un periodo nuevo al activar, cierra el periodo abierto al
-- desactivar. AFTER UPDATE porque necesita ver los valores ya guardados
-- (folio incluido, cuando se activa viene en el mismo UPDATE).
CREATE OR REPLACE FUNCTION public.trg_mkt_premium_periodo_tracking()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.plan_mkt_premium = true AND (OLD.plan_mkt_premium IS DISTINCT FROM true) THEN
    INSERT INTO public.mkt_premium_periodos (usuario_id, folio, plan, frecuencia_pago, metodo_pago, fecha_inicio)
    VALUES (
      NEW.id,
      COALESCE(NEW.mkt_premium_folio, 'SIN-FOLIO'),
      NEW.mkt_premium_plan,
      NEW.mkt_premium_frecuencia_pago,
      NEW.mkt_premium_metodo_pago,
      COALESCE(NEW.mkt_premium_fecha_inicio, CURRENT_DATE)
    );
  ELSIF NEW.plan_mkt_premium = false AND OLD.plan_mkt_premium = true THEN
    UPDATE public.mkt_premium_periodos
    SET fecha_fin = CURRENT_DATE
    WHERE usuario_id = NEW.id AND fecha_fin IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_premium_periodo ON public.usuarios;
CREATE TRIGGER trg_mkt_premium_periodo
  AFTER UPDATE ON public.usuarios
  FOR EACH ROW
  WHEN (OLD.plan_mkt_premium IS DISTINCT FROM NEW.plan_mkt_premium)
  EXECUTE FUNCTION public.trg_mkt_premium_periodo_tracking();
