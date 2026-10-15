/*
  # Permiso "Editar" para tipos de trámite

  Añade puede_editar a las tablas de permisos de tramites y actualiza la RPC
  para soportar la acción 'editar'.

  Lógica de resolución (igual que ver/crear):
  1. Override individual → 2. Config por rol → 3. Default: true (backwards compatible)
*/

-- ── Añadir puede_editar a config por rol ──────────────────────────────────────
ALTER TABLE public.tramite_tipo_rol_permisos
  ADD COLUMN IF NOT EXISTS puede_editar boolean NOT NULL DEFAULT true;

-- ── Añadir puede_editar a overrides por usuario ───────────────────────────────
ALTER TABLE public.tramite_tipo_usuario_override
  ADD COLUMN IF NOT EXISTS puede_editar boolean;   -- NULL = heredar del rol

-- ── Actualizar RPC para soportar acción 'editar' ─────────────────────────────
CREATE OR REPLACE FUNCTION public.puede_acceder_tipo_tramite(
  p_tipo_id  uuid,
  p_user_id  uuid,
  p_accion   text  -- 'ver' | 'crear' | 'editar'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_rol        text;
  v_override   boolean;
  v_rol_config boolean;
BEGIN
  SELECT rol INTO v_rol FROM usuarios WHERE id = p_user_id LIMIT 1;

  IF v_rol IN ('Administrador', 'Gerente') THEN
    RETURN true;
  END IF;

  IF p_accion = 'ver' THEN
    SELECT puede_ver INTO v_override FROM tramite_tipo_usuario_override
     WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
    SELECT puede_ver INTO v_rol_config FROM tramite_tipo_rol_permisos
     WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;

  ELSIF p_accion = 'crear' THEN
    SELECT puede_crear INTO v_override FROM tramite_tipo_usuario_override
     WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
    SELECT puede_crear INTO v_rol_config FROM tramite_tipo_rol_permisos
     WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;

  ELSE  -- 'editar'
    SELECT puede_editar INTO v_override FROM tramite_tipo_usuario_override
     WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
    SELECT puede_editar INTO v_rol_config FROM tramite_tipo_rol_permisos
     WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  END IF;

  RETURN COALESCE(v_rol_config, true);
END;
$$;

-- Índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_tramite_rol_permisos_editar
  ON public.tramite_tipo_rol_permisos(tramite_tipo_id, rol, puede_editar);
