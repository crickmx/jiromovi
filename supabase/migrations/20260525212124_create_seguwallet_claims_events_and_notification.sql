/*
  # SeguWallet Claims Events - Notification System

  1. New Tables
    - `seguwallet_claims_events`
      - Logs every siniestros button click by a SeguWallet customer
      - Fields: customer, agent, insurer, event_type, source, notification flags

  2. Notification Setup
    - Inserts tipo_notificacion "seguwallet_siniestro_click"
    - Inserts correo_plantilla with bell + WhatsApp content

  3. Security
    - RLS: authenticated users can insert; agents/admins can select
*/

-- ─── Claims Events Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguwallet_claims_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguwallet_customer_id uuid REFERENCES seguwallet_customers(id) ON DELETE SET NULL,
  agent_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  insurer_id uuid REFERENCES seguwallet_insurers(id) ON DELETE SET NULL,
  insurer_name text NOT NULL DEFAULT '',
  claims_phone text,
  event_type text NOT NULL DEFAULT 'call' CHECK (event_type IN ('call', 'whatsapp', 'view')),
  source text NOT NULL DEFAULT 'modal' CHECK (source IN ('modal', 'directory', 'dashboard')),
  bell_notification_sent boolean DEFAULT false,
  whatsapp_notification_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE seguwallet_claims_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_seguwallet_claims_events_customer ON seguwallet_claims_events(seguwallet_customer_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_claims_events_agent ON seguwallet_claims_events(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_claims_events_created ON seguwallet_claims_events(created_at DESC);

CREATE POLICY "Authenticated users can insert claims events"
  ON seguwallet_claims_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can view their claims events"
  ON seguwallet_claims_events
  FOR SELECT
  TO authenticated
  USING (
    agent_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('admin', 'superadmin')
      AND u.deleted_at IS NULL
    )
  );

-- ─── Notification Type ────────────────────────────────────────────────────────
INSERT INTO correo_tipos_notificacion (
  codigo, nombre, descripcion, activo,
  permite_destinatarios_custom,
  enviar_correo, enviar_whatsapp, enviar_notificacion,
  modulo, nombre_estandar, trigger_event, destinatario_tipo
) VALUES (
  'seguwallet_siniestro_click',
  'SeguWallet - Alerta siniestro cliente',
  'Notifica al agente cuando su cliente de SeguWallet hace clic en el boton de reportar siniestro.',
  true, false,
  false, true, true,
  'seguwallet', 'seguwallet_siniestro_click', 'siniestro_click', 'agente'
)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Notification Template ────────────────────────────────────────────────────
DO $$
DECLARE
  v_tipo_id uuid;
BEGIN
  SELECT id INTO v_tipo_id FROM correo_tipos_notificacion WHERE codigo = 'seguwallet_siniestro_click';

  IF v_tipo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id
  ) THEN
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
      enviar_correo, enviar_whatsapp, enviar_notificacion,
      es_plantilla_default
    ) VALUES (
      v_tipo_id,
      'Tu cliente {{cliente_nombre}} contacto siniestros de {{aseguradora_nombre}}',
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;}.card{background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;border-left:4px solid #dc2626;}.badge{display:inline-block;background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;margin-bottom:16px;}h2{color:#111;margin:0 0 16px;}.field{margin:8px 0;font-size:14px;color:#555;}.field strong{color:#111;}.tip{margin-top:16px;padding:12px;background:#fff7ed;border-radius:8px;font-size:13px;color:#92400e;}.footer{margin-top:20px;font-size:11px;color:#aaa;}</style></head><body><div class="card"><div class="badge">Alerta de Siniestro</div><h2>Tu cliente reporto un siniestro</h2><div class="field"><strong>Cliente:</strong> {{cliente_nombre}}</div><div class="field"><strong>Aseguradora:</strong> {{aseguradora_nombre}}</div><div class="field"><strong>Telefono de siniestros:</strong> {{telefono_siniestros}}</div><div class="field"><strong>Tipo de contacto:</strong> {{tipo_contacto}}</div><div class="field"><strong>Fecha y hora:</strong> {{fecha_hora}}</div><div class="tip">Te recomendamos dar seguimiento con tu cliente para asegurarte de que recibio la atencion necesaria.</div><div class="footer">Notificacion automatica de SeguWallet</div></div></body></html>',
      'Tu cliente *{{cliente_nombre}}* contacto siniestros de *{{aseguradora_nombre}}* ({{tipo_contacto}}) al {{telefono_siniestros}} el {{fecha_hora}}. Puedes dar seguimiento desde SeguWallet.',
      'Alerta de siniestro - SeguWallet',
      'Tu cliente {{cliente_nombre}} contacto siniestros de {{aseguradora_nombre}} ({{tipo_contacto}})',
      ARRAY['cliente_nombre', 'aseguradora_nombre', 'telefono_siniestros', 'tipo_contacto', 'fecha_hora'],
      ARRAY['cliente_nombre', 'aseguradora_nombre', 'telefono_siniestros', 'tipo_contacto', 'fecha_hora'],
      ARRAY['cliente_nombre', 'aseguradora_nombre', 'tipo_contacto'],
      false, true, true,
      true
    );
  END IF;
END $$;
