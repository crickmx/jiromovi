/*
  # Fix Publicidad Storage - Enable Anonymous Public Access

  1. Changes
    - Remove existing policies that only allow authenticated users
    - Create new policies that allow public anonymous access for SELECT
    - Keep authenticated-only policies for INSERT/UPDATE/DELETE operations

  2. Security
    - Public (anonymous + authenticated) READ access for all publicidad buckets
    - Authenticated-only WRITE access (insert/update/delete)
*/

-- Drop existing restrictive policies for publicidad-plantillas
DROP POLICY IF EXISTS "Todos pueden ver plantillas publicidad" ON storage.objects;
DROP POLICY IF EXISTS "Acceso público a plantillas" ON storage.objects;

-- Drop existing restrictive policies for publicidad-logos  
DROP POLICY IF EXISTS "Todos pueden ver logos publicidad" ON storage.objects;
DROP POLICY IF EXISTS "Acceso público a logos" ON storage.objects;

-- Drop existing restrictive policies for publicidad-disenos
DROP POLICY IF EXISTS "Todos pueden ver diseños publicidad" ON storage.objects;
DROP POLICY IF EXISTS "Acceso público a diseños" ON storage.objects;

-- Create PUBLIC access policies for SELECT (read) operations
-- These policies allow both anonymous and authenticated users

CREATE POLICY "Public can view publicidad plantillas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'publicidad-plantillas');

CREATE POLICY "Public can view publicidad logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'publicidad-logos');

CREATE POLICY "Public can view publicidad disenos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'publicidad-disenos');

-- Ensure buckets are marked as public
UPDATE storage.buckets
SET public = true
WHERE id IN ('publicidad-plantillas', 'publicidad-logos', 'publicidad-disenos');