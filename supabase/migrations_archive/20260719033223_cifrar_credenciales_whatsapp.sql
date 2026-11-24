/*
  # Cifrado de credenciales de WhatsApp (Wazzup24)

  `whatsapp_configuracion.api_key` quedaba expuesta en texto plano a cualquier
  Administrador mediante el cliente de Supabase. Esta migración replica el
  patrón ya usado por `email_credenciales` e `ia_credenciales_correo`:

  - una credencial por cada fila de configuración (la tabla permite varias);
  - pgcrypto y funciones SECURITY DEFINER reservadas a service_role;
  - la misma clave maestra `EMAIL_CREDENTIALS_MASTER_KEY`;
  - RLS habilitado y cero políticas en la tabla de credenciales;
  - columna legada nullable y revocada para clientes durante la transición.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS whatsapp_credenciales (
  configuracion_id uuid PRIMARY KEY REFERENCES whatsapp_configuracion(id) ON DELETE CASCADE,
  api_key_cifrada bytea NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_credenciales ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: solo service_role accede a esta tabla.

CREATE OR REPLACE FUNCTION whatsapp_cred_set(
  p_configuracion_id uuid,
  p_api_key text,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO whatsapp_credenciales (configuracion_id, api_key_cifrada, updated_at)
  VALUES (p_configuracion_id, extensions.pgp_sym_encrypt(p_api_key, p_key), now())
  ON CONFLICT (configuracion_id) DO UPDATE
    SET api_key_cifrada = excluded.api_key_cifrada, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION whatsapp_cred_get(p_configuracion_id uuid, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(api_key_cifrada, p_key) INTO v_result
  FROM whatsapp_credenciales
  WHERE configuracion_id = p_configuracion_id;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION whatsapp_cred_set(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION whatsapp_cred_get(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION whatsapp_cred_set(uuid, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION whatsapp_cred_get(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION whatsapp_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION whatsapp_cred_get(uuid, text) TO service_role;

ALTER TABLE whatsapp_configuracion ALTER COLUMN api_key DROP NOT NULL;

REVOKE SELECT (api_key), INSERT (api_key), UPDATE (api_key)
  ON whatsapp_configuracion FROM authenticated;

-- Un GRANT a nivel tabla prevalece sobre un REVOKE a nivel columna en
-- PostgreSQL. Reemplazamos los privilegios amplios por grants explícitos para
-- que el revoke anterior sea efectivo aunque el proyecto tenga los defaults
-- habituales de Supabase.
REVOKE SELECT, INSERT, UPDATE ON whatsapp_configuracion FROM authenticated;
GRANT SELECT (
  id, numero_remitente, activo, configurado_por, ultima_actualizacion,
  ultima_prueba, estado_ultima_prueba, created_at, updated_at, channel_id_uuid
) ON whatsapp_configuracion TO authenticated;
GRANT INSERT (
  id, numero_remitente, activo, configurado_por, ultima_actualizacion,
  ultima_prueba, estado_ultima_prueba, created_at, updated_at, channel_id_uuid
) ON whatsapp_configuracion TO authenticated;
GRANT UPDATE (
  id, numero_remitente, activo, configurado_por, ultima_actualizacion,
  ultima_prueba, estado_ultima_prueba, created_at, updated_at, channel_id_uuid
) ON whatsapp_configuracion TO authenticated;

/*
  ── Paso manual pendiente (correr en el SQL Editor de Supabase, YA con
  EMAIL_CREDENTIALS_MASTER_KEY configurada) ──

  1. Migrar las filas existentes (reemplazar 'CLAVE_MAESTRA_AQUI' por el
     mismo valor usado para email_credenciales e ia_credenciales_correo):

     select whatsapp_cred_set(id, api_key, 'CLAVE_MAESTRA_AQUI')
     from whatsapp_configuracion
     where api_key is not null and api_key != '';

  2. Verificar que descifra igual que el original:

     select configuracion_id,
            whatsapp_cred_get(configuracion_id, 'CLAVE_MAESTRA_AQUI') as api_key_descifrada
     from whatsapp_credenciales;

  3. Solo cuando 1 y 2 se vean bien Y ya se hayan probado los envíos y el
     webhook de Wazzup24, borrar la columna vieja:

     alter table whatsapp_configuracion drop column api_key;
*/
