-- Fix get_admin_tramites_attention_count() to match needsAttentionFn exactly.
-- The RPC was counting tickets where admin is their own agente (agente_id = auth.uid()),
-- but the kanban skips those. Add the same exclusion.
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
        AND t.agente_id IS DISTINCT FROM auth.uid()
        AND t.agente_usuario_id IS DISTINCT FROM auth.uid()
      )
    );
$function$;
