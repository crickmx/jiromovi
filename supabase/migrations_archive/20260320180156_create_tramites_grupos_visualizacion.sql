/*
  # Sistema de Grupos de Visualización para Trámites

  1. Nuevas Tablas
    - `tramites_grupos_visualizacion`
      - `id` (uuid, primary key)
      - `nombre` (text) - Nombre del grupo
      - `descripcion` (text) - Descripción opcional
      - `color` (text) - Color para identificación visual
      - `oficina_id` (uuid, FK a oficinas) - Grupo específico por oficina
      - `activo` (boolean) - Estado del grupo
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `tramites_grupos_miembros`
      - `id` (uuid, primary key)
      - `grupo_id` (uuid, FK a tramites_grupos_visualizacion)
      - `usuario_id` (uuid, FK a usuarios)
      - `created_at` (timestamptz)
      - Unique constraint en (grupo_id, usuario_id)

  2. Security
    - Enable RLS en ambas tablas
    - Políticas restrictivas por rol y oficina

  3. Funciones
    - `get_user_grupos()` - Obtener grupos de un usuario
    - `get_grupo_miembros()` - Obtener miembros de un grupo
*/

-- Tabla de grupos de visualización
CREATE TABLE IF NOT EXISTS tramites_grupos_visualizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  color text DEFAULT '#6366f1',
  oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de miembros de grupos
CREATE TABLE IF NOT EXISTS tramites_grupos_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grupo_id, usuario_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_grupos_oficina ON tramites_grupos_visualizacion(oficina_id);
CREATE INDEX IF NOT EXISTS idx_grupos_activo ON tramites_grupos_visualizacion(activo);
CREATE INDEX IF NOT EXISTS idx_grupos_miembros_grupo ON tramites_grupos_miembros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupos_miembros_usuario ON tramites_grupos_miembros(usuario_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_tramites_grupos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tramites_grupos_updated_at ON tramites_grupos_visualizacion;
CREATE TRIGGER tramites_grupos_updated_at
  BEFORE UPDATE ON tramites_grupos_visualizacion
  FOR EACH ROW
  EXECUTE FUNCTION update_tramites_grupos_updated_at();

-- Enable RLS
ALTER TABLE tramites_grupos_visualizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE tramites_grupos_miembros ENABLE ROW LEVEL SECURITY;

-- Políticas para tramites_grupos_visualizacion
DROP POLICY IF EXISTS "Admins y Gerentes pueden ver grupos" ON tramites_grupos_visualizacion;
CREATE POLICY "Admins y Gerentes pueden ver grupos"
  ON tramites_grupos_visualizacion
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
      AND (
        tramites_grupos_visualizacion.oficina_id IS NULL
        OR usuarios.oficina_id = tramites_grupos_visualizacion.oficina_id
      )
    )
  );

DROP POLICY IF EXISTS "Admins y Gerentes pueden crear grupos" ON tramites_grupos_visualizacion;
CREATE POLICY "Admins y Gerentes pueden crear grupos"
  ON tramites_grupos_visualizacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
      AND (
        tramites_grupos_visualizacion.oficina_id IS NULL
        OR usuarios.oficina_id = tramites_grupos_visualizacion.oficina_id
      )
    )
  );

DROP POLICY IF EXISTS "Admins y Gerentes pueden actualizar grupos" ON tramites_grupos_visualizacion;
CREATE POLICY "Admins y Gerentes pueden actualizar grupos"
  ON tramites_grupos_visualizacion
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
      AND (
        tramites_grupos_visualizacion.oficina_id IS NULL
        OR usuarios.oficina_id = tramites_grupos_visualizacion.oficina_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
      AND (
        tramites_grupos_visualizacion.oficina_id IS NULL
        OR usuarios.oficina_id = tramites_grupos_visualizacion.oficina_id
      )
    )
  );

DROP POLICY IF EXISTS "Admins y Gerentes pueden eliminar grupos" ON tramites_grupos_visualizacion;
CREATE POLICY "Admins y Gerentes pueden eliminar grupos"
  ON tramites_grupos_visualizacion
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
      AND (
        tramites_grupos_visualizacion.oficina_id IS NULL
        OR usuarios.oficina_id = tramites_grupos_visualizacion.oficina_id
      )
    )
  );

-- Políticas para tramites_grupos_miembros
DROP POLICY IF EXISTS "Admins y Gerentes pueden ver miembros" ON tramites_grupos_miembros;
CREATE POLICY "Admins y Gerentes pueden ver miembros"
  ON tramites_grupos_miembros
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Admins y Gerentes pueden agregar miembros" ON tramites_grupos_miembros;
CREATE POLICY "Admins y Gerentes pueden agregar miembros"
  ON tramites_grupos_miembros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Admins y Gerentes pueden eliminar miembros" ON tramites_grupos_miembros;
CREATE POLICY "Admins y Gerentes pueden eliminar miembros"
  ON tramites_grupos_miembros
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Función para obtener grupos de un usuario
CREATE OR REPLACE FUNCTION get_user_grupos(p_usuario_id uuid)
RETURNS TABLE (
  grupo_id uuid,
  grupo_nombre text,
  grupo_color text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.nombre,
    g.color
  FROM tramites_grupos_visualizacion g
  INNER JOIN tramites_grupos_miembros m ON m.grupo_id = g.id
  WHERE m.usuario_id = p_usuario_id
  AND g.activo = true
  ORDER BY g.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener miembros de un grupo
CREATE OR REPLACE FUNCTION get_grupo_miembros(p_grupo_id uuid)
RETURNS TABLE (
  usuario_id uuid,
  nombre_completo text,
  oficina_nombre text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, '')) as nombre_completo,
    o.nombre as oficina_nombre
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE m.grupo_id = p_grupo_id
  ORDER BY nombre_completo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insertar grupos de ejemplo
INSERT INTO tramites_grupos_visualizacion (nombre, descripcion, color, oficina_id, activo) VALUES
  ('Equipo Comercial', 'Agentes y ejecutivos del área comercial', '#10b981', NULL, true),
  ('Equipo Administrativo', 'Personal administrativo y soporte', '#3b82f6', NULL, true),
  ('Gerencia', 'Gerentes y directores', '#8b5cf6', NULL, true),
  ('Operaciones', 'Equipo de operaciones y trámites', '#f59e0b', NULL, true)
ON CONFLICT DO NOTHING;
