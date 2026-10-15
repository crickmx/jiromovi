/*
  # Oculta el reporte de bug a quien lo reportó

  ## Contexto
  tickets_select_v7 deja ver un trámite a quien lo creó vía `creado_por = auth.uid()`.
  Para "Reporte de bug" no queremos eso: el reporte es interno, solo se le agradece
  al usuario, no debe verlo en su lista de trámites.

  ## Por qué una función SECURITY DEFINER y no un NOT EXISTS directo
  Si el NOT EXISTS consultara bug_reportes directamente dentro de la política de
  tickets, quedaría sujeto al RLS de bug_reportes (que ya restringe a Admin/Gerente/
  equipo asignado) evaluado como el usuario que reporta el bug -- para él, esa
  subconsulta siempre devolvería "sin filas" y el NOT EXISTS sería SIEMPRE true,
  sin importar si el reporte existe. Se usa una función SECURITY DEFINER (mismo
  patrón que get_my_grupo_ids()/get_my_grupos_lider_ids()) para evitar ese problema.

  ## Cambio
  Reemplaza tickets_select_v7 por tickets_select_v8, agregando la condición
  "y no es un reporte de bug" únicamente a la cláusula de creado_por. El resto de
  la política queda idéntico a tickets_select_v7 (confirmado en producción).
*/

CREATE OR REPLACE FUNCTION public.es_reporte_de_bug(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM bug_reportes WHERE ticket_id = p_ticket_id);
$function$;

DROP POLICY IF EXISTS "tickets_select_v7" ON tickets;

CREATE POLICY "tickets_select_v8" ON tickets FOR SELECT TO authenticated USING (
  (get_my_rol() = ANY (ARRAY['Administrador'::text, 'Gerente'::text]))
  OR (agente_id = auth.uid())
  OR (
    (creado_por = auth.uid())
    AND NOT public.es_reporte_de_bug(id)
  )
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
