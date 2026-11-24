/*
  # Ensure All Required Storage Buckets Exist

  1. Storage Buckets
    - `avatars` - User profile pictures
    - `documentos` - User documents
    - `expediente-usuarios` - User file records
    - `chat-files` - Chat attachments
    - `publicidad-archivos` - Advertising files
    - `capacitaciones` - Training materials
    - `seguros-education` - Insurance education content

  2. Purpose
    - Ensure all buckets exist to prevent upload errors
    - Set appropriate public/private settings
    - Create missing storage policies

  3. Notes
    - Uses ON CONFLICT to safely handle existing buckets
    - Policies may already exist from previous migrations
*/

-- Create avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create documentos bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Create expediente-usuarios bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('expediente-usuarios', 'expediente-usuarios', false)
ON CONFLICT (id) DO NOTHING;

-- Create chat-files bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create publicidad-archivos bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('publicidad-archivos', 'publicidad-archivos', true)
ON CONFLICT (id) DO NOTHING;

-- Create capacitaciones bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('capacitaciones', 'capacitaciones', false)
ON CONFLICT (id) DO NOTHING;

-- Create seguros-education bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('seguros-education', 'seguros-education', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (public bucket)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Anyone can view avatars'
  ) THEN
    CREATE POLICY "Anyone can view avatars"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated users can upload avatars"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can update own avatar'
  ) THEN
    CREATE POLICY "Users can update own avatar"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Storage policies for documentos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can view documentos'
  ) THEN
    CREATE POLICY "Authenticated users can view documentos"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'documentos');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can upload documentos'
  ) THEN
    CREATE POLICY "Authenticated users can upload documentos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'documentos');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Admin and Gerente can delete documentos'
  ) THEN
    CREATE POLICY "Admin and Gerente can delete documentos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'documentos'
        AND (
          EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN ('Administrador', 'Gerente')
          )
        )
      );
  END IF;
END $$;