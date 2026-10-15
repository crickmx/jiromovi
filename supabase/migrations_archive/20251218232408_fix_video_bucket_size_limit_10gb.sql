/*
  # Aumentar límite del bucket de videos a 10GB

  1. Cambios
    - Aumentar file_size_limit a 10GB (10737418240 bytes)
    - Asegurar que el bucket esté configurado correctamente
    - Remover cualquier restricción de MIME types

  2. Notas
    - 10GB permite videos muy largos y de alta calidad
    - Supabase usa TUS protocol para uploads resumibles automáticamente
    - Este límite es suficiente para la mayoría de videos educativos
*/

-- Actualizar el bucket de videos a 10GB
UPDATE storage.buckets
SET
  file_size_limit = 10737418240,  -- 10GB en bytes
  public = true,
  allowed_mime_types = NULL  -- Permitir todos los tipos
WHERE id = 'seguros-videos';

-- Si el bucket no existe, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-videos',
  'seguros-videos',
  true,
  10737418240,  -- 10GB
  NULL
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = 10737418240,
  public = true,
  allowed_mime_types = NULL;

-- Asegurar bucket de thumbnails también esté bien configurado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-thumbnails',
  'seguros-thumbnails',
  true,
  10485760,  -- 10MB para thumbnails
  NULL  -- Permitir todos los tipos de imagen
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = 10485760,
  public = true,
  allowed_mime_types = NULL;