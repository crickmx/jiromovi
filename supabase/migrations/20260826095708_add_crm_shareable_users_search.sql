/*
  Search users that may be invited to a shared CRM board.

  The UI previously queried `usuarios` directly. That depends on the caller's
  directory RLS policies and caused the search to fail for otherwise eligible
  board owners/admins. This function exposes only the data needed for inviting
  eligible active users, after validating the caller's global and board roles.
*/

CREATE OR REPLACE FUNCTION public.crm_search_shareable_users(
  p_board_id uuid,
  p_query text
)
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  oficina_nombre text,
  rol text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_role text;
  v_query text;
BEGIN
  v_query := btrim(COALESCE(p_query, ''));

  IF char_length(v_query) < 2 THEN
    RAISE EXCEPTION 'Ingresa al menos 2 caracteres para buscar usuarios';
  END IF;

  SELECT u.rol
    INTO v_caller_role
  FROM public.usuarios u
  WHERE u.id = auth.uid();

  IF v_caller_role NOT IN ('Empleado', 'Gerente', 'Administrador') THEN
    RAISE EXCEPTION 'No tienes permisos para buscar usuarios que puedan ser invitados';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_boards b
    WHERE b.id = p_board_id
      AND b.deleted_at IS NULL
      AND (
        b.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.crm_board_members bm
          WHERE bm.board_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.member_role IN ('owner', 'admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Solo los propietarios y administradores del tablero pueden buscar invitados';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    btrim(CONCAT_WS(' ', u.nombre, u.apellidos)) AS nombre_completo,
    COALESCE(o.nombre, 'Sin oficina') AS oficina_nombre,
    u.rol,
    u.imagen_perfil_url AS avatar_url
  FROM public.usuarios u
  LEFT JOIN public.oficinas o ON o.id = u.oficina_id
  WHERE u.rol IN ('Empleado', 'Gerente', 'Administrador')
    AND u.activo = true
    AND (u.estado IS NULL OR lower(u.estado) = 'activo')
    AND (
      u.nombre ILIKE '%' || v_query || '%'
      OR u.apellidos ILIKE '%' || v_query || '%'
      OR u.email_laboral ILIKE '%' || v_query || '%'
    )
  ORDER BY u.nombre, u.apellidos
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_search_shareable_users(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
