-- No todo lo que no está en MOVI es basura.
--
-- `purgar_huerfanos_auth` borraba cualquier cuenta de `auth.users` sin ficha en
-- `public.usuarios`. Pero ese mismo `auth.users` lo comparten otras apps del
-- proyecto que NO guardan a su gente en `usuarios`:
--
--   SeguWallet  → `seguwallet_customers.auth_user_id`  (clientes finales)
--   Chava       → `chava_agente_users`
--
-- La primera revisión real lo destapó: de ocho "huérfanos", tres eran correos
-- de seguwallet. Borrarlos habría dado de baja a clientes.
--
-- Además decenas de tablas de `public` referencian `auth.users` directamente, y
-- varias con ON DELETE CASCADE: un borrado a ciegas se habría llevado pedidos,
-- eventos de aula y conversaciones del asistente.

-- ── ¿De qué cuelga una cuenta? ──────────────────────────────────────────────
-- Recorre las llaves foráneas reales en vez de una lista escrita a mano, que
-- se queda vieja al día siguiente. Solo mira `public`: dentro de `auth` toda
-- cuenta tiene sesiones e identidades y eso no dice nada.
CREATE OR REPLACE FUNCTION public.referencias_de_cuenta(p_user_id uuid)
RETURNS TABLE (tabla text, columna text, filas bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n bigint;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tabla, a.attname::text AS columna
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND ns.nspname = 'public'
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tabla, r.columna)
      INTO n USING p_user_id;
    IF n > 0 THEN
      tabla := r.tabla; columna := r.columna; filas := n;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Sin llave foránea, pero igual de dueñas de la cuenta.
  FOR r IN
    SELECT * FROM (VALUES
      ('seguwallet_customers', 'auth_user_id'),
      ('chava_agente_users',   'auth_user_id')
    ) v(tabla, columna)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tabla AND column_name = r.columna
    ) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tabla, r.columna)
        INTO n USING p_user_id;
      IF n > 0 THEN
        tabla := 'public.' || r.tabla; columna := r.columna; filas := n;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.referencias_de_cuenta IS
  'De qué cuelga una cuenta de auth.users dentro de public. Si devuelve algo, esa cuenta NO se puede borrar sin llevarse datos por delante.';

-- ── La vista deja de llamar "huérfano" a un cliente de otra app ─────────────
-- Se recrea entera: `CREATE OR REPLACE VIEW` solo deja AGREGAR columnas al
-- final, y aquí `referencias` entra en medio.
DROP VIEW IF EXISTS public.vista_correos_bloqueados;
CREATE VIEW public.vista_correos_bloqueados AS
SELECT
  au.id,
  au.email AS correo_retenido,
  u.nombre,
  u.apellidos,
  u.rol,
  CASE
    WHEN u.id IS NULL           THEN 'sin_ficha_movi'
    WHEN u.is_deleted           THEN 'eliminado'
    WHEN u.estado = 'eliminado' THEN 'eliminado'
    ELSE 'visible'
  END AS motivo,
  -- De qué cuelga la cuenta. Si trae algo, NO se toca.
  (SELECT count(*) FROM public.referencias_de_cuenta(au.id)) AS referencias,
  au.created_at,
  au.last_sign_in_at
FROM auth.users au
LEFT JOIN public.usuarios u ON u.id = au.id
WHERE au.email NOT LIKE 'deleted-%@deleted.local'
  AND (u.id IS NULL OR u.is_deleted = true OR u.estado = 'eliminado');

COMMENT ON VIEW public.vista_correos_bloqueados IS
  'Correos que ocupa alguien invisible en MOVI. `motivo = sin_ficha_movi` NO significa que sobre: puede ser un cliente de SeguWallet o de Chava. Mirar la columna `referencias` antes de tocar nada.';

-- ── La purga se niega a borrar cualquier cosa de la que cuelgue algo ────────
-- Igual que la vista: ahora devuelve una columna más (`resultado`), y Postgres
-- no deja cambiar el tipo de retorno de una función que ya existe.
DROP FUNCTION IF EXISTS public.purgar_huerfanos_auth(integer);
CREATE FUNCTION public.purgar_huerfanos_auth(p_minutos_minimos integer DEFAULT 60)
RETURNS TABLE (id uuid, correo text, creada timestamptz, resultado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  v_refs bigint;
BEGIN
  FOR c IN
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.usuarios u ON u.id = au.id
    WHERE u.id IS NULL
      AND au.created_at < now() - make_interval(mins => greatest(p_minutos_minimos, 1))
  LOOP
    SELECT count(*) INTO v_refs FROM public.referencias_de_cuenta(c.id);

    id := c.id; correo := c.email; creada := c.created_at;

    IF v_refs > 0 THEN
      -- Es de alguien: un cliente de SeguWallet, un usuario de Chava, o tiene
      -- pedidos/eventos colgando que se irían en cascada.
      resultado := 'conservada (' || v_refs || ' referencia(s))';
    ELSE
      DELETE FROM auth.users WHERE auth.users.id = c.id;
      resultado := 'borrada';
    END IF;

    RETURN NEXT;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.purgar_huerfanos_auth IS
  'Borra SOLO las cuentas de auth.users sin ficha en MOVI y sin nada colgando. Devuelve qué hizo con cada una. Las de otras apps (SeguWallet, Chava) se conservan.';

REVOKE ALL ON FUNCTION public.purgar_huerfanos_auth(integer) FROM PUBLIC;
