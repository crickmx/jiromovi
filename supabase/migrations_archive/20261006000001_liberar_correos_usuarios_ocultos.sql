-- Soltar los correos que retienen usuarios que ya no se ven en MOVI.
--
-- Síntoma: no se puede dar de alta a alguien que ya existió. La causa NO está
-- en `public.usuarios` sino en `auth.users`: el alta llama a
-- `auth.admin.createUser`, que rechaza un correo ya registrado. Borrar la ficha
-- de MOVI no libera nada por sí solo.
--
-- Dos casos distintos retienen un correo sin que nadie lo vea:
--
--   a) Usuarios con `is_deleted = true` cuyo correo nunca se liberó, porque se
--      marcaron por un camino que no pasó por `safe_delete_user`.
--   b) Cuentas HUÉRFANAS en `auth.users` sin ficha en `public.usuarios`. Son
--      invisibles en todas las pantallas y nada las libera nunca.
--
-- El historial NO se toca: la ficha del usuario se queda, y con ella sus
-- trámites, comentarios, pedidos y comisiones. Lo único que cambia es el correo.

-- ── El correo que se le pone a un usuario dado de baja ──────────────────────
CREATE OR REPLACE FUNCTION public.correo_liberado(p_user_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'deleted-' || left(p_user_id::text, 8) || '@deleted.local';
$$;

-- ── Qué correos están retenidos y por quién ─────────────────────────────────
-- Para mirar ANTES y DESPUÉS: `select * from vista_correos_bloqueados;`
CREATE OR REPLACE VIEW public.vista_correos_bloqueados AS
SELECT
  au.id,
  au.email                                   AS correo_retenido,
  u.nombre,
  u.apellidos,
  u.rol,
  CASE
    WHEN u.id IS NULL           THEN 'huerfano_auth'
    WHEN u.is_deleted           THEN 'eliminado'
    WHEN u.estado = 'eliminado' THEN 'eliminado'
    ELSE 'visible'
  END                                        AS motivo,
  au.created_at,
  au.last_sign_in_at
FROM auth.users au
LEFT JOIN public.usuarios u ON u.id = au.id
WHERE au.email NOT LIKE 'deleted-%@deleted.local'
  AND (u.id IS NULL OR u.is_deleted = true OR u.estado = 'eliminado');

COMMENT ON VIEW public.vista_correos_bloqueados IS
  'Correos que ocupa alguien invisible en MOVI y que por eso impiden dar de alta a esa persona otra vez.';

-- ── 1. Los eliminados sueltan su correo ─────────────────────────────────────
UPDATE public.usuarios u
SET email_laboral = public.correo_liberado(u.id),
    email_personal = NULL
WHERE (u.is_deleted = true OR u.estado = 'eliminado')
  AND (u.email_laboral NOT LIKE 'deleted-%@deleted.local' OR u.email_personal IS NOT NULL);

UPDATE auth.users au
SET email = public.correo_liberado(au.id),
    email_confirmed_at = NULL,
    updated_at = now()
FROM public.usuarios u
WHERE au.id = u.id
  AND (u.is_deleted = true OR u.estado = 'eliminado')
  AND au.email NOT LIKE 'deleted-%@deleted.local';

-- ── 2. Las cuentas huérfanas se borran, pero a mano ─────────────────────────
-- No se borran aquí: un huérfano puede ser un alta que está ocurriendo en este
-- momento (la cuenta se crea unos milisegundos antes que la ficha). Por eso es
-- una función que se llama cuando alguien la mira, con un margen de tiempo.
CREATE OR REPLACE FUNCTION public.purgar_huerfanos_auth(p_minutos_minimos integer DEFAULT 60)
RETURNS TABLE (id uuid, correo text, creada timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH huerfanos AS (
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.usuarios u ON u.id = au.id
    WHERE u.id IS NULL
      AND au.created_at < now() - make_interval(mins => greatest(p_minutos_minimos, 1))
  ), borrados AS (
    DELETE FROM auth.users a
    USING huerfanos h
    WHERE a.id = h.id
    RETURNING a.id
  )
  SELECT h.id, h.email, h.created_at FROM huerfanos h JOIN borrados b ON b.id = h.id;
END $$;

COMMENT ON FUNCTION public.purgar_huerfanos_auth IS
  'Borra las cuentas de auth.users que no tienen ficha en MOVI y devuelve cuáles borró. No tienen historial que perder: sin ficha, nada las referencia.';

REVOKE ALL ON FUNCTION public.purgar_huerfanos_auth(integer) FROM PUBLIC;
