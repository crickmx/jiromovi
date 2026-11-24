/*
  # Create helper function for SICAS document count

  1. Changes
    - Creates a SECURITY DEFINER function to efficiently count sicas_documents
    - This avoids the expensive RLS evaluation for a simple count
    - Only returns the count, not the data, so it's safe
    - Restricted to authenticated users with appropriate roles

  2. Security
    - Function checks caller's role before returning count
    - Only Administrador, Ejecutivo, Gerente roles can get the total count
    - Agentes get count filtered to their vendor
*/

CREATE OR REPLACE FUNCTION public.get_sicas_documents_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_oficina_id uuid;
  user_id_sicas text;
  result bigint;
BEGIN
  SELECT rol, oficina_id, id_sicas INTO user_role, user_oficina_id, user_id_sicas
  FROM usuarios WHERE id = auth.uid();

  IF user_role IS NULL THEN
    RETURN 0;
  END IF;

  IF user_role IN ('Administrador', 'Ejecutivo') THEN
    SELECT count(*) INTO result FROM sicas_documents;
  ELSIF user_role = 'Gerente' AND user_oficina_id IS NOT NULL THEN
    SELECT count(*) INTO result FROM sicas_documents WHERE oficina_id = user_oficina_id;
  ELSIF user_role = 'Agente' AND user_id_sicas IS NOT NULL THEN
    SELECT count(*) INTO result FROM sicas_documents WHERE vend_id = user_id_sicas;
  ELSIF user_role = 'Empleado' AND user_oficina_id IS NOT NULL THEN
    SELECT count(*) INTO result FROM sicas_documents WHERE oficina_id = user_oficina_id;
  ELSE
    RETURN 0;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sicas_documents_count() TO authenticated;
