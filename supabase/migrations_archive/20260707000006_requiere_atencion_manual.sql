/*
  # Bandera manual de "Requiere atención" + fix de visibilidad de Reportes de Bug

  ## Parte 1: bandera manual
  Hoy "Requiere atención" es 100% automático (calculado por ultima_accion_por).
  Se agrega una bandera explícita que un admin o el responsable del trámite puede
  prender/apagar arrastrando la tarjeta entre "En Proceso" y "Requiere Atención"
  (implementado en el frontend, Tramites.tsx). Es independiente del cálculo
  automático — ambos se combinan con OR en needsAttentionFn.

  ## Parte 2: por qué agente_id se llena ahora en Reportes de Bug
  ReportarBugModal.tsx dejaba agente_id/agente_usuario_id en NULL para que el
  creador no viera su propio reporte. Pero needsAttentionFn (rama Admin) compara
  ultima_accion_por contra agente_id — con agente_id NULL nunca hay match, y los
  reportes de bug nunca aparecían en "Requiere atención" para el Admin. Al llenar
  agente_id con el creador, hay que cerrar el mismo hueco que ya se cerró para
  creado_por en tickets_select_v8 (20260707000003), porque agente_id = auth.uid()
  es una cláusula OR independiente sin ese filtro.
*/

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS requiere_atencion_manual boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "tickets_select_v8" ON tickets;

CREATE POLICY "tickets_select_v9" ON tickets FOR SELECT TO authenticated USING (
  (get_my_rol() = ANY (ARRAY['Administrador'::text, 'Gerente'::text]))
  OR (
    (agente_id = auth.uid())
    AND NOT public.es_reporte_de_bug(id)
  )
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

/*
  ## Parte 3: get_admin_tramites_attention_count() ahora también cuenta requiere_atencion_manual
  Esta función vivía solo en Supabase (creada fuera de migraciones — mismo patrón de
  drift ya documentado para políticas de tickets). Se recrea aquí con su lógica
  original (confirmada con Ricardo) + la bandera manual nueva, para que quede en
  el repo y no se vuelva a perder.
*/
CREATE OR REPLACE FUNCTION public.get_admin_tramites_attention_count()
RETURNS bigint
LANGUAGE sql
STABLE
AS $function$
  SELECT COUNT(*)::bigint FROM tickets t
  WHERE t.eliminado_at IS NULL
    AND t.cerrado_en IS NULL
    AND (
      t.requiere_atencion_manual
      OR (
        t.ultima_accion_por IS NOT NULL
        AND (t.ultima_accion_por = t.agente_id OR t.ultima_accion_por = t.agente_usuario_id)
      )
    );
$function$;
