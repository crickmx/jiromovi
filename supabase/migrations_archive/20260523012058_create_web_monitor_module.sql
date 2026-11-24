/*
  # Create Web Page Monitor Module

  1. New Tables
    - `monitored_sites` - Stores registered websites with their latest check results
    - `site_history` - Historical log of all check results
    - `status_changes` - Records state transitions for alerting

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read
    - Admin/gerente roles can manage
    - Service role has full access (for edge functions)

  3. Indexes for performance

  4. Notification trigger on status changes to notify ccjimenez@jiro.com.mx
*/

-- monitored_sites table
CREATE TABLE IF NOT EXISTS monitored_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_check timestamptz,
  last_status text DEFAULT 'PENDIENTE',
  last_http_code integer,
  last_response_time integer,
  last_ssl_status text,
  last_ssl_valid_to timestamptz,
  last_diagnosis text,
  previous_status text,
  previous_ssl_status text,
  previous_http_code integer,
  status_changed_at timestamptz,
  ssl_changed_at timestamptz
);

ALTER TABLE monitored_sites ENABLE ROW LEVEL SECURITY;

-- site_history table
CREATE TABLE IF NOT EXISTS site_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES monitored_sites(id) ON DELETE CASCADE,
  checked_at timestamptz DEFAULT now(),
  status text,
  http_code integer,
  response_time integer,
  ssl_status text,
  diagnosis text
);

ALTER TABLE site_history ENABLE ROW LEVEL SECURITY;

-- status_changes table
CREATE TABLE IF NOT EXISTS status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES monitored_sites(id) ON DELETE CASCADE,
  url text NOT NULL,
  change_type text NOT NULL DEFAULT 'status',
  old_value text,
  new_value text,
  detected_at timestamptz DEFAULT now()
);

ALTER TABLE status_changes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_history_site_checked
  ON site_history(site_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_changes_detected_at
  ON status_changes(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitored_sites_last_status
  ON monitored_sites(last_status);

-- RLS Policies for monitored_sites
CREATE POLICY "Authenticated users can view monitored sites"
  ON monitored_sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and gerente can insert monitored sites"
  ON monitored_sites FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  );

CREATE POLICY "Admin and gerente can update monitored sites"
  ON monitored_sites FOR UPDATE
  TO authenticated
  USING (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  )
  WITH CHECK (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  );

CREATE POLICY "Admin and gerente can delete monitored sites"
  ON monitored_sites FOR DELETE
  TO authenticated
  USING (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  );

-- RLS Policies for site_history
CREATE POLICY "Authenticated users can view site history"
  ON site_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and gerente can insert site history"
  ON site_history FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  );

-- RLS Policies for status_changes
CREATE POLICY "Authenticated users can view status changes"
  ON status_changes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and gerente can insert status changes"
  ON status_changes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (raw_app_meta_data->>'rol')::text FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'gerente', 'Admin', 'Gerente')
  );

-- Service role full access for edge functions
CREATE POLICY "Service role full access monitored_sites"
  ON monitored_sites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access site_history"
  ON site_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access status_changes"
  ON status_changes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create notification type for web monitor state changes
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, modulo, activo)
VALUES (
  'web_monitor_status_change',
  'Cambio de Estado en Monitor Web',
  'Se dispara cuando un sitio monitoreado cambia de estado (OK, ADVERTENCIA, CRITICO)',
  'admin_digital',
  true
)
ON CONFLICT (codigo) DO NOTHING;

-- Create email template for web monitor notifications
INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default
)
SELECT
  id,
  'Alerta Monitor Web: {{url}} cambio a {{new_status}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1e293b;">Cambio de Estado Detectado</h2>
    <p style="color: #475569;">El sitio web <strong>{{url}}</strong> ha cambiado de estado:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Sitio</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{{url}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Estado Anterior</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{{old_status}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Estado Actual</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{{new_status}}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Tipo de Cambio</td><td style="padding: 8px; border: 1px solid #e2e8f0;">{{change_type}}</td></tr>
    </table>
    <p style="color: #64748b; font-size: 12px;">Mensaje generado automaticamente por el Monitor Web de Admin Digital.</p>
  </div>',
  'Alerta Monitor Web: {{url}} cambio de {{old_status}} a {{new_status}} ({{change_type}})',
  true,
  true,
  true,
  true
FROM correo_tipos_notificacion
WHERE codigo = 'web_monitor_status_change'
ON CONFLICT DO NOTHING;

-- Function to notify on status change
CREATE OR REPLACE FUNCTION notify_web_monitor_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  SELECT id INTO v_target_user_id
  FROM usuarios
  WHERE email_laboral = 'ccjimenez@jiro.com.mx'
  AND deleted_at IS NULL
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM enviar_notificacion_transaccional(
    'web_monitor_status_change',
    v_target_user_id,
    jsonb_build_object(
      'url', NEW.url,
      'change_type', NEW.change_type,
      'old_status', COALESCE(NEW.old_value, 'N/A'),
      'new_status', COALESCE(NEW.new_value, 'N/A')
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on status_changes INSERT
CREATE TRIGGER trg_notify_web_monitor_status_change
  AFTER INSERT ON status_changes
  FOR EACH ROW
  EXECUTE FUNCTION notify_web_monitor_status_change();
