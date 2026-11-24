/*
  # Crear Notificación: Nuevo Usuario Creado (para equipos internos)
  
  1. Propósito
    - Notificar a equipos internos (RRHH, Mercadotecnia, Mesa de Control)
    - Cuando se crea un nuevo usuario en el sistema
    - Para seguimiento comercial, branding, activación de campañas
    - Diferente de "bienvenida" (que se envía al usuario) y "usuario_nuevo_pendiente" (registro público)
  
  2. Destinatarios
    - Solo roles: Empleado, Gerente, Administrador
    - Configurables desde panel de administración
    - Nunca agentes
  
  3. Variables disponibles
    - {{usuario_nombre}}
    - {{usuario_apellidos}}
    - {{usuario_email_laboral}}
    - {{usuario_rol}}
    - {{usuario_oficina}}
    - {{usuario_fecha_alta}}
    - {{creado_por}}
    - {{link_usuario}}
*/

-- Crear tipo de notificación
INSERT INTO correo_tipos_notificacion (
  codigo,
  nombre,
  descripcion,
  activo,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_personalizada,
  permite_destinatarios_custom
)
VALUES (
  'nuevo_usuario_creado',
  'Nuevo Usuario Creado (Notificación Interna)',
  '✅ Notifica a equipos internos (RRHH, Mercadotecnia, Mesa de Control) cuando se crea un nuevo usuario. Para seguimiento comercial y activación de campañas.',
  true,
  true,
  true,
  true,
  false,
  true
)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo,
  enviar_correo = EXCLUDED.enviar_correo,
  enviar_whatsapp = EXCLUDED.enviar_whatsapp,
  enviar_notificacion = EXCLUDED.enviar_notificacion,
  permite_destinatarios_custom = EXCLUDED.permite_destinatarios_custom;

-- Crear plantilla para este tipo
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_id uuid;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'nuevo_usuario_creado';

  IF v_tipo_id IS NOT NULL THEN
    -- Verificar si ya existe una plantilla default
    SELECT id INTO v_plantilla_id
    FROM correo_plantillas
    WHERE tipo_notificacion_id = v_tipo_id
      AND es_plantilla_default = true;

    IF v_plantilla_id IS NOT NULL THEN
      -- Actualizar plantilla existente
      UPDATE correo_plantillas
      SET
        asunto = 'Nuevo usuario registrado en MOVI Digital',
        html_cuerpo = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Nuevo Usuario Registrado</h2>
          <p>Hola,</p>
          <p>Se ha creado un nuevo usuario en MOVI Digital:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nombre:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
            <p><strong>Email:</strong> {{usuario_email_laboral}}</p>
            <p><strong>Rol:</strong> {{usuario_rol}}</p>
            <p><strong>Oficina:</strong> {{usuario_oficina}}</p>
            <p><strong>Fecha de alta:</strong> {{usuario_fecha_alta}}</p>
            <p><strong>Creado por:</strong> {{creado_por}}</p>
          </div>
          <p>
            <a href="{{link_usuario}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver perfil del usuario
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Este es un correo automático del sistema de Notificaciones Transaccionales de MOVI Digital.
          </p>
        </div>',
        variables_disponibles = ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_email_laboral', 'usuario_rol', 'usuario_oficina', 'usuario_fecha_alta', 'creado_por', 'link_usuario'],
        whatsapp_plantilla = '🆕 *Nuevo Usuario en MOVI Digital*

*Nombre:* {{usuario_nombre}} {{usuario_apellidos}}
*Email:* {{usuario_email_laboral}}
*Rol:* {{usuario_rol}}
*Oficina:* {{usuario_oficina}}
*Creado por:* {{creado_por}}

Ver perfil: {{link_usuario}}

