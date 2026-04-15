
/*
  # FASE 2-3: Unificación del Catálogo de Notificaciones Transaccionales

  ## Resumen
  Agrega columnas de clasificación al catálogo `correo_tipos_notificacion` para
  implementar nomenclatura estándar [MODULO] - [EVENTO] - [DESTINATARIO] - [CANAL].

  ## Cambios
  1. Nuevas columnas en `correo_tipos_notificacion`:
     - `modulo` (text): Módulo del sistema al que pertenece la notificación
     - `nombre_estandar` (text): Nombre con nomenclatura estándar
     - `trigger_event` (text): Evento que dispara la notificación
     - `destinatario_tipo` (text): Tipo de destinatario (usuario, admin, gerente, etc.)
     - `es_obsoleto` (boolean): Marca si está deprecada

  2. Actualiza los 28 tipos existentes con clasificación por módulo y nombre estándar

  3. Inserta tipos faltantes para los módulos: AUTH, CRM, COMISIONES, EDUCATION, SICAS,
     SISTEMA, ESPACIO JIRO

  4. Crea plantillas por defecto (`correo_plantillas`) para los nuevos tipos

  5. Crea vista `v_catalogo_notificaciones` para consulta unificada

  ## Seguridad
  - Sin cambios en RLS (hereda políticas existentes)
*/

-- PASO 1: Agregar columnas de clasificación a correo_tipos_notificacion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_tipos_notificacion' AND column_name = 'modulo'
  ) THEN
    ALTER TABLE correo_tipos_notificacion ADD COLUMN modulo text DEFAULT 'SISTEMA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_tipos_notificacion' AND column_name = 'nombre_estandar'
  ) THEN
    ALTER TABLE correo_tipos_notificacion ADD COLUMN nombre_estandar text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_tipos_notificacion' AND column_name = 'trigger_event'
  ) THEN
    ALTER TABLE correo_tipos_notificacion ADD COLUMN trigger_event text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_tipos_notificacion' AND column_name = 'destinatario_tipo'
  ) THEN
    ALTER TABLE correo_tipos_notificacion ADD COLUMN destinatario_tipo text DEFAULT 'usuario';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_tipos_notificacion' AND column_name = 'es_obsoleto'
  ) THEN
    ALTER TABLE correo_tipos_notificacion ADD COLUMN es_obsoleto boolean DEFAULT false;
  END IF;
END $$;

-- PASO 2: Clasificar los tipos existentes con módulo y nombre estándar
UPDATE correo_tipos_notificacion SET
  modulo = 'AUTH',
  nombre_estandar = 'AUTH - Bienvenida - Usuario - Todos',
  trigger_event = 'usuario_activado',
  destinatario_tipo = 'usuario',
  es_obsoleto = true
WHERE codigo = 'bienvenida';

UPDATE correo_tipos_notificacion SET
  modulo = 'AUTH',
  nombre_estandar = 'AUTH - Cuenta Activada - Usuario - Todos',
  trigger_event = 'usuario_activado',
  destinatario_tipo = 'usuario'
WHERE codigo = 'cuenta_activada';

UPDATE correo_tipos_notificacion SET
  modulo = 'AUTH',
  nombre_estandar = 'AUTH - Nuevo Usuario Pendiente - Admin/Gerente - Todos',
  trigger_event = 'usuario_creado_pendiente',
  destinatario_tipo = 'admin_gerente'
WHERE codigo = 'usuario_nuevo_pendiente';

UPDATE correo_tipos_notificacion SET
  modulo = 'AUTH',
  nombre_estandar = 'AUTH - Nuevo Usuario Creado - Admin - Todos',
  trigger_event = 'usuario_creado',
  destinatario_tipo = 'admin'
WHERE codigo = 'nuevo_usuario_creado';

UPDATE correo_tipos_notificacion SET
  modulo = 'AUTH',
  nombre_estandar = 'AUTH - Recuperación de Contraseña - Usuario - Correo',
  trigger_event = 'password_reset_solicitado',
  destinatario_tipo = 'usuario'
WHERE codigo = 'password_reset';

UPDATE correo_tipos_notificacion SET
  modulo = 'EDUCATION',
  nombre_estandar = 'EDUCATION - Nuevo Evento - Usuarios - Todos',
  trigger_event = 'evento_creado',
  destinatario_tipo = 'todos'
WHERE codigo = 'nuevo_evento';

