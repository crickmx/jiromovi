
/*
  # FASES 8-9-10: Eliminar Duplicados y Garantizar Bienvenida Única

  ## Resumen
  Corrige los problemas de duplicación de notificaciones de bienvenida y
  limpia los tipos obsoletos del catálogo.

  ## Cambios
  1. Elimina el trigger duplicado `trigger_send_welcome_on_user_activation`
     (ambos apuntaban a la misma función — duplicación)

  2. Reescribe `trigger_send_welcome_on_activation()` para:
     - Usar SOLO la condición `estado` cambia a 'activo' (no la condición `activo` boolean)
     - Agregar guard anti-duplicados: verifica que no se haya enviado en los últimos 60 segundos
     - Enviar solo UNA notificación por evento de activación

  3. Marca como obsoleto el tipo 'bienvenida' en el catálogo
     (el correcto es 'cuenta_activada')

  4. Desactiva el tipo 'bienvenida' para evitar envíos accidentales

  ## Seguridad
  - SECURITY DEFINER se mantiene en las funciones
  - Sin cambios en RLS
*/

-- PASO 1: Eliminar el trigger duplicado
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios;

-- PASO 2: Reescribir la función con lógica anti-duplicados y condición única
CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_nombre text;
  v_pagina_web text;
  v_recent_notification boolean;
BEGIN
  -- Solo actuar cuando el estado cambia a 'activo' desde un estado diferente
  -- (NO usar la condición del campo 'activo' boolean para evitar doble disparo)
  IF NOT (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo')) THEN
    RETURN NEW;
  END IF;

  -- Guard anti-duplicados: verificar si ya se envió una notificación 'cuenta_activada'
  -- en los últimos 60 segundos para este usuario
  SELECT EXISTS(
    SELECT 1 FROM correo_historial_envios
    WHERE destinatario_id = NEW.id
      AND tipo_codigo = 'cuenta_activada'
      AND created_at > NOW() - INTERVAL '60 seconds'
    LIMIT 1
  ) INTO v_recent_notification;

  -- Si ya se envió recientemente, no duplicar
  IF v_recent_notification THEN
    RAISE NOTICE '[ACTIVATION TRIGGER] Notificación reciente detectada para %, omitiendo duplicado', NEW.id;
    RETURN NEW;
  END IF;

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

  -- Enviar notificación de cuenta activada
  BEGIN
    PERFORM notify(
      'cuenta_activada',
      ARRAY[NEW.id],
      jsonb_build_object(
        'nombre', COALESCE(NEW.nombre, ''),
        'apellidos', COALESCE(NEW.apellidos, ''),
        'nombre_completo', COALESCE(NEW.nombre_completo, TRIM(COALESCE(NEW.nombre, '') || ' ' || COALESCE(NEW.apellidos, ''))),
        'email_laboral', NEW.email_laboral,
        'email_personal', COALESCE(NEW.email_personal, ''),
        'celular_laboral', COALESCE(NEW.celular_laboral, ''),
        'celular_personal', COALESCE(NEW.celular_personal, ''),
        'password', 'La contraseña que configuraste',
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'puesto', COALESCE(NEW.puesto, 'Sin asignar'),
        'pagina_web', v_pagina_web,
        'url', '/dashboard'
      ),
      NEW.id::text
    );

    RAISE NOTICE '[ACTIVATION TRIGGER] Notificación cuenta_activada enviada para usuario %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ACTIVATION TRIGGER] Error al enviar notificación: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- PASO 3: Recrear el trigger único con la función corregida
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;

CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

-- PASO 4: Marcar 'bienvenida' como obsoleto y desactivar
UPDATE correo_tipos_notificacion
SET
  es_obsoleto = true,
  activo = false,
  descripcion = COALESCE(descripcion, '') || ' [OBSOLETO: usar cuenta_activada]'
WHERE codigo = 'bienvenida';

-- PASO 5: Verificar que 'cuenta_activada' está activo
UPDATE correo_tipos_notificacion
SET activo = true
WHERE codigo = 'cuenta_activada';

-- PASO 6: Agregar columna destinatario_id a correo_historial_envios si no existe
-- (para el guard anti-duplicados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'destinatario_id'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN destinatario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'tipo_codigo'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN tipo_codigo text;
  END IF;
END $$;

-- Índice para la consulta anti-duplicados
CREATE INDEX IF NOT EXISTS idx_correo_historial_destinatario_tipo
  ON correo_historial_envios(destinatario_id, tipo_codigo, created_at)
  WHERE destinatario_id IS NOT NULL;
