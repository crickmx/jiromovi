-- ─── FASE 1: Consolidación y adiciones del módulo Trámites ───────────────────
--
-- 1. Agregar area_id FK a tramites_grupos_visualizacion (normalizar área)
-- 2. Agregar puede_editar a tablas de permisos existentes
-- 3. Crear tramite_equipo_tipo_permisos (permisos granulares por equipo × tipo)
-- 4. Actualizar puede_acceder_tipo_tramite() con capa de equipo
-- 5. Deprecar tramites_usuarios_empleados (sin referencias en código)
--
-- Todas las operaciones son ADITIVAS — no elimina ni renombra nada.
-- Los datos existentes de producción se conservan.

-- ─── 1. area_id en equipos ────────────────────────────────────────────────────

ALTER TABLE public.tramites_grupos_visualizacion
  ADD COLUMN IF NOT EXISTS area_id uuid
    REFERENCES public.tramites_areas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tramites_grupos_visualizacion.area_id IS
  'FK normalizada a tramites_areas. Reemplaza a area_categoria (texto libre) a medida que se migra el código.';

-- Poblar area_id desde area_categoria para equipos que ya tienen área asignada
UPDATE public.tramites_grupos_visualizacion g
SET    area_id = ta.id
FROM   public.tramites_areas ta
WHERE  ta.nombre = g.area_categoria
  AND  g.area_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tgv_area_id
  ON public.tramites_grupos_visualizacion(area_id);

-- ─── 2. puede_editar en tablas de permisos existentes ────────────────────────

-- 2a. tramite_tipo_rol_permisos
ALTER TABLE public.tramite_tipo_rol_permisos
  ADD COLUMN IF NOT EXISTS puede_editar boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tramite_tipo_rol_permisos.puede_editar IS
  'Si el rol puede editar trámites de este tipo. DEFAULT true = comportamiento anterior conservado.';

-- 2b. tramite_tipo_usuario_override
ALTER TABLE public.tramite_tipo_usuario_override
  ADD COLUMN IF NOT EXISTS puede_editar boolean DEFAULT NULL;

COMMENT ON COLUMN public.tramite_tipo_usuario_override.puede_editar IS
  'Override de puede_editar por usuario. NULL = heredar del rol.';

-- ─── 3. Nueva tabla: tramite_equipo_tipo_permisos ────────────────────────────
--
-- Permite asignar permisos CREAR / EDITAR / VER por Equipo × Tipo de trámite.
-- NULL en cualquier campo = heredar del rol global (backward compatible).
-- Esta tabla es la nueva fuente de verdad para permisos por equipo; convive con
-- tramite_tipo_rol_permisos (por rol) como capa de base.

CREATE TABLE IF NOT EXISTS public.tramite_equipo_tipo_permisos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       uuid        NOT NULL
                              REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  tramite_tipo_id uuid        NOT NULL
                              REFERENCES public.ticket_tipos(id)                 ON DELETE CASCADE,
  puede_crear     boolean     DEFAULT NULL,
  puede_editar    boolean     DEFAULT NULL,
  puede_ver       boolean     DEFAULT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  UNIQUE (equipo_id, tramite_tipo_id)
);

COMMENT ON TABLE public.tramite_equipo_tipo_permisos IS
  'Permisos CREAR/EDITAR/VER por Equipo × Tipo de trámite. NULL = heredar del rol. Tiene prioridad sobre tramite_tipo_rol_permisos.';

CREATE INDEX IF NOT EXISTS idx_tetp_equipo    ON public.tramite_equipo_tipo_permisos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_tetp_tipo      ON public.tramite_equipo_tipo_permisos(tramite_tipo_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tetp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tetp_updated ON public.tramite_equipo_tipo_permisos;
CREATE TRIGGER trg_tetp_updated
  BEFORE UPDATE ON public.tramite_equipo_tipo_permisos
  FOR EACH ROW EXECUTE FUNCTION public.tetp_updated_at();

ALTER TABLE public.tramite_equipo_tipo_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tetp_select"
  ON public.tramite_equipo_tipo_permisos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tetp_admin"
  ON public.tramite_equipo_tipo_permisos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND activo = true
    )
  );

-- ─── 4. Actualizar puede_acceder_tipo_tramite() ───────────────────────────────
--
-- Nueva lógica de 5 capas:
--   1. Admin / Gerente  → siempre puede
--   2. Override usuario → tramite_tipo_usuario_override (si no es NULL)
--   3. Override equipo  → tramite_equipo_tipo_permisos del equipo del usuario (si no es NULL)
--   4. Config por rol   → tramite_tipo_rol_permisos
--   5. Default          → true (backward compatible)