UPDATE correo_tipos_notificacion SET
  modulo = 'EDUCATION',
  nombre_estandar = 'EDUCATION - Recordatorio Evento - Usuario - Todos',
  trigger_event = 'evento_proximo',
  destinatario_tipo = 'usuario'
WHERE codigo = 'recordatorio_evento';

UPDATE correo_tipos_notificacion SET
  modulo = 'EDUCATION',
  nombre_estandar = 'EDUCATION - Cancelación Evento - Usuarios - Todos',
  trigger_event = 'evento_cancelado',
  destinatario_tipo = 'todos'
WHERE codigo = 'cancelacion_evento';

UPDATE correo_tipos_notificacion SET
  modulo = 'COMUNICADOS',
  nombre_estandar = 'COMUNICADOS - Nuevo Comunicado - Destinatarios - Todos',
  trigger_event = 'comunicado_publicado',
  destinatario_tipo = 'destinatarios'
WHERE codigo = 'nuevo_comunicado';

UPDATE correo_tipos_notificacion SET
  modulo = 'TRAMITES',
  nombre_estandar = 'TRAMITES - Nuevo Trámite - Mesa Control - Todos',
  trigger_event = 'tramite_creado',
  destinatario_tipo = 'mesa_control'
WHERE codigo = 'nuevo_tramite';

UPDATE correo_tipos_notificacion SET
  modulo = 'TRAMITES',
  nombre_estandar = 'TRAMITES - Trámite Actualizado - Agente - Todos',
  trigger_event = 'tramite_actualizado',
  destinatario_tipo = 'agente'
WHERE codigo = 'tramite_actualizado';

UPDATE correo_tipos_notificacion SET
  modulo = 'TRAMITES',
  nombre_estandar = 'TRAMITES - Cambio de Estatus - Agente - Todos',
  trigger_event = 'tramite_estatus_cambiado',
  destinatario_tipo = 'agente'
WHERE codigo = 'tramite_cambio_estatus';

UPDATE correo_tipos_notificacion SET
  modulo = 'TRAMITES',
  nombre_estandar = 'TRAMITES - Nuevo Comentario - Involucrados - Todos',
  trigger_event = 'tramite_comentario_agregado',
  destinatario_tipo = 'involucrados'
WHERE codigo = 'tramite_comentario_nuevo';

UPDATE correo_tipos_notificacion SET
  modulo = 'TRAMITES',
  nombre_estandar = 'TRAMITES - Nuevo Documento - Involucrados - Todos',
  trigger_event = 'tramite_documento_subido',
  destinatario_tipo = 'involucrados'
WHERE codigo = 'tramite_documento_cargado';

UPDATE correo_tipos_notificacion SET
  modulo = 'COMISIONES',
  nombre_estandar = 'COMISIONES - Solicitud Corrección - Mesa Control - Todos',
  trigger_event = 'correccion_comision_solicitada',
  destinatario_tipo = 'mesa_control'
WHERE codigo = 'solicitud_correccion_comisiones';

UPDATE correo_tipos_notificacion SET
  modulo = 'COMISIONES',
  nombre_estandar = 'COMISIONES - Lote Cerrado - Agente - Todos',
  trigger_event = 'comision_lote_cerrado',
  destinatario_tipo = 'agente'
WHERE codigo = 'commission_batch_closed';

UPDATE correo_tipos_notificacion SET
  modulo = 'ESPACIO_JIRO',
  nombre_estandar = 'ESPACIO_JIRO - Confirmación Reserva - Usuario - Todos',
  trigger_event = 'reserva_confirmada',
  destinatario_tipo = 'usuario'
WHERE codigo = 'reserva_espacio';

UPDATE correo_tipos_notificacion SET
  modulo = 'STORE',
  nombre_estandar = 'STORE - Solicitud Compra - Mercadotecnia - Todos',
  trigger_event = 'pedido_creado',
  destinatario_tipo = 'mercadotecnia'
WHERE codigo = 'solicitud_compra_store';

UPDATE correo_tipos_notificacion SET
  modulo = 'RRHH',
  nombre_estandar = 'RRHH - Vacaciones Aprobadas - Usuario - Todos',
  trigger_event = 'vacaciones_aprobadas',
  destinatario_tipo = 'usuario'
WHERE codigo = 'vacaciones_aprobadas';

