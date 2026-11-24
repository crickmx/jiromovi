/*
  # Crear tabla para configurar destinatarios de notificaciones
  
  1. Propósito
    - Permitir que administradores configuren quién recibe cada tipo de notificación
    - Cada tipo de notificación puede tener múltiples destinatarios
    - Solo usuarios con roles Empleado, Gerente, Administrador
  
  2. Seguridad
    - RLS habilitado
    - Solo administradores pueden modificar
    - Todos pueden leer (para verificar si deben recibir notificaciones)
*/

-- Crear tabla para destinatarios de notificaciones
CREATE TABLE IF NOT EXISTS correo_destinatarios_notificacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_notificacion_id uuid NOT NULL REFERENCES correo_tipos_notificacion(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Un usuario solo puede estar una vez por tipo de notificación
  UNIQUE (tipo_notificacion_id, usuario_id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_tipo 
  ON correo_destinatarios_notificacion(tipo_notificacion_id);

CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_usuario 
  ON correo_destinatarios_notificacion(usuario_id);

CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_activo 
  ON correo_destinatarios_notificacion(activo);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_correo_destinatarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_correo_destinatarios_updated_at 
  ON correo_destinatarios_notificacion;

CREATE TRIGGER trigger_update_correo_destinatarios_updated_at
  BEFORE UPDATE ON correo_destinatarios_notificacion
  FOR EACH ROW
  EXECUTE FUNCTION update_correo_destinatarios_updated_at();

-- Habilitar RLS
ALTER TABLE correo_destinatarios_notificacion ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Todos los usuarios autenticados pueden ver los destinatarios (para verificar si deben recibir)
CREATE POLICY "Usuarios pueden ver destinatarios de notificaciones"
  ON correo_destinatarios_notificacion
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo administradores pueden insertar destinatarios
CREATE POLICY "Administradores pueden agregar destinatarios"
  ON correo_destinatarios_notificacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND estado = 'activo'
    )
  );

-- Solo administradores pueden actualizar destinatarios
CREATE POLICY "Administradores pueden actualizar destinatarios"
  ON correo_destinatarios_notificacion
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND estado = 'activo'
    )
  );

-- Solo administradores pueden eliminar destinatarios
CREATE POLICY "Administradores pueden eliminar destinatarios"
  ON correo_destinatarios_notificacion
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND estado = 'activo'
    )
  );

-- Comentarios
COMMENT ON TABLE correo_destinatarios_notificacion IS
  'Configuración de destinatarios para cada tipo de notificación transaccional';

COMMENT ON COLUMN correo_destinatarios_notificacion.tipo_notificacion_id IS
  'Referencia al tipo de notificación';

COMMENT ON COLUMN correo_destinatarios_notificacion.usuario_id IS
  'Usuario que recibirá este tipo de notificación';

COMMENT ON COLUMN correo_destinatarios_notificacion.activo IS
  'Si está activo, el usuario recibirá las notificaciones de este tipo';
