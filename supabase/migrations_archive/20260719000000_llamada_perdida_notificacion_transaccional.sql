/*
  # Llamada perdida como tipo de notificación transaccional editable

  Registra "llamada_perdida" en el catálogo de Notificaciones Transaccionales
  (correo_tipos_notificacion + correo_plantillas) para que el Admin pueda
  editar el título/cuerpo de la campanita, y activar/desactivarla, desde
  /notificaciones-transaccionales — sin tocar código.

  - Tipo "Automática" (permite_destinatarios_custom = false): va siempre a
    quien recibió la llamada, no a una lista fija.
  - Solo canal "campanita" activo por ahora (enviar_correo/enviar_whatsapp
    en false tanto en el tipo como en la plantilla — el RPC
    enviar_notificacion_transaccional lee los canales desde la plantilla,
    no desde el tipo, así que hay que ponerlos en false en las dos tablas).
  - El envío real de la campanita lo sigue haciendo telefonia-cdr-poll
    directo a `notificaciones` (leyendo esta plantilla y sustituyendo
    variables) — el canal "in_app" del pipeline de notification_jobs no
    inserta nada en `notificaciones` todavía (gap preexistente, no se toca
    aquí).
*/

DO $$
DECLARE
  v_tipo_id uuid;
BEGIN
  INSERT INTO correo_tipos_notificacion (
    codigo, nombre, descripcion, activo, es_personalizada,
    permite_destinatarios_custom, enviar_correo, enviar_whatsapp,
    enviar_notificacion, modulo, destinatario_tipo, platform
  ) VALUES (
    'llamada_perdida',
    'Llamada perdida',
    'Aviso cuando el conmutador (Yeastar) marca una llamada como perdida en la extensión de un usuario.',
    true, false, false, false, false, true,
    'TELEFONIA', 'usuario', 'movi'
  )
  ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_tipo_id;

  IF v_tipo_id IS NULL THEN
    SELECT id INTO v_tipo_id FROM correo_tipos_notificacion WHERE codigo = 'llamada_perdida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id
  ) THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id, asunto, html_cuerpo, whatsapp_plantilla,
      notificacion_titulo, notificacion_cuerpo,
      variables_disponibles, whatsapp_variables_disponibles, notificacion_variables_disponibles,
      es_plantilla_default, enviar_correo, enviar_whatsapp, enviar_notificacion
    ) VALUES (
      v_tipo_id,
      'Llamada perdida de {{caller_display}}',
      '<h2>Llamada perdida</h2><p>Tuviste una llamada perdida en tu extensión {{extension}} de {{caller_display}}.</p>',
      'Llamada perdida en tu extensión {{extension}} de {{caller_display}}.',
      'Llamada perdida',
      'Llamada perdida en tu extensión {{extension}} de {{caller_display}}',
      ARRAY['{{extension}}', '{{caller_number}}', '{{caller_name}}', '{{caller_display}}'],
      ARRAY['{{extension}}', '{{caller_number}}', '{{caller_name}}', '{{caller_display}}'],
      ARRAY['{{extension}}', '{{caller_number}}', '{{caller_name}}', '{{caller_display}}'],
      true, false, false, true
    );
  END IF;
END $$;
