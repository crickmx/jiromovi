/*
  # Fix Publicidad Storage Public Access

  1. Changes
    - Eliminar políticas de storage existentes que requieren autenticación
    - Crear nuevas políticas que permitan acceso público anónimo de lectura
    - Mantener políticas de escritura solo para usuarios autenticados

  2. Security
    - Lectura pública para todos (anónimo y autenticado)
    - Escritura solo para usuarios autenticados según rol
*/

-- Eliminar políticas existentes para publicidad-plantillas (SELECT)
DROP POLICY IF EXISTS "Todos pueden ver plantillas" ON storage.objects;

-- Eliminar políticas existentes para publicidad-logos (SELECT)
DROP POLICY IF EXISTS "Todos pueden ver logos" ON storage.objects;

-- Eliminar políticas existentes para publicidad-disenos (SELECT)
DROP POLICY IF EXISTS "Usuarios pueden ver diseños" ON storage.objects;

-- Crear políticas de lectura pública para publicidad-plantillas
CREATE POLICY "Acceso público a plantillas"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'publicidad-plantillas');

-- Crear políticas de lectura pública para publicidad-logos
CREATE POLICY "Acceso público a logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'publicidad-logos');

-- Crear políticas de lectura pública para publicidad-disenos
CREATE POLICY "Acceso público a diseños"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'publicidad-disenos');

-- Asegurar que los buckets están marcados como públicos
UPDATE storage.buckets
SET public = true
WHERE id IN ('publicidad-plantillas', 'publicidad-logos', 'publicidad-disenos');