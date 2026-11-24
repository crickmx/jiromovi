/*
  # Sistema de Sesiones Programadas para Seguros Education

  ## Descripción
  Nuevo sistema de programación y gestión de capacitaciones con enlaces externos
  (Zoom, Teams, Google Meet, etc.). Reemplaza el sistema de Aula Virtual con WebRTC
  por un directorio de sesiones más simple y flexible.

  ## 1. Nueva Tabla

  ### `education_sesiones_programadas`
  - `id` (uuid, PK)
  - `titulo` (text, requerido) - Nombre de la sesión
  - `compania` (text, requerido) - Compañía que imparte
  - `ponente` (text, requerido) - Nombre del instructor/ponente
  - `ponente_bio` (text, opcional) - Biografía breve del ponente
  - `ponente_foto_url` (text, opcional) - URL de foto del ponente
  - `descripcion` (text, requerido) - Descripción de la sesión
  - `fecha` (date, requerido) - Fecha de la sesión
  - `hora` (time, requerido) - Hora de inicio
  - `duracion_minutos` (int, default 60) - Duración estimada
  - `link_acceso` (text, requerido) - URL de la plataforma externa
  - `clave_acceso` (text, opcional) - Password/clave para ingresar
  - `miniatura_url` (text, opcional) - Banner o imagen promocional
  - `oficinas_asignadas` (jsonb, default []) - Array de IDs de oficinas (null = todas)
  - `capacidad` (int, nullable) - Límite de participantes
  - `estatus` (enum) - programada | en_vivo | finalizada | cancelada
  - `publicada` (boolean, default true) - Visibilidad
  - `minutos_anticipacion` (int, default 15) - Minutos antes para habilitar "Ingresar"
  - `tags` (jsonb, default []) - Etiquetas/categorías
  - `creado_por` (uuid, FK usuarios)
  - `actualizado_por` (uuid, FK usuarios, nullable)
  - Timestamps: created_at, updated_at

  ### `education_sesiones_registro`
  Control de registros/inscripciones a sesiones
  - `id` (uuid, PK)
  - `sesion_id` (uuid, FK)
  - `usuario_id` (uuid, FK)
  - `asistio` (boolean, default false)
  - Timestamps

  ## 2. Seguridad
  - RLS habilitado en ambas tablas
  - Administradores: acceso completo
  - Gerentes: ver sesiones de su oficina (si aplica filtro)
  - Empleados/Agentes: ver sesiones publicadas según oficina asignada
  - Todos pueden registrarse

  ## 3. Índices
  - Por fecha/hora para listado cronológico
  - Por estatus para filtros
  - Por oficinas para control de visibilidad
*/

-- ============================================================================
-- TABLA PRINCIPAL: education_sesiones_programadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS education_sesiones_programadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Información básica
  titulo text NOT NULL,
  compania text NOT NULL,
  ponente text NOT NULL,
  ponente_bio text,
  ponente_foto_url text,
  descripcion text NOT NULL,

  -- Fecha y hora
  fecha date NOT NULL,
  hora time NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 60,

  -- Acceso
  link_acceso text NOT NULL,
  clave_acceso text,

  -- Media
  miniatura_url text,

  -- Control de visibilidad
  oficinas_asignadas jsonb DEFAULT '[]'::jsonb,
  capacidad integer,

  -- Estado
  estatus text NOT NULL DEFAULT 'programada' CHECK (estatus IN ('programada', 'en_vivo', 'finalizada', 'cancelada')),
  publicada boolean DEFAULT true,
  minutos_anticipacion integer DEFAULT 15,

  -- Categorización
  tags jsonb DEFAULT '[]'::jsonb,

  -- Auditoría
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  actualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE education_sesiones_programadas IS 'Sesiones programadas de capacitación con enlaces externos (Zoom, Teams, etc.)';
COMMENT ON COLUMN education_sesiones_programadas.oficinas_asignadas IS 'Array de IDs de oficinas. Vacío = visible para todas';
COMMENT ON COLUMN education_sesiones_programadas.minutos_anticipacion IS 'Minutos antes del inicio para habilitar botón "Ingresar"';
COMMENT ON COLUMN education_sesiones_programadas.tags IS 'Array de etiquetas para categorización: ["Ventas", "Productos", "Cumplimiento"]';

-- Índices
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha_hora ON education_sesiones_programadas(fecha, hora);
CREATE INDEX IF NOT EXISTS idx_sesiones_estatus ON education_sesiones_programadas(estatus);
CREATE INDEX IF NOT EXISTS idx_sesiones_publicada ON education_sesiones_programadas(publicada);
CREATE INDEX IF NOT EXISTS idx_sesiones_created_at ON education_sesiones_programadas(created_at DESC);

-- ============================================================================
-- TABLA DE REGISTRO: education_sesiones_registro
-- ============================================================================

CREATE TABLE IF NOT EXISTS education_sesiones_registro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES education_sesiones_programadas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asistio boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sesion_id, usuario_id)
);

COMMENT ON TABLE education_sesiones_registro IS 'Registro de inscripciones a sesiones programadas';

CREATE INDEX IF NOT EXISTS idx_registro_sesion ON education_sesiones_registro(sesion_id);
CREATE INDEX IF NOT EXISTS idx_registro_usuario ON education_sesiones_registro(usuario_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE education_sesiones_programadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_sesiones_registro ENABLE ROW LEVEL SECURITY;

-- Políticas para education_sesiones_programadas

-- Administradores: acceso completo
CREATE POLICY "Administradores pueden ver todas las sesiones"
  ON education_sesiones_programadas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores pueden crear sesiones"
  ON education_sesiones_programadas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores pueden actualizar sesiones"
  ON education_sesiones_programadas FOR UPDATE
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

CREATE POLICY "Administradores pueden eliminar sesiones"
  ON education_sesiones_programadas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes y empleados: ver sesiones publicadas de su oficina (o todas si oficinas_asignadas está vacío)
CREATE POLICY "Usuarios pueden ver sesiones publicadas de su oficina"
  ON education_sesiones_programadas FOR SELECT
  TO authenticated
  USING (
    publicada = true
    AND (
      -- Sin restricción de oficina (visible para todos)
      oficinas_asignadas = '[]'::jsonb
      OR
      -- Usuario pertenece a una de las oficinas asignadas
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.oficina_id::text = ANY(
          SELECT jsonb_array_elements_text(oficinas_asignadas)
        )
      )
    )
  );

-- Políticas para education_sesiones_registro

-- Cualquier usuario autenticado puede registrarse
CREATE POLICY "Usuarios pueden registrarse en sesiones"
  ON education_sesiones_registro FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- Ver sus propios registros
CREATE POLICY "Usuarios pueden ver sus registros"
  ON education_sesiones_registro FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

-- Administradores pueden ver todos los registros
CREATE POLICY "Administradores pueden ver todos los registros"
  ON education_sesiones_registro FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Administradores pueden actualizar asistencia
CREATE POLICY "Administradores pueden actualizar registros"
  ON education_sesiones_registro FOR UPDATE
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

-- ============================================================================
-- TRIGGER PARA ACTUALIZAR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_education_sesiones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sesiones_programadas_timestamp
  BEFORE UPDATE ON education_sesiones_programadas
  FOR EACH ROW
  EXECUTE FUNCTION update_education_sesiones_timestamp();

CREATE TRIGGER update_sesiones_registro_timestamp
  BEFORE UPDATE ON education_sesiones_registro
  FOR EACH ROW
  EXECUTE FUNCTION update_education_sesiones_timestamp();
