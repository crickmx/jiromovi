/*
  # Fix Welcome Trigger to Detect 'activo' Field Changes
  
  1. Changes
    - Update trigger function to detect changes in both 'estado' and 'activo' fields
    - When 'activo' changes from false to true, send welcome notification
    - When 'estado' changes to 'activo', send welcome notification
    - Avoid duplicate notifications
  
  2. Security
    - Function remains SECURITY DEFINER
    - No changes to RLS policies
*/

-- Drop and recreate the trigger function with both field detections
CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oficina_nombre text;
  v_pagina_web text;
  v_should_send_welcome boolean := false;
BEGIN
  -- Debug logging
  RAISE NOTICE '[ACTIVATION TRIGGER] Ejecutado para usuario %', NEW.id;
  RAISE NOTICE '[ACTIVATION TRIGGER] Estado OLD: %, Estado NEW: %', OLD.estado, NEW.estado;
  RAISE NOTICE '[ACTIVATION TRIGGER] Activo OLD: %, Activo NEW: %', OLD.activo, NEW.activo;
  
  -- Detectar si se debe enviar mensaje de bienvenida
  -- Caso 1: Campo 'estado' cambió a 'activo'
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    v_should_send_welcome := true;
    RAISE NOTICE '[ACTIVATION TRIGGER] Condición cumplida: estado cambió a activo';
  END IF;
  
  -- Caso 2: Campo 'activo' cambió de false a true
  IF NEW.activo = true AND (OLD.activo IS NULL OR OLD.activo = false) THEN
    v_should_send_welcome := true;
    RAISE NOTICE '[ACTIVATION TRIGGER] Condición cumplida: activo cambió a true';
  END IF;
  
  -- Si se debe enviar bienvenida, proceder
  IF v_should_send_welcome THEN
    RAISE NOTICE '[ACTIVATION TRIGGER] Enviando notificación de bienvenida...';
    
    -- Obtener nombre de oficina
    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;
    
    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;
    
    -- Construir URL de página web
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;
    
    -- Enviar notificación de cuenta activada usando notify()
    BEGIN
      PERFORM notify(
        'cuenta_activada',
        ARRAY[NEW.id],
        jsonb_build_object(
          'nombre', COALESCE(NEW.nombre, ''),
          'apellidos', COALESCE(NEW.apellidos, ''),
          'nombre_completo', COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos),
          'email_laboral', NEW.email_laboral,
          'email_personal', COALESCE(NEW.email_personal, ''),
          'celular_laboral', COALESCE(NEW.celular_laboral, ''),
          'celular_personal', COALESCE(NEW.celular_personal, ''),
          'password', 'Tu contraseña configurada',
          'rol', NEW.rol,
          'oficina', v_oficina_nombre,
          'puesto', COALESCE(NEW.puesto, ''),
          'pagina_web', v_pagina_web
        ),
        'activation_trigger'
      );
      
      RAISE NOTICE '[ACTIVATION TRIGGER] Notificación enviada exitosamente para usuario %: %', NEW.id, NEW.email_laboral;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[ACTIVATION TRIGGER] Error al enviar notificación: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[ACTIVATION TRIGGER] Condición NO cumplida. No se envía notificación.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (drop and recreate to be safe)
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios;

CREATE TRIGGER trigger_send_welcome_on_user_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

-- Add comment
COMMENT ON FUNCTION trigger_send_welcome_on_activation IS 
  'Sends welcome notification when user is activated via estado=activo or activo=true';
