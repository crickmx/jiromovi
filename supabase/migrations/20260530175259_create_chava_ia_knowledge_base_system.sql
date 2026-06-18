/*
  # Chava IA - Knowledge Base & Copilot System

  1. New Tables
    - `chava_carpetas` - Folders/categories for organizing knowledge documents
      - `id` (uuid, PK)
      - `nombre` (text) - Folder name
      - `descripcion` (text) - Description
      - `carpeta_padre_id` (uuid, FK self) - Parent folder for nesting
      - `icono` (text) - Lucide icon name
      - `orden` (integer) - Display order
      - `activo` (boolean) - Active status
      - `created_at` / `updated_at` (timestamptz)
    
    - `chava_documentos` - Documents uploaded to knowledge base
      - `id` (uuid, PK)
      - `carpeta_id` (uuid, FK → chava_carpetas)
      - `titulo` (text) - Document title
      - `descripcion` (text) - Description
      - `archivo_url` (text) - Storage URL
      - `archivo_nombre` (text) - Original filename
      - `archivo_tipo` (text) - MIME type
      - `archivo_tamano` (bigint) - File size in bytes
      - `estado` (text) - processing, ready, error
      - `version` (integer) - Version number
      - `acceso` (text) - Access level (todos, administrador, gerente, ejecutivo, agente, seguwallet)
      - `contenido_extraido` (text) - Extracted text content
      - `total_fragmentos` (integer) - Number of chunks generated
      - `subido_por` (uuid, FK → usuarios)
      - `created_at` / `updated_at` (timestamptz)
    
    - `chava_fragmentos` - Document chunks with embeddings for RAG
      - `id` (uuid, PK)
      - `documento_id` (uuid, FK → chava_documentos)
      - `contenido` (text) - Chunk text
      - `embedding` (vector(1536)) - OpenAI embedding vector
      - `metadata` (jsonb) - Extra metadata (page, section, etc.)
      - `orden` (integer) - Chunk order in document
      - `created_at` (timestamptz)
    
    - `chava_modulos_descubiertos` - Auto-discovered platform modules
      - `id` (uuid, PK)
      - `nombre` (text) - Module name
      - `ruta` (text) - Route path
      - `descripcion` (text) - Generated description
      - `categoria` (text) - Category (comercial, operaciones, admin, etc.)
      - `roles_permitidos` (text[]) - Allowed roles
      - `funcionalidades` (jsonb) - Detected functionalities
      - `relaciones` (jsonb) - Relations to other modules
      - `ultima_indexacion` (timestamptz) - Last indexing time
      - `activo` (boolean)
      - `created_at` / `updated_at` (timestamptz)
    
    - `chava_configuracion` - Chava IA configuration
      - `id` (uuid, PK)
      - `clave` (text, UNIQUE) - Config key
      - `valor` (jsonb) - Config value
      - `descripcion` (text) - Description
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, FK → usuarios)
    
    - `chava_consultas_log` - Audit log of all queries
      - `id` (uuid, PK)
      - `usuario_id` (uuid, FK → usuarios)
      - `conversacion_id` (uuid) - Related conversation
      - `pregunta` (text) - User question
      - `respuesta` (text) - AI response
      - `fuentes_utilizadas` (jsonb) - Sources used (documents, modules)
      - `tokens_entrada` (integer) - Input tokens
      - `tokens_salida` (integer) - Output tokens
      - `modelo` (text) - Model used
      - `tiempo_respuesta_ms` (integer) - Response time
      - `satisfaccion` (integer) - User feedback (1-5)
      - `error` (text) - Error if any
      - `created_at` (timestamptz)
    
    - `chava_entrenamiento_jobs` - Training/reindexing jobs
      - `id` (uuid, PK)
      - `tipo` (text) - Type: documento, modulo, completo
      - `referencia_id` (uuid) - Reference to document/module
      - `estado` (text) - pending, processing, completed, error
      - `progreso` (integer) - 0-100 progress
      - `resultado` (jsonb) - Result details
      - `iniciado_por` (uuid, FK → usuarios)
      - `iniciado_at` (timestamptz)
      - `completado_at` (timestamptz)
      - `error` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Admin-only write access for management tables
    - Authenticated read for knowledge queries (filtered by acceso level)
    - Service role full access for edge functions

  3. Extensions
    - Enable vector extension for embeddings

  4. Important Notes
    - Uses pgvector for semantic search
    - Document processing happens asynchronously via edge functions
    - Embedding dimension 1536 matches OpenAI text-embedding-3-small
*/

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- CHAVA CARPETAS (Knowledge Base Folders)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_carpetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text DEFAULT '',
  carpeta_padre_id uuid REFERENCES chava_carpetas(id) ON DELETE SET NULL,
  icono text DEFAULT 'folder',
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_carpetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chava_carpetas"
  ON chava_carpetas FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Authenticated users can read active chava_carpetas"
  ON chava_carpetas FOR SELECT
  TO authenticated
  USING (activo = true);

