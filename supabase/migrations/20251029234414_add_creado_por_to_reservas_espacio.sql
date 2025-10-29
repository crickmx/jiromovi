/*
  # Agregar columna creado_por a reservas_espacio

  ## Descripción
  Agrega la columna creado_por para rastrear quién creó la reserva, 
  diferenciando del usuario para quien es la reserva (usuario_id).

  ## Cambios
  - Agrega columna `creado_por` (uuid, foreign key a usuarios)
  - Copia valores de usuario_id para registros existentes
  - Crea índice para mejor rendimiento

  ## Seguridad
  - Se mantienen las políticas RLS existentes
*/

-- Agregar columna creado_por
ALTER TABLE reservas_espacio 
ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- Inicializar con usuario_id para registros existentes
UPDATE reservas_espacio 
SET creado_por = usuario_id 
WHERE creado_por IS NULL;

-- Crear índice para rendimiento
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_creado_por ON reservas_espacio(creado_por);

COMMENT ON COLUMN reservas_espacio.creado_por IS 'Usuario que creó la reserva';
