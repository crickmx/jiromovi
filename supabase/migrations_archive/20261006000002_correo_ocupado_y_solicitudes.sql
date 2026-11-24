-- Qué hacer cuando el correo del alta ya está ocupado.
--
-- Hasta ahora el alta simplemente fallaba con "A user with this email address
-- has already been registered" y ahí se acababa: ni decía quién lo tiene, ni
-- había forma de seguir. Ahora hay dos caminos según quién lo intente:
--
--   Administrador → ve quién lo ocupa, y puede liberarlo y quedárselo.
--   Cualquier otro → deja una solicitud; el usuario NO se crea hasta que un
--                    Administrador la revisa y la autoriza.

-- ── ¿Quién tiene este correo? ───────────────────────────────────────────────
-- SECURITY DEFINER porque tiene que mirar `auth.users`, que nadie puede leer.
-- Devuelve lo mínimo para decidir: quién es y si se ve en MOVI.
CREATE OR REPLACE FUNCTION public.quien_ocupa_correo(p_email text)
RETURNS TABLE (
  user_id uuid,
  nombre text,
  apellidos text,
  rol text,
  visible boolean,
  motivo text,
  eliminado_en timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    au.id,
    u.nombre,
    u.apellidos,
    u.rol,
    coalesce(u.is_deleted = false AND u.estado <> 'eliminado', false) AS visible,
    CASE
      WHEN u.id IS NULL           THEN 'huerfano_auth'
      WHEN u.is_deleted           THEN 'eliminado'
      WHEN u.estado = 'eliminado' THEN 'eliminado'
      ELSE 'activo'
    END,
    u.deleted_at
  FROM auth.users au
  LEFT JOIN public.usuarios u ON u.id = au.id
  WHERE lower(au.email) = lower(trim(p_email))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.quien_ocupa_correo(text) TO authenticated;

-- ── Liberar un correo ocupado ───────────────────────────────────────────────
-- Solo Administrador. Queda constancia en `audit_logs`, siempre: reasignar el
-- correo de alguien es de las cosas que hay que poder reconstruir después.
CREATE OR REPLACE FUNCTION public.liberar_correo_ocupado(p_email text, p_forzar boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin record;
  v_due record;
  v_nuevo text;
BEGIN
  SELECT rol, is_deleted INTO v_admin FROM usuarios WHERE id = auth.uid();
  IF NOT FOUND OR v_admin.rol <> 'Administrador' OR v_admin.is_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo un Administrador puede liberar un correo', 'error_code', 'NO_AUTORIZADO');
  END IF;

  SELECT * INTO v_due FROM quien_ocupa_correo(p_email);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'error_code', 'LIBRE', 'message', 'Ese correo no lo tiene nadie');
  END IF;

  -- Quitarle el correo a alguien que sigue trabajando lo deja sin poder entrar.
  -- No se hace por accidente: hay que pedirlo expresamente.
  IF v_due.visible AND NOT p_forzar THEN
    RETURN jsonb_build_object(
      'success', false, 'error_code', 'EN_USO',
      'error', 'Ese correo lo usa un usuario activo de MOVI',
      'ocupado_por', jsonb_build_object('id', v_due.user_id, 'nombre', concat_ws(' ', v_due.nombre, v_due.apellidos), 'rol', v_due.rol)
    );
  END IF;

  v_nuevo := public.correo_liberado(v_due.user_id);

  UPDATE auth.users
  SET email = v_nuevo, email_confirmed_at = NULL, updated_at = now()
  WHERE id = v_due.user_id;

  UPDATE usuarios
  SET email_laboral = v_nuevo,
      email_personal = CASE WHEN lower(coalesce(email_personal, '')) = lower(trim(p_email)) THEN NULL ELSE email_personal END
  WHERE id = v_due.user_id;

  INSERT INTO audit_logs (action, performed_by, target_user_id, target_resource_type, target_resource_id, details)
  VALUES ('EMAIL_RELEASE', auth.uid(), v_due.user_id, 'usuario', v_due.user_id,
          jsonb_build_object('correo_liberado', trim(p_email), 'correo_nuevo', v_nuevo,
                             'era_visible', v_due.visible, 'motivo', v_due.motivo, 'forzado', p_forzar));

  RETURN jsonb_build_object('success', true, 'liberado_de', v_due.user_id,
                            'nombre', concat_ws(' ', v_due.nombre, v_due.apellidos), 'era_visible', v_due.visible);
END $$;

GRANT EXECUTE ON FUNCTION public.liberar_correo_ocupado(text, boolean) TO authenticated;

-- ── Cola de altas que esperan el visto bueno de un Administrador ────────────
CREATE TABLE IF NOT EXISTS public.usuarios_solicitudes_alta (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Todo lo que se capturó en el formulario, tal cual, para poder crear al
  -- usuario después sin pedirle a nadie que lo vuelva a teclear.
  datos            jsonb       NOT NULL,
  email_solicitado text        NOT NULL,
  motivo           text        NOT NULL DEFAULT 'correo_ocupado',
  ocupado_por      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  solicitado_por   uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado           text        NOT NULL DEFAULT 'pendiente'
                               CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  resuelto_por     uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  resuelto_en      timestamptz,
  nota_resolucion  text,
  usuario_creado   uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usuarios_solicitudes_alta IS
  'Altas de usuario que no se pudieron completar (el correo ya estaba ocupado) y esperan que un Administrador las autorice.';

CREATE INDEX IF NOT EXISTS idx_solicitudes_alta_pendientes
  ON public.usuarios_solicitudes_alta(created_at DESC) WHERE estado = 'pendiente';

ALTER TABLE public.usuarios_solicitudes_alta ENABLE ROW LEVEL SECURITY;

-- Cualquiera que pueda dar de alta puede dejar su solicitud, pero solo a su
-- nombre: `solicitado_por` no se puede falsear.
DROP POLICY IF EXISTS "solicitudes_alta_insert" ON public.usuarios_solicitudes_alta;
CREATE POLICY "solicitudes_alta_insert" ON public.usuarios_solicitudes_alta
  FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid() AND estado = 'pendiente');

-- Cada quien ve las suyas; el Administrador ve todas.
DROP POLICY IF EXISTS "solicitudes_alta_select" ON public.usuarios_solicitudes_alta;
CREATE POLICY "solicitudes_alta_select" ON public.usuarios_solicitudes_alta
  FOR SELECT TO authenticated
  USING (
    solicitado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND NOT is_deleted)
  );

-- Resolverlas es solo del Administrador.
DROP POLICY IF EXISTS "solicitudes_alta_update" ON public.usuarios_solicitudes_alta;
CREATE POLICY "solicitudes_alta_update" ON public.usuarios_solicitudes_alta
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND NOT is_deleted))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND NOT is_deleted));
