/*
  # Configurar bucket de videos para archivos grandes

  1. Cambios
    - Aumentar file_size_limit a 2GB
    - Configurar allowed_mime_types para videos
    - Asegurar que el bucket esté público

  2. Notas
    - Configuración optimizada para videos de hasta 2GB
    - Supabase usa TUS protocol automáticamente para archivos > 6MB
*/

-- Actualizar configuración del bucket seguros-videos
UPDATE storage.buckets
SET 
  file_size_limit = 2147483648,
  public = true,
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi'
  ]
WHERE id = 'seguros-videos';
