/*
  # Add Documents Storage and Management

  1. New Tables
    - `documentos_usuarios`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, foreign key to usuarios)
      - `nombre_archivo` (text, required) - Display name of the document
      - `tipo_documento` (text, optional) - Document type/category
      - `url_archivo` (text, required) - Storage URL
      - `tamano_bytes` (bigint, optional) - File size in bytes
      - `tipo_mime` (text, optional) - MIME type
      - `created_at` (timestamptz) - Upload timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Storage
    - Create 'documentos' bucket for file storage
    - Configure bucket policies for authenticated access

  3. Security
    - Enable RLS on `documentos_usuarios` table
    - Admin users can manage all documents
    - Regular users can only view their own documents
    - Storage policies allow authenticated users to upload/download

  4. Important Notes
    - Files are stored in Supabase Storage
    - File URLs are stored in the database
    - Each document belongs to one user
    - Cascade delete removes documents when user is deleted
*/

-- Create documentos_usuarios table
CREATE TABLE IF NOT EXISTS documentos_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  tipo_documento text DEFAULT '',
  url_archivo text NOT NULL,
  tamano_bytes bigint DEFAULT 0,
  tipo_mime text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_documentos_usuario_id ON documentos_usuarios(usuario_id);

-- Enable RLS
ALTER TABLE documentos_usuarios ENABLE ROW LEVEL SECURITY;

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
  ON documentos_usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON documentos_usuarios FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Admins can insert documents for any user
CREATE POLICY "Admins can insert documents"
  ON documentos_usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can insert documents for themselves
CREATE POLICY "Users can insert own documents"
  ON documentos_usuarios FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Admins can update all documents
CREATE POLICY "Admins can update documents"
  ON documentos_usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON documentos_usuarios FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Admins can delete all documents
CREATE POLICY "Admins can delete documents"
  ON documentos_usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documentos_usuarios FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documentos bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos');

-- Allow authenticated users to view documents
CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

-- Admins can delete any document
CREATE POLICY "Admins can delete any document"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents in storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can update any document
CREATE POLICY "Admins can update any document"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can update their own documents
CREATE POLICY "Users can update own documents in storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
