/*
  # Crear todas las tablas faltantes del sistema

  1. Tablas Creadas
    - accesos_nacional
    - firma_templates
    - firma_asignaciones
    - plantillas_correo
    - firma_imagenes
    
  2. Seguridad
    - RLS habilitado en todas las tablas
*/

-- Tabla de accesos nacionales
CREATE TABLE IF NOT EXISTS accesos_nacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  url text NOT NULL,
  usuario text,
  password text,
  notas text,
  categoria text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accesos_nacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver accesos"
  ON accesos_nacional FOR SELECT
  TO authenticated
  USING (true);

-- Tabla de plantillas de firmas de email
CREATE TABLE IF NOT EXISTS firma_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  html_content text NOT NULL,
  es_global boolean DEFAULT false,
  activo boolean DEFAULT true,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE firma_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver firmas activas"
  ON firma_templates FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Solo admin puede gestionar firmas"
  ON firma_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Tabla de asignaciones de firmas a usuarios
CREATE TABLE IF NOT EXISTS firma_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  firma_id uuid REFERENCES firma_templates(id) ON DELETE CASCADE NOT NULL,
  asignado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, firma_id)
);

ALTER TABLE firma_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus asignaciones"
  ON firma_asignaciones FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Solo admin puede gestionar asignaciones"
  ON firma_asignaciones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Tabla de imágenes de firmas
CREATE TABLE IF NOT EXISTS firma_imagenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id uuid REFERENCES firma_templates(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  tipo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE firma_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver imagenes de firmas"
  ON firma_imagenes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin puede gestionar imagenes"
  ON firma_imagenes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Tabla de plantillas de correo
CREATE TABLE IF NOT EXISTS plantillas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  asunto text NOT NULL,
  cuerpo text NOT NULL,
  tipo text DEFAULT 'general',
  activa boolean DEFAULT true,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plantillas_correo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin y Gerentes pueden ver plantillas"
  ON plantillas_correo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admin y Gerentes pueden gestionar plantillas"
  ON plantillas_correo FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_categoria ON accesos_nacional(categoria);
CREATE INDEX IF NOT EXISTS idx_firma_templates_activo ON firma_templates(activo);
CREATE INDEX IF NOT EXISTS idx_firma_templates_global ON firma_templates(es_global);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_usuario ON firma_asignaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_firma ON firma_asignaciones(firma_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_correo_activa ON plantillas_correo(activa);
