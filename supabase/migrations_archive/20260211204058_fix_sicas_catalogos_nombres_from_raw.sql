/*
  # Fix SICAS Catalogos Nombres from Raw Data
  
  1. Problema
    - Los nombres están guardados como JSON strings completos
    - Ejemplo: '{"IDDespacho":"1","DespNombre":"MARSELLA CORPORATIVO",...}'
    - Debería ser solo: 'MARSELLA CORPORATIVO'
    
  2. Solución
    - Extraer el nombre correcto desde el campo raw (jsonb)
    - Para Despachos (ID 11): usar raw->>'DespNombre'
    - Para Vendedores (ID 32): usar raw->>'VendedorNombre' o raw->>'NombreVendedor'
    
  3. Seguridad
    - Solo actualiza nombres, no modifica datos sensibles
*/

-- Corregir nombres de Despachos (catalog_type_id = 11)
UPDATE public.sicas_catalogos
SET nombre = COALESCE(
  raw->>'DespNombre',
  raw->>'Despachonombre', 
  raw->>'DESPNOMBRE',
  raw->>'nombre',
  raw->>'Nombre',
  raw->>'NOMBRE',
  nombre
)
WHERE catalog_type_id = 11
AND (
  nombre LIKE '{%' 
  OR nombre LIKE '"%'
  OR LENGTH(nombre) > 200
);

-- Corregir nombres de Vendedores (catalog_type_id = 32)
UPDATE public.sicas_catalogos
SET nombre = COALESCE(
  raw->>'VendedorNombre',
  raw->>'NombreVendedor',
  raw->>'VENDEDORNOMBRE',
  raw->>'NOMBREVENDEDOR',
  raw->>'Nombre',
  raw->>'nombre',
  raw->>'NOMBRE',
  nombre
)
WHERE catalog_type_id = 32
AND (
  nombre LIKE '{%' 
  OR nombre LIKE '"%'
  OR LENGTH(nombre) > 200
);

-- Verificar resultados
DO $$
DECLARE
  despachos_fixed INTEGER;
  vendedores_fixed INTEGER;
BEGIN
  SELECT COUNT(*) INTO despachos_fixed
  FROM public.sicas_catalogos
  WHERE catalog_type_id = 11
  AND nombre NOT LIKE '{%'
  AND nombre NOT LIKE '"%';
  
  SELECT COUNT(*) INTO vendedores_fixed
  FROM public.sicas_catalogos
  WHERE catalog_type_id = 32
  AND nombre NOT LIKE '{%'
  AND nombre NOT LIKE '"%';
  
  RAISE NOTICE 'Despachos con nombres correctos: %', despachos_fixed;
  RAISE NOTICE 'Vendedores con nombres correctos: %', vendedores_fixed;
END $$;
