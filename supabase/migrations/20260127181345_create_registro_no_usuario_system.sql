/*
  # Sistema de Registro "Aún no soy usuario"

  1. Nueva Tabla
    - `registro_interesados`: Almacena solicitudes de registro de usuarios no registrados
      - Campos básicos: nombre, apellidos, email, whatsapp
      - Campo `es_agente_jiro`: indica si es agente de Grupo JIRO
      - Campo `oficina_id`: oficina seleccionada (solo si es agente)
      - Campo `status`: nuevo, contactado, descartado, convertido
      - Campo `source`: origen del registro (login_registro)
      - Campos de auditoría: created_at, updated_at, metadata

  2. Tipo y Plantillas de Notificación
    - Tipo: `nuevo_registro_no_usuario`
    - Plantilla con 3 canales: Email, WhatsApp, Campanita

  3. Función
    - `procesar_registro_no_usuario()`: Crea registro, tareas y envía notificaciones

  4. Seguridad
    - RLS habilitado en tabla registro_interesados
    - Policies: Administradores y Gerentes pueden ver registros
    - Función pública para recibir registros
*/

-- 1. Crear enum para status de registro
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registro_status') THEN
    CREATE TYPE registro_status AS ENUM ('nuevo', 'contactado', 'descartado', 'convertido');
  END IF;
END $$;

-- 2. Crear tabla registro_interesados
CREATE TABLE IF NOT EXISTS registro_interesados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellidos text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  es_agente_jiro boolean NOT NULL DEFAULT false,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  status registro_status NOT NULL DEFAULT 'nuevo',
  source text NOT NULL DEFAULT 'login_registro',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_registro_interesados_email ON registro_interesados(email);
CREATE INDEX IF NOT EXISTS idx_registro_interesados_status ON registro_interesados(status);
CREATE INDEX IF NOT EXISTS idx_registro_interesados_oficina ON registro_interesados(oficina_id);
CREATE INDEX IF NOT EXISTS idx_registro_interesados_created ON registro_interesados(created_at DESC);

-- 4. Trigger para updated_at
CREATE TRIGGER set_updated_at_registro_interesados
  BEFORE UPDATE ON registro_interesados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar RLS
ALTER TABLE registro_interesados ENABLE ROW LEVEL SECURITY;

-- 6. Policies para registro_interesados
CREATE POLICY "Administradores pueden ver todos los registros"
  ON registro_interesados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Gerentes pueden ver registros de su oficina"
  ON registro_interesados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = registro_interesados.oficina_id
    )
  );

CREATE POLICY "Administradores pueden actualizar registros"
  ON registro_interesados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- 7. Crear tipo de notificación
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
) VALUES (
  'nuevo_registro_no_usuario',
  'Nuevo Registro: Aún no soy usuario',
  '🆕 Notifica cuando alguien se registra desde el formulario "Aún no soy usuario" en el login. Crea tarea automática y envía notificación al equipo correspondiente.',
  true,
  true,
  true,
  true,
  false,
  false
) ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo,
  enviar_correo = EXCLUDED.enviar_correo,
  enviar_whatsapp = EXCLUDED.enviar_whatsapp,
  enviar_notificacion = EXCLUDED.enviar_notificacion;

-- 8. Crear plantilla para este tipo
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_id uuid;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'nuevo_registro_no_usuario';

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
        asunto = 'Nuevo registro: Aún no soy usuario - {{nombre_completo}}',
        html_cuerpo = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af; margin-bottom: 20px;">🆕 Nuevo Registro de Usuario</h2>
          <p style="font-size: 16px; color: #374151; margin-bottom: 15px;">
            Se ha recibido una nueva solicitud de registro:
          </p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #1e40af; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Nombre:</strong> {{nombre_completo}}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> {{email}}</p>
            <p style="margin: 5px 0;"><strong>WhatsApp:</strong> {{whatsapp}}</p>
            <p style="margin: 5px 0;"><strong>¿Es agente Grupo JIRO?:</strong> {{es_agente_texto}}</p>
            <p style="margin: 5px 0;"><strong>Oficina:</strong> {{oficina_nombre}}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> {{fecha_registro}}</p>
          </div>
          <div style="margin-top: 25px;">
            <a href="{{url_tarea}}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Ver Tarea →
            </a>
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
            Por favor, da seguimiento a esta solicitud lo antes posible.
          </p>
        </div>',
        variables_disponibles = ARRAY['nombre_completo', 'email', 'whatsapp', 'es_agente_texto', 'oficina_nombre', 'fecha_registro', 'url_tarea'],
        whatsapp_plantilla = '🆕 *Nuevo Registro - Aún no soy usuario*

