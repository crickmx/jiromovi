/*
  # Sistema de Logotipos Unificado

  1. Nuevas columnas
    - `oficinas.logo_url` - Logo de la oficina
    - `usuarios.mi_logotipo_url` - Logo personal del usuario
  
  2. Storage Buckets
    - `oficinas-logos` - Para logos de oficinas
    - `usuarios-logos` - Para logos personales de usuarios
  
  3. Función SQL
    - `get_effective_user_logo(user_id)` - Resuelve la jerarquía: Mi Logotipo → Logo Oficina → Logo JIRO
  
  4. Seguridad
    - RLS policies para control de acceso a storage
    - Solo usuarios autenticados pueden ver logos
    - Solo administradores pueden editar logos de oficina
    - Usuarios pueden editar su propio logo
*/

-- Add logo columns to oficinas and usuarios
ALTER TABLE oficinas ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mi_logotipo_url text;

-- Create storage buckets for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('oficinas-logos', 'oficinas-logos', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
  ('usuarios-logos', 'usuarios-logos', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view office logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload office logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update office logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete office logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view user logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;

-- RLS Policies for oficinas-logos bucket
CREATE POLICY "Authenticated users can view office logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'oficinas-logos');

CREATE POLICY "Admins can upload office logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'oficinas-logos' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update office logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'oficinas-logos' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete office logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'oficinas-logos' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- RLS Policies for usuarios-logos bucket
CREATE POLICY "Authenticated users can view user logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'usuarios-logos');

CREATE POLICY "Users can upload their own logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'usuarios-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'usuarios-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'usuarios-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Drop and recreate function to resolve logo hierarchy
DROP FUNCTION IF EXISTS get_effective_user_logo(uuid);

CREATE OR REPLACE FUNCTION get_effective_user_logo(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_logo_url text;
  v_oficina_logo text;
BEGIN
  -- First try: User's personal logo
  SELECT mi_logotipo_url INTO v_logo_url
  FROM usuarios
  WHERE id = p_user_id;
  
  IF v_logo_url IS NOT NULL AND v_logo_url != '' THEN
    RETURN v_logo_url;
  END IF;
  
  -- Second try: Office logo
  SELECT o.logo_url INTO v_oficina_logo
  FROM usuarios u
  JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.id = p_user_id;
  
  IF v_oficina_logo IS NOT NULL AND v_oficina_logo != '' THEN
    RETURN v_oficina_logo;
  END IF;
  
  -- Third try: Default JIRO logo
  RETURN '/logojiro.png';
END;
$$;