/*
  # Corregir variables de plantilla de correo para comunicados

  ## Descripción
  La plantilla de email para nuevo_comunicado tenía variables incorrectas
  que no coincidían con los datos enviados por la función.

  ## Problema
  - Plantilla usaba: {{titulo_comunicado}}, {{link_comunicado}}
  - Datos enviados tienen: {{titulo}}, {{link}}
  - Resultado: El email mostraba {{mensaje}} sin reemplazar

  ## Solución
  Actualizar la plantilla HTML para usar las variables correctas que vienen
  en el objeto de datos.

  ## Variables correctas
  - {{titulo}} - Título del comunicado
  - {{nombre}} - Nombre del destinatario
  - {{link}} - Link directo al comunicado
  - {{mensaje}} - Mensaje adicional (opcional)
*/

-- Actualizar plantilla de correo para nuevo_comunicado
UPDATE correo_plantillas
SET 
  asunto = 'Nuevo comunicado: {{titulo}}',
  html_cuerpo = '<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f9fafb;">
  <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #1D78FF; margin: 0; font-size: 24px;">📢 Nuevo Comunicado</h2>
    </div>
    
    <h3 style="color: #1f2937; margin: 20px 0 15px 0; font-size: 20px; font-weight: 600;">
      {{titulo}}
    </h3>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Hola {{nombre}},
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Se ha publicado un nuevo comunicado que puede ser de tu interés.
    </p>
    
    <div style="margin: 35px 0; text-align: center;">
      <a href="{{link}}" 
         style="background-color: #1D78FF; color: white; padding: 14px 32px; 
                text-decoration: none; border-radius: 8px; display: inline-block;
                font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(29,120,255,0.3);">
        Ver Comunicado
      </a>
    </div>
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 13px; margin: 0; text-align: center;">
        Mensaje enviado desde <a href="https://www.movi.digital" style="color: #1D78FF; text-decoration: none;">www.movi.digital</a>
      </p>
    </div>
  </div>
</div>',
  variables_disponibles = ARRAY['titulo', 'nombre', 'apellidos', 'link', 'mensaje']
WHERE tipo_notificacion_id = (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'nuevo_comunicado'
);

-- Verificar que se actualizó correctamente
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM correo_plantillas
  WHERE tipo_notificacion_id = (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'nuevo_comunicado')
  AND html_cuerpo LIKE '%{{titulo}}%'
  AND html_cuerpo LIKE '%{{link}}%';

  IF v_count > 0 THEN
    RAISE NOTICE '✅ Plantilla de comunicados actualizada correctamente';
    RAISE NOTICE '✅ Variables ahora: {{titulo}}, {{nombre}}, {{link}}';
  ELSE
    RAISE WARNING '⚠️ La plantilla no se actualizó correctamente';
  END IF;
END $$;
