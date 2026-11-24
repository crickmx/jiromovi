/*
  # Crear Bucket para archivos del Chat

  1. Bucket
    - Crear bucket 'chat-files' para almacenar archivos del chat
    - Público para facilitar acceso
    - Límite de 10MB por archivo
*/

-- Crear bucket para archivos de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'text/plain',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;
