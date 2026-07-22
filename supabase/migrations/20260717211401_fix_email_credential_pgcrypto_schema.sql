-- Supabase instala pgcrypto en el esquema `extensions`. Las funciones
-- SECURITY DEFINER fijan search_path=public, por lo que deben calificar
-- explícitamente las llamadas criptográficas.

CREATE OR REPLACE FUNCTION public.email_cred_set(
  p_usuario_id uuid,
  p_password text,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_credenciales (usuario_id, password_cifrada, updated_at)
  VALUES (
    p_usuario_id,
    extensions.pgp_sym_encrypt(p_password, p_key),
    now()
  )
  ON CONFLICT (usuario_id) DO UPDATE
    SET password_cifrada = excluded.password_cifrada,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.email_cred_get(
  p_usuario_id uuid,
  p_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(password_cifrada, p_key)
    INTO v_result
  FROM public.email_credenciales
  WHERE usuario_id = p_usuario_id;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ia_cred_set(
  p_cuenta_id uuid,
  p_password text,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ia_credenciales_correo (cuenta_id, password_cifrada, updated_at)
  VALUES (
    p_cuenta_id,
    extensions.pgp_sym_encrypt(p_password, p_key),
    now()
  )
  ON CONFLICT (cuenta_id) DO UPDATE
    SET password_cifrada = excluded.password_cifrada,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.ia_cred_get(
  p_cuenta_id uuid,
  p_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(password_cifrada, p_key)
    INTO v_result
  FROM public.ia_credenciales_correo
  WHERE cuenta_id = p_cuenta_id;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.email_cred_set(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_cred_get(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia_cred_set(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia_cred_get(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.email_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_cred_get(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ia_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ia_cred_get(uuid, text) TO service_role;
