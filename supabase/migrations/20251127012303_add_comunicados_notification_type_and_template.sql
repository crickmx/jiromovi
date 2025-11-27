/*
  # Crear tipo y plantilla de notificación para Comunicados
  
  ## Descripción
  Agrega tipo de notificación específico para cuando se crea un nuevo
  comunicado, incluyendo plantilla WhatsApp con título y link directo.
  
  ## Cambios
  1. Nuevo tipo: nuevo_comunicado
     - Para notificar cuando se publica un comunicado
     - Con plantilla WhatsApp que incluye título y link
  
  ## Variables disponibles
  - {{titulo}} - Título del comunicado
  - {{nombre}} - Nombre del usuario destinatario
  - {{apellidos}} - Apellidos del usuario
  - {{link}} - Link directo al comunicado
*/

-- =====================================================
-- 1. Tipo de notificación para comunicados
-- =====================================================

INSERT INTO correo_tipos_notificacion (
  codigo,
  nombre,
  descripcion,
  activo,
  enviar_por_whatsapp
)
VALUES (
  'nuevo_comunicado',
  'Nuevo Comunicado Publicado',
  'Notificación cuando se publica un nuevo comunicado visible para el usuario',
  true,
  true
)
ON CONFLICT (codigo) DO UPDATE
SET 
  enviar_por_whatsapp = true,
  activo = true;

-- =====================================================
-- 2. Plantilla WhatsApp y Email para comunicados
-- =====================================================

DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_exists boolean;
BEGIN
  -- Obtener ID del tipo
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'nuevo_comunicado';

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
      'Nuevo comunicado: {{titulo}}',
      '<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #1D78FF;">📢 Nuevo Comunicado</h2>
        <h3 style="margin: 20px 0;">{{titulo}}</h3>
        <p style="font-size: 16px; line-height: 1.6;">
          Hola {{nombre}},
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Se ha publicado un nuevo comunicado que puede ser de tu interés.
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="{{link}}" 
             style="background-color: #1D78FF; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Ver Comunicado
          </a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px;">Mensaje desde www.movi.digital</p>
      </div>',
      '📢 *Nuevo Comunicado*

*{{titulo}}*

Hola {{nombre}},

Se ha publicado un nuevo comunicado que puede ser de tu interés.

🔗 Ver: {{link}}

---
Mensaje desde www.movi.digital',
      ARRAY['titulo', 'nombre', 'apellidos', 'link'],
      ARRAY['titulo', 'nombre', 'apellidos', 'link'],
      true
    );
    RAISE NOTICE '✅ Plantilla creada para nuevo_comunicado';
  ELSE
    -- Actualizar plantilla existente
    UPDATE correo_plantillas
    SET 
      whatsapp_plantilla = '📢 *Nuevo Comunicado*

*{{titulo}}*

Hola {{nombre}},

Se ha publicado un nuevo comunicado que puede ser de tu interés.

🔗 Ver: {{link}}

---
Mensaje desde www.movi.digital',
      whatsapp_variables_disponibles = ARRAY['titulo', 'nombre', 'apellidos', 'link'],
      html_cuerpo = '<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #1D78FF;">📢 Nuevo Comunicado</h2>
        <h3 style="margin: 20px 0;">{{titulo}}</h3>
        <p style="font-size: 16px; line-height: 1.6;">
          Hola {{nombre}},
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Se ha publicado un nuevo comunicado que puede ser de tu interés.
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="{{link}}" 
             style="background-color: #1D78FF; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Ver Comunicado
          </a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px;">Mensaje desde www.movi.digital</p>
      </div>'
    WHERE tipo_notificacion_id = v_tipo_id;
    RAISE NOTICE '✅ Plantilla actualizada para nuevo_comunicado';
  END IF;
END $$;

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOTIFICACIONES PARA COMUNICADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Tipo "nuevo_comunicado" configurado';
  RAISE NOTICE '✅ Plantilla WhatsApp y Email lista';
  RAISE NOTICE '✅ Variables: titulo, nombre, apellidos, link';
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora los comunicados enviarán notificación';
  RAISE NOTICE 'con campanita + WhatsApp automáticamente';
  RAISE NOTICE '========================================';
END $$;
