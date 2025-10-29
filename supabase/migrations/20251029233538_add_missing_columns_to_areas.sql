/*
  # Agregar columnas faltantes a tabla areas

  ## Descripción
  Agrega las columnas necesarias para que el módulo de Espacio Jiro funcione correctamente:
  - oficina_id: Relaciona el área con una oficina específica
  - disponibilidad_semanal: Almacena los horarios disponibles por día de la semana

  ## Cambios
  - Agrega columna `oficina_id` (uuid, foreign key a oficinas)
  - Agrega columna `disponibilidad_semanal` (jsonb)

  ## Seguridad
  - Se mantienen las políticas RLS existentes
*/

-- Agregar oficina_id
ALTER TABLE areas 
ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE;

-- Agregar disponibilidad_semanal
ALTER TABLE areas 
ADD COLUMN IF NOT EXISTS disponibilidad_semanal jsonb DEFAULT '{
  "lunes": {"activo": true, "inicio": "09:00", "fin": "18:00"},
  "martes": {"activo": true, "inicio": "09:00", "fin": "18:00"},
  "miercoles": {"activo": true, "inicio": "09:00", "fin": "18:00"},
  "jueves": {"activo": true, "inicio": "09:00", "fin": "18:00"},
  "viernes": {"activo": true, "inicio": "09:00", "fin": "18:00"},
  "sabado": {"activo": false, "inicio": "09:00", "fin": "14:00"},
  "domingo": {"activo": false, "inicio": "09:00", "fin": "14:00"}
}'::jsonb;

-- Crear índice para oficina_id
CREATE INDEX IF NOT EXISTS idx_areas_oficina_id ON areas(oficina_id);

COMMENT ON COLUMN areas.oficina_id IS 'Oficina a la que pertenece el área';
COMMENT ON COLUMN areas.disponibilidad_semanal IS 'Horarios de disponibilidad por día de la semana';
