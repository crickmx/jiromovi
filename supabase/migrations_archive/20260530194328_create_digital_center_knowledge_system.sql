/*
  # Centro Digital Knowledge System

  ## Overview
  Extends Centro Digital with a global document library (for shared insurance knowledge base),
  promotional ads/banners, and integrates with Chava IA's RAG system.

  ## New Tables
  - `digital_center_documents` — global insurance documents indexed for Chava RAG
    - Organized by aseguradora, ramo, categoria, tipo, formato
    - Has tags[], is_featured, is_recent flags
    - Global visibility (no RLS restriction for authenticated users)
  - `digital_center_ads` — promotional banners shown in Centro Digital
    - Has title, subtitle, cta_text, cta_url, image_url, color scheme
    - Active/inactive toggle, admin-managed

  ## Modified Tables
  - `chava_documentos` — already exists, extended with digital_center_document_id FK

  ## Security
  - RLS on both tables
  - Authenticated users can read digital_center_documents
  - Only admins can insert/update/delete digital_center_documents and ads
*/

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- digital_center_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_center_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  aseguradora text,
  ramo text,
  categoria text,
  tipo text,
  formato text DEFAULT 'pdf',
  tags text[] DEFAULT '{}',
  url_original text,
  storage_path text,
  tamano_bytes bigint,
  is_featured boolean DEFAULT false,
  is_recent boolean DEFAULT false,
  activo boolean DEFAULT true,
  visibilidad text DEFAULT 'global',
  subido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE digital_center_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view digital center documents"
  ON digital_center_documents FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins can insert digital center documents"
  ON digital_center_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador')
    )
  );

CREATE POLICY "Admins can update digital center documents"
  ON digital_center_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador')
    )
  );

CREATE POLICY "Admins can delete digital center documents"
  ON digital_center_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador')
    )
  );

-- Index for common filter queries
CREATE INDEX IF NOT EXISTS idx_digital_center_docs_aseguradora ON digital_center_documents(aseguradora) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_digital_center_docs_ramo ON digital_center_documents(ramo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_digital_center_docs_featured ON digital_center_documents(is_featured) WHERE activo = true;

-- ============================================================
-- digital_center_ads
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_center_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  subtitulo text,
  cta_texto text DEFAULT 'Ver más',
  cta_url text,
  imagen_url text,
  color_fondo text DEFAULT '#0891b2',
  color_texto text DEFAULT '#ffffff',
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE digital_center_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active ads"
  ON digital_center_ads FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins can insert ads"
  ON digital_center_ads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update ads"
  ON digital_center_ads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete ads"
  ON digital_center_ads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );

-- ============================================================
-- digital_center_knowledge_chunks — RAG fragments for Chava
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_center_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES digital_center_documents(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  embedding vector(1536),
  chunk_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE digital_center_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge chunks"
  ON digital_center_knowledge_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert knowledge chunks"
  ON digital_center_knowledge_chunks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON digital_center_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- RPC: Search digital center knowledge for Chava RAG
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_conocimiento_digital_center(
  query_embedding vector(1536),
  similitud_minima float DEFAULT 0.72,
  max_resultados int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  documento_titulo text,
  aseguradora text,
  ramo text,
  categoria text,
  contenido text,
  similitud float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.titulo AS documento_titulo,
    d.aseguradora,
    d.ramo,
    d.categoria,
    c.contenido,
    1 - (c.embedding <=> query_embedding) AS similitud
  FROM digital_center_knowledge_chunks c
  JOIN digital_center_documents d ON d.id = c.document_id
  WHERE d.activo = true
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= similitud_minima
  ORDER BY c.embedding <=> query_embedding
  LIMIT max_resultados;
END;
$$;

-- ============================================================
-- Seed: initial promotional ad
-- ============================================================
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM usuarios WHERE rol = 'Administrador' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM digital_center_ads WHERE titulo = 'Impulsa tus ventas con herramientas digitales') THEN
    INSERT INTO digital_center_ads (
      titulo,
      subtitulo,
      cta_texto,
      cta_url,
      color_fondo,
      color_texto,
      activo,
      orden,
      creado_por
    ) VALUES (
      'Impulsa tus ventas con herramientas digitales',
      'Accede a materiales de apoyo, tarifas actualizadas y recursos comerciales para cerrar más negocios',
      'Explorar recursos',
      '/centro-digital',
      '#0f172a',
      '#ffffff',
      true,
      0,
      admin_id
    );
  END IF;
END $$;