*Nombre:* {{nombre_completo}}
*Email:* {{email}}
*WhatsApp:* {{whatsapp}}
*¿Agente JIRO?:* {{es_agente_texto}}
*Oficina:* {{oficina_nombre}}

📅 {{fecha_registro}}

Por favor, da seguimiento a esta solicitud.

{{url_tarea}}',
        whatsapp_variables_disponibles = ARRAY['nombre_completo', 'email', 'whatsapp', 'es_agente_texto', 'oficina_nombre', 'fecha_registro', 'url_tarea'],
        notificacion_titulo = 'Nuevo registro: Aún no soy usuario',
        notificacion_cuerpo = '{{nombre_completo}} solicitó registro. {{es_agente_texto}} - {{oficina_nombre}}',
        notificacion_variables_disponibles = ARRAY['nombre_completo', 'es_agente_texto', 'oficina_nombre'],
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
      ) VALUES (
        v_tipo_id,
        'Nuevo registro: Aún no soy usuario - {{nombre_completo}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af; margin-bottom: 20px;">🆕 Nuevo Registro de Usuario</h2>
          <p style="font-size: 16px; color: #374151; margin-bottom: 15px;">
            Se ha recibido una nueva solicitud de registro:
          </p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #1e40af; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Nombre:</strong> {{nombre_completo}}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> {{email}}</p>
            <p style="margin: 5px 0;"><strong>WhatsApp:</strong> {{whatsapp}}</p>
            <p style="margin: 5px 0;"><strong>¿Es agente Grupo JIRO?:</strong> {{es_agente_texto}}</p>
            <p style="margin: 5px 0;"><strong>Oficina:</strong> {{oficina_nombre}}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> {{fecha_registro}}</p>
          </div>
          <div style="margin-top: 25px;">
            <a href="{{url_tarea}}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Ver Tarea →
            </a>
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
            Por favor, da seguimiento a esta solicitud lo antes posible.
          </p>
        </div>',
        ARRAY['nombre_completo', 'email', 'whatsapp', 'es_agente_texto', 'oficina_nombre', 'fecha_registro', 'url_tarea'],
        '🆕 *Nuevo Registro - Aún no soy usuario*

*Nombre:* {{nombre_completo}}
*Email:* {{email}}
*WhatsApp:* {{whatsapp}}
*¿Agente JIRO?:* {{es_agente_texto}}
*Oficina:* {{oficina_nombre}}

📅 {{fecha_registro}}

Por favor, da seguimiento a esta solicitud.

{{url_tarea}}',
        ARRAY['nombre_completo', 'email', 'whatsapp', 'es_agente_texto', 'oficina_nombre', 'fecha_registro', 'url_tarea'],
        'Nuevo registro: Aún no soy usuario',
        '{{nombre_completo}} solicitó registro. {{es_agente_texto}} - {{oficina_nombre}}',
        ARRAY['nombre_completo', 'es_agente_texto', 'oficina_nombre'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;

-- 9. Función para procesar registro y crear tareas con notificaciones
CREATE OR REPLACE FUNCTION procesar_registro_no_usuario(
  p_nombre text,
  p_apellidos text,
  p_email text,
  p_whatsapp text,
  p_es_agente_jiro boolean,
  p_oficina_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registro_id uuid;
  v_tarea_id uuid;
  v_destinatario record;
  v_oficina_nombre text := 'N/A';
  v_nombre_completo text;
  v_es_agente_texto text;
  v_descripcion_tarea text;
  v_url_base text := 'https://movi.grupojiro.com';
BEGIN
  -- Validar email único (si ya existe nuevo, retornar mensaje)
  IF EXISTS (
    SELECT 1 FROM registro_interesados
    WHERE email = p_email
    AND status = 'nuevo'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ya recibimos tu solicitud anteriormente. Pronto te contactaremos.'
    );
  END IF;

  -- Validar que si es agente, tenga oficina
  IF p_es_agente_jiro AND p_oficina_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Debes seleccionar una oficina'
    );
  END IF;

  -- Obtener nombre de oficina si aplica
  IF p_oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = p_oficina_id;
    
    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'Oficina no encontrada';
    END IF;
  END IF;

  -- Preparar variables
  v_nombre_completo := p_nombre || ' ' || p_apellidos;
  v_es_agente_texto := CASE WHEN p_es_agente_jiro THEN 'Sí' ELSE 'No' END;

  -- 1. Crear registro en BD
  INSERT INTO registro_interesados (
    nombre,
    apellidos,
    email,
    whatsapp,
    es_agente_jiro,
    oficina_id,
    status,
    source,
    metadata
  ) VALUES (
    p_nombre,
    p_apellidos,
    p_email,
    p_whatsapp,
    p_es_agente_jiro,
    p_oficina_id,
    'nuevo',
    'login_registro',
    p_metadata
  ) RETURNING id INTO v_registro_id;

  -- 2. Preparar descripción de tarea
  v_descripcion_tarea := format(
    E'**Nuevo registro recibido**\n\n' ||
    E'**Nombre completo:** %s\n' ||
    E'**Email:** %s\n' ||
    E'**WhatsApp:** %s\n' ||
    E'**¿Es agente Grupo JIRO?:** %s\n' ||
    CASE WHEN p_es_agente_jiro
      THEN format(E'**Oficina:** %s\n', v_oficina_nombre)
      ELSE ''
    END ||
    E'**Fecha de registro:** %s\n\n' ||
    E'Por favor, contacta a esta persona lo antes posible.',
    v_nombre_completo,
    p_email,
    p_whatsapp,
    v_es_agente_texto,
    to_char(now(), 'DD/MM/YYYY HH24:MI')
  );

  -- 3. Determinar destinatarios y crear tareas
  IF p_es_agente_jiro THEN
    -- Caso A: Es agente - Asignar a gerentes de oficina + admins

    -- Crear tarea para cada gerente de la oficina
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Gerente'
      AND oficina_id = p_oficina_id
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea
      INSERT INTO tickets (
        titulo,
        descripcion,
        categoria,
        prioridad,
        estado,
        usuario_id,
        creado_por,
        metadata
      ) VALUES (
        'Nuevo registro: ' || v_nombre_completo,
        v_descripcion_tarea,
        'Lead – Registro MOVI',
        'alta',
        'abierto',
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario'
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones (campanita + email + whatsapp)
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto || ' - ' || v_oficina_nombre,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', v_oficina_nombre,
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;

    -- Crear tarea para cada administrador
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Administrador'
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea
      INSERT INTO tickets (
        titulo,
        descripcion,
        categoria,
        prioridad,
        estado,
        usuario_id,
        creado_por,
        metadata
      ) VALUES (
        'Nuevo registro: ' || v_nombre_completo,
        v_descripcion_tarea,
        'Lead – Registro MOVI',
        'alta',
        'abierto',
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario'
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto || ' - ' || v_oficina_nombre,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', v_oficina_nombre,
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;

  ELSE
    -- Caso B: No es agente - Solo admins
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Administrador'
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea
      INSERT INTO tickets (
        titulo,
        descripcion,
        categoria,
        prioridad,
        estado,
        usuario_id,
        creado_por,
        metadata
      ) VALUES (
        'Nuevo registro: ' || v_nombre_completo,
        v_descripcion_tarea,
        'Lead – Registro MOVI',
        'alta',
        'abierto',
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario'
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', 'N/A',
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', '¡Listo! Recibimos tus datos. En breve un miembro del equipo te contactará.',
    'registro_id', v_registro_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al procesar el registro: ' || SQLERRM
    );
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados y anónimos
GRANT EXECUTE ON FUNCTION procesar_registro_no_usuario TO anon, authenticated;

-- 10. Comentarios
COMMENT ON TABLE registro_interesados IS 'Registros de usuarios que aún no tienen cuenta en MOVI';
COMMENT ON FUNCTION procesar_registro_no_usuario IS 'Procesa registro de "Aún no soy usuario", crea tareas y envía notificaciones';
