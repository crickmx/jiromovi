/*
  # Crear Notificaciones Transaccionales Completas
  
  1. Recursos Humanos
    - Vacaciones aprobadas
  
  2. Mercadotecnia
    - Solicitud de compra en Store
  
  3. Mesa de Control
    - Nuevo trámite generado
    - Solicitud de corrección de comisiones
  
  Todos permiten:
  - Seleccionar destinatarios (Empleado, Gerente, Administrador)
  - Activar/desactivar por canal (Email, WhatsApp, Push)
  - Variables personalizables
*/

-- ============================================
-- 1. RECURSOS HUMANOS: Vacaciones Aprobadas
-- ============================================

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
  'vacaciones_aprobadas',
  'Vacaciones Aprobadas (RRHH)',
  '✅ Notifica a RRHH cuando se aprueban vacaciones de un empleado. Para seguimiento y gestión de ausencias.',
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
  permite_destinatarios_custom = EXCLUDED.permite_destinatarios_custom;

-- Plantilla de vacaciones aprobadas
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_existe boolean;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'vacaciones_aprobadas';

  IF v_tipo_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
    ) INTO v_plantilla_existe;

    IF NOT v_plantilla_existe THEN
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
        '✅ Vacaciones aprobadas - {{empleado_nombre}} {{empleado_apellidos}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">✅ Vacaciones Aprobadas</h2>
          <p>Se han aprobado las vacaciones del siguiente empleado:</p>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p><strong>Empleado:</strong> {{empleado_nombre}} {{empleado_apellidos}}</p>
            <p><strong>Oficina:</strong> {{empleado_oficina}}</p>
            <p><strong>Período:</strong> {{fecha_inicio_vacaciones}} - {{fecha_fin_vacaciones}}</p>
            <p><strong>Aprobado por:</strong> {{aprobado_por}}</p>
            <p><strong>Fecha de aprobación:</strong> {{fecha_aprobacion}}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Notificación automática del sistema de RRHH - MOVI Digital
          </p>
        </div>',
        ARRAY['empleado_nombre', 'empleado_apellidos', 'empleado_oficina', 'fecha_inicio_vacaciones', 'fecha_fin_vacaciones', 'aprobado_por', 'fecha_aprobacion'],
        '✅ *Vacaciones Aprobadas*

*Empleado:* {{empleado_nombre}} {{empleado_apellidos}}
*Oficina:* {{empleado_oficina}}
*Período:* {{fecha_inicio_vacaciones}} - {{fecha_fin_vacaciones}}
*Aprobado por:* {{aprobado_por}}
*Fecha:* {{fecha_aprobacion}}

_Notificación RRHH - MOVI Digital_',
        ARRAY['empleado_nombre', 'empleado_apellidos', 'empleado_oficina', 'fecha_inicio_vacaciones', 'fecha_fin_vacaciones', 'aprobado_por', 'fecha_aprobacion'],
        'Vacaciones aprobadas',
        '{{empleado_nombre}} {{empleado_apellidos}} - Vacaciones del {{fecha_inicio_vacaciones}} al {{fecha_fin_vacaciones}}',
        ARRAY['empleado_nombre', 'empleado_apellidos', 'fecha_inicio_vacaciones', 'fecha_fin_vacaciones'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;

-- ============================================
-- 2. MERCADOTECNIA: Solicitud de Compra Store
-- ============================================

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
  'solicitud_compra_store',
  'Solicitud de Compra en Store (Mercadotecnia)',
  '✅ Notifica cuando un usuario realiza un pedido en la Store. Para gestión de inventario y logística.',
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
  permite_destinatarios_custom = EXCLUDED.permite_destinatarios_custom;

-- Plantilla de solicitud de compra
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_existe boolean;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'solicitud_compra_store';

  IF v_tipo_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
    ) INTO v_plantilla_existe;

    IF NOT v_plantilla_existe THEN
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
        '🛒 Nuevo pedido en Store - #{{pedido_id}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🛒 Nuevo Pedido en Store</h2>
          <p>Se ha registrado un nuevo pedido:</p>
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p><strong>Pedido:</strong> #{{pedido_id}}</p>
            <p><strong>Usuario:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
            <p><strong>Oficina:</strong> {{usuario_oficina}}</p>
            <p><strong>Fecha:</strong> {{fecha_pedido}}</p>
            <p><strong>Total de productos:</strong> {{total_productos}}</p>
          </div>
          <p>
            <a href="{{link_pedido}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver detalles del pedido
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Notificación automática - Store MOVI Digital
          </p>
        </div>',
        ARRAY['pedido_id', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'fecha_pedido', 'total_productos', 'link_pedido'],
        '🛒 *Nuevo Pedido en Store*

*Pedido:* #{{pedido_id}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Oficina:* {{usuario_oficina}}
*Fecha:* {{fecha_pedido}}
*Total productos:* {{total_productos}}

