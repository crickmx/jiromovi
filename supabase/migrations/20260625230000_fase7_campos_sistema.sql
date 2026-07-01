-- ─── Fase 7: Campos de Sistema (Sección 1 Fija) ─────────────────────────────
-- Agrega is_sistema y sistema_key a tramite_tipo_campos,
-- función + trigger para auto-crear los 7 campos sistema en cada nuevo tipo,
-- y backfill para los tipos existentes.

-- 1. Extender constraint de tipo
ALTER TABLE public.tramite_tipo_campos DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;
ALTER TABLE public.tramite_tipo_campos ADD CONSTRAINT tramite_tipo_campos_tipo_check
  CHECK (tipo IN (
    'texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano',
    'dropdown','seleccion_multiple','aseguradora','ramo','rfc','codigo_postal',
    'telefono','email','curp','porcentaje',
    'area','equipo','agente_vendedor','oficina_jiro','fecha_creacion','fecha_finalizacion'
  ));

-- 2. Agregar columnas is_sistema y sistema_key
ALTER TABLE public.tramite_tipo_campos
  ADD COLUMN IF NOT EXISTS is_sistema   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sistema_key  text;

-- 3. Índice único parcial para evitar duplicar campos sistema por tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_sistema_campos_unique
  ON public.tramite_tipo_campos(tramite_tipo_id, sistema_key)
  WHERE is_sistema = true;

-- 4. Función helper: inserta UN campo sistema si no existe aún
CREATE OR REPLACE FUNCTION public.ensure_sistema_campo(
  p_tipo_id    uuid,
  p_key        text,
  p_label      text,
  p_tipo       text,
  p_order      int,
  p_config     jsonb,
  p_skey       text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tramite_tipo_campos
    WHERE tramite_tipo_id = p_tipo_id
      AND is_sistema = true
      AND sistema_key = p_skey
  ) THEN
    INSERT INTO public.tramite_tipo_campos
      (tramite_tipo_id, key, label, tipo, requerido, display_order, config, activo, is_sistema, sistema_key)
    VALUES
      (p_tipo_id, p_key, p_label, p_tipo, true, p_order, p_config, true, true, p_skey);
  END IF;
END;
$$;

-- 5. Función: crear los 7 campos sistema para un tipo dado
CREATE OR REPLACE FUNCTION public.create_all_sistema_campos(p_tipo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'area',              'Área',               'area',              -7, '{}'::jsonb,  'area');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'equipo',            'Equipo',              'equipo',            -6, '{}'::jsonb,  'equipo');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'estatus_tramite',   'Estatus',             'estatus',           -5,
    '{"opciones":[{"label":"Iniciado","slug":"iniciado","clasificacion":"inicio"},{"label":"Terminado","slug":"terminado","clasificacion":"terminacion"}]}'::jsonb,
    'estatus');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'agente_vendedor',   'Agente / Vendedor',   'agente_vendedor',   -4, '{}'::jsonb,  'agente_vendedor');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'oficina_jiro',      'Oficina Jiro',        'oficina_jiro',      -3, '{}'::jsonb,  'oficina_jiro');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_creacion',    'Fecha de Creación',   'fecha_creacion',    -2, '{}'::jsonb,  'fecha_creacion');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_finalizacion','Fecha de Finalización','fecha_finalizacion',-1, '{}'::jsonb,  'fecha_finalizacion');
END;
$$;

-- 6. Trigger: ejecutar al insertar un nuevo ticket_tipo
CREATE OR REPLACE FUNCTION public.trigger_create_sistema_campos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.create_all_sistema_campos(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_sistema_campos ON public.ticket_tipos;
CREATE TRIGGER trg_create_sistema_campos
  AFTER INSERT ON public.ticket_tipos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_create_sistema_campos();

-- 7. Backfill: tipos existentes
--    Para estatus: si ya existe uno custom lo upgradea; si no, crea el sistema.
DO $$
DECLARE t record;
DECLARE existing_estatus_id uuid;
BEGIN
  FOR t IN SELECT id FROM public.ticket_tipos LOOP

    -- Estatus especial: intentar upgradear el existente
    SELECT id INTO existing_estatus_id
    FROM public.tramite_tipo_campos
    WHERE tramite_tipo_id = t.id
      AND tipo = 'estatus'
      AND (is_sistema = false OR is_sistema IS NULL)
    ORDER BY display_order ASC
    LIMIT 1;

    IF existing_estatus_id IS NOT NULL THEN
      UPDATE public.tramite_tipo_campos
      SET is_sistema = true, sistema_key = 'estatus', display_order = -5
      WHERE id = existing_estatus_id;
    ELSE
      PERFORM public.ensure_sistema_campo(t.id, 'estatus_tramite', 'Estatus', 'estatus', -5,
        '{"opciones":[{"label":"Iniciado","slug":"iniciado","clasificacion":"inicio"},{"label":"Terminado","slug":"terminado","clasificacion":"terminacion"}]}'::jsonb,
        'estatus');
    END IF;

    -- Los otros 6 campos sistema
    PERFORM public.ensure_sistema_campo(t.id, 'area',              'Área',               'area',              -7, '{}'::jsonb, 'area');
    PERFORM public.ensure_sistema_campo(t.id, 'equipo',            'Equipo',              'equipo',            -6, '{}'::jsonb, 'equipo');
    PERFORM public.ensure_sistema_campo(t.id, 'agente_vendedor',   'Agente / Vendedor',   'agente_vendedor',   -4, '{}'::jsonb, 'agente_vendedor');
    PERFORM public.ensure_sistema_campo(t.id, 'oficina_jiro',      'Oficina Jiro',        'oficina_jiro',      -3, '{}'::jsonb, 'oficina_jiro');
    PERFORM public.ensure_sistema_campo(t.id, 'fecha_creacion',    'Fecha de Creación',   'fecha_creacion',    -2, '{}'::jsonb, 'fecha_creacion');
    PERFORM public.ensure_sistema_campo(t.id, 'fecha_finalizacion','Fecha de Finalización','fecha_finalizacion',-1, '{}'::jsonb, 'fecha_finalizacion');

  END LOOP;
END;
$$;
