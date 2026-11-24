/*
  # Add Document Attachments for Assistant
  
  1. New Table
    - `assistant_attachments`
      - `id` (uuid, primary key)
      - `mensaje_id` (uuid, references mensajes_chatgpt)
      - `file_name` (text)
      - `file_size` (integer)
      - `file_type` (text)
      - `storage_path` (text)
      - `uploaded_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
  
  2. Storage Bucket
    - Create 'assistant-files' bucket for document uploads
  
  3. Security
    - Enable RLS on assistant_attachments
    - Users can only access their own attachments
    - Service role can manage all attachments
*/

-- Create assistant_attachments table
CREATE TABLE IF NOT EXISTS assistant_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id uuid REFERENCES mensajes_chatgpt(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attachments_mensaje 
ON assistant_attachments(mensaje_id);

CREATE INDEX IF NOT EXISTS idx_attachments_user 
ON assistant_attachments(uploaded_by);

-- Enable RLS
ALTER TABLE assistant_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own attachments"
  ON assistant_attachments FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can insert own attachments"
  ON assistant_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete own attachments"
  ON assistant_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
  );

CREATE POLICY "Service role can manage all attachments"
  ON assistant_attachments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for assistant files
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('assistant-files', 'assistant-files', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage policies for assistant-files bucket
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assistant-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assistant-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assistant-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role can manage all files"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'assistant-files')
  WITH CHECK (bucket_id = 'assistant-files');