-- ============================================================
-- CHAVA DOCUMENTOS (Knowledge Base Documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carpeta_id uuid REFERENCES chava_carpetas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion text DEFAULT '',
  archivo_url text,
  archivo_nombre text,
  archivo_tipo text,
  archivo_tamano bigint DEFAULT 0,
  estado text DEFAULT 'pending' CHECK (estado IN ('pending', 'processing', 'ready', 'error')),
  version integer DEFAULT 1,
  acceso text DEFAULT 'todos' CHECK (acceso IN ('todos', 'administrador', 'gerente', 'ejecutivo', 'agente', 'seguwallet')),
  contenido_extraido text,
  total_fragmentos integer DEFAULT 0,
  subido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chava_documentos"
  ON chava_documentos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Users can read documents by access level"
  ON chava_documentos FOR SELECT
  TO authenticated
  USING (
    estado = 'ready' AND (
      acceso = 'todos'
      OR (acceso = 'administrador' AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
      OR (acceso = 'gerente' AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')))
      OR (acceso = 'ejecutivo' AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente', 'Ejecutivo')))
      OR (acceso = 'agente' AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente', 'Ejecutivo', 'Agente')))
    )
  );

-- ============================================================
-- CHAVA FRAGMENTOS (Document Chunks with Embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_fragmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES chava_documentos(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_fragmentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access chava_fragmentos"
  ON chava_fragmentos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Authenticated can read chava_fragmentos"
  ON chava_fragmentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chava_documentos d
      WHERE d.id = chava_fragmentos.documento_id
      AND d.estado = 'ready'
    )
  );

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chava_fragmentos_embedding
  ON chava_fragmentos USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chava_fragmentos_documento
  ON chava_fragmentos (documento_id);

-- ============================================================
-- CHAVA MODULOS DESCUBIERTOS (Auto-discovered modules)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_modulos_descubiertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ruta text,
  descripcion text DEFAULT '',
  categoria text DEFAULT 'general',
  roles_permitidos text[] DEFAULT '{}',
  funcionalidades jsonb DEFAULT '[]',
  relaciones jsonb DEFAULT '[]',
  ultima_indexacion timestamptz,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_modulos_descubiertos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chava_modulos_descubiertos"
  ON chava_modulos_descubiertos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Authenticated can read chava_modulos_descubiertos"
  ON chava_modulos_descubiertos FOR SELECT
  TO authenticated
  USING (activo = true);

-- ============================================================
-- CHAVA CONFIGURACION (AI Configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}',
  descripcion text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE chava_configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chava_configuracion"
  ON chava_configuracion FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Authenticated can read chava_configuracion"
  ON chava_configuracion FOR SELECT
  TO authenticated
  USING (true);

-- Insert default configuration
INSERT INTO chava_configuracion (clave, valor, descripcion) VALUES
  ('modelo_ia', '"gpt-4o-mini"', 'Modelo de OpenAI a utilizar'),
  ('temperatura', '0.7', 'Temperatura de generacion (0-2)'),
  ('max_tokens', '2000', 'Maximo de tokens por respuesta'),
  ('contexto_max_fragmentos', '5', 'Maximo de fragmentos de conocimiento por consulta'),
  ('embedding_modelo', '"text-embedding-3-small"', 'Modelo de embeddings'),
  ('rag_similitud_minima', '0.72', 'Similitud minima para incluir fragmento en contexto'),
  ('rag_habilitado', 'true', 'Habilitar busqueda RAG en base de conocimiento'),
  ('auto_descubrimiento', 'true', 'Descubrimiento automatico de modulos'),
  ('max_historial_mensajes', '20', 'Maximo de mensajes de historial en contexto'),
  ('system_prompt_base', '"Eres Chava, el asistente inteligente oficial de MOVI Digital y Seguwallet. Eres un experto en seguros, fianzas, operacion de promotorias, administracion de agentes, marketing, automatizacion, CRM, produccion, comisiones, SICAS y procesos internos de Grupo JIRO. Responde de manera profesional, amigable, cercana y proactiva. No te limites a responder preguntas: sugiere mejoras, detecta oportunidades y ayuda al usuario a aprovechar mejor la plataforma."', 'Prompt base del sistema')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- CHAVA CONSULTAS LOG (Audit Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_consultas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  conversacion_id uuid,
  pregunta text,
  respuesta text,
  fuentes_utilizadas jsonb DEFAULT '[]',
  tokens_entrada integer DEFAULT 0,
  tokens_salida integer DEFAULT 0,
  modelo text,
  tiempo_respuesta_ms integer DEFAULT 0,
  satisfaccion integer CHECK (satisfaccion IS NULL OR (satisfaccion >= 1 AND satisfaccion <= 5)),
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_consultas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all chava_consultas_log"
  ON chava_consultas_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Users can read own chava_consultas_log"
  ON chava_consultas_log FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Authenticated can insert chava_consultas_log"
  ON chava_consultas_log FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_chava_consultas_usuario
  ON chava_consultas_log (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chava_consultas_fecha
  ON chava_consultas_log (created_at DESC);

-- ============================================================
-- CHAVA ENTRENAMIENTO JOBS (Training/Reindexing Jobs)
-- ============================================================
CREATE TABLE IF NOT EXISTS chava_entrenamiento_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('documento', 'modulo', 'carpeta', 'completo')),
  referencia_id uuid,
  estado text DEFAULT 'pending' CHECK (estado IN ('pending', 'processing', 'completed', 'error')),
  progreso integer DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  resultado jsonb DEFAULT '{}',
  iniciado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  iniciado_at timestamptz,
  completado_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_entrenamiento_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chava_entrenamiento_jobs"
  ON chava_entrenamiento_jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE INDEX IF NOT EXISTS idx_chava_entrenamiento_estado
  ON chava_entrenamiento_jobs (estado, created_at DESC);

-- ============================================================
-- FUNCTION: Semantic search in knowledge base
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_conocimiento_chava(
  query_embedding vector(1536),
  similitud_minima float DEFAULT 0.72,
  max_resultados int DEFAULT 5,
  usuario_rol text DEFAULT 'Agente'
)
RETURNS TABLE (
  id uuid,
  documento_id uuid,
  documento_titulo text,
  carpeta_nombre text,
  contenido text,
  similitud float,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.documento_id,
    d.titulo AS documento_titulo,
    c.nombre AS carpeta_nombre,
    f.contenido,
    1 - (f.embedding <=> query_embedding) AS similitud,
    f.metadata
  FROM chava_fragmentos f
  JOIN chava_documentos d ON d.id = f.documento_id
  LEFT JOIN chava_carpetas c ON c.id = d.carpeta_id
  WHERE d.estado = 'ready'
    AND (
      d.acceso = 'todos'
      OR (d.acceso = 'administrador' AND usuario_rol = 'Administrador')
      OR (d.acceso = 'gerente' AND usuario_rol IN ('Administrador', 'Gerente'))
      OR (d.acceso = 'ejecutivo' AND usuario_rol IN ('Administrador', 'Gerente', 'Ejecutivo'))
      OR (d.acceso = 'agente' AND usuario_rol IN ('Administrador', 'Gerente', 'Ejecutivo', 'Agente'))
    )
    AND 1 - (f.embedding <=> query_embedding) >= similitud_minima
  ORDER BY f.embedding <=> query_embedding
  LIMIT max_resultados;
END;
$$;

-- ============================================================
-- FUNCTION: Get Chava stats for dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_chava_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_documentos', (SELECT count(*) FROM chava_documentos WHERE estado = 'ready'),
    'total_fragmentos', (SELECT count(*) FROM chava_fragmentos),
    'total_carpetas', (SELECT count(*) FROM chava_carpetas WHERE activo = true),
    'total_modulos', (SELECT count(*) FROM chava_modulos_descubiertos WHERE activo = true),
    'consultas_hoy', (SELECT count(*) FROM chava_consultas_log WHERE created_at >= CURRENT_DATE),
    'consultas_semana', (SELECT count(*) FROM chava_consultas_log WHERE created_at >= CURRENT_DATE - interval '7 days'),
    'consultas_mes', (SELECT count(*) FROM chava_consultas_log WHERE created_at >= CURRENT_DATE - interval '30 days'),
    'tokens_mes', (SELECT COALESCE(sum(tokens_entrada + tokens_salida), 0) FROM chava_consultas_log WHERE created_at >= CURRENT_DATE - interval '30 days'),
    'errores_semana', (SELECT count(*) FROM chava_consultas_log WHERE error IS NOT NULL AND created_at >= CURRENT_DATE - interval '7 days'),
    'satisfaccion_promedio', (SELECT COALESCE(round(avg(satisfaccion)::numeric, 1), 0) FROM chava_consultas_log WHERE satisfaccion IS NOT NULL AND created_at >= CURRENT_DATE - interval '30 days'),
    'documentos_pendientes', (SELECT count(*) FROM chava_documentos WHERE estado = 'pending'),
    'jobs_activos', (SELECT count(*) FROM chava_entrenamiento_jobs WHERE estado IN ('pending', 'processing'))
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================================
-- STORAGE BUCKET for knowledge base files
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chava-knowledge',
  'chava-knowledge',
  false,
  524288000,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'video/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chava-knowledge bucket
CREATE POLICY "Admins can upload to chava-knowledge"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chava-knowledge'
    AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Admins can update chava-knowledge"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chava-knowledge'
    AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Admins can delete from chava-knowledge"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chava-knowledge'
    AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "Authenticated can read chava-knowledge"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chava-knowledge');
