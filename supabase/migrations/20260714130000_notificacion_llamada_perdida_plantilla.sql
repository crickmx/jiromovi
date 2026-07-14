/*
  # Plantilla configurable para notificaciones de llamada perdida

  Registra el tipo "llamada_perdida" en el motor existente de notificaciones
  transaccionales (`correo_tipos_notificacion` / `correo_plantillas`), el mismo
  que ya administra /admin/transaccionales (TiposNotificaciones.tsx /
  EditarPlantillaModal.tsx) y que ya envía WhatsApp vía Wazzup24
  (notification_channels / whatsapp_configuracion).

  No se crea una tabla ni un canal de WhatsApp nuevos: se reutiliza el motor
  ya construido para no duplicar infraestructura.

  Variables disponibles: {{caller_name}}, {{caller_phone}}, {{caller_phone_10}},
  {{nombre_usuario}}, {{extension}}.

  Si esta fila no existe (por ejemplo en un ambiente donde no se ha corrido
  esta migración), el edge function `telefonia-missed-calls` cae de regreso a
  los textos hardcodeados actuales.
*/

INSERT INTO correo_tipos_notificacion (
  codigo, nombre, descripcion, modulo, nombre_estandar, trigger_event,
  destinatario_tipo, activo, enviar_correo, enviar_whatsapp, enviar_notificacion,
  permite_destinatarios_custom
)
VALUES (
  'llamada_perdida',
  'Llamada Perdida',
  'Se dispara cuando un usuario recibe una llamada perdida en su extensión de Telefonía',
  'TELEFONIA',
  'TELEFONIA - Llamada Perdida - Usuario - Todos',
  'llamada_perdida_recibida',
  'usuario',
  true,
  false,
  false,
  true,
  false
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default
)
SELECT
  ctn.id,
  'Llamada perdida de {{caller_name}}',
  '<p>Hola {{nombre_usuario}}, perdiste una llamada de <strong>{{caller_name}}</strong> ({{caller_phone_10}}).</p>',
  'Hola {{nombre_usuario}}, perdiste una llamada de {{caller_name}} al número {{caller_phone_10}}',
  'Llamada perdida',
  'Llamada perdida de {{caller_name}} ({{caller_phone_10}})',
  ARRAY['{{caller_name}}', '{{caller_phone}}', '{{caller_phone_10}}', '{{nombre_usuario}}', '{{extension}}'],
  ARRAY['{{caller_name}}', '{{caller_phone}}', '{{caller_phone_10}}', '{{nombre_usuario}}', '{{extension}}'],
  ARRAY['{{caller_name}}', '{{caller_phone}}', '{{caller_phone_10}}', '{{nombre_usuario}}', '{{extension}}'],
  false,
  false,
  true,
  true
FROM correo_tipos_notificacion ctn
WHERE ctn.codigo = 'llamada_perdida'
AND NOT EXISTS (
  SELECT 1 FROM correo_plantillas cp WHERE cp.tipo_notificacion_id = ctn.id
);
