/*
  # Agregar campos para Registro de Personal

  ## 1. Modificaciones a tabla usuarios
  
  Agregar campos faltantes para el sistema de registro de personal:
  - `status` (text) - Estado del usuario (activo, pendiente_activacion, inactivo)
  - `equipo_computo_marca` (text) - Marca del equipo de cómputo
  - `equipo_computo_modelo` (text) - Modelo del equipo de cómputo
  - `equipo_celular_marca` (text) - Marca del equipo celular
  - `equipo_celular_modelo` (text) - Modelo del equipo celular
  - `created_by` (uuid) - ID del usuario que creó este registro
  - `password_generated_at` (timestamptz) - Fecha de generación de contraseña
  
  ## 2. Nueva tabla: auditoria_usuarios
  
  Registro de auditoría de operaciones sobre usuarios
  - `id` (uuid, primary key)
  - `usuario_id` (uuid) - ID del usuario afectado
  - `accion` (text) - Acción realizada (crear, activar, desactivar, actualizar)
  - `realizado_por` (uuid) - ID del usuario que realizó la acción
  - `detalles` (jsonb) - Detalles adicionales de la operación
  - `created_at` (timestamptz)

  ## 3. Seguridad
  
  - Enable RLS en tabla de auditoría
  - Solo administradores pueden ver auditoría
  - Sistema puede insertar en auditoría
*/

-- Agregar campos a tabla usuarios si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'status'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN status text DEFAULT 'activo';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'equipo_computo_marca'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN equipo_computo_marca text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'equipo_computo_modelo'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN equipo_computo_modelo text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'equipo_celular_marca'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN equipo_celular_marca text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'equipo_celular_modelo'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN equipo_celular_modelo text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN created_by uuid REFERENCES usuarios(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'password_generated_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN password_generated_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'fecha_ingreso_jiro'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN fecha_ingreso_jiro date;
  END IF;
END $$;

-- Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid,
  accion text NOT NULL,
  realizado_por uuid REFERENCES usuarios(id),
  detalles jsonb,
  created_at timestamptz DEFAULT now()
);

-- Crear índices para auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria_usuarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria_usuarios(created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_realizado_por ON auditoria_usuarios(realizado_por);

-- Habilitar RLS en tabla de auditoría
ALTER TABLE auditoria_usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas para tabla auditoria_usuarios
CREATE POLICY "Solo administradores pueden ver auditoría"
  ON auditoria_usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Sistema puede insertar en auditoría"
  ON auditoria_usuarios FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Actualizar usuarios existentes con status 'activo' si no tienen status
UPDATE usuarios SET status = 'activo' WHERE status IS NULL;

-- Comentarios en columnas para documentación
COMMENT ON COLUMN usuarios.status IS 'Estado del usuario: activo, pendiente_activacion, inactivo';
COMMENT ON COLUMN usuarios.equipo_computo_marca IS 'Marca del equipo de cómputo asignado';
COMMENT ON COLUMN usuarios.equipo_computo_modelo IS 'Modelo del equipo de cómputo asignado';
COMMENT ON COLUMN usuarios.equipo_celular_marca IS 'Marca del equipo celular asignado';
COMMENT ON COLUMN usuarios.equipo_celular_modelo IS 'Modelo del equipo celular asignado';
COMMENT ON COLUMN usuarios.created_by IS 'ID del usuario administrador que creó este registro';
COMMENT ON COLUMN usuarios.password_generated_at IS 'Fecha y hora en que se generó la contraseña aleatoria';
COMMENT ON COLUMN usuarios.fecha_ingreso_jiro IS 'Fecha de ingreso del empleado a JIRO';
