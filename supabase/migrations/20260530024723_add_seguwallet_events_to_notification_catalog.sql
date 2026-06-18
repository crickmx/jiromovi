/*
  # Add Seguwallet events to notification_events_catalog

  The notify() RPC uses this table to resolve in-app bell and WhatsApp templates.
  Adding all Seguwallet event codes so the dispatcher can process them.

  Events added:
  - seguwallet_bienvenida     — agent campanita when new customer activated
  - seguwallet_siniestro_click — agent campanita + WhatsApp when customer clicks siniestro
  - seguwallet_poliza_externa_cargada — agent campanita + WhatsApp when external policy uploaded
  - seguwallet_perfil_completado — agent campanita when customer completes profile
  - seguwallet_terminos_aceptados — agent campanita when customer accepts terms
  - seguwallet_492_documento_cargado — agent campanita + WhatsApp when 492 doc uploaded
*/

INSERT INTO notification_events_catalog
  (event_code, event_name, module, description, enable_in_app, enable_email, enable_whatsapp,
   template_in_app, template_whatsapp, priority, active)
VALUES
  (
    'seguwallet_bienvenida',
    'SeguWallet — Nuevo cliente activado',
    'seguwallet',
    'Notifica al agente cuando un nuevo cliente es activado en Seguwallet.',
    true, false, false,
    '{"title":"Nuevo cliente activado - SeguWallet","body":"Tu cliente {{nombre_cliente}} fue activado en SeguWallet."}',
    NULL,
    'normal', true
  ),
  (
    'seguwallet_siniestro_click',
    'SeguWallet — Alerta siniestro cliente',
    'seguwallet',
    'Notifica al agente cuando su cliente hace clic en reportar siniestro.',
    true, false, true,
    '{"title":"Alerta siniestro - SeguWallet","body":"Tu cliente {{cliente_nombre}} contactó siniestros de {{aseguradora_nombre}} ({{tipo_contacto}})"}',
    '{"text":"Tu cliente *{{cliente_nombre}}* contactó a siniestros de *{{aseguradora_nombre}}* el {{fecha_hora}} desde SeguWallet."}',
    'high', true
  ),
  (
    'seguwallet_poliza_externa_cargada',
    'SeguWallet — Nueva póliza externa cargada',
    'seguwallet',
    'Notifica al agente cuando su cliente carga una póliza externa.',
    true, false, true,
    '{"title":"Nueva póliza externa - SeguWallet","body":"Tu cliente {{cliente_nombre}} cargó una póliza de {{aseguradora}} ({{ramo}})"}',
    '{"text":"Hola {{agente_nombre}}, tu cliente *{{cliente_nombre}}* acabo de cargar una poliza externa en SeguWallet.\n\nAseguradora: {{aseguradora}}\nTipo de seguro: {{ramo}}\nPoliza: {{numero_poliza}}\n\nPuedes revisarla desde tu panel de Seguwallet."}',
    'normal', true
  ),
  (
    'seguwallet_perfil_completado',
    'SeguWallet — Perfil completado',
    'seguwallet',
    'Notifica al agente cuando su cliente completa su perfil.',
    true, false, false,
    '{"title":"Perfil completado - SeguWallet","body":"Tu cliente {{cliente_nombre}} completó su perfil en SeguWallet."}',
    NULL,
    'low', true
  ),
  (
    'seguwallet_terminos_aceptados',
    'SeguWallet — Términos aceptados',
    'seguwallet',
    'Notifica al agente cuando su cliente acepta los términos.',
    true, false, false,
    '{"title":"Términos aceptados - SeguWallet","body":"Tu cliente {{cliente_nombre}} aceptó los términos y condiciones."}',
    NULL,
    'low', true
  ),
  (
    'seguwallet_492_documento_cargado',
    'SeguWallet — Documento 492 cargado',
    'seguwallet',
    'Notifica al agente cuando su cliente carga un documento en el Expediente 492.',
    true, false, true,
    '{"title":"Documento 492 cargado - SeguWallet","body":"Tu cliente {{cliente_nombre}} cargó: {{nombre_documento}}"}',
    '{"text":"Tu cliente *{{cliente_nombre}}* cargó un documento en su Expediente 492 en SeguWallet: {{nombre_documento}}"}',
    'normal', true
  )
ON CONFLICT (event_code) DO UPDATE SET
  event_name    = EXCLUDED.event_name,
  module        = EXCLUDED.module,
  description   = EXCLUDED.description,
  enable_in_app = EXCLUDED.enable_in_app,
  enable_whatsapp = EXCLUDED.enable_whatsapp,
  template_in_app = EXCLUDED.template_in_app,
  template_whatsapp = EXCLUDED.template_whatsapp,
  priority      = EXCLUDED.priority,
  active        = EXCLUDED.active,
  updated_at    = now();
