/*
  # Create Notifications System

  ## Overview
  Creates a comprehensive real-time notification system with:
  - User notifications
  - Admin broadcast capabilities
  - Read/unread status
  - Module-specific notifications
  - Action URLs for quick navigation

  ## New Tables
    - `notificaciones`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Recipient user
      - `titulo` (text) - Notification title
      - `mensaje` (text) - Notification message
      - `modulo` (text) - Source module (Chat, Vacaciones, etc.)
      - `icono` (text) - Icon identifier
      - `accion_url` (text) - Internal URL to navigate to
      - `accion_texto` (text) - Action button text
      - `leida` (boolean) - Read status
      - `fecha_creacion` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `notificaciones_globales`
      - `id` (uuid, primary key)
      - `titulo` (text)
      - `mensaje` (text)
      - `accion_url` (text)
      - `destinatarios` (jsonb) - Target users/roles/offices
      - `enviado_por` (uuid) - Admin who sent it
      - `fecha_envio` (timestamptz)
      - `created_at` (timestamptz)

  ## Security
    - Enable RLS on all tables
    - Users can only view their own notifications
    - Only Administradores can send global notifications

  ## Notes
    - Notifications expire after 90 days (configurable)
    - Real-time updates via Supabase Realtime
    - Push notifications handled client-side
*/

-- Create notificaciones table
CREATE TABLE IF NOT EXISTS notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  modulo text NOT NULL,
  icono text DEFAULT 'bell',
  accion_url text,
  accion_texto text DEFAULT 'Ver más',
  leida boolean DEFAULT false,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notificaciones_globales table
CREATE TABLE IF NOT EXISTS notificaciones_globales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensaje text NOT NULL,
  accion_url text,
  destinatarios jsonb DEFAULT '{}'::jsonb,
  enviado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_envio timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(user_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_modulo ON notificaciones(modulo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_globales_fecha ON notificaciones_globales(fecha_envio DESC);

-- Enable RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_globales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notificaciones

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notificaciones FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notificaciones FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notifications for users
CREATE POLICY "System can create notifications"
  ON notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notificaciones FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON notificaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- RLS Policies for notificaciones_globales

-- Only admins can view global notifications
CREATE POLICY "Admins can view global notifications"
  ON notificaciones_globales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Only admins can create global notifications
CREATE POLICY "Admins can create global notifications"
  ON notificaciones_globales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_notificaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notificaciones_updated_at
  BEFORE UPDATE ON notificaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_notificaciones_updated_at();

-- Function to auto-delete old notifications (90 days)
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notificaciones
  WHERE fecha_creacion < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to create notification for user
CREATE OR REPLACE FUNCTION crear_notificacion(
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_icono text DEFAULT 'bell',
  p_accion_url text DEFAULT NULL,
  p_accion_texto text DEFAULT 'Ver más'
)
RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notificaciones (
    user_id,
    titulo,
    mensaje,
    modulo,
    icono,
    accion_url,
    accion_texto
  ) VALUES (
    p_user_id,
    p_titulo,
    p_mensaje,
    p_modulo,
    p_icono,
    p_accion_url,
    p_accion_texto
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send global notification
CREATE OR REPLACE FUNCTION enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_destinatarios jsonb,
  p_enviado_por uuid
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_users uuid[];
BEGIN
  -- Log the global notification
  INSERT INTO notificaciones_globales (
    titulo,
    mensaje,
    accion_url,
    destinatarios,
    enviado_por
  ) VALUES (
    p_titulo,
    p_mensaje,
    p_accion_url,
    p_destinatarios,
    p_enviado_por
  );
  
  -- Determine target users based on destinatarios
  IF p_destinatarios->>'tipo' = 'todos' THEN
    -- All active users
    SELECT ARRAY_AGG(id) INTO v_users
    FROM usuarios
    WHERE activo = true;
    
  ELSIF p_destinatarios->>'tipo' = 'oficina' THEN
    -- Users in specific office
    SELECT ARRAY_AGG(id) INTO v_users
    FROM usuarios
    WHERE oficina_id::text = p_destinatarios->>'oficina_id'
    AND activo = true;
    
  ELSIF p_destinatarios->>'tipo' = 'rol' THEN
    -- Users with specific role
    SELECT ARRAY_AGG(id) INTO v_users
    FROM usuarios
    WHERE rol = p_destinatarios->>'rol'
    AND activo = true;
    
  ELSIF p_destinatarios->>'tipo' = 'usuario' THEN
    -- Specific user
    v_users := ARRAY[p_destinatarios->>'user_id']::uuid[];
  END IF;
  
  -- Create individual notifications
  IF v_users IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY v_users
    LOOP
      INSERT INTO notificaciones (
        user_id,
        titulo,
        mensaje,
        modulo,
        icono,
        accion_url,
        accion_texto
      ) VALUES (
        v_user_id,
        p_titulo,
        p_mensaje,
        'Sistema',
        'megaphone',
        p_accion_url,
        'Ver más'
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
