/*
  # Actualizar límite de adjuntos de tareas CRM

  1. Cambios
    - Aumentar límite de tamaño de archivo de 10MB a 50MB
    - Permitir cualquier formato de archivo (remover restricción de tipos MIME)

  2. Modificaciones
    - Actualizar configuración del bucket crm-tareas-adjuntos
*/

-- Actualizar bucket para permitir 50MB y cualquier tipo de archivo
UPDATE storage.buckets
SET 
  file_size_limit = 52428800,  -- 50MB en bytes
  allowed_mime_types = NULL     -- NULL permite cualquier tipo de archivo
WHERE id = 'crm-tareas-adjuntos';
