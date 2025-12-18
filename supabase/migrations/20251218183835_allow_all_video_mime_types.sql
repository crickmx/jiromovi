/*
  # Permitir todos los tipos MIME en bucket de videos

  1. Cambios
    - Remover restricción de allowed_mime_types para permitir cualquier archivo
    - Esto resuelve problemas con archivos detectados como application/octet-stream
    - La validación de tipo de archivo se hará en el frontend

  2. Notas
    - Algunos navegadores/sistemas operativos detectan videos como application/octet-stream
    - Es más flexible permitir todos los tipos y validar en la aplicación
*/

-- Permitir todos los tipos MIME en el bucket de videos
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'seguros-videos';
