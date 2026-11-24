/*
  # Aumentar límite de carga de videos a 2GB

  1. Cambios
    - Actualizar bucket seguros-videos para permitir archivos de hasta 2GB
    - Configurar file_size_limit en el bucket

  2. Notas
    - El límite por defecto en Supabase es 50MB
    - Aumentamos a 2GB (2147483648 bytes) para videos largos
    - Esto permite subir videos de mayor duración y calidad
*/

-- Actualizar el bucket seguros-videos con límite de 2GB
UPDATE storage.buckets
SET file_size_limit = 2147483648
WHERE id = 'seguros-videos';
