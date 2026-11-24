/*
  # Restaura visibilidad de "líder ve todos los trámites de su equipo"

  ## Contexto
  La política `tickets_select_v6` fue creada directamente en el SQL Editor de
  Supabase (nunca quedó en una migración de este repo). Al reemplazar la
  versión anterior, se perdió la cláusula que dejaba a un líder de equipo ver
  TODOS los trámites de su grupo (asignados o no) — v6 solo dejaba ver el pool
  SIN ASIGNAR de los grupos del usuario (mismo criterio para cualquier
  miembro, no específico de líder).

  ## Cambio
  - Nueva función `get_my_grupos_lider_ids()`: grupos activos donde el usuario
    actual tiene `rol_en_equipo = 'lider'` en `tramites_grupos_miembros`.
  - Reemplaza `tickets_select_v6` por `tickets_select_v7`, agregando la
    cláusula de líder sin tocar nada de lo demás que v6 ya cubre.
*/

CREATE OR REPLACE FUNCTION public.get_my_grupos_lider_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(tgm.grupo_id), ARRAY[]::uuid[])
  FROM tramites_grupos_miembros tgm
  JOIN tramites_grupos_visualizacion g ON g.id = tgm.grupo_id
  WHERE tgm.usuario_id = auth.uid()
    AND tgm.rol_en_equipo = 'lider'
    AND g.activo = true;
$function$;

DROP POLICY IF EXISTS "tickets_select_v6" ON tickets;

CREATE POLICY "tickets_select_v7" ON tickets FOR SELECT TO authenticated USING (
  (get_my_rol() = ANY (ARRAY['Administrador'::text, 'Gerente'::text]))
  OR (agente_id = auth.uid())
  OR (creado_por = auth.uid())
  OR (assigned_to_user_id = auth.uid())
  OR (agente_usuario_id = auth.uid())
  OR (attending_user_id = auth.uid())
  OR (
    (assigned_to_user_id IS NULL)
    AND (attending_user_id IS NULL)
    AND (grupo_asignado_id IS NOT NULL)
    AND (grupo_asignado_id = ANY (get_my_grupo_ids()))
  )
  OR (
    (grupo_asignado_id IS NOT NULL)
    AND (grupo_asignado_id = ANY (get_my_grupos_lider_ids()))
  )
);