UPDATE correo_tipos_notificacion SET
  modulo = 'CRM',
  nombre_estandar = 'CRM - Cumpleaños Contacto - Agente - Todos',
  trigger_event = 'cumpleanos_contacto',
  destinatario_tipo = 'agente'
WHERE codigo = 'cumpleanos_contacto';

UPDATE correo_tipos_notificacion SET
  modulo = 'REGISTRO',
  nombre_estandar = 'REGISTRO - Nuevo Lead Registro - Admin - Todos',
  trigger_event = 'registro_no_usuario_enviado',
  destinatario_tipo = 'admin'
WHERE codigo = 'nuevo_registro_no_usuario';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - Notificación Individual - Usuario - Interna',
  trigger_event = 'manual',
  destinatario_tipo = 'usuario'
WHERE codigo = 'notificacion_individual';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - Notificación Interna - Usuario - Interna',
  trigger_event = 'manual',
  destinatario_tipo = 'usuario'
WHERE codigo = 'notificacion_interna';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - Notificación Personalizada - Variable - Todos',
  trigger_event = 'manual',
  destinatario_tipo = 'variable'
WHERE codigo = 'notificacion_personalizada';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - Email Directo - Variable - Correo',
  trigger_event = 'manual',
  destinatario_tipo = 'variable'
WHERE codigo = 'email_directo';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - WhatsApp Directo - Variable - WhatsApp',
  trigger_event = 'manual',
  destinatario_tipo = 'variable'
WHERE codigo = 'whatsapp_directo';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - Correo Transaccional - Variable - Correo',
  trigger_event = 'manual',
  destinatario_tipo = 'variable'
WHERE codigo = 'correo_transaccional';

UPDATE correo_tipos_notificacion SET
  modulo = 'SISTEMA',
  nombre_estandar = 'SISTEMA - WhatsApp Transaccional - Variable - WhatsApp',
  trigger_event = 'manual',
  destinatario_tipo = 'variable'
WHERE codigo = 'whatsapp_transaccional';

-- PASO 3: Insertar tipos faltantes por módulo
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo, enviar_correo, enviar_whatsapp, enviar_notificacion, modulo, nombre_estandar, trigger_event, destinatario_tipo)
VALUES
  -- AUTH
  ('password_changed', 'Contraseña Cambiada', 'Se notifica al usuario que su contraseña fue cambiada', true, true, false, true, 'AUTH', 'AUTH - Contraseña Cambiada - Usuario - Correo', 'password_cambiado', 'usuario'),
  ('cuenta_desactivada', 'Cuenta Desactivada', 'Se notifica al usuario que su cuenta fue desactivada', true, true, false, false, 'AUTH', 'AUTH - Cuenta Desactivada - Usuario - Correo', 'usuario_desactivado', 'usuario'),
  -- CRM
  ('crm_lead_asignado', 'Lead CRM Asignado', 'Se notifica al agente cuando se le asigna un lead', true, false, true, true, 'CRM', 'CRM - Lead Asignado - Agente - Todos', 'crm_lead_asignado', 'agente'),
  ('crm_tarea_vencida', 'Tarea CRM Vencida', 'Recordatorio de tarea vencida en CRM', true, false, true, true, 'CRM', 'CRM - Tarea Vencida - Agente - Todos', 'crm_tarea_vencida', 'agente'),
  ('web_lead_nuevo', 'Nuevo Lead Web', 'Lead generado desde la página web pública del agente', true, true, true, true, 'CRM', 'CRM - Nuevo Lead Web - Agente - Todos', 'web_lead_recibido', 'agente'),
  -- COMISIONES
  ('comisiones_lote_disponible', 'Lote de Comisiones Disponible', 'Se notifica al agente cuando tiene comisiones listas para revisar', true, true, true, true, 'COMISIONES', 'COMISIONES - Lote Disponible - Agente - Todos', 'comision_lote_disponible', 'agente'),
  ('comisiones_error_calculo', 'Error en Cálculo de Comisiones', 'Alerta al administrador sobre errores en el cálculo', true, true, false, true, 'COMISIONES', 'COMISIONES - Error Cálculo - Admin - Todos', 'comision_error_calculo', 'admin'),
  -- EDUCATION
  ('education_curso_completado', 'Curso Completado', 'Se notifica al usuario cuando completa un curso', true, false, false, true, 'EDUCATION', 'EDUCATION - Curso Completado - Usuario - Interna', 'curso_completado', 'usuario'),
  -- SICAS
  ('sicas_sync_exitoso', 'SICAS Sync Exitoso', 'Confirmación de sincronización exitosa con SICAS', true, false, false, true, 'SICAS', 'SICAS - Sync Exitoso - Admin - Interna', 'sicas_sync_completado', 'admin'),
  ('sicas_sync_fallido', 'SICAS Sync Fallido', 'Alerta de fallo en sincronización con SICAS', true, true, false, true, 'SICAS', 'SICAS - Sync Fallido - Admin - Todos', 'sicas_sync_fallido', 'admin'),
  ('sicas_sin_datos', 'SICAS Sin Datos', 'Alerta cuando SICAS no retorna datos para un agente', true, false, false, true, 'SICAS', 'SICAS - Sin Datos - Admin - Interna', 'sicas_sin_datos', 'admin'),
  -- ESPACIO JIRO
  ('reserva_espacio_solicitada', 'Reserva de Espacio Solicitada', 'Se notifica al administrador de espacio cuando hay una nueva solicitud', true, false, false, true, 'ESPACIO_JIRO', 'ESPACIO_JIRO - Reserva Solicitada - Admin Espacio - Interna', 'reserva_espacio_creada', 'admin_espacio'),
  ('reserva_espacio_rechazada', 'Reserva de Espacio Rechazada', 'Se notifica al usuario cuando su reserva es rechazada', true, false, false, true, 'ESPACIO_JIRO', 'ESPACIO_JIRO - Reserva Rechazada - Usuario - Interna', 'reserva_espacio_rechazada', 'usuario'),
  -- TRAMITES
  ('renovacion_proxima', 'Renovación de Póliza Próxima', 'Recordatorio de renovación próxima para el agente', true, false, true, true, 'TRAMITES', 'TRAMITES - Renovación Próxima - Agente - Todos', 'renovacion_proxima_30_dias', 'agente')
