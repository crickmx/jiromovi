-- Función que retorna el historial de tickets de un agente para el panel
-- de Marketing Premium. Usa SECURITY DEFINER para bypasear RLS (el caller
-- no siempre tiene rol Administrador/Gerente), pero verifica que el caller
-- tenga acceso al módulo de Marketing antes de devolver datos.
--
-- Nota: usar tickets.columna en vez de alias t.columna para evitar
-- ambigüedad con los OUT parameters del RETURNS TABLE.

CREATE OR REPLACE FUNCTION public.get_tickets_agente_premium(p_agente_id uuid)
RETURNS TABLE (
  id                   uuid,
  folio                text,
  tipo_tramite         text,
  fecha_creacion       timestamptz,
  custom_estatus_label text,
  creado_por           uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_rol   text;
  v_tiene_acceso boolean := false;
BEGIN
  SELECT rol INTO v_caller_rol
  FROM usuarios
  WHERE id = auth.uid();

  IF v_caller_rol IN ('Administrador', 'Gerente') THEN
    v_tiene_acceso := true;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    ) INTO v_tiene_acceso;
  END IF;

  IF NOT v_tiene_acceso THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    tickets.id,
    tickets.folio,
    tickets.tipo_tramite,
    tickets.fecha_creacion,
    tickets.custom_estatus_label,
    tickets.creado_por
  FROM tickets
  WHERE tickets.agente_id = p_agente_id
     OR tickets.agente_usuario_id = p_agente_id
  ORDER BY tickets.fecha_creacion DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tickets_agente_premium(uuid) TO authenticated;
