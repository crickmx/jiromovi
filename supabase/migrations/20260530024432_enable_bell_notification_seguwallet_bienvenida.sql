/*
  # Enable in-app notification on seguwallet_bienvenida template

  Adds notificacion_titulo, notificacion_cuerpo and sets enviar_notificacion=true
  on the seguwallet_bienvenida default template so the agent gets a campanita
  when a new customer is activated.
*/
UPDATE correo_plantillas SET
  enviar_notificacion = true,
  notificacion_titulo = 'Nuevo cliente activado - SeguWallet',
  notificacion_cuerpo = 'Tu cliente {{nombre_cliente}} fue activado en SeguWallet.',
  notificacion_variables_disponibles = ARRAY['nombre_cliente','nombre_agente','nombre_oficina']
WHERE tipo_notificacion_id = (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'seguwallet_bienvenida'
)
AND es_plantilla_default = true;
