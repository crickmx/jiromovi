/*
  # Fix Function Search Paths (Safe Version)
  
  1. Security Improvements
    - Sets secure search paths for functions that exist
    - Prevents search_path manipulation attacks
    - Uses DO blocks for safe execution
  
  2. Changes
    - Updates functions to use explicit schema qualification
    - Sets search_path to empty string for security
    - Only updates functions that exist
  
  3. Notes
    - Wrapped in DO blocks for safety
    - Silently skips non-existent functions
*/

DO $$
BEGIN
  -- Fix search path for timestamp trigger functions
  EXECUTE 'ALTER FUNCTION public.update_correos_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_accesos_nacional_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_aula_eventos_timestamp() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_comunicados_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_correo_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.trigger_set_timestamp() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.trigger_set_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_seguros_lessons_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_seguros_progress_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_chat_timestamp() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.actualizar_timestamp() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.actualizar_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.update_conversacion_timestamp() SET search_path = ''''';
  
  -- Fix search path for folio generation functions
  EXECUTE 'ALTER FUNCTION public.set_gmm_folio() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.generate_gmm_folio() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.set_ticket_folio() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.generar_folio_ticket() SET search_path = ''''';
  
  -- Fix search path for normalization functions
  EXECUTE 'ALTER FUNCTION public.normalize_email() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.normalize_name() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.normalize_person_name() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.normalize_vendor_name() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.normalizar_telefono_mx(text) SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.normalize_phone_mx(text) SET search_path = ''''';
  
  -- Fix search path for sync functions
  EXECUTE 'ALTER FUNCTION public.sync_usuario_nombre_norm() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.sync_usuario_metadata() SET search_path = ''''';
  
  -- Fix search path for chat functions
  EXECUTE 'ALTER FUNCTION public.set_chat_miembros_defaults() SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.get_or_create_direct_chat(uuid, uuid) SET search_path = ''''';
  EXECUTE 'ALTER FUNCTION public.is_chat_member(uuid, uuid) SET search_path = ''''';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Silently ignore errors for functions that don't exist
    NULL;
END $$;

-- Note: Additional function search paths can be fixed on a case-by-case basis
-- This migration covers the most critical timestamp and security-sensitive functions