ON CONFLICT (codigo) DO NOTHING;

-- PASO 4: Crear plantillas por defecto para los tipos que no tienen plantilla
-- Helper: obtener id de tipo por codigo
DO $$
DECLARE
  v_tipo_id uuid;
  v_codigos text[] := ARRAY[
    'password_changed',
    'cuenta_desactivada',
    'crm_lead_asignado',
    'crm_tarea_vencida',
    'web_lead_nuevo',
    'comisiones_lote_disponible',
    'comisiones_error_calculo',
    'education_curso_completado',
    'sicas_sync_exitoso',
    'sicas_sync_fallido',
    'sicas_sin_datos',
    'reserva_espacio_solicitada',
    'reserva_espacio_rechazada',
    'renovacion_proxima'
  ];
  v_codigo text;
  v_nombre text;
BEGIN
  FOREACH v_codigo IN ARRAY v_codigos LOOP
    SELECT id, nombre INTO v_tipo_id, v_nombre
    FROM correo_tipos_notificacion
    WHERE codigo = v_codigo;

    IF v_tipo_id IS NOT NULL THEN
      INSERT INTO correo_plantillas (
        tipo_notificacion_id,
        asunto,
        html_cuerpo,
        whatsapp_plantilla,
        notificacion_titulo,
        notificacion_cuerpo,
        enviar_correo,
        enviar_whatsapp,
        enviar_notificacion,
        es_plantilla_default
      )
      SELECT
        v_tipo_id,
        v_nombre || ' - MOVI Digital',
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1)}.header{background:#1a56db;padding:30px;text-align:center}.header h1{color:#ffffff;margin:0;font-size:22px}.body{padding:30px}.greeting{font-size:16px;color:#333;margin-bottom:15px}.content{font-size:14px;color:#555;line-height:1.6}.footer{background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}</style></head><body><div class="container"><div class="header"><h1>MOVI Digital</h1></div><div class="body"><p class="greeting">Hola {{nombre}},</p><div class="content"><p>{{mensaje}}</p></div></div><div class="footer"><p>Este correo fue enviado automáticamente por MOVI Digital. Por favor no respondas a este mensaje.</p></div></div></body></html>',
        '🔔 *' || v_nombre || '*' || chr(10) || chr(10) || 'Hola {{nombre}},' || chr(10) || chr(10) || '{{mensaje}}' || chr(10) || chr(10) || '_MOVI Digital_',
        v_nombre,
        '{{mensaje}}',
        ctn.enviar_correo,
        ctn.enviar_whatsapp,
        ctn.enviar_notificacion,
        true
      FROM correo_tipos_notificacion ctn
      WHERE ctn.id = v_tipo_id
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- PASO 5: Migrar plantilla de commission_batch_closed_agent a comisiones_lote_disponible
-- Solo si existe en transactional_notification_templates
DO $$
DECLARE
  v_tipo_id uuid;
  v_has_plantilla boolean;
BEGIN
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'comisiones_lote_disponible';

  IF v_tipo_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id
    ) INTO v_has_plantilla;

    -- Si la tabla transactional_notification_templates existe y tiene datos, migrar
    IF NOT v_has_plantilla AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'transactional_notification_templates'
    ) THEN
      INSERT INTO correo_plantillas (
        tipo_notificacion_id,
        asunto,
        html_cuerpo,
        whatsapp_plantilla,
        notificacion_titulo,
        notificacion_cuerpo,
        enviar_correo,
        enviar_whatsapp,
        enviar_notificacion,
        es_plantilla_default
      )
      SELECT
        v_tipo_id,
        COALESCE(subject_template, 'Tus comisiones están disponibles - MOVI Digital'),
        COALESCE(
          email_html_template,
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden}.header{background:#1a56db;padding:30px;text-align:center}.header h1{color:#ffffff;margin:0;font-size:22px}.body{padding:30px}.footer{background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#999}</style></head><body><div class="container"><div class="header"><h1>MOVI Digital</h1></div><div class="body"><p>Hola {{nombre}},</p><p>Tu lote de comisiones está disponible para revisión. Accede a la plataforma para ver el detalle de tus comisiones del período <strong>{{periodo}}</strong>.</p><p><strong>Total Comisiones:</strong> {{total_comisiones}}<br><strong>Comisión Neta:</strong> {{comision_neta}}</p></div><div class="footer"><p>MOVI Digital - Sistema de Gestión de Seguros</p></div></div></body></html>'
        ),
        COALESCE(
          whatsapp_template,
          '💰 *Comisiones Disponibles*' || chr(10) || chr(10) || 'Hola {{nombre}},' || chr(10) || chr(10) || 'Tu lote de comisiones del período *{{periodo}}* está disponible.' || chr(10) || chr(10) || '💵 Comisión Neta: *{{comision_neta}}*' || chr(10) || chr(10) || 'Revísalo en: app.movidigital.mx' || chr(10) || chr(10) || '_MOVI Digital_'
        ),
        'Comisiones Disponibles',
        'Tu lote de comisiones del período {{periodo}} está disponible',
        true,
        true,
        true,
        true
      FROM transactional_notification_templates
      WHERE event_code = 'commission_batch_closed_agent'
      LIMIT 1;
    END IF;
  END IF;
