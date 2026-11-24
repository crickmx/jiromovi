/*
  # Fix SICAS Catalogos Nombres - Corregir JSON a texto simple
  
  1. Problema
    - Los nombres están guardados como JSON strings completos
    - Ejemplo: '{"IDDespacho":"1","DespNombre":"MARSELLA CORPORATIVO",...}'
    - Debería ser solo: 'MARSELLA CORPORATIVO'
    
  2. Solución
    - Para Despachos (ID 11): extraer raw->>'DespNombre'
    - Para Vendedores (ID 32): extraer raw->>'VendNombre'
    
  3. Seguridad
    - Solo actualiza nombres, preserva raw data
*/

-- Corregir nombres de Despachos (catalog_type_id = 11)
UPDATE sicas_catalogos
SET nombre = COALESCE(
  raw->>'DespNombre',
  raw->>'Despachonombre', 
  raw->>'DESPNOMBRE',
  raw->>'nombre',
  raw->>'Nombre',
  raw->>'NOMBRE',
  nombre
)
WHERE catalog_type_id = 11;

-- Corregir nombres de Vendedores (catalog_type_id = 32)
UPDATE sicas_catalogos
SET nombre = COALESCE(
  raw->>'VendNombre',
  raw->>'VENDNOMBRE',
  raw->>'VendedorNombre',
  raw->>'NombreVendedor',
  raw->>'Nombre',
  raw->>'nombre',
  nombre
)
WHERE catalog_type_id = 32;

-- Verificar resultados
DO $$
DECLARE
  despachos_total INTEGER;
  despachos_validos INTEGER;
  vendedores_total INTEGER;
  vendedores_validos INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE nombre NOT LIKE '{%' AND LENGTH(nombre) < 200)
  INTO despachos_total, despachos_validos
  FROM sicas_catalogos
  WHERE catalog_type_id = 11;
  
  SELECT COUNT(*), COUNT(*) FILTER (WHERE nombre NOT LIKE '{%' AND LENGTH(nombre) < 200)
  INTO vendedores_total, vendedores_validos
  FROM sicas_catalogos
  WHERE catalog_type_id = 32;
  
  RAISE NOTICE 'Despachos: % total, % con nombres correctos', despachos_total, despachos_validos;
  RAISE NOTICE 'Vendedores: % total, % con nombres correctos', vendedores_total, vendedores_validos;
  
  IF despachos_validos < despachos_total THEN
    RAISE WARNING 'Algunos despachos tienen nombres en formato JSON';
  END IF;
  
  IF vendedores_validos < vendedores_total THEN
    RAISE WARNING 'Algunos vendedores tienen nombres en formato JSON';
  END IF;
END $$;
