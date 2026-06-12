-- Create storage bucket for tariff file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tariff-uploads',
  'tariff-uploads',
  false,
  52428800,
  ARRAY['application/vnd.ms-excel.sheet.macroEnabled.12', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to tariff-uploads bucket
CREATE POLICY "authenticated_upload_tariff_files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tariff-uploads');

-- Allow authenticated users to read their uploads
CREATE POLICY "authenticated_read_tariff_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tariff-uploads');

-- Allow service role to delete processed files (via edge function)
CREATE POLICY "service_delete_tariff_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tariff-uploads');