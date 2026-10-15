/*
  # Fix: get_admin_tramites_attention_count() nunca bajaba cuando el Admin es su propio agente

  ## Contexto
  Un Reporte de Bug llena agente_id con quien lo reportó. Cuando el propio Admin
  reporta un bug y luego lo marca como leído (o lo mueve en el Kanban), ultima_accion_por
  queda igual a agente_id porque son la misma persona -- el conteo de abajo siempre
  contaba ese trámite como pendiente, sin importar cuántas veces se marcara como leído.

  Mismo fix ya aplicado en el frontend (needsAttentionFn, Tramites.tsx): si el Admin
  que consulta es también el agente del trámite, la comparación automática se ignora
  y solo manda la bandera manual (requiere_atencion_manual).
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
        AND t.agente_id IS DISTINCT FROM auth.uid()
        AND t.agente_usuario_id IS DISTINCT FROM auth.uid()
      )
    );
$function$;