Ver detalles: {{link_pedido}}

_Store - MOVI Digital_',
        ARRAY['pedido_id', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'fecha_pedido', 'total_productos', 'link_pedido'],
        'Nuevo pedido en Store',
        'Pedido #{{pedido_id}} - {{usuario_nombre}} {{usuario_apellidos}} ({{total_productos}} productos)',
        ARRAY['pedido_id', 'usuario_nombre', 'usuario_apellidos', 'total_productos'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;

-- ============================================
-- 3. MESA DE CONTROL: Nuevo Trámite
-- ============================================

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
  'nuevo_tramite',
  'Nuevo Trámite Generado (Mesa de Control)',
  '✅ Notifica cuando se genera un nuevo trámite (corrección de póliza, corrección de comisiones, registro, etc.).',
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
  permite_destinatarios_custom = EXCLUDED.permite_destinatarios_custom;

-- Plantilla de nuevo trámite
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_existe boolean;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'nuevo_tramite';

  IF v_tipo_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
    ) INTO v_plantilla_existe;

    IF NOT v_plantilla_existe THEN
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
        '📋 Nuevo trámite generado - {{tipo_tramite}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">📋 Nuevo Trámite Generado</h2>
          <p>Se ha generado un nuevo trámite que requiere atención:</p>
          <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
            <p><strong>Tipo:</strong> {{tipo_tramite}}</p>
            <p><strong>Folio:</strong> {{folio_tramite}}</p>
            <p><strong>Generado por:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
            <p><strong>Oficina:</strong> {{usuario_oficina}}</p>
            <p><strong>Fecha:</strong> {{fecha_creacion}}</p>
          </div>
          <p>
            <a href="{{link_tramite}}" style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver trámite
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Notificación automática - Mesa de Control MOVI Digital
          </p>
        </div>',
        ARRAY['tipo_tramite', 'folio_tramite', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'fecha_creacion', 'link_tramite'],
        '📋 *Nuevo Trámite*

*Tipo:* {{tipo_tramite}}
*Folio:* {{folio_tramite}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Oficina:* {{usuario_oficina}}
*Fecha:* {{fecha_creacion}}

Ver trámite: {{link_tramite}}

_Mesa de Control - MOVI Digital_',
        ARRAY['tipo_tramite', 'folio_tramite', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'fecha_creacion', 'link_tramite'],
        'Nuevo trámite generado',
        '{{tipo_tramite}} - Folio {{folio_tramite}} - {{usuario_nombre}} {{usuario_apellidos}}',
        ARRAY['tipo_tramite', 'folio_tramite', 'usuario_nombre', 'usuario_apellidos'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;

-- ============================================
-- 4. MESA DE CONTROL: Corrección de Comisiones
-- ============================================

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
  'solicitud_correccion_comisiones',
  'Solicitud de Corrección de Comisiones (Mesa de Control)',
  '✅ Notifica cuando un usuario solicita corrección en un lote de comisiones.',
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
  permite_destinatarios_custom = EXCLUDED.permite_destinatarios_custom;

-- Plantilla de corrección de comisiones
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_existe boolean;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'solicitud_correccion_comisiones';

  IF v_tipo_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
    ) INTO v_plantilla_existe;

    IF NOT v_plantilla_existe THEN
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
        '💰 Solicitud de corrección de comisiones - Semana {{lote_semana}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">💰 Solicitud de Corrección de Comisiones</h2>
          <p>Se ha recibido una solicitud de corrección:</p>
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p><strong>Lote:</strong> Semana {{lote_semana}}</p>
            <p><strong>Documento:</strong> {{documento}}</p>
            <p><strong>Usuario:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
            <p><strong>Oficina:</strong> {{usuario_oficina}}</p>
            <p><strong>Motivo:</strong> {{motivo_correccion}}</p>
          </div>
          <p>
            <a href="{{link_lote}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver lote de comisiones
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Notificación automática - Mesa de Control MOVI Digital
          </p>
        </div>',
        ARRAY['lote_semana', 'documento', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'motivo_correccion', 'link_lote'],
        '💰 *Corrección de Comisiones*

*Lote:* Semana {{lote_semana}}
*Documento:* {{documento}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Oficina:* {{usuario_oficina}}
*Motivo:* {{motivo_correccion}}

Ver lote: {{link_lote}}

_Mesa de Control - MOVI Digital_',
        ARRAY['lote_semana', 'documento', 'usuario_nombre', 'usuario_apellidos', 'usuario_oficina', 'motivo_correccion', 'link_lote'],
        'Solicitud de corrección',
        'Semana {{lote_semana}} - {{documento}} - {{usuario_nombre}} {{usuario_apellidos}}',
        ARRAY['lote_semana', 'documento', 'usuario_nombre', 'usuario_apellidos'],
        true,
        true,
        true,
        true
      );
    END IF;
  END IF;
END $$;
