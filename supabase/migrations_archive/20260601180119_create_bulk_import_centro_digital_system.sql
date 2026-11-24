/*
  # Create Bulk Import Centro Digital System

  1. New Tables
    - `bulk_import_jobs` - Tracks each import session
      - `id` (uuid, PK)
      - `titulo` (text) - Human-readable job name
      - `estado` (text) - pending, parsing, downloading, indexing, completed, error
      - `archivo_html_nombre` (text) - Original uploaded HTML filename
      - `total_links_encontrados` (integer) - Total links found in HTML
      - `total_descargables` (integer) - Links identified as downloadable files
      - `total_no_descargables` (integer) - Web links (excluded)
      - `total_descargados` (integer) - Successfully downloaded
      - `total_duplicados` (integer) - Skipped as duplicates
      - `total_errores` (integer) - Failed downloads
      - `total_indexados` (integer) - Successfully indexed for Chava AI
      - `carpeta_destino_id` (uuid, FK) - Target Centro Digital folder
      - `configuracion` (jsonb) - Import settings/filters
      - `iniciado_por` (uuid, FK) - Admin who started the import
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)

    - `bulk_import_items` - Individual document items within a job
      - `id` (uuid, PK)
      - `job_id` (uuid, FK→bulk_import_jobs)
      - `titulo` (text) - Document title from HTML card
      - `url_original` (text) - Source URL to download from
      - `aseguradora` (text) - Insurance company/institution
      - `categoria` (text) - Category classification
      - `ramo` (text) - Line of business
      - `descripcion` (text) - Description from HTML
      - `tags` (text[]) - Tags/keywords
      - `estado` (text) - pending, downloading, downloaded, stored, indexed, error, skipped, duplicate
      - `es_descargable` (boolean) - Whether link is a downloadable file
      - `tipo_mime_detectado` (text) - Detected MIME type
      - `tamano_bytes` (bigint) - File size after download
      - `storage_path` (text) - Path in Supabase storage
      - `archivo_centro_digital_id` (uuid, FK) - Resulting Centro Digital file
      - `error_mensaje` (text) - Error details if failed
      - `intentos` (integer) - Download retry count
      - `hash_contenido` (text) - SHA-256 for duplicate detection
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Only Administrador role can access

  3. Indexes
    - job_id index on items table
    - estado index for filtering
    - hash_contenido for duplicate lookups
    - url_original for uniqueness within job
*/

-- ── bulk_import_jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bulk_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT 'Importación Masiva',
  estado text NOT NULL DEFAULT 'pending'
    CHECK (estado IN ('pending', 'parsing', 'downloading', 'indexing', 'completed', 'error', 'cancelled')),
  archivo_html_nombre text,
  total_links_encontrados integer DEFAULT 0,
  total_descargables integer DEFAULT 0,
  total_no_descargables integer DEFAULT 0,
  total_descargados integer DEFAULT 0,
  total_duplicados integer DEFAULT 0,
  total_errores integer DEFAULT 0,
  total_indexados integer DEFAULT 0,
  carpeta_destino_id uuid REFERENCES centro_digital_carpetas(id) ON DELETE SET NULL,
  configuracion jsonb DEFAULT '{}',
  iniciado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  error_global text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bulk_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view import jobs"
  ON bulk_import_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can create import jobs"
  ON bulk_import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update import jobs"
  ON bulk_import_jobs FOR UPDATE
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

CREATE POLICY "Admins can delete import jobs"
  ON bulk_import_jobs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ── bulk_import_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bulk_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES bulk_import_jobs(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  url_original text NOT NULL,
  aseguradora text,
  categoria text,
  ramo text,
  descripcion text,
  tags text[] DEFAULT '{}',
  estado text NOT NULL DEFAULT 'pending'
    CHECK (estado IN ('pending', 'downloading', 'downloaded', 'stored', 'indexed', 'error', 'skipped', 'duplicate')),
  es_descargable boolean DEFAULT true,
  tipo_mime_detectado text,
  tamano_bytes bigint,
  storage_path text,
  archivo_centro_digital_id uuid REFERENCES centro_digital_archivos(id) ON DELETE SET NULL,
  error_mensaje text,
  intentos integer DEFAULT 0,
  hash_contenido text,
  nombre_archivo_original text,
  extension text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bulk_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view import items"
  ON bulk_import_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can create import items"
  ON bulk_import_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update import items"
  ON bulk_import_items FOR UPDATE
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

CREATE POLICY "Admins can delete import items"
  ON bulk_import_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bulk_import_items_job_id
  ON bulk_import_items(job_id);

CREATE INDEX IF NOT EXISTS idx_bulk_import_items_estado
  ON bulk_import_items(estado);

CREATE INDEX IF NOT EXISTS idx_bulk_import_items_hash
  ON bulk_import_items(hash_contenido)
  WHERE hash_contenido IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bulk_import_items_url
  ON bulk_import_items(job_id, url_original);

CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_estado
  ON bulk_import_jobs(estado);

CREATE INDEX IF NOT EXISTS idx_bulk_import_jobs_iniciado_por
  ON bulk_import_jobs(iniciado_por);
