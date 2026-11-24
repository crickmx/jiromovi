-- Create Seguros Lesson Documents System
--
-- 1. New Tables
--   - seguros_lesson_documents (documentos de apoyo para lecciones)
--
-- 2. Storage
--   - Create seguros-lesson-documents bucket
--
-- 3. Security
--   - Enable RLS on seguros_lesson_documents table
--   - Admins can create, update, delete documents
--   - All authenticated users can view and download documents
--   - Maximum 5 documents per lesson

-- Create seguros_lesson_documents table
CREATE TABLE IF NOT EXISTS seguros_lesson_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES seguros_lessons(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  archivo_url text NOT NULL,
  tipo_archivo text,
  tamano_bytes bigint,
  descripcion text,
  orden integer DEFAULT 0,
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seguros_lesson_documents_lesson_id 
  ON seguros_lesson_documents(lesson_id, orden);

CREATE INDEX IF NOT EXISTS idx_seguros_lesson_documents_creado_por 
  ON seguros_lesson_documents(creado_por);

-- Enable RLS
ALTER TABLE seguros_lesson_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view documents
CREATE POLICY "All users can view lesson documents"
  ON seguros_lesson_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: Only admins can insert documents
CREATE POLICY "Admins can upload lesson documents"
  ON seguros_lesson_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- RLS Policies: Only admins can update documents
CREATE POLICY "Admins can update lesson documents"
  ON seguros_lesson_documents
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

-- RLS Policies: Only admins can delete documents
CREATE POLICY "Admins can delete lesson documents"
  ON seguros_lesson_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create function to check max 5 documents per lesson
CREATE OR REPLACE FUNCTION check_lesson_documents_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM seguros_lesson_documents WHERE lesson_id = NEW.lesson_id) >= 5 THEN
    RAISE EXCEPTION 'Una lección no puede tener más de 5 documentos de apoyo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce 5 documents limit
CREATE TRIGGER trigger_check_lesson_documents_limit
  BEFORE INSERT ON seguros_lesson_documents
  FOR EACH ROW
  EXECUTE FUNCTION check_lesson_documents_limit();

-- Create trigger for updated_at
CREATE TRIGGER trigger_seguros_lesson_documents_updated_at
  BEFORE UPDATE ON seguros_lesson_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for lesson documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('seguros-lesson-documents', 'seguros-lesson-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Admins can upload documents
CREATE POLICY "Admins can upload lesson documents to storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seguros-lesson-documents' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Storage policies: Admins can update documents
CREATE POLICY "Admins can update lesson documents in storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seguros-lesson-documents' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Storage policies: Admins can delete documents
CREATE POLICY "Admins can delete lesson documents from storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seguros-lesson-documents' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Storage policies: All authenticated users can view/download documents
CREATE POLICY "All users can view lesson documents in storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'seguros-lesson-documents');