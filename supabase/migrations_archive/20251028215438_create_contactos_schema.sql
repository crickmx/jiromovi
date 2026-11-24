/*
  # Crear módulo de Contactos

  1. Nuevas Tablas
    - `contactos`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, foreign key to usuarios)
      - `nombre` (text)
      - `apellido` (text)
      - `email` (text, required)
      - `celular` (text)
      - `empresa` (text)
      - `comentarios` (text)
      - `origen` (enum: 'automatico' | 'manual')
      - `ultima_interaccion` (timestamptz)
      - `cantidad_emails` (integer, contador de emails intercambiados)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Índices
    - Índice único por usuario_id + email
    - Índice en email para búsquedas rápidas
    - Índice en nombre, apellido para ordenamiento
    - Índice en empresa para agrupación

  3. Seguridad
    - RLS habilitado
    - Usuarios solo pueden ver/editar sus propios contactos
    - Administradores pueden ver todos (opcional)
*/

-- Tipo ENUM para origen del contacto
DO $$ BEGIN
  CREATE TYPE origen_contacto AS ENUM ('automatico', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabla de contactos
CREATE TABLE IF NOT EXISTS contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text,
  apellido text,
  email text NOT NULL,
  celular text,
  empresa text,
  comentarios text,
  origen origen_contacto NOT NULL DEFAULT 'manual',
  ultima_interaccion timestamptz,
  cantidad_emails integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint único: un email por usuario
  CONSTRAINT contactos_usuario_email_unique UNIQUE (usuario_id, email)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contactos_usuario_id ON contactos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contactos_email ON contactos(email);
CREATE INDEX IF NOT EXISTS idx_contactos_nombre ON contactos(nombre);
CREATE INDEX IF NOT EXISTS idx_contactos_apellido ON contactos(apellido);
CREATE INDEX IF NOT EXISTS idx_contactos_empresa ON contactos(empresa);
CREATE INDEX IF NOT EXISTS idx_contactos_origen ON contactos(origen);
CREATE INDEX IF NOT EXISTS idx_contactos_ultima_interaccion ON contactos(ultima_interaccion DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_contactos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contactos_timestamp
  BEFORE UPDATE ON contactos
  FOR EACH ROW
  EXECUTE FUNCTION update_contactos_updated_at();

-- Habilitar RLS
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuarios solo ven sus propios contactos
CREATE POLICY "Usuarios pueden ver sus contactos"
  ON contactos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden insertar sus contactos"
  ON contactos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden actualizar sus contactos"
  ON contactos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden eliminar sus contactos"
  ON contactos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- Política adicional: Administradores pueden ver todos
CREATE POLICY "Administradores pueden ver todos los contactos"
  ON contactos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Función para extraer contactos de un email
CREATE OR REPLACE FUNCTION extraer_contactos_email(
  p_usuario_id uuid,
  p_remitente_email text,
  p_remitente_nombre text,
  p_destinatarios text[],
  p_cc text[],
  p_fecha timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
  v_nombre text;
  v_apellido text;
  v_parts text[];
BEGIN
  -- Procesar remitente
  IF p_remitente_email IS NOT NULL AND p_remitente_email != '' THEN
    -- Extraer nombre y apellido del remitente
    IF p_remitente_nombre IS NOT NULL AND p_remitente_nombre != '' THEN
      v_parts := string_to_array(trim(p_remitente_nombre), ' ');
      v_nombre := v_parts[1];
      v_apellido := array_to_string(v_parts[2:array_length(v_parts, 1)], ' ');
    ELSE
      v_nombre := split_part(p_remitente_email, '@', 1);
      v_apellido := NULL;
    END IF;
    
    INSERT INTO contactos (
      usuario_id,
      email,
      nombre,
      apellido,
      origen,
      ultima_interaccion,
      cantidad_emails
    )
    VALUES (
      p_usuario_id,
      lower(trim(p_remitente_email)),
      v_nombre,
      v_apellido,
      'automatico',
      p_fecha,
      1
    )
    ON CONFLICT (usuario_id, email)
    DO UPDATE SET
      ultima_interaccion = GREATEST(contactos.ultima_interaccion, p_fecha),
      cantidad_emails = contactos.cantidad_emails + 1,
      nombre = COALESCE(NULLIF(contactos.nombre, ''), EXCLUDED.nombre),
      apellido = COALESCE(NULLIF(contactos.apellido, ''), EXCLUDED.apellido);
  END IF;
  
  -- Procesar destinatarios
  IF p_destinatarios IS NOT NULL THEN
    FOREACH v_email IN ARRAY p_destinatarios
    LOOP
      IF v_email IS NOT NULL AND v_email != '' THEN
        INSERT INTO contactos (
          usuario_id,
          email,
          nombre,
          origen,
          ultima_interaccion,
          cantidad_emails
        )
        VALUES (
          p_usuario_id,
          lower(trim(v_email)),
          split_part(v_email, '@', 1),
          'automatico',
          p_fecha,
          1
        )
        ON CONFLICT (usuario_id, email)
        DO UPDATE SET
          ultima_interaccion = GREATEST(contactos.ultima_interaccion, p_fecha),
          cantidad_emails = contactos.cantidad_emails + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Procesar CC
  IF p_cc IS NOT NULL THEN
    FOREACH v_email IN ARRAY p_cc
    LOOP
      IF v_email IS NOT NULL AND v_email != '' THEN
        INSERT INTO contactos (
          usuario_id,
          email,
          nombre,
          origen,
          ultima_interaccion,
          cantidad_emails
        )
        VALUES (
          p_usuario_id,
          lower(trim(v_email)),
          split_part(v_email, '@', 1),
          'automatico',
          p_fecha,
          1
        )
        ON CONFLICT (usuario_id, email)
        DO UPDATE SET
          ultima_interaccion = GREATEST(contactos.ultima_interaccion, p_fecha),
          cantidad_emails = contactos.cantidad_emails + 1;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Función para buscar contactos
CREATE OR REPLACE FUNCTION buscar_contactos(
  p_usuario_id uuid,
  p_query text
)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  email text,
  celular text,
  empresa text,
  comentarios text,
  origen origen_contacto,
  ultima_interaccion timestamptz,
  cantidad_emails integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nombre,
    c.apellido,
    c.email,
    c.celular,
    c.empresa,
    c.comentarios,
    c.origen,
    c.ultima_interaccion,
    c.cantidad_emails
  FROM contactos c
  WHERE c.usuario_id = p_usuario_id
    AND (
      p_query IS NULL
      OR p_query = ''
      OR lower(c.nombre) LIKE '%' || lower(p_query) || '%'
      OR lower(c.apellido) LIKE '%' || lower(p_query) || '%'
      OR lower(c.email) LIKE '%' || lower(p_query) || '%'
      OR lower(c.empresa) LIKE '%' || lower(p_query) || '%'
      OR lower(c.celular) LIKE '%' || lower(p_query) || '%'
    )
  ORDER BY c.ultima_interaccion DESC NULLS LAST, c.nombre ASC;
END;
$$;
