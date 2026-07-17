/*
  # Cifrado de credenciales de correo (IONOS)

  Contexto: `email_configuraciones.password` guardaba la contraseña de la
  cuenta de correo de IONOS en texto plano, escrita directamente desde el
  navegador (GestorEmails.tsx) y legible en claro por cualquier Administrador
  vía el cliente de Supabase (política "Admins can view all email configs").

  Esta migración:
  1. Crea `email_credenciales`, una tabla separada sin ninguna política RLS
     para `authenticated`/`anon` (RLS habilitado + cero políticas = acceso
     denegado por default) — solo el service_role de los edge functions
     puede leerla/escribirla, porque ese rol no está sujeto a RLS.
  2. Crea dos funciones `SECURITY DEFINER` (`email_cred_set`/`email_cred_get`)
     que cifran/descifran con pgcrypto (`pgp_sym_encrypt`/`pgp_sym_decrypt`),
     usando una clave maestra que solo vive en los secretos del edge function
     (`EMAIL_CREDENTIALS_MASTER_KEY`) — nunca se guarda en la base de datos.
     Ambas funciones quedan reservadas a `service_role`.
  3. Vuelve nullable `email_configuraciones.password` para que las cuentas
     nuevas ya no la usen. La columna NO se borra todavía: hay 6 cuentas
     existentes con contraseña en texto plano que hay que migrar primero
     (ver instrucciones al final de este archivo) antes de poder borrarla.

  Después de correr esto en Supabase, hace falta:
  - Configurar el secreto `EMAIL_CREDENTIALS_MASTER_KEY` en el proyecto
    (Edge Functions → Secrets), con un valor aleatorio largo generado aparte
    (por ejemplo `openssl rand -base64 32`). Nunca escribir ese valor en el
    repo.
  - Desplegar los edge functions actualizados (ionos-webmail,
    email-sync-inbox, email-send-message, create-tramite-from-email).
  - Migrar las 6 filas existentes y, ya confirmado que todo sigue
    funcionando, borrar la columna `password` (instrucciones abajo).
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_credenciales (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  password_cifrada bytea NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_credenciales ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: ni authenticated ni anon pueden tocar esta tabla
-- bajo ninguna circunstancia. Solo service_role (edge functions) accede.

CREATE OR REPLACE FUNCTION email_cred_set(p_usuario_id uuid, p_password text, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_credenciales (usuario_id, password_cifrada, updated_at)
  VALUES (p_usuario_id, pgp_sym_encrypt(p_password, p_key), now())
  ON CONFLICT (usuario_id) DO UPDATE
    SET password_cifrada = excluded.password_cifrada, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION email_cred_get(p_usuario_id uuid, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT pgp_sym_decrypt(password_cifrada, p_key) INTO v_result
  FROM email_credenciales WHERE usuario_id = p_usuario_id;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION email_cred_set(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION email_cred_get(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION email_cred_get(uuid, text) TO service_role;

ALTER TABLE email_configuraciones ALTER COLUMN password DROP NOT NULL;

-- Cierra de inmediato el hueco de "Admin ve la contraseña en claro desde el
-- navegador": aunque la columna password siga viva durante la transición,
-- ningún rol de cliente (authenticated/anon) puede ya leerla ni escribirla.
-- El service_role de los edge functions no se ve afectado (no es 'authenticated').
REVOKE SELECT (password), INSERT (password), UPDATE (password) ON email_configuraciones FROM authenticated;

/*
  ── Paso manual pendiente (correr en el SQL Editor de Supabase, YA con
  EMAIL_CREDENTIALS_MASTER_KEY configurada) ──

  1. Migrar las 6 filas existentes (reemplazar 'CLAVE_MAESTRA_AQUI' por el
     mismo valor que se puso en el secreto del edge function):

     select email_cred_set(usuario_id, password, 'CLAVE_MAESTRA_AQUI')
     from email_configuraciones
     where password is not null and password != '';

  2. Verificar que descifra igual que el original:

     select usuario_id, email_cred_get(usuario_id, 'CLAVE_MAESTRA_AQUI') as password_descifrada
     from email_credenciales;

  3. Solo cuando 1 y 2 se vean bien Y ya se haya probado el módulo de correo
     en la app con normalidad, borrar la columna vieja:

     alter table email_configuraciones drop column password;
*/
