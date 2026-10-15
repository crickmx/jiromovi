-- ─── Fix: Sync cerrado_en ↔ completed_at ─────────────────────────────────────
-- El trigger trg_set_completed_at (FormBuilder) sólo actualizaba completed_at.
-- El trigger log_ticket_cambio (historial) sólo observa cerrado_en.
-- Resultado: cierre automático vía estatus FormBuilder era invisible en el historial
-- y en vistas que usan completed_at vs cerrado_en indistintamente.
--
-- Este fix actualiza trg_set_completed_at para sincronizar ambas columnas,
-- de modo que el historial existente se active solo sin código adicional.

CREATE OR REPLACE FUNCTION public.trg_set_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_sistema_key    text;
  v_config         jsonb;
  v_es_terminacion boolean := false;
BEGIN
  IF NEW.valor_texto IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sistema_key, config
  INTO   v_sistema_key, v_config
  FROM   public.tramite_tipo_campos
  WHERE  id         = NEW.campo_id
    AND  is_sistema = true
    AND  sistema_key = 'estatus';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(v_config -> 'opciones') AS opt
    WHERE  opt->>'slug'          = NEW.valor_texto
      AND  opt->>'clasificacion' = 'terminacion'
  ) INTO v_es_terminacion;

  IF v_es_terminacion THEN
    -- Sincronizar completed_at Y cerrado_en para que log_ticket_cambio lo registre
    UPDATE public.tickets
    SET    completed_at = now(),
           cerrado_en   = now(),
           cerrado_por  = (SELECT auth.uid())
    WHERE  id           = NEW.tramite_id
      AND  completed_at IS NULL;
  ELSE
    -- Si el estatus vuelve a uno no terminal, limpiar ambas columnas
    UPDATE public.tickets
    SET    completed_at = NULL,
           cerrado_en   = NULL,
           cerrado_por  = NULL
    WHERE  id = NEW.tramite_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_set_completed_at IS
  'Actualiza tickets.completed_at y tickets.cerrado_en al insertar una respuesta de estatus con clasificacion=terminacion.
   Sincronizar ambas columnas activa automáticamente el trigger log_ticket_cambio para registrar el cierre en el historial.';
