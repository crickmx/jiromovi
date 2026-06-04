/*
  # Fix 1: Idempotencia fuerte para notificaciones de activación/bienvenida

  ## Problema
  El guard anti-duplicados actual chequeaba `correo_historial_envios` que solo se 
  llena DESPUÉS de que el job es procesado y enviado. Entre la creación del job y 
  el procesamiento async existe una ventana donde el trigger puede dispararse dos 
  veces para el mismo usuario y ambos superar el guard.

  ## Solución
  1. Cambiar el guard para checar `notification_jobs` directamente (existen desde el 
     momento de creación, no solo después del envío)
  2. Ampliar la ventana de deduplicación de 60 segundos a 24 horas para activación
     (un usuario solo debe recibir bienvenida una vez por día como máximo)
  3. Agregar columna `processing_started_at` a notification_jobs para tracking de 
     concurrencia (usado por Fix 3)
  4. Agregar columna `next_retry_at` para control de reintentos
  5. Asegurar que bienvenida sigue marcada como obsoleta y cuenta_activada activa

  ## Sin cambios a
  - Templates existentes
  - Datos históricos
  - Lógica de canales (email/whatsapp/in-app)
  - Otras notificaciones
*/

-- ============================================================
-- PASO 1: Agregar columnas de control a notification_jobs
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_jobs' AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE notification_jobs ADD COLUMN processing_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_jobs' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE notification_jobs ADD COLUMN next_retry_at timestamptz;
  END IF;
END $$;

-- Índice para el guard anti-duplicados en notification_jobs
CREATE INDEX IF NOT EXISTS idx_notification_jobs_dedup
  ON notification_jobs(user_id, event_code, status, created_at)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- PASO 2: Reescribir función de activación con guard robusto
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_nombre text;
  v_pagina_web text;
  v_already_queued boolean;
BEGIN
  -- Solo actuar cuando estado cambia a 'activo' desde un estado diferente
  IF NOT (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo')) THEN
    RETURN NEW;
  END IF;

  RAISE NOTICE '[ACTIVATION TRIGGER] Ejecutado para usuario % (% -> %)',
    NEW.id, OLD.estado, NEW.estado;

  -- Guard fuerte: checar notification_jobs directamente.
  -- Se checa ANTES del envío (no historial que solo existe post-envío).
  -- Ventana de 24 horas para activación — un usuario no debe recibir 
  -- bienvenida dos veces en el mismo día.
  SELECT EXISTS(
    SELECT 1 FROM notification_jobs
    WHERE user_id = NEW.id
      AND event_code = 'cuenta_activada'
      AND status IN ('pending', 'processing', 'sent')
      AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  ) INTO v_already_queued;

  IF v_already_queued THEN
    RAISE NOTICE '[ACTIVATION TRIGGER] Job reciente detectado para %, omitiendo duplicado', NEW.id;
    RETURN NEW;
  END IF;

  -- Obtener nombre de oficina
  IF NEW.oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = NEW.oficina_id;
  END IF;
  v_oficina_nombre := COALESCE(v_oficina_nombre, 'No asignada');

  -- Construir URL de página web
  IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
    v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
  ELSE
    v_pagina_web := 'No configurada aún';
  END IF;

  -- Enviar notificación
  BEGIN
    PERFORM notify(
      'cuenta_activada',
      ARRAY[NEW.id],
      jsonb_build_object(
        'nombre',          COALESCE(NEW.nombre, ''),
        'apellidos',       COALESCE(NEW.apellidos, ''),
        'nombre_completo', COALESCE(NEW.nombre_completo, TRIM(COALESCE(NEW.nombre, '') || ' ' || COALESCE(NEW.apellidos, ''))),
        'email_laboral',   COALESCE(NEW.email_laboral, ''),
        'email_personal',  COALESCE(NEW.email_personal, ''),
        'celular_laboral', COALESCE(NEW.celular_laboral, ''),
        'celular_personal',COALESCE(NEW.celular_personal, ''),
        'password',        'La contraseña que configuraste',
        'rol',             COALESCE(NEW.rol, ''),
        'oficina',         v_oficina_nombre,
        'puesto',          COALESCE(NEW.puesto, 'Sin asignar'),
        'pagina_web',      v_pagina_web,
        'url',             '/dashboard'
      ),
      NEW.id::text
    );
    RAISE NOTICE '[ACTIVATION TRIGGER] Notificación cuenta_activada encolada para %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ACTIVATION TRIGGER] Error al encolar notificación para %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- PASO 3: Asegurar un solo trigger de activación
-- ============================================================

-- Limpiar cualquier variante previa
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios;
DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;
DROP TRIGGER IF EXISTS trigger_send_welcome_on_insert_active ON usuarios;

-- Crear trigger único
CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

-- ============================================================
-- PASO 4: Asegurar catálogo limpio
-- ============================================================

-- bienvenida → obsoleto
UPDATE correo_tipos_notificacion
SET es_obsoleto = true, activo = false
WHERE codigo = 'bienvenida';

-- cuenta_activada → activo
UPDATE correo_tipos_notificacion
SET activo = true, es_obsoleto = false
WHERE codigo = 'cuenta_activada';

-- ============================================================
-- PASO 5: Índice adicional en correo_historial_envios para 
-- compatibilidad con el guard legacy (lo mantiene funcionando)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_correo_historial_destinatario_tipo
  ON correo_historial_envios(destinatario_id, tipo_codigo, created_at)
  WHERE destinatario_id IS NOT NULL;
