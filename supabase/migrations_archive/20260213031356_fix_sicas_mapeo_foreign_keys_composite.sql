/*
  # Actualizar Foreign Keys de Mapeo SICAS con Clave Compuesta

  Este migration actualiza los foreign keys de las tablas de mapeo para que apunten
  a la tabla unificada sicas_catalogos usando una clave compuesta.

  ## Cambios

  1. **sicas_catalogos**
     - Agrega unique constraint en (catalog_type_id, id_sicas)

  2. **sicas_mapeo_vendedor_usuario**
     - Elimina FK antiguo
     - Agrega columna catalog_type_id con valor fijo 32
     - Agrega FK compuesto

  3. **sicas_mapeo_despacho_oficina**
     - Elimina FK antiguo
     - Agrega columna catalog_type_id con valor fijo 11
     - Agrega FK compuesto
*/

-- Paso 1: Crear unique constraint en sicas_catalogos
ALTER TABLE sicas_catalogos
  DROP CONSTRAINT IF EXISTS sicas_catalogos_catalog_type_id_sicas_key;

ALTER TABLE sicas_catalogos
  ADD CONSTRAINT sicas_catalogos_catalog_type_id_sicas_key
  UNIQUE (catalog_type_id, id_sicas);

-- Paso 2: Actualizar sicas_mapeo_vendedor_usuario
-- Eliminar FK antiguo
ALTER TABLE sicas_mapeo_vendedor_usuario
  DROP CONSTRAINT IF EXISTS sicas_mapeo_vendedor_usuario_id_sicas_vendedor_fkey;

-- Agregar columna catalog_type_id si no existe
ALTER TABLE sicas_mapeo_vendedor_usuario
  ADD COLUMN IF NOT EXISTS catalog_type_id INTEGER DEFAULT 32 NOT NULL;

-- Agregar nuevo FK compuesto
ALTER TABLE sicas_mapeo_vendedor_usuario
  ADD CONSTRAINT sicas_mapeo_vendedor_usuario_catalog_fkey
  FOREIGN KEY (catalog_type_id, id_sicas_vendedor)
  REFERENCES sicas_catalogos(catalog_type_id, id_sicas)
  ON DELETE CASCADE;

-- Paso 3: Actualizar sicas_mapeo_despacho_oficina
-- Eliminar FK antiguo
ALTER TABLE sicas_mapeo_despacho_oficina
  DROP CONSTRAINT IF EXISTS sicas_mapeo_despacho_oficina_id_sicas_despacho_fkey;

-- Agregar columna catalog_type_id si no existe
ALTER TABLE sicas_mapeo_despacho_oficina
  ADD COLUMN IF NOT EXISTS catalog_type_id INTEGER DEFAULT 11 NOT NULL;

-- Agregar nuevo FK compuesto
ALTER TABLE sicas_mapeo_despacho_oficina
  ADD CONSTRAINT sicas_mapeo_despacho_oficina_catalog_fkey
  FOREIGN KEY (catalog_type_id, id_sicas_despacho)
  REFERENCES sicas_catalogos(catalog_type_id, id_sicas)
  ON DELETE CASCADE;
