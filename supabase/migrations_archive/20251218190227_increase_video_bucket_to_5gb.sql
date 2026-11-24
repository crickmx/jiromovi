/*
  # Aumentar límite del bucket de videos a 5GB

  1. Cambios
    - Aumentar file_size_limit a 5GB (5368709120 bytes)
    - Asegurar que el bucket esté público
    - Verificar que las políticas de storage estén correctas
    - Remover restricción de allowed_mime_types para máxima compatibilidad

  2. Notas
    - 5GB permite videos largos y de alta calidad
    - Supabase usa TUS protocol para uploads resumibles
    - La validación de tamaño se hace en el frontend para mejor UX
*/

-- Verificar que el bucket existe, si no, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-videos',
  'seguros-videos',
  true,
  5368709120,
  NULL
)
ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = 5368709120,
  public = true,
  allowed_mime_types = NULL;

-- Asegurar que el bucket de thumbnails también esté configurado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-thumbnails',
  'seguros-thumbnails',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = 10485760,
  public = true;

-- Asegurar políticas de storage para videos
DO $$
BEGIN
  -- Policy para permitir subir videos (solo administradores)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload videos'
  ) THEN
    CREATE POLICY "Admins can upload videos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'seguros-videos' 
      AND (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol = 'Administrador'
        )
      )
    );
  END IF;

  -- Policy para permitir leer videos (todos los usuarios autenticados)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view videos'
  ) THEN
    CREATE POLICY "Anyone can view videos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'seguros-videos');
  END IF;

  -- Policy para permitir eliminar videos (solo administradores)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete videos'
  ) THEN
    CREATE POLICY "Admins can delete videos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'seguros-videos' 
      AND (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol = 'Administrador'
        )
      )
    );
  END IF;

  -- Policies para thumbnails
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload thumbnails'
  ) THEN
    CREATE POLICY "Admins can upload thumbnails"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'seguros-thumbnails' 
      AND (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol = 'Administrador'
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view thumbnails'
  ) THEN
    CREATE POLICY "Anyone can view thumbnails"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'seguros-thumbnails');
  END IF;
END $$;