CREATE OR REPLACE FUNCTION public.puede_acceder_tipo_tramite(
  p_tipo_id  uuid,
  p_user_id  uuid,
  p_accion   text   -- 'ver', 'crear' o 'editar'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_rol         text;
  v_override    boolean;
  v_equipo_val  boolean;
  v_rol_config  boolean;
BEGIN
  -- Obtener rol global
  SELECT rol INTO v_rol FROM public.usuarios WHERE id = p_user_id LIMIT 1;

  -- 1. Admin y Gerente siempre pueden
  IF v_rol IN ('Administrador', 'Gerente') THEN
    RETURN true;
  END IF;

  -- 2. Override por usuario
  IF p_accion = 'ver' THEN
    SELECT puede_ver   INTO v_override FROM public.tramite_tipo_usuario_override
    WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
  ELSIF p_accion = 'crear' THEN
    SELECT puede_crear INTO v_override FROM public.tramite_tipo_usuario_override
    WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
  ELSE
    SELECT puede_editar INTO v_override FROM public.tramite_tipo_usuario_override
    WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
  END IF;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  -- 3. Override por equipo (toma el equipo con mayor permiso entre los del usuario)
  IF p_accion = 'ver' THEN
    SELECT bool_or(tp.puede_ver) INTO v_equipo_val
    FROM   public.tramites_grupos_miembros gm
    JOIN   public.tramite_equipo_tipo_permisos tp
           ON tp.equipo_id = gm.grupo_id AND tp.tramite_tipo_id = p_tipo_id
    WHERE  gm.usuario_id = p_user_id
      AND  tp.puede_ver IS NOT NULL;
  ELSIF p_accion = 'crear' THEN
    SELECT bool_or(tp.puede_crear) INTO v_equipo_val
    FROM   public.tramites_grupos_miembros gm
    JOIN   public.tramite_equipo_tipo_permisos tp
           ON tp.equipo_id = gm.grupo_id AND tp.tramite_tipo_id = p_tipo_id
    WHERE  gm.usuario_id = p_user_id
      AND  tp.puede_crear IS NOT NULL;
  ELSE
    SELECT bool_or(tp.puede_editar) INTO v_equipo_val
    FROM   public.tramites_grupos_miembros gm
    JOIN   public.tramite_equipo_tipo_permisos tp
           ON tp.equipo_id = gm.grupo_id AND tp.tramite_tipo_id = p_tipo_id
    WHERE  gm.usuario_id = p_user_id
      AND  tp.puede_editar IS NOT NULL;
  END IF;
  IF v_equipo_val IS NOT NULL THEN RETURN v_equipo_val; END IF;

  -- 4. Config por rol
  IF p_accion = 'ver' THEN
    SELECT puede_ver    INTO v_rol_config FROM public.tramite_tipo_rol_permisos
    WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  ELSIF p_accion = 'crear' THEN
    SELECT puede_crear  INTO v_rol_config FROM public.tramite_tipo_rol_permisos
    WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  ELSE
    SELECT puede_editar INTO v_rol_config FROM public.tramite_tipo_rol_permisos
    WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  END IF;

  -- 5. Default true
  RETURN COALESCE(v_rol_config, true);
END;
$$;

COMMENT ON FUNCTION public.puede_acceder_tipo_tramite IS
  'Verifica si un usuario puede ver/crear/editar un tipo de trámite. Capas: admin → override_usuario → override_equipo → config_rol → default_true.';

-- ─── 5. Deprecar tramites_usuarios_empleados ─────────────────────────────────
-- La tabla fue creada en bloque_a2 pero no tiene referencias en el código fuente.
-- Se marca como deprecated. No se elimina para no romper posibles referencias externas.

COMMENT ON TABLE public.tramites_usuarios_empleados IS
  'DEPRECATED (2026-06-30): Sin referencias en el código fuente. La membresía activa usa tramites_grupos_miembros. Esta tabla puede eliminarse en una migración futura una vez confirmado.';

COMMENT ON TABLE public.tramites_usuarios IS
  'DEPRECATED (2026-06-30): Perfil auxiliar creado en bloque_a2. Sin referencias activas en el código fuente.';

COMMENT ON TABLE public.tramites_usuarios_agentes IS
  'DEPRECATED (2026-06-30): Sin referencias activas en el código fuente. Los agentes se gestionan vía tramites_grupos_reglas.';
