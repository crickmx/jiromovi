/*
  # Agregar Soporte para Adjuntos en Chat
  
  ## Nuevas Funcionalidades
  1. Bucket de storage para archivos del chat
  2. Columnas en chat_mensajes para adjuntos
  3. Políticas RLS para storage
  
  ## Cambios
  - Crear bucket 'chat-attachments'
  - Agregar columnas de adjuntos
  - Configurar políticas de acceso
*/

-- ============================================
-- 1. AGREGAR COLUMNAS A chat_mensajes
-- ============================================

-- Agregar columna para URL del archivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_mensajes' AND column_name = 'archivo_url'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN archivo_url text;
  END IF;
END $$;

-- Agregar columna para nombre del archivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_mensajes' AND column_name = 'archivo_nombre'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN archivo_nombre text;
  END IF;
END $$;

-- Agregar columna para tipo MIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_mensajes' AND column_name = 'archivo_tipo'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN archivo_tipo text;
  END IF;
END $$;

-- Agregar columna para tamaño del archivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_mensajes' AND column_name = 'archivo_tamano'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN archivo_tamano bigint;
  END IF;
END $$;

-- Agregar columna eliminado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_mensajes' AND column_name = 'eliminado'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN eliminado boolean DEFAULT false;
  END IF;
END $$;

-- Actualizar constraint de tipo
ALTER TABLE chat_mensajes DROP CONSTRAINT IF EXISTS chat_mensajes_tipo_check;
ALTER TABLE chat_mensajes 
ADD CONSTRAINT chat_mensajes_tipo_check 
CHECK (tipo IN ('texto', 'imagen', 'archivo', 'video', 'audio'));

-- ============================================
-- 2. CREAR BUCKET DE STORAGE
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
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
    'video/mp4',
    'audio/mpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. POLÍTICAS RLS PARA STORAGE (SIMPLES)
-- ============================================

-- Política de SELECT: Usuarios autenticados pueden ver
CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Política de INSERT: Usuarios autenticados pueden subir
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Política de UPDATE: Usuarios autenticados pueden actualizar
CREATE POLICY "Authenticated users can update chat attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Política de DELETE: Usuarios autenticados pueden eliminar
CREATE POLICY "Authenticated users can delete chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments');

-- ============================================
-- LOG
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Columnas de adjuntos agregadas';
  RAISE NOTICE '✅ Bucket chat-attachments creado (50 MB max)';
  RAISE NOTICE '✅ Políticas RLS configuradas';
END $$;
