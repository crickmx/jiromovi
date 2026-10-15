/*
  # Add Notificaciones Internas Template Support

  1. Changes
    - Update plantillas_correo tipo constraint to include 'notificaciones_internas'
    - Create configuracion_notificaciones table for recipient emails
    - Insert default "Notificaciones internas" template
    
  2. New Table
    - `configuracion_notificaciones` (Notification Configuration)
      - `id` (uuid, primary key)
      - `clave` (text) - Configuration key
      - `valor` (text) - Configuration value (emails separated by comma)
      - `descripcion` (text) - Description
      - `activo` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  3. Security
    - Enable RLS on configuracion_notificaciones
    - Only admins and gerentes can manage notification settings
*/

-- Update plantillas_correo tipo constraint
ALTER TABLE plantillas_correo 
  DROP CONSTRAINT IF EXISTS plantillas_correo_tipo_check;

ALTER TABLE plantillas_correo 
  ADD CONSTRAINT plantillas_correo_tipo_check 
  CHECK (tipo IN ('bienvenida', 'actualizacion_password', 'cumpleanos', 'aniversario', 'notificaciones_internas'));

-- Create configuracion_notificaciones table
CREATE TABLE IF NOT EXISTS configuracion_notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE NOT NULL,
  valor text NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE configuracion_notificaciones ENABLE ROW LEVEL SECURITY;

-- Policies for configuracion_notificaciones
CREATE POLICY "Admins and Gerentes can view notification config"
  ON configuracion_notificaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can insert notification config"
  ON configuracion_notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can update notification config"
  ON configuracion_notificaciones FOR UPDATE
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

-- Insert default notification configuration
INSERT INTO configuracion_notificaciones (clave, valor, descripcion, activo) VALUES
(
  'emails_notificaciones_internas',
  '',
  'Correos electrónicos que recibirán notificaciones cuando se da de alta un nuevo usuario (separar por coma)',
  true
)
ON CONFLICT (clave) DO NOTHING;

-- Insert default "Notificaciones internas" template
INSERT INTO plantillas_correo (nombre, tipo, asunto, cuerpo_html, activo, envio_automatico) VALUES
(
  'Notificaciones internas',
  'notificaciones_internas',
  'Nuevo usuario registrado: {{nombre}} {{apellidos}}',
  '<h1>Nuevo Usuario Registrado en el Sistema</h1>
<p>Se ha dado de alta un nuevo usuario con la siguiente información:</p>

<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Nombre completo:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{nombre}} {{apellidos}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Rol:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{rol}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Puesto:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{puesto}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Oficina:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{oficina}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha de nacimiento:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{fecha_nacimiento}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha de ingreso:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{fecha_ingreso}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Celular personal:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{celular_personal}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Email personal:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{email_personal}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Celular laboral:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{celular_laboral}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Email laboral:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{email_laboral}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Extensión telefónica:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{extension_telefonica}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Equipo de cómputo:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{equipo_computo}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Equipo celular:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{equipo_celular}}</td>
  </tr>
  <tr>
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">URL Web JIRO:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{url_web_jiro}}</td>
  </tr>
  <tr style="background-color: #f3f4f6;">
    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">URL Web Multicotizador:</td>
    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{url_web_multicotizador}}</td>
  </tr>
</table>

<p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
Esta es una notificación automática generada por el sistema.
</p>',
  true,
  true
)
ON CONFLICT DO NOTHING;
