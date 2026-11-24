/*
  # Create Email Center Schema

  1. New Tables
    - `plantillas_correo` (Email Templates)
      - `id` (uuid, primary key)
      - `nombre` (text) - Template name
      - `tipo` (text) - Type: bienvenida, actualizacion_password, cumpleanos, aniversario
      - `asunto` (text) - Email subject with placeholders
      - `cuerpo_html` (text) - HTML body with placeholders
      - `activo` (boolean) - Whether template is active
      - `envio_automatico` (boolean) - Enable automatic sending
      - `hora_envio` (time) - Time to send automatic emails
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `historial_correos` (Email History)
      - `id` (uuid, primary key)
      - `plantilla_id` (uuid, foreign key) - Reference to template
      - `destinatario_id` (uuid, foreign key) - Reference to user
      - `destinatario_email` (text) - Recipient email
      - `asunto` (text) - Email subject sent
      - `cuerpo_html` (text) - HTML body sent
      - `tipo_envio` (text) - manual or automatico
      - `estado` (text) - enviado, fallido, pendiente
      - `error_mensaje` (text) - Error message if failed
      - `enviado_por_id` (uuid) - User who sent (for manual sends)
      - `fecha_envio` (timestamptz) - When it was sent
      - `created_at` (timestamptz)

    - `envios_automaticos_log` (Automatic Sends Log)
      - `id` (uuid, primary key)
      - `usuario_id` (uuid) - User who received
      - `tipo` (text) - cumpleanos or aniversario
      - `anio` (integer) - Year when sent
      - `fecha_envio` (date) - Date sent
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only authenticated admin/gerente users can manage templates
    - All authenticated users can view email history (filtered by role)

  3. Indexes
    - Index on plantilla tipo and activo
    - Index on historial estado and fecha_envio
    - Index on envios_automaticos_log for duplicate prevention
*/

-- Create plantillas_correo table
CREATE TABLE IF NOT EXISTS plantillas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('bienvenida', 'actualizacion_password', 'cumpleanos', 'aniversario')),
  asunto text NOT NULL,
  cuerpo_html text NOT NULL,
  activo boolean DEFAULT true,
  envio_automatico boolean DEFAULT false,
  hora_envio time DEFAULT '08:00:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create historial_correos table
CREATE TABLE IF NOT EXISTS historial_correos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid REFERENCES plantillas_correo(id) ON DELETE SET NULL,
  destinatario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_email text NOT NULL,
  asunto text NOT NULL,
  cuerpo_html text NOT NULL,
  tipo_envio text NOT NULL CHECK (tipo_envio IN ('manual', 'automatico')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('enviado', 'fallido', 'pendiente')),
  error_mensaje text,
  enviado_por_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_envio timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create envios_automaticos_log table
CREATE TABLE IF NOT EXISTS envios_automaticos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('cumpleanos', 'aniversario')),
  anio integer NOT NULL,
  fecha_envio date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, tipo, anio)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo_activo ON plantillas_correo(tipo, activo);
CREATE INDEX IF NOT EXISTS idx_historial_estado_fecha ON historial_correos(estado, fecha_envio DESC);
CREATE INDEX IF NOT EXISTS idx_envios_log_lookup ON envios_automaticos_log(usuario_id, tipo, anio);

-- Enable RLS
ALTER TABLE plantillas_correo ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_correos ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios_automaticos_log ENABLE ROW LEVEL SECURITY;

-- Policies for plantillas_correo
CREATE POLICY "Admins and Gerentes can view templates"
  ON plantillas_correo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can insert templates"
  ON plantillas_correo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can update templates"
  ON plantillas_correo FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can delete templates"
  ON plantillas_correo FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Policies for historial_correos
CREATE POLICY "Admins and Gerentes can view all email history"
  ON historial_correos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can insert email history"
  ON historial_correos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Policies for envios_automaticos_log
CREATE POLICY "Admins and Gerentes can view automatic sends log"
  ON envios_automaticos_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can insert automatic sends log"
  ON envios_automaticos_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Insert default templates
INSERT INTO plantillas_correo (nombre, tipo, asunto, cuerpo_html, activo, envio_automatico) VALUES
(
  'Bienvenida a la empresa',
  'bienvenida',
  'Bienvenido/a {{nombre}} a nuestro equipo',
  '<h1>¡Bienvenido/a {{nombre}}!</h1><p>Es un placer tenerte en nuestro equipo como {{puesto}}.</p><p>Esperamos que tu experiencia con nosotros sea excepcional.</p><p>Saludos cordiales,<br>El equipo de {{empresa}}</p>',
  true,
  false
),
(
  'Actualización de contraseña',
  'actualizacion_password',
  'Tu contraseña ha sido actualizada',
  '<h1>Hola {{nombre}},</h1><p>Te informamos que tu contraseña ha sido actualizada exitosamente.</p><p>Si no realizaste este cambio, por favor contacta al administrador inmediatamente.</p><p>Saludos,<br>Equipo de seguridad</p>',
  true,
  false
),
(
  'Felicitación de cumpleaños',
  'cumpleanos',
  '¡Feliz cumpleaños {{nombre}}! 🎉',
  '<h1>¡Feliz cumpleaños {{nombre}}! 🎂</h1><p>Todo el equipo de {{empresa}} te desea un día maravilloso lleno de alegría y buenos momentos.</p><p>Que este nuevo año de vida venga cargado de éxitos y felicidad.</p><p>¡Disfruta tu día especial!</p><p>Con cariño,<br>El equipo de {{empresa}}</p>',
  true,
  true
),
(
  'Aniversario laboral',
  'aniversario',
  '¡Feliz aniversario en {{empresa}}, {{nombre}}! 🎊',
  '<h1>¡Felicidades {{nombre}}! 🎊</h1><p>Hoy celebramos tu aniversario en {{empresa}}. Han sido {{anios}} año(s) de dedicación y compromiso.</p><p>Agradecemos tu valiosa contribución y esperamos seguir contando contigo por muchos años más.</p><p>¡Gracias por ser parte de nuestro equipo!</p><p>Saludos cordiales,<br>El equipo de {{empresa}}</p>',
  true,
  true
)
ON CONFLICT DO NOTHING;
