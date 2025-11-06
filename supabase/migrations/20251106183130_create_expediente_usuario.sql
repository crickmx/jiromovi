/*
  # Create Employee File/Expediente System

  1. New Tables
    - `expediente_usuario`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, foreign key to usuarios)
      - `nombre_archivo` (text) - Original file name
      - `descripcion` (text) - File description/notes
      - `tipo_documento` (text) - Document type (e.g., "Contrato", "Identificación", "CV", etc.)
      - `archivo_url` (text) - Storage URL
      - `archivo_path` (text) - Storage path
      - `size_bytes` (bigint) - File size
      - `mime_type` (text) - File MIME type
      - `subido_por` (uuid, foreign key to usuarios) - Who uploaded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `expediente_usuario` table
    - Add policies for Administrador and Gerente to manage files
    - Gerentes can only see files from their office users

  3. Storage
    - Create storage bucket for employee files
    - Set up policies for upload/download
*/

-- Create expediente_usuario table
CREATE TABLE IF NOT EXISTS expediente_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  descripcion text DEFAULT '',
  tipo_documento text DEFAULT 'Otro',
  archivo_url text NOT NULL,
  archivo_path text NOT NULL,
  size_bytes bigint DEFAULT 0,
  mime_type text DEFAULT 'application/octet-stream',
  subido_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expediente_usuario_usuario_id ON expediente_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_expediente_usuario_subido_por ON expediente_usuario(subido_por);

-- Enable RLS
ALTER TABLE expediente_usuario ENABLE ROW LEVEL SECURITY;

-- Policy: Administrador can view all files
CREATE POLICY "Administrador can view all expediente files"
  ON expediente_usuario
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policy: Gerente can view files from their office
CREATE POLICY "Gerente can view expediente files from their office"
  ON expediente_usuario
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      INNER JOIN usuarios u2 ON u1.oficina_id = u2.oficina_id
      WHERE u1.id = auth.uid()
      AND u1.rol = 'Gerente'
      AND u2.id = expediente_usuario.usuario_id
    )
  );

-- Policy: Administrador can insert files
CREATE POLICY "Administrador can insert expediente files"
  ON expediente_usuario
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policy: Gerente can insert files for their office users
CREATE POLICY "Gerente can insert expediente files for their office"
  ON expediente_usuario
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u1
      INNER JOIN usuarios u2 ON u1.oficina_id = u2.oficina_id
      WHERE u1.id = auth.uid()
      AND u1.rol = 'Gerente'
      AND u2.id = expediente_usuario.usuario_id
    )
  );

-- Policy: Administrador can update files
CREATE POLICY "Administrador can update expediente files"
  ON expediente_usuario
  FOR UPDATE
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

-- Policy: Gerente can update files from their office
CREATE POLICY "Gerente can update expediente files from their office"
  ON expediente_usuario
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      INNER JOIN usuarios u2 ON u1.oficina_id = u2.oficina_id
      WHERE u1.id = auth.uid()
      AND u1.rol = 'Gerente'
      AND u2.id = expediente_usuario.usuario_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u1
      INNER JOIN usuarios u2 ON u1.oficina_id = u2.oficina_id
      WHERE u1.id = auth.uid()
      AND u1.rol = 'Gerente'
      AND u2.id = expediente_usuario.usuario_id
    )
  );

-- Policy: Administrador can delete files
CREATE POLICY "Administrador can delete expediente files"
  ON expediente_usuario
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policy: Gerente can delete files from their office
CREATE POLICY "Gerente can delete expediente files from their office"
  ON expediente_usuario
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      INNER JOIN usuarios u2 ON u1.oficina_id = u2.oficina_id
      WHERE u1.id = auth.uid()
      AND u1.rol = 'Gerente'
      AND u2.id = expediente_usuario.usuario_id
    )
  );

-- Create storage bucket for expediente files
INSERT INTO storage.buckets (id, name, public)
VALUES ('expediente-usuarios', 'expediente-usuarios', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Authenticated users can view files based on RLS
CREATE POLICY "Authenticated users can view expediente files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'expediente-usuarios');

-- Storage policies: Administrador and Gerente can upload
CREATE POLICY "Admin and Gerente can upload expediente files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expediente-usuarios'
    AND (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
      )
    )
  );

-- Storage policies: Administrador and Gerente can update
CREATE POLICY "Admin and Gerente can update expediente files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expediente-usuarios'
    AND (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
      )
    )
  );

-- Storage policies: Administrador and Gerente can delete
CREATE POLICY "Admin and Gerente can delete expediente files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expediente-usuarios'
    AND (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
      )
    )
  );