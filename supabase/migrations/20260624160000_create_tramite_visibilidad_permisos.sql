/*
  # Permisos de visibilidad de tipos de trámite

  ## Reglas
  - tramite_tipo_rol_permisos: configuración general por rol
  - tramite_tipo_usuario_override: override manual por usuario (NULL = heredar del rol)

  Lógica de resolución:
  1. Si existe override para el usuario → usar ese valor
  2. Si no, usar la config del rol
  3. Si no hay ninguna → asumir permitido (backwards compatible)
*/

-- ── Config general por rol ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tramite_tipo_rol_permisos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tramite_tipo_id uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  rol           text NOT NULL,
  puede_crear   boolean NOT NULL DEFAULT true,
  puede_ver     boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES public.usuarios(id),
  UNIQUE (tramite_tipo_id, rol)
);

ALTER TABLE public.tramite_tipo_rol_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_write_rol_permisos"
  ON public.tramite_tipo_rol_permisos FOR ALL
  USING (get_my_rol() = 'Administrador');

CREATE POLICY "auth_read_rol_permisos"
  ON public.tramite_tipo_rol_permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── Override manual por usuario ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tramite_tipo_usuario_override (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tramite_tipo_id uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  puede_crear   boolean,   -- NULL = heredar del rol
  puede_ver     boolean,   -- NULL = heredar del rol
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES public.usuarios(id),
  UNIQUE (tramite_tipo_id, user_id)
);

ALTER TABLE public.tramite_tipo_usuario_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_write_usuario_override"
  ON public.tramite_tipo_usuario_override FOR ALL
  USING (get_my_rol() = 'Administrador');

CREATE POLICY "auth_read_usuario_override"
  ON public.tramite_tipo_usuario_override FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── RPC: verificar si el usuario puede ver/crear un tipo de trámite ─────────

CREATE OR REPLACE FUNCTION public.puede_acceder_tipo_tramite(
  p_tipo_id  uuid,
  p_user_id  uuid,
  p_accion   text  -- 'ver' o 'crear'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_rol        text;
  v_override   boolean;
  v_rol_config boolean;
BEGIN
  -- Obtener rol del usuario
  SELECT rol INTO v_rol FROM usuarios WHERE id = p_user_id LIMIT 1;

  -- Admin y Gerente siempre pueden
  IF v_rol IN ('Administrador', 'Gerente') THEN
    RETURN true;
  END IF;

  -- Revisar override de usuario
  IF p_accion = 'ver' THEN
    SELECT puede_ver INTO v_override
      FROM tramite_tipo_usuario_override
     WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;

    IF v_override IS NOT NULL THEN RETURN v_override; END IF;

    SELECT puede_ver INTO v_rol_config
      FROM tramite_tipo_rol_permisos
     WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  ELSE
    SELECT puede_crear INTO v_override
      FROM tramite_tipo_usuario_override
     WHERE tramite_tipo_id = p_tipo_id AND user_id = p_user_id LIMIT 1;

    IF v_override IS NOT NULL THEN RETURN v_override; END IF;

    SELECT puede_crear INTO v_rol_config
      FROM tramite_tipo_rol_permisos
     WHERE tramite_tipo_id = p_tipo_id AND rol = v_rol LIMIT 1;
  END IF;

  -- Si no hay configuración, asumir permitido
  RETURN COALESCE(v_rol_config, true);
END;
$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_tramite_tipo_rol_permisos_tipo_rol
  ON tramite_tipo_rol_permisos(tramite_tipo_id, rol);

CREATE INDEX IF NOT EXISTS idx_tramite_tipo_usuario_override_tipo_user
  ON tramite_tipo_usuario_override(tramite_tipo_id, user_id);
