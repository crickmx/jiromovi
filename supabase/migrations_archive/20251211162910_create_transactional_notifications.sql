/*
  # Sistema de Notificaciones Transaccionales

  1. Nuevas Tablas
    - `transactional_notification_templates`: Plantillas configurables para notificaciones automáticas
      - `id` (uuid, PK)
      - `event_key` (text, unique): Identificador del evento
      - `name` (text): Nombre descriptivo de la plantilla
      - `email_subject_template` (text, nullable): Plantilla del asunto del correo
      - `email_body_template` (text, nullable): Plantilla del cuerpo del correo (HTML)
      - `whatsapp_body_template` (text, nullable): Plantilla para mensaje de WhatsApp
      - `inapp_title_template` (text, nullable): Plantilla del título de notificación interna
      - `inapp_body_template` (text, nullable): Plantilla del cuerpo de notificación interna
      - `is_active` (boolean): Si la plantilla está activa
      - `created_at`, `updated_at`

    - `notifications`: Notificaciones internas (campanita) por usuario
      - `id` (uuid, PK)
      - `user_id` (uuid, FK a usuarios)
      - `title` (text): Título de la notificación
      - `body` (text): Cuerpo de la notificación
      - `link_url` (text, nullable): URL a donde navegar al hacer clic
      - `is_read` (boolean): Si ya fue leída
      - `created_at`

  2. Security
    - RLS habilitado en ambas tablas
    - Administradores pueden gestionar plantillas
    - Usuarios solo pueden ver sus propias notificaciones
    - Service role puede crear notificaciones
*/

-- Crear tabla de plantillas de notificaciones transaccionales
CREATE TABLE IF NOT EXISTS transactional_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  name text NOT NULL,
  email_subject_template text,
  email_body_template text,
  whatsapp_body_template text,
  inapp_title_template text,
  inapp_body_template text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de notificaciones internas
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_transactional_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transactional_notification_templates_updated_at
  BEFORE UPDATE ON transactional_notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_transactional_notification_templates_updated_at();

-- Habilitar RLS
ALTER TABLE transactional_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para transactional_notification_templates
CREATE POLICY "Admins can view all templates"
  ON transactional_notification_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert templates"
  ON transactional_notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update templates"
  ON transactional_notification_templates FOR UPDATE
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

CREATE POLICY "Service role can read templates"
  ON transactional_notification_templates FOR SELECT
  TO service_role
  USING (true);

-- Políticas para notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select notifications"
  ON notifications FOR SELECT
  TO service_role
  USING (true);

-- Insertar plantilla por defecto para cierre de lote de comisiones
INSERT INTO transactional_notification_templates (
  event_key,
  name,
  email_subject_template,
  email_body_template,
  whatsapp_body_template,
  inapp_title_template,
  inapp_body_template,
  is_active
) VALUES (
  'commission_batch_closed_agent',
  'Lote de comisiones cerrado - Notificación a agente',
  'Tus comisiones de la semana {{week_number}} ya están listas',
  '<p>Hola <strong>{{agent_name}}</strong>,</p>
<br>
<p>Te informamos que tus comisiones de la <strong>semana {{week_number}}</strong> (periodo del <strong>{{period_start}}</strong> al <strong>{{period_end}}</strong>) han sido calculadas.</p>
<br>
<p><strong>Total de comisiones netas:</strong> ${{net_commission_total}} MXN</p>
<br>
<p>Puedes consultar el detalle y descargar tu Orden de Pago en el siguiente enlace:</p>
<p><a href="{{orden_de_pago_url}}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Descargar Orden de Pago</a></p>
<br>
<p>Atentamente,<br>
Equipo de Comisiones</p>',
  'Hola {{agent_name}} 👋

Tus comisiones de la semana {{week_number}} ({{period_start}} a {{period_end}}) ya están listas.

Total neto: ${{net_commission_total}} MXN

Puedes ver el detalle y descargar tu Orden de Pago aquí:
{{orden_de_pago_url}}',
  'Comisiones semana {{week_number}} listas',
  'Tus comisiones del periodo {{period_start}} al {{period_end}} ya están disponibles. Total neto: ${{net_commission_total}} MXN. Haz clic para ver tu Orden de Pago.',
  true
) ON CONFLICT (event_key) DO NOTHING;