END $$;

-- PASO 6: Crear índices para búsqueda por módulo
CREATE INDEX IF NOT EXISTS idx_correo_tipos_notificacion_modulo
  ON correo_tipos_notificacion(modulo);

CREATE INDEX IF NOT EXISTS idx_correo_tipos_notificacion_es_obsoleto
  ON correo_tipos_notificacion(es_obsoleto);

-- PASO 7: Crear vista unificada del catálogo
CREATE OR REPLACE VIEW v_catalogo_notificaciones AS
SELECT
  ctn.id,
  ctn.codigo,
  ctn.nombre,
  ctn.descripcion,
  ctn.modulo,
  COALESCE(ctn.nombre_estandar, ctn.nombre) AS nombre_estandar,
  ctn.trigger_event,
  ctn.destinatario_tipo,
  ctn.activo,
  ctn.es_obsoleto,
  ctn.enviar_correo,
  ctn.enviar_whatsapp,
  ctn.enviar_notificacion,
  ctn.created_at,
  CASE WHEN cp.id IS NOT NULL THEN true ELSE false END AS tiene_plantilla,
  cp.asunto AS plantilla_asunto,
  cp.id AS plantilla_id
FROM correo_tipos_notificacion ctn
LEFT JOIN correo_plantillas cp ON cp.tipo_notificacion_id = ctn.id AND cp.es_plantilla_default = true
ORDER BY ctn.modulo, ctn.nombre;

-- Dar acceso a la vista a roles autenticados
GRANT SELECT ON v_catalogo_notificaciones TO authenticated;
GRANT SELECT ON v_catalogo_notificaciones TO service_role;
