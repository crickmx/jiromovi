/*
  # Actualizar enviar_notificacion_completa para usar notify()

  1. Problema
    - La función enviar_notificacion_completa usa sistema antiguo
    - No aprovecha la nueva arquitectura con notification_jobs
    - No usa notify() que maneja idempotency y canales correctamente

  2. Solución
    - Reemplazar implementación para usar notify()
    - Mantener la misma interfaz para no romper edge functions
    - Delegar toda la lógica a notify()
*/

CREATE OR REPLACE FUNCTION enviar_notificacion_completa(
  p_tipo_codigo text,
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_datos_adicionales jsonb DEFAULT '{}'::jsonb,
  p_accion_url text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_notif_ids uuid[] := ARRAY[]::uuid[];
  v_payload jsonb;
BEGIN
  -- Preparar payload con todos los datos necesarios
  v_payload := p_datos_adicionales || jsonb_build_object(
    'titulo', p_titulo,
    'mensaje', p_mensaje,
    'modulo', p_modulo,
    'url', COALESCE(p_accion_url, '/dashboard')
  );

  -- Llamar a notify() que maneja todo: campanita, email, WhatsApp
  SELECT notify(
    p_tipo_codigo,
    ARRAY[p_user_id],
    v_payload,
    NULL -- entity_id
  ) INTO v_result;

  -- Log del resultado
  RAISE LOG '[enviar_notificacion_completa] Resultado de notify(): %', v_result;

  -- Retornar array vacío por compatibilidad (la función antigua retornaba IDs de notificaciones)
  -- En el nuevo sistema no necesitamos retornar los IDs porque notify() maneja todo internamente
  RETURN v_notif_ids;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[enviar_notificacion_completa] Error: %', SQLERRM;
  RETURN v_notif_ids;
END;
$$;

COMMENT ON FUNCTION enviar_notificacion_completa IS
  '[UPDATED] Función de compatibilidad que ahora usa notify() internamente. Mantiene la misma interfaz para no romper edge functions existentes.';