_Notificación automática - MOVI Digital_',
        whatsapp_variables_disponibles = ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_email_laboral', 'usuario_rol', 'usuario_oficina', 'creado_por', 'link_usuario'],
        notificacion_titulo = 'Nuevo usuario registrado',
        notificacion_cuerpo = '{{usuario_nombre}} {{usuario_apellidos}} ({{usuario_rol}}) se ha registrado en {{usuario_oficina}}',
        notificacion_variables_disponibles = ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_rol', 'usuario_oficina'],
        enviar_correo = true,
        enviar_whatsapp = true,
        enviar_notificacion = true
      WHERE id = v_plantilla_id;
    ELSE
      -- Crear nueva plantilla
      INSERT INTO correo_plantillas (
        tipo_notificacion_id,
        asunto,
        html_cuerpo,
        variables_disponibles,
        whatsapp_plantilla,
        whatsapp_variables_disponibles,
        notificacion_titulo,
        notificacion_cuerpo,
        notificacion_variables_disponibles,
        es_plantilla_default,
        enviar_correo,
        enviar_whatsapp,
        enviar_notificacion
      )
      VALUES (
        v_tipo_id,
        'Nuevo usuario registrado en MOVI Digital',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Nuevo Usuario Registrado</h2>
          <p>Hola,</p>
          <p>Se ha creado un nuevo usuario en MOVI Digital:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nombre:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
            <p><strong>Email:</strong> {{usuario_email_laboral}}</p>
            <p><strong>Rol:</strong> {{usuario_rol}}</p>
            <p><strong>Oficina:</strong> {{usuario_oficina}}</p>
            <p><strong>Fecha de alta:</strong> {{usuario_fecha_alta}}</p>
            <p><strong>Creado por:</strong> {{creado_por}}</p>
          </div>
          <p>
            <a href="{{link_usuario}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver perfil del usuario
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Este es un correo automático del sistema de Notificaciones Transaccionales de MOVI Digital.
          </p>
        </div>',
        ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_email_laboral', 'usuario_rol', 'usuario_oficina', 'usuario_fecha_alta', 'creado_por', 'link_usuario'],
        '🆕 *Nuevo Usuario en MOVI Digital*

*Nombre:* {{usuario_nombre}} {{usuario_apellidos}}
*Email:* {{usuario_email_laboral}}
*Rol:* {{usuario_rol}}
*Oficina:* {{usuario_oficina}}
*Creado por:* {{creado_por}}

Ver perfil: {{link_usuario}}

_Notificación automática - MOVI Digital_',
        ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_email_laboral', 'usuario_rol', 'usuario_oficina', 'creado_por', 'link_usuario'],
        'Nuevo usuario registrado',
        '{{usuario_nombre}} {{usuario_apellidos}} ({{usuario_rol}}) se ha registrado en {{usuario_oficina}}',
        ARRAY['usuario_nombre', 'usuario_apellidos', 'usuario_rol', 'usuario_oficina'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;

-- Crear función para notificar a equipos internos cuando se crea un usuario
CREATE OR REPLACE FUNCTION notificar_equipos_nuevo_usuario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatarios uuid[];
  v_destinatario uuid;
  v_oficina_nombre text;
  v_creador_nombre text;
  v_link_usuario text;
  v_datos jsonb;
BEGIN
  -- Solo notificar cuando se CREA un nuevo usuario (INSERT)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre de oficina
  SELECT nombre INTO v_oficina_nombre
  FROM oficinas
  WHERE id = NEW.oficina_id;
  
  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'Sin oficina asignada';
  END IF;

  -- Obtener nombre del creador (si está disponible en el contexto)
  v_creador_nombre := 'Sistema';
  IF current_setting('app.current_user_id', true) IS NOT NULL THEN
    SELECT nombre_completo INTO v_creador_nombre
    FROM usuarios
    WHERE id = current_setting('app.current_user_id', true)::uuid;
    
    IF v_creador_nombre IS NULL THEN
      v_creador_nombre := 'Administrador';
    END IF;
  END IF;

  -- Construir link al perfil del usuario
  v_link_usuario := 'https://movidigital.com/perfil/' || NEW.id::text;

  -- Preparar datos para la notificación
  v_datos := jsonb_build_object(
    'usuario_nombre', NEW.nombre,
    'usuario_apellidos', NEW.apellidos,
    'usuario_email_laboral', NEW.email_laboral,
    'usuario_rol', NEW.rol,
    'usuario_oficina', v_oficina_nombre,
    'usuario_fecha_alta', to_char(NEW.created_at, 'DD/MM/YYYY HH24:MI'),
    'creado_por', v_creador_nombre,
    'link_usuario', v_link_usuario
  );

  -- Obtener destinatarios configurados para este tipo de notificación
  SELECT ARRAY_AGG(DISTINCT usuario_id)
  INTO v_destinatarios
  FROM correo_destinatarios_notificacion cdn
  INNER JOIN correo_tipos_notificacion ctn ON ctn.id = cdn.tipo_notificacion_id
  INNER JOIN usuarios u ON u.id = cdn.usuario_id
  WHERE ctn.codigo = 'nuevo_usuario_creado'
    AND ctn.activo = true
    AND u.estado = 'activo'
    AND u.rol IN ('Empleado', 'Gerente', 'Administrador');

  -- Si no hay destinatarios configurados, no hacer nada
  IF v_destinatarios IS NULL OR array_length(v_destinatarios, 1) = 0 THEN
    RAISE LOG '[nuevo_usuario] No hay destinatarios configurados para nuevo_usuario_creado';
    RETURN NEW;
  END IF;

  RAISE LOG '[nuevo_usuario] Notificando a % destinatarios sobre nuevo usuario: %', 
    array_length(v_destinatarios, 1), NEW.email_laboral;

  -- Enviar notificación a cada destinatario
  FOREACH v_destinatario IN ARRAY v_destinatarios
  LOOP
    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_usuario_creado',
        p_user_id := v_destinatario,
        p_titulo := 'Nuevo usuario registrado',
        p_mensaje := NEW.nombre || ' ' || NEW.apellidos || ' (' || NEW.rol || ') se ha registrado en ' || v_oficina_nombre,
        p_modulo := 'usuarios',
        p_datos_adicionales := v_datos,
        p_accion_url := '/perfil/' || NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[nuevo_usuario] Error notificando a destinatario %: %', v_destinatario, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Crear trigger para notificar cuando se crea un usuario
DROP TRIGGER IF EXISTS trigger_notificar_equipos_nuevo_usuario ON usuarios;

CREATE TRIGGER trigger_notificar_equipos_nuevo_usuario
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION notificar_equipos_nuevo_usuario();

COMMENT ON FUNCTION notificar_equipos_nuevo_usuario IS
  'Notifica a equipos internos (configurados) cuando se crea un nuevo usuario en el sistema';

COMMENT ON TRIGGER trigger_notificar_equipos_nuevo_usuario ON usuarios IS
  'Dispara notificaciones a equipos internos cuando se crea un nuevo usuario';
