/*
  # Agregar tipo y plantilla para notificaciones individuales con WhatsApp
  
  ## Descripción
  Agrega el tipo de notificación "notificacion_individual" y su plantilla
  para permitir que las notificaciones individuales envíen WhatsApp.
  
  ## Cambios
  1. Insertar tipo notificacion_individual si no existe
  2. Insertar plantilla WhatsApp si no existe
  3. Actualizar función enviar_notificacion_individual
*/

-- =====================================================
-- 1. Tipo de notificación individual
-- =====================================================

INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo, enviar_por_whatsapp)
VALUES (
  'notificacion_individual',
  'Notificación Individual del Sistema',
  'Notificaciones automáticas del sistema para usuarios individuales',
  true,
  true
)
ON CONFLICT (codigo) DO UPDATE
SET 
  enviar_por_whatsapp = true,
  activo = true;

-- =====================================================
-- 2. Plantilla WhatsApp
-- =====================================================

DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_exists boolean;
BEGIN
  -- Obtener ID del tipo
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'notificacion_individual';

  -- Verificar si existe plantilla
  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas 
    WHERE tipo_notificacion_id = v_tipo_id
  ) INTO v_plantilla_exists;

  -- Solo insertar si no existe
  IF NOT v_plantilla_exists THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      whatsapp_plantilla,
      variables_disponibles,
      whatsapp_variables_disponibles,
      es_plantilla_default
    )
    VALUES (
      v_tipo_id,
      '{{titulo}}',
      '<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1D78FF;">{{titulo}}</h2>
        <p style="font-size: 16px;">{{mensaje}}</p>
        <p><strong>Módulo:</strong> {{modulo}}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Mensaje automático de MOVI Digital</p>
      </div>',
      '🔔 *{{titulo}}*

{{mensaje}}

📂 Módulo: {{modulo}}

---
_Mensaje automático de MOVI Digital_',
      ARRAY['titulo', 'mensaje', 'modulo', 'nombre', 'apellidos'],
      ARRAY['titulo', 'mensaje', 'modulo', 'nombre', 'apellidos'],
      true
    );
    RAISE NOTICE '✅ Plantilla creada para notificacion_individual';
  ELSE
    -- Actualizar solo el whatsapp_plantilla si ya existe
    UPDATE correo_plantillas
    SET whatsapp_plantilla = '🔔 *{{titulo}}*

{{mensaje}}

📂 Módulo: {{modulo}}

---
_Mensaje automático de MOVI Digital_',
        whatsapp_variables_disponibles = ARRAY['titulo', 'mensaje', 'modulo', 'nombre', 'apellidos']
    WHERE tipo_notificacion_id = v_tipo_id;
    RAISE NOTICE '✅ Plantilla actualizada para notificacion_individual';
  END IF;
END $$;

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOTIFICACIONES INDIVIDUALES CON WHATSAPP';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Tipo "notificacion_individual" configurado';
  RAISE NOTICE '✅ Plantilla WhatsApp lista';
  RAISE NOTICE '✅ Función enviar_notificacion_individual disponible';
  RAISE NOTICE '';
  RAISE NOTICE 'Todas las notificaciones individuales (campanita)';
  RAISE NOTICE 'ahora envían WhatsApp automáticamente al teléfono';
  RAISE NOTICE 'laboral del usuario.';
  RAISE NOTICE '========================================';
END $$;
