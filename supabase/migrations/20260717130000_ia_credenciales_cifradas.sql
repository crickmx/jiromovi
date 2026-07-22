/*
  # Cifrado de credenciales de correo (Automatización IA)

  Contexto: `ia_cuentas_correo.password_encrypted` guardaba la contraseña de
  las cuentas de correo monitoreadas por el módulo de Automatización IA en
  texto plano, escrita directamente desde el navegador (AutomatizacionIA.tsx,
  CuentaForm.handleSave) y legible en claro por cualquier Administrador vía
  el cliente de Supabase (política "Admins can manage ia_cuentas_correo",
  que da SELECT/INSERT/UPDATE completo sobre la tabla, incluida esa columna).
  Es el mismo bug ya corregido en `email_configuraciones` (ver migración
  20260717120000_email_credenciales_cifradas.sql), aplicado aquí al módulo
  de Automatización IA.

  Esta migración:
  1. Crea `ia_credenciales_correo`, tabla separada sin ninguna política RLS
     para `authenticated`/`anon` (RLS habilitado + cero políticas = acceso
     denegado por default) — solo el service_role de los edge functions
     puede leerla/escribirla. Clave primaria: `cuenta_id`, que referencia
     `ia_cuentas_correo(id)` (a diferencia de `email_credenciales`, que usa
     `usuario_id`, porque una cuenta de correo IA no pertenece 1:1 a un
     usuario sino que es una cuenta compartida administrada por Admins).
  2. Crea dos funciones `SECURITY DEFINER` (`ia_cred_set`/`ia_cred_get`) que
     cifran/descifran con pgcrypto (`pgp_sym_encrypt`/`pgp_sym_decrypt`),
     reutilizando la MISMA clave maestra que `email_credenciales`
     (secreto `EMAIL_CREDENTIALS_MASTER_KEY` en los edge functions) — no se
     introduce un segundo secreto para el mismo propósito. Ambas funciones
     quedan reservadas a `service_role`.
  3. Vuelve nullable `ia_cuentas_correo.password_encrypted` para que las
     cuentas nuevas ya no la usen. La columna NO se borra todavía: hay que
     migrar primero las filas existentes (ver instrucciones al final de
     este archivo) antes de poder borrarla.
  4. Cierra de inmediato el hueco de lectura en claro desde el navegador:
     revoca SELECT/INSERT/UPDATE sobre esa columna para `authenticated`,
     igual que se hizo con `email_configuraciones.password`.

  Después de correr esto en Supabase, hace falta:
  - Confirmar que el secreto `EMAIL_CREDENTIALS_MASTER_KEY` ya existe en el
    proyecto (Edge Functions → Secrets). Si Fase 0 de email ya se desplegó,
    ya debería estar configurado; si no, generarlo con
    `openssl rand -base64 32` y nunca escribirlo en el repo.
  - Desplegar los edge functions actualizados (ia-monitor-email,
    ia-cuentas-correo-save, y el _shared/emailCredentials.ts actualizado).
  - Migrar las filas existentes de `ia_cuentas_correo` y, ya confirmado que
    el monitoreo de correo sigue funcionando, borrar la columna
    `password_encrypted` (instrucciones abajo).
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ia_credenciales_correo (
  cuenta_id uuid PRIMARY KEY REFERENCES ia_cuentas_correo(id) ON DELETE CASCADE,
  password_cifrada bytea NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ia_credenciales_correo ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: ni authenticated ni anon pueden tocar esta tabla
-- bajo ninguna circunstancia. Solo service_role (edge functions) accede.

CREATE OR REPLACE FUNCTION ia_cred_set(p_cuenta_id uuid, p_password text, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ia_credenciales_correo (cuenta_id, password_cifrada, updated_at)
  VALUES (p_cuenta_id, extensions.pgp_sym_encrypt(p_password, p_key), now())
  ON CONFLICT (cuenta_id) DO UPDATE
    SET password_cifrada = excluded.password_cifrada, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION ia_cred_get(p_cuenta_id uuid, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(password_cifrada, p_key) INTO v_result
  FROM ia_credenciales_correo WHERE cuenta_id = p_cuenta_id;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION ia_cred_set(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ia_cred_get(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ia_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION ia_cred_get(uuid, text) TO service_role;

ALTER TABLE ia_cuentas_correo ALTER COLUMN password_encrypted DROP NOT NULL;

-- Cierra de inmediato el hueco de "Admin ve la contraseña en claro desde el
-- navegador": aunque la columna password_encrypted siga viva durante la
-- transición, ningún rol de cliente (authenticated/anon) puede ya leerla ni
-- escribirla. El service_role de los edge functions no se ve afectado.
REVOKE SELECT (password_encrypted), INSERT (password_encrypted), UPDATE (password_encrypted)
  ON ia_cuentas_correo FROM authenticated;

/*
  ── Paso manual pendiente (correr en el SQL Editor de Supabase, YA con
  EMAIL_CREDENTIALS_MASTER_KEY configurada) ──

  1. Migrar las filas existentes (reemplazar 'CLAVE_MAESTRA_AQUI' por el
     mismo valor que se usó para migrar email_credenciales):

     select ia_cred_set(id, password_encrypted, 'CLAVE_MAESTRA_AQUI')
     from ia_cuentas_correo
     where password_encrypted is not null and password_encrypted != '';

  2. Verificar que descifra igual que el original:

     select cuenta_id, ia_cred_get(cuenta_id, 'CLAVE_MAESTRA_AQUI') as password_descifrada
     from ia_credenciales_correo;

  3. Solo cuando 1 y 2 se vean bien Y ya se haya probado el monitoreo de
     correo del módulo de Automatización IA con normalidad, borrar la
     columna vieja:

     alter table ia_cuentas_correo drop column password_encrypted;
*/
