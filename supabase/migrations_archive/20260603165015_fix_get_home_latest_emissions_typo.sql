/*
  # Fix typo in get_home_latest_emissions - mowi_user_id → movi_user_id
*/
CREATE OR REPLACE FUNCTION public.get_home_latest_emissions(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  result jsonb;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF user_rol IN ('Administrador', 'Gerente', 'Empleado') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT id, id_docto, poliza, cliente, compania, ramo, prima_neta, fecha_captura, status_texto
      FROM sicas_documents
      WHERE fecha_captura IS NOT NULL
        AND (
          user_rol = 'Administrador'
          OR oficina_id = user_oficina_id
        )
      ORDER BY fecha_captura DESC
      LIMIT p_limit
    ) r;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT sd.id, sd.id_docto, sd.poliza, sd.cliente, sd.compania, sd.ramo, sd.prima_neta, sd.fecha_captura, sd.status_texto
      FROM sicas_documents sd
      JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
      WHERE sd.fecha_captura IS NOT NULL
      ORDER BY sd.fecha_captura DESC
      LIMIT p_limit
    ) r;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_latest_emissions(uuid, int) TO authenticated;
