/*
  # Fix SICAS Vendedores - Extraer VendNombre
  
  1. Problema
    - Los vendedores usan el campo 'VendNombre' no 'VendedorNombre'
    - La migración anterior no usaba el campo correcto
    
  2. Solución
    - Extraer desde raw->>'VendNombre'
*/

-- Corregir nombres de Vendedores usando VendNombre
UPDATE public.sicas_catalogos
SET nombre = COALESCE(
  raw->>'VendNombre',          -- Campo correcto usado por SICAS
  raw->>'VENDNOMBRE',
  raw->>'VendedorNombre',
  raw->>'NombreVendedor',
  raw->>'Nombre',
  raw->>'nombre',
  nombre
)
WHERE catalog_type_id = 32
AND (
  nombre LIKE '{%' 
  OR nombre LIKE '"%'
  OR LENGTH(nombre) > 200
);

-- Verificar algunos ejemplos
SELECT 
  id_sicas,
  LEFT(nombre, 50) as nombre_corregido,
  raw->>'VendNombre' as campo_raw
FROM public.sicas_catalogos
WHERE catalog_type_id = 32
ORDER BY id_sicas::int
LIMIT 5;
