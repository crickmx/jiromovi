-- Permite proponer un nombre para crear una cuenta MOVI nueva (sin user_id existente)
ALTER TABLE maestro_mapeo_pendiente
  ADD COLUMN IF NOT EXISTS nombre_propuesto text,
  ALTER COLUMN user_id_propuesto DROP NOT NULL;
