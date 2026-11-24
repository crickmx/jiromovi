/*
  # Storage para Assets de Páginas Web

  ## Descripción
  Crea el bucket de storage para logos de aseguradoras e iconos de ramos.

  ## Bucket
  - `web-page-assets` - Para logos y iconos del módulo de páginas web

  ## Políticas
  - Admin puede subir archivos
  - Todos pueden ver archivos (públicos)
*/

-- Crear bucket para assets de páginas web
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-page-assets', 'web-page-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: Admin puede subir
CREATE POLICY "Admins can upload web page assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'web-page-assets'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Admin puede actualizar
CREATE POLICY "Admins can update web page assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'web-page-assets'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Admin puede eliminar
CREATE POLICY "Admins can delete web page assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'web-page-assets'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Todos pueden ver (público)
CREATE POLICY "Anyone can view web page assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'web-page-assets');
