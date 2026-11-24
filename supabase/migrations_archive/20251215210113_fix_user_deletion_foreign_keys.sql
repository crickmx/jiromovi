/*
  # Fix User Deletion Foreign Key Constraints

  1. Changes
    - Update foreign key constraints from `ON DELETE RESTRICT` to `ON DELETE SET NULL`
    - Allows user deletion without being blocked by related records
    - Preserves data by setting references to NULL instead of blocking deletion
    
  2. Tables Updated
    - `notificaciones_globales.enviado_por`
    - `accesos_nacional.creado_por`
    - `accesos_nacional.ultima_edicion_por`
    - `seguros_sessions.creado_por`
    - `seguros_lessons.creado_por`
    
  3. Notes
    - This allows administrators to delete users without first having to reassign all their created content
    - Historical records are preserved with NULL creator references
*/

-- notificaciones_globales.enviado_por
ALTER TABLE notificaciones_globales
  DROP CONSTRAINT IF EXISTS notificaciones_globales_enviado_por_fkey;

ALTER TABLE notificaciones_globales
  ALTER COLUMN enviado_por DROP NOT NULL;

ALTER TABLE notificaciones_globales
  ADD CONSTRAINT notificaciones_globales_enviado_por_fkey 
  FOREIGN KEY (enviado_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL;

-- accesos_nacional.creado_por
ALTER TABLE accesos_nacional
  DROP CONSTRAINT IF EXISTS accesos_nacional_creado_por_fkey;

ALTER TABLE accesos_nacional
  ALTER COLUMN creado_por DROP NOT NULL;

ALTER TABLE accesos_nacional
  ADD CONSTRAINT accesos_nacional_creado_por_fkey 
  FOREIGN KEY (creado_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL;

-- accesos_nacional.ultima_edicion_por
ALTER TABLE accesos_nacional
  DROP CONSTRAINT IF EXISTS accesos_nacional_ultima_edicion_por_fkey;

ALTER TABLE accesos_nacional
  ADD CONSTRAINT accesos_nacional_ultima_edicion_por_fkey 
  FOREIGN KEY (ultima_edicion_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL;

-- seguros_sessions.creado_por
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seguros_sessions') THEN
    ALTER TABLE seguros_sessions
      DROP CONSTRAINT IF EXISTS seguros_sessions_creado_por_fkey;

    ALTER TABLE seguros_sessions
      ADD CONSTRAINT seguros_sessions_creado_por_fkey 
      FOREIGN KEY (creado_por) 
      REFERENCES usuarios(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- seguros_lessons.creado_por
ALTER TABLE seguros_lessons
  DROP CONSTRAINT IF EXISTS seguros_lessons_creado_por_fkey;

ALTER TABLE seguros_lessons
  ADD CONSTRAINT seguros_lessons_creado_por_fkey 
  FOREIGN KEY (creado_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL;