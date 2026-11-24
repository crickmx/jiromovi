/*
  # Fix Remaining NO ACTION Foreign Key Constraints

  1. Problem
    - Several tables still have NO ACTION constraints pointing to usuarios
    - This prevents user deletion even when it should be allowed
    
  2. Solution
    - Change all NO ACTION constraints to SET NULL
    - Allow columns to be NULL
    - Preserve historical records with NULL creator references
    
  3. Tables Updated
    - crm_contactos.creado_por
    - crm_cotizaciones.creado_por
    - crm_notas.creado_por
    - crm_polizas.creado_por
    - crm_tareas.creado_por
    - expediente_usuario.subido_por
    - production_google_sheets_config.configurado_por_user_id
*/

-- crm_contactos.creado_por
ALTER TABLE crm_contactos
  DROP CONSTRAINT IF EXISTS crm_contactos_creado_por_fkey;

ALTER TABLE crm_contactos
  ADD CONSTRAINT crm_contactos_creado_por_fkey
  FOREIGN KEY (creado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- crm_cotizaciones.creado_por
ALTER TABLE crm_cotizaciones
  DROP CONSTRAINT IF EXISTS crm_cotizaciones_creado_por_fkey;

ALTER TABLE crm_cotizaciones
  ADD CONSTRAINT crm_cotizaciones_creado_por_fkey
  FOREIGN KEY (creado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- crm_notas.creado_por
ALTER TABLE crm_notas
  DROP CONSTRAINT IF EXISTS crm_notas_creado_por_fkey;

ALTER TABLE crm_notas
  ADD CONSTRAINT crm_notas_creado_por_fkey
  FOREIGN KEY (creado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- crm_polizas.creado_por
ALTER TABLE crm_polizas
  DROP CONSTRAINT IF EXISTS crm_polizas_creado_por_fkey;

ALTER TABLE crm_polizas
  ADD CONSTRAINT crm_polizas_creado_por_fkey
  FOREIGN KEY (creado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- crm_tareas.creado_por
ALTER TABLE crm_tareas
  DROP CONSTRAINT IF EXISTS crm_tareas_creado_por_fkey;

ALTER TABLE crm_tareas
  ALTER COLUMN creado_por DROP NOT NULL;

ALTER TABLE crm_tareas
  ADD CONSTRAINT crm_tareas_creado_por_fkey
  FOREIGN KEY (creado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- expediente_usuario.subido_por
ALTER TABLE expediente_usuario
  DROP CONSTRAINT IF EXISTS expediente_usuario_subido_por_fkey;

ALTER TABLE expediente_usuario
  ALTER COLUMN subido_por DROP NOT NULL;

ALTER TABLE expediente_usuario
  ADD CONSTRAINT expediente_usuario_subido_por_fkey
  FOREIGN KEY (subido_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- production_google_sheets_config.configurado_por_user_id
ALTER TABLE production_google_sheets_config
  DROP CONSTRAINT IF EXISTS production_google_sheets_config_configurado_por_user_id_fkey;

ALTER TABLE production_google_sheets_config
  ADD CONSTRAINT production_google_sheets_config_configurado_por_user_id_fkey
  FOREIGN KEY (configurado_por_user_id)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;