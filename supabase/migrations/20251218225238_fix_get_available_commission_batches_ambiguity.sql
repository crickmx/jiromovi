/*
  # Corregir ambigüedad en get_available_commission_batches_for_user
  
  ## Problema
  La función tiene un error de ambigüedad en la columna `id` que causa que no funcione.
  
  ## Solución
  - Usar usuarios.id en lugar de id en las subconsultas WHERE
  
  ## Cambios
  - Recrear la función con la referencia correcta a la columna
*/

CREATE OR REPLACE FUNCTION get_available_commission_batches_for_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  date_from date,
  date_to date,
  status text,
  documents_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cb.id,
    cb.name,
    cb.date_from,
    cb.date_to,
    cb.status,
    COUNT(cd.id) as documents_count
  FROM commission_batches cb
  LEFT JOIN commission_details cd ON cd.batch_id = cb.id
  WHERE cb.status != 'cancelled'
  AND (
    -- Si es agente, solo sus lotes
    (SELECT rol FROM usuarios WHERE usuarios.id = p_user_id) = 'Agente'
    AND EXISTS (
      SELECT 1 FROM commission_details cd2
      JOIN commission_agents ca ON ca.id = cd2.agent_id
      WHERE cd2.batch_id = cb.id
      AND ca.usuario_id = p_user_id
    )
    OR
    -- Si es staff, todos los lotes
    (SELECT rol FROM usuarios WHERE usuarios.id = p_user_id) IN ('Empleado', 'Gerente', 'Administrador')
  )
  GROUP BY cb.id, cb.name, cb.date_from, cb.date_to, cb.status
  ORDER BY cb.date_from DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;