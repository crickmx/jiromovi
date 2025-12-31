/*
  # Remove Unused Indexes
  
  1. Performance Improvements
    - Removes indexes that are not being used by queries
    - Reduces storage overhead
    - Improves write performance (fewer indexes to maintain)
  
  2. Changes
    - Drops unused indexes identified by database analysis
    - Keeps all essential and frequently-used indexes
  
  3. Notes
    - These indexes can be recreated if usage patterns change
    - Monitor query performance after removal
*/

-- Remove unused SICAS indexes
DROP INDEX IF EXISTS public.idx_sicas_despachos_id_sicas;
DROP INDEX IF EXISTS public.idx_sicas_despachos_is_mapped;
DROP INDEX IF EXISTS public.idx_sicas_vendedores_id_sicas;
DROP INDEX IF EXISTS public.idx_sicas_vendedores_is_mapped;
DROP INDEX IF EXISTS public.idx_sicas_mapeo_vendedor_usuario;
DROP INDEX IF EXISTS public.idx_sicas_catalogos_catalog_type;
DROP INDEX IF EXISTS public.idx_sicas_catalogos_id_sicas;
DROP INDEX IF EXISTS public.idx_sicas_catalogos_nombre;
DROP INDEX IF EXISTS public.idx_sicas_catalogos_is_mapped;
DROP INDEX IF EXISTS public.idx_sicas_catalogos_raw;
DROP INDEX IF EXISTS public.idx_sicas_sync_history_status;

-- Remove unused assistant/correo indexes
DROP INDEX IF EXISTS public.idx_correo_plantillas_canales;
DROP INDEX IF EXISTS public.idx_assistant_action_clicks_action_id;
DROP INDEX IF EXISTS public.idx_assistant_actions_intent_codigo;
DROP INDEX IF EXISTS public.idx_assistant_suggestions_intent_codigo;
DROP INDEX IF EXISTS public.idx_conversaciones_chatgpt_snapshot_id;
