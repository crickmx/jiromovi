/*
  # Create Centro Digital Intelligent Indexing System

  1. New Tables
    - `centro_digital_chunks` - Stores text chunks with vector embeddings for RAG
      - `id` (uuid, primary key)
      - `archivo_id` (uuid, FK to centro_digital_archivos)
      - `carpeta_id` (uuid, FK to centro_digital_carpetas, denormalized for fast filtering)
      - `contenido` (text, the chunk text)
      - `embedding` (vector(1536), OpenAI text-embedding-3-small)
      - `chunk_index` (integer, order within document)
      - `metadata` (jsonb, section headers, page numbers, etc.)
      - `created_at` (timestamptz)

    - `centro_digital_indexing_jobs` - Tracks document processing status
      - `id` (uuid, primary key)
      - `archivo_id` (uuid, FK to centro_digital_archivos)
      - `estado` (text: pendiente, procesando, completado, error)
      - `total_chunks` (integer)
      - `contenido_extraido_tamano` (integer, character count)
      - `error_mensaje` (text, error details if failed)
      - `iniciado_por` (uuid, user who triggered)
      - `created_at`, `completado_at` (timestamps)

  2. Functions
    - `buscar_centro_digital_chunks` - Vector similarity search respecting folder AI settings
    - `get_indexing_stats` - Stats for admin dashboard

  3. Security
    - RLS enabled on both tables
    - Chunks readable by authenticated users (filtered by folder permissions at query level)
    - Indexing jobs viewable by admins/gerentes
    - Service role can insert/update (edge function operations)

  4. Notes
    - Chunks are linked to both archivo and carpeta for efficient filtering
    - The search function filters by `enable_chava_ai = true` on the folder
    - External access is controlled by `external_chava_access` on the folder
    - Knowledge priority affects result ordering
*/

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- centro_digital_chunks - RAG fragments from Centro Digital files
-- ============================================================
CREATE TABLE IF NOT EXISTS centro_digital_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_id uuid NOT NULL REFERENCES centro_digital_archivos(id) ON DELETE CASCADE,
  carpeta_id uuid NOT NULL REFERENCES centro_digital_carpetas(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  embedding vector(1536),
  chunk_index integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE centro_digital_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chunks from AI-enabled folders"
  ON centro_digital_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM centro_digital_carpetas
      WHERE id = centro_digital_chunks.carpeta_id
      AND activa = true
      AND enable_chava_ai = true
    )
  );

CREATE POLICY "Service role can manage chunks"
  ON centro_digital_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Service role can delete chunks"
  ON centro_digital_chunks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

-- Indexes for vector search and filtering
CREATE INDEX IF NOT EXISTS idx_cd_chunks_embedding
  ON centro_digital_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_cd_chunks_archivo
  ON centro_digital_chunks(archivo_id);

CREATE INDEX IF NOT EXISTS idx_cd_chunks_carpeta
  ON centro_digital_chunks(carpeta_id);

-- ============================================================
-- centro_digital_indexing_jobs - Track processing status
-- ============================================================
CREATE TABLE IF NOT EXISTS centro_digital_indexing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_id uuid NOT NULL REFERENCES centro_digital_archivos(id) ON DELETE CASCADE,
  carpeta_id uuid NOT NULL REFERENCES centro_digital_carpetas(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente',
  total_chunks integer DEFAULT 0,
  contenido_extraido_tamano integer DEFAULT 0,
  error_mensaje text,
  iniciado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completado_at timestamptz,
  CONSTRAINT indexing_estado_check CHECK (estado IN ('pendiente', 'procesando', 'completado', 'error'))
);

ALTER TABLE centro_digital_indexing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gerentes can view indexing jobs"
  ON centro_digital_indexing_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can insert indexing jobs"
  ON centro_digital_indexing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can update indexing jobs"
  ON centro_digital_indexing_jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE INDEX IF NOT EXISTS idx_cd_indexing_jobs_archivo
  ON centro_digital_indexing_jobs(archivo_id);

CREATE INDEX IF NOT EXISTS idx_cd_indexing_jobs_estado
  ON centro_digital_indexing_jobs(estado);

-- ============================================================
-- RPC: Vector similarity search across Centro Digital chunks
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_centro_digital_chunks(
  query_embedding vector(1536),
  similitud_minima float DEFAULT 0.72,
  max_resultados int DEFAULT 8,
  solo_externo boolean DEFAULT false
)
RETURNS TABLE (
  chunk_id uuid,
  archivo_id uuid,
  carpeta_id uuid,
  archivo_nombre text,
  carpeta_nombre text,
  contenido text,
  metadata jsonb,
  similitud float,
  knowledge_priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.id AS chunk_id,
    ch.archivo_id,
    ch.carpeta_id,
    a.nombre AS archivo_nombre,
    c.nombre AS carpeta_nombre,
    ch.contenido,
    ch.metadata,
    (1 - (ch.embedding <=> query_embedding))::float AS similitud,
    c.knowledge_priority
  FROM centro_digital_chunks ch
  JOIN centro_digital_archivos a ON a.id = ch.archivo_id
  JOIN centro_digital_carpetas c ON c.id = ch.carpeta_id
  WHERE c.activa = true
    AND c.enable_chava_ai = true
    AND a.estado = 'activo'
    AND ch.embedding IS NOT NULL
    AND (1 - (ch.embedding <=> query_embedding)) >= similitud_minima
    AND (NOT solo_externo OR c.external_chava_access = true)
  ORDER BY
    c.knowledge_priority DESC,
    ch.embedding <=> query_embedding
  LIMIT max_resultados;
END;
$$;

-- ============================================================
-- RPC: Get indexing statistics for admin dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_centro_digital_indexing_stats()
RETURNS TABLE (
  total_carpetas_ai integer,
  total_archivos_indexados integer,
  total_chunks integer,
  total_pendientes integer,
  total_errores integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*)::integer FROM centro_digital_carpetas WHERE activa = true AND enable_chava_ai = true),
    (SELECT count(DISTINCT archivo_id)::integer FROM centro_digital_chunks),
    (SELECT count(*)::integer FROM centro_digital_chunks),
    (SELECT count(*)::integer FROM centro_digital_indexing_jobs WHERE estado = 'pendiente'),
    (SELECT count(*)::integer FROM centro_digital_indexing_jobs WHERE estado = 'error');
END;
$$;
