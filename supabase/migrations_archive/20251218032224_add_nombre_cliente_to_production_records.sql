/*
  # Agregar columna nombre_cliente a production_records

  ## Propósito
  Separar el nombre del cliente real del nombre del despacho/oficina.

  ## Cambios
  1. Agregar columna `nombre_cliente` (text, nullable)
     - Almacena el nombre del cliente/asegurado (campo NombreCompleto del Excel)
  2. El campo existente `desp_nombre_raw` sigue siendo el despacho/oficina
  
  ## Notas
  - Los registros existentes tendrán nombre_cliente = NULL
  - Las nuevas importaciones deben poblar ambos campos
  - En frontend: mostrar nombre_cliente si existe, si no mostrar desp_nombre_raw
*/

-- Agregar columna nombre_cliente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'nombre_cliente'
  ) THEN
    ALTER TABLE production_records
      ADD COLUMN nombre_cliente text;
    
    COMMENT ON COLUMN production_records.nombre_cliente IS 'Nombre del cliente/asegurado real (NombreCompleto del Excel)';
  END IF;
END $$;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_production_records_nombre_cliente
  ON production_records(nombre_cliente)
  WHERE nombre_cliente IS NOT NULL;
