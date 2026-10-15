/*
  # Increase Assistant Files Storage Limit to 500MB

  1. Changes
    - Update assistant-files bucket file size limit to 500MB
    - Allow larger document uploads for assistant
*/

-- Update the bucket to allow 500MB files
UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB in bytes
WHERE id = 'assistant-files';
