/*
  # Agregar campos de Orden de Compra a Store

  1. Nuevas Columnas en store_pedidos
    - `forma_pago`: Enum con periodicidad (Contado, Semestral, Trimestral, Mensual)
    - `metodo_pago`: Enum con canal de pago (Cargo a Oficina, Bono, etc.)
    - `metodo_pago_otro_detalle`: Texto cuando método = 'Otro'
    - `folio_oc`: Folio alfanumérico único de 8 caracteres
    - `observaciones_oc`: Observaciones del admin para la OC
    - `oc_generada_por`: ID del admin que generó la OC
    - `oc_generada_en`: Timestamp de generación de OC

  2. Seguridad
    - Solo admins pueden modificar estos campos
*/

-- Crear tipos enum para forma y método de pago
DO $$ BEGIN
  CREATE TYPE forma_pago_oc AS ENUM (
    'Contado',
    'Mensual',
    'Trimestral',
    'Semestral'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE metodo_pago_oc AS ENUM (
    'Cargo a Oficina',
    'Cargo a Bono de Agente',
    'Pago Directo',
    'Descuento de Comisiones',
    'Cargo a Nómina',
    'Otro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Agregar columnas a store_pedidos
ALTER TABLE store_pedidos 
  ADD COLUMN IF NOT EXISTS forma_pago forma_pago_oc,
  ADD COLUMN IF NOT EXISTS metodo_pago metodo_pago_oc,
  ADD COLUMN IF NOT EXISTS metodo_pago_otro_detalle text,
  ADD COLUMN IF NOT EXISTS folio_oc varchar(8) UNIQUE,
  ADD COLUMN IF NOT EXISTS observaciones_oc text,
  ADD COLUMN IF NOT EXISTS oc_generada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oc_generada_en timestamptz;

-- Validación: si método = 'Otro', debe tener detalle
ALTER TABLE store_pedidos
  ADD CONSTRAINT check_metodo_pago_otro_detalle
  CHECK (
    metodo_pago != 'Otro' OR 
    (metodo_pago = 'Otro' AND metodo_pago_otro_detalle IS NOT NULL AND trim(metodo_pago_otro_detalle) != '')
  );

-- Índice para búsqueda por folio
CREATE INDEX IF NOT EXISTS idx_store_pedidos_folio_oc ON store_pedidos(folio_oc) WHERE folio_oc IS NOT NULL;

-- Función para generar folio único de OC
CREATE OR REPLACE FUNCTION generar_folio_oc()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  folio text;
  existe boolean;
  intentos integer := 0;
  max_intentos integer := 100;
BEGIN
  LOOP
    -- Generar folio alfanumérico de 8 caracteres (mayúsculas y números)
    folio := upper(
      substring(md5(random()::text || clock_timestamp()::text) from 1 for 8)
    );
    
    -- Verificar si existe
    SELECT EXISTS(
      SELECT 1 FROM store_pedidos WHERE folio_oc = folio
    ) INTO existe;
    
    EXIT WHEN NOT existe;
    
    intentos := intentos + 1;
    IF intentos >= max_intentos THEN
      RAISE EXCEPTION 'No se pudo generar folio único después de % intentos', max_intentos;
    END IF;
  END LOOP;
  
  RETURN folio;
END;
$$;

-- Comentarios
COMMENT ON COLUMN store_pedidos.forma_pago IS 'Periodicidad de pago: Contado, Mensual, Trimestral, Semestral';
COMMENT ON COLUMN store_pedidos.metodo_pago IS 'Canal de pago: Cargo a Oficina, Bono, Pago Directo, etc.';
COMMENT ON COLUMN store_pedidos.metodo_pago_otro_detalle IS 'Detalle obligatorio cuando método = Otro';
COMMENT ON COLUMN store_pedidos.folio_oc IS 'Folio único alfanumérico de 8 caracteres para Orden de Compra';
COMMENT ON COLUMN store_pedidos.observaciones_oc IS 'Observaciones del admin para la OC';
COMMENT ON COLUMN store_pedidos.oc_generada_por IS 'Admin que generó la Orden de Compra';
COMMENT ON COLUMN store_pedidos.oc_generada_en IS 'Fecha y hora de generación de la OC';
