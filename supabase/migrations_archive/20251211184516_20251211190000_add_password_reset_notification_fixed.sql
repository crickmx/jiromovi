/*
  # Agregar Notificación Transaccional para Recuperación de Contraseña

  1. Propósito
    - Crear tipo de notificación para recuperación de contraseña
    - Crear plantilla de correo para recuperación de contraseña
    - Permitir envío de correos desde sistema transaccional en lugar de Supabase Auth

  2. Nuevos Elementos
    - Tipo de notificación: password_reset
    - Plantilla con diseño profesional
    - Variables: {{nombre}}, {{reset_link}}, {{nombre_plataforma}}, {{fecha}}

  3. Configuración
    - Se activa por defecto
    - Solo envío por correo (no WhatsApp)
*/

-- Verificar si ya existe el tipo de notificación
DO $$
DECLARE
  v_tipo_id uuid;
BEGIN
  -- Insertar tipo de notificación si no existe
  INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo, enviar_por_correo, enviar_por_whatsapp)
  VALUES (
    'password_reset',
    'Recuperación de Contraseña',
    'Notificación enviada cuando un usuario solicita recuperar su contraseña',
    true,
    true,
    false
  )
  ON CONFLICT (codigo) DO UPDATE
  SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo,
    enviar_por_correo = EXCLUDED.enviar_por_correo
  RETURNING id INTO v_tipo_id;

  -- Si no se obtuvo ID del INSERT, obtenerlo del registro existente
  IF v_tipo_id IS NULL THEN
    SELECT id INTO v_tipo_id
    FROM correo_tipos_notificacion
    WHERE codigo = 'password_reset';
  END IF;

  -- Eliminar plantilla existente si existe
  DELETE FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id;

  -- Insertar plantilla de correo
  INSERT INTO correo_plantillas (
    tipo_notificacion_id,
    asunto,
    html_cuerpo,
    variables_disponibles,
    es_plantilla_default
  )
  VALUES (
    v_tipo_id,
    'Recuperación de Contraseña - {{nombre_plataforma}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                Recuperación de Contraseña
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{{nombre_plataforma}}</strong>.
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Haz clic en el botón de abajo para crear una nueva contraseña:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px 0;">
                    <a href="{{reset_link}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                O copia y pega este enlace en tu navegador:
              </p>
              
              <p style="color: #667eea; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0; word-break: break-all;">
                {{reset_link}}
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 0 0 20px 0;">
                <p style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0;">
                  <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora por seguridad.
                </p>
              </div>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu contraseña no será modificada.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
              <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 0;">
                <strong>{{nombre_plataforma}}</strong> • {{fecha}}
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    ARRAY['nombre', 'reset_link', 'nombre_plataforma', 'fecha'],
    true
  );

END $$;