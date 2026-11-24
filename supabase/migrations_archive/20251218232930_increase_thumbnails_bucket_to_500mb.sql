/*
  # Aumentar límite del bucket de miniaturas a 500MB

  1. Cambios
    - Aumentar file_size_limit de seguros-thumbnails a 500MB (524288000 bytes)
    - Mantener configuración pública y tipos MIME permitidos
    - Necesario para permitir miniaturas de alta calidad y videos cortos de previsualización

  2. Notas
    - 500MB permite:
      - Miniaturas de muy alta resolución
      - Clips de video cortos para previsualización
      - GIFs animados de alta calidad
    - El bucket mantiene su acceso público para visualización
*/

-- Actualizar el bucket de thumbnails a 500MB
UPDATE storage.buckets
SET
  file_size_limit = 524288000,  -- 500MB en bytes
  public = true,
  allowed_mime_types = NULL  -- Permitir todos los tipos de imagen y video
WHERE id = 'seguros-thumbnails';

-- Si el bucket no existe, crearlo con el nuevo límite
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguros-thumbnails',
  'seguros-thumbnails',
  true,
  524288000,  -- 500MB
  NULL
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = 524288000,
  public = true,
  allowed_mime_types = NULL;