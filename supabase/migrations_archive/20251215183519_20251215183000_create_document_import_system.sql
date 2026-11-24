/*
  # Sistema de Importación de Documentos con Mapeo de Vendedores

  1. Nuevas Tablas
    - `document_import_batches`
      - `id` (uuid, primary key)
      - `file_name` (text) - Nombre del archivo Excel importado
      - `imported_by` (uuid, FK a usuarios) - Admin que importó
      - `imported_at` (timestamptz) - Fecha de importación
      - `records_total` (int) - Total de registros procesados
      - `records_matched` (int) - Registros con usuario asignado
      - `records_unmatched` (int) - Registros sin asignar
      - `status` (text) - Estado del batch
      - `metadata` (jsonb) - Información adicional

    - `imported_documents`
      - `id` (uuid, primary key)
      - `batch_id` (uuid, FK a document_import_batches)
      - `source_row_index` (int) - Índice de la fila en Excel
      - `document_id` (text) - ID/folio/póliza del documento
      - `vendor_email_raw` (text) - Email del vendedor (sin normalizar)
      - `vendor_name_raw` (text) - Nombre del vendedor (sin normalizar)
      - `vendor_key` (text) - Clave de agrupación normalizada
      - `movi_user_id` (uuid, FK a usuarios) - Usuario MOVI asignado
      - `match_method` (text) - Método de asignación
      - `is_unmatched` (boolean) - Si está sin asignar
      - `document_data` (jsonb) - Datos completos del documento

  2. Funciones
    - `normalize_email` - Normaliza emails para comparación
    - `normalize_name` - Normaliza nombres para comparación
    - `calculate_vendor_key` - Calcula la clave de agrupación
    - `find_movi_user_for_vendor` - Busca usuario MOVI automáticamente

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Solo Admin y usuarios autenticados pueden ver/insertar
*/

-- Crear tabla de lotes de importación
CREATE TABLE IF NOT EXISTS document_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  imported_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  imported_at timestamptz DEFAULT now(),
  records_total int DEFAULT 0,
  records_matched int DEFAULT 0,
  records_unmatched int DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de documentos importados
CREATE TABLE IF NOT EXISTS imported_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES document_import_batches(id) ON DELETE CASCADE,
  source_row_index int NOT NULL,
  document_id text NOT NULL,
  vendor_email_raw text,
  vendor_name_raw text,
  vendor_key text NOT NULL,
  movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  match_method text DEFAULT 'none' CHECK (match_method IN ('direct_email', 'mapping_email', 'mapping_name', 'manual', 'none')),
  is_unmatched boolean DEFAULT true,
  document_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_imported_documents_batch_id ON imported_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_imported_documents_vendor_key ON imported_documents(vendor_key);
CREATE INDEX IF NOT EXISTS idx_imported_documents_is_unmatched ON imported_documents(is_unmatched);
CREATE INDEX IF NOT EXISTS idx_imported_documents_movi_user_id ON imported_documents(movi_user_id);
CREATE INDEX IF NOT EXISTS idx_document_import_batches_imported_by ON document_import_batches(imported_by);

-- Función para normalizar emails
CREATE OR REPLACE FUNCTION normalize_email(email text)
RETURNS text AS $$
BEGIN
  IF email IS NULL OR trim(email) = '' THEN
    RETURN NULL;
  END IF;
  RETURN lower(trim(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para normalizar nombres
CREATE OR REPLACE FUNCTION normalize_name(name text)
RETURNS text AS $$
DECLARE
  normalized text;
BEGIN
  IF name IS NULL OR trim(name) = '' THEN
    RETURN NULL;
  END IF;

  -- Convertir a minúsculas y quitar espacios extras
  normalized := lower(trim(regexp_replace(name, '\s+', ' ', 'g')));

  -- Quitar acentos (transliterar)
  normalized := unaccent(normalized);

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Habilitar extensión unaccent si no está habilitada
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Función para calcular vendor_key
CREATE OR REPLACE FUNCTION calculate_vendor_key(vendor_email text, vendor_name text)
RETURNS text AS $$
DECLARE
  normalized_email text;
  normalized_name text;
BEGIN
  -- Intentar usar email primero
  normalized_email := normalize_email(vendor_email);
  IF normalized_email IS NOT NULL AND normalized_email != '' THEN
    RETURN 'email:' || normalized_email;
  END IF;

  -- Fallback a nombre
  normalized_name := normalize_name(vendor_name);
  IF normalized_name IS NOT NULL AND normalized_name != '' THEN
    RETURN 'name:' || normalized_name;
  END IF;

  -- Si no hay ni email ni nombre
  RETURN 'unknown';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para buscar usuario MOVI por email o mapeo
CREATE OR REPLACE FUNCTION find_movi_user_for_vendor(
  vendor_email text,
  vendor_name text,
  OUT user_id uuid,
  OUT method text
)
AS $$
DECLARE
  normalized_email text;
  normalized_name text;
  vendor_key_value text;
BEGIN
  user_id := NULL;
  method := 'none';

  -- Paso 1: Búsqueda directa por email
  normalized_email := normalize_email(vendor_email);
  IF normalized_email IS NOT NULL THEN
    SELECT id INTO user_id
    FROM usuarios
    WHERE normalize_email(email) = normalized_email
    LIMIT 1;

    IF user_id IS NOT NULL THEN
      method := 'direct_email';
      RETURN;
    END IF;
  END IF;

  -- Paso 2: Búsqueda en mapeos por email
  IF normalized_email IS NOT NULL THEN
    SELECT movi_user_id INTO user_id
    FROM vendor_mappings
    WHERE source_type = 'email'
      AND source_value = normalized_email
      AND status = 'active'
    LIMIT 1;

    IF user_id IS NOT NULL THEN
      method := 'mapping_email';
      RETURN;
    END IF;
  END IF;

  -- Paso 3: Búsqueda en mapeos por nombre
  normalized_name := normalize_name(vendor_name);
  IF normalized_name IS NOT NULL THEN
    SELECT movi_user_id INTO user_id
    FROM vendor_mappings
    WHERE source_type = 'name'
      AND source_value = normalized_name
      AND status = 'active'
    LIMIT 1;

    IF user_id IS NOT NULL THEN
      method := 'mapping_name';
      RETURN;
    END IF;
  END IF;

  -- No se encontró match
  method := 'none';
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar contadores del batch
CREATE OR REPLACE FUNCTION update_batch_counters(p_batch_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE document_import_batches
  SET
    records_total = (
      SELECT COUNT(*)
      FROM imported_documents
      WHERE batch_id = p_batch_id
    ),
    records_matched = (
      SELECT COUNT(*)
      FROM imported_documents
      WHERE batch_id = p_batch_id AND is_unmatched = false
    ),
    records_unmatched = (
      SELECT COUNT(*)
      FROM imported_documents
      WHERE batch_id = p_batch_id AND is_unmatched = true
    ),
    updated_at = now()
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Función para asignar vendedor manualmente
CREATE OR REPLACE FUNCTION assign_vendor_to_user(
  p_batch_id uuid,
  p_vendor_key text,
  p_movi_user_id uuid,
  p_save_mapping boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  v_source_type text;
  v_source_value text;
  v_updated_count int;
  v_result jsonb;
BEGIN
  -- Actualizar todos los documentos con ese vendor_key en el batch
  UPDATE imported_documents
  SET
    movi_user_id = p_movi_user_id,
    match_method = 'manual',
    is_unmatched = false,
    updated_at = now()
  WHERE batch_id = p_batch_id
    AND vendor_key = p_vendor_key;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Si se debe guardar el mapeo
  IF p_save_mapping THEN
    -- Determinar tipo y valor según el vendor_key
    IF p_vendor_key LIKE 'email:%' THEN
      v_source_type := 'email';
      v_source_value := substring(p_vendor_key from 7);
    ELSIF p_vendor_key LIKE 'name:%' THEN
      v_source_type := 'name';
      v_source_value := substring(p_vendor_key from 6);
    ELSE
      v_source_type := NULL;
      v_source_value := NULL;
    END IF;

    -- Insertar o actualizar mapeo
    IF v_source_type IS NOT NULL THEN
      INSERT INTO vendor_mappings (
        source_type,
        source_value,
        movi_user_id,
        status,
        created_by,
        updated_by
      )
      VALUES (
        v_source_type,
        v_source_value,
        p_movi_user_id,
        'active',
        auth.uid(),
        auth.uid()
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = p_movi_user_id,
        status = 'active',
        updated_by = auth.uid(),
        updated_at = now();
    END IF;
  END IF;

  -- Actualizar contadores del batch
  PERFORM update_batch_counters(p_batch_id);

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'mapping_saved', p_save_mapping AND v_source_type IS NOT NULL
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_import_batches_updated_at ON document_import_batches;
CREATE TRIGGER update_document_import_batches_updated_at
  BEFORE UPDATE ON document_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imported_documents_updated_at ON imported_documents;
CREATE TRIGGER update_imported_documents_updated_at
  BEFORE UPDATE ON imported_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE document_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para document_import_batches
DROP POLICY IF EXISTS "Admins pueden ver todos los batches" ON document_import_batches;
CREATE POLICY "Admins pueden ver todos los batches"
  ON document_import_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden insertar batches" ON document_import_batches;
CREATE POLICY "Admins pueden insertar batches"
  ON document_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden actualizar batches" ON document_import_batches;
CREATE POLICY "Admins pueden actualizar batches"
  ON document_import_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas RLS para imported_documents
DROP POLICY IF EXISTS "Admins pueden ver todos los documentos importados" ON imported_documents;
CREATE POLICY "Admins pueden ver todos los documentos importados"
  ON imported_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios documentos" ON imported_documents;
CREATE POLICY "Usuarios pueden ver sus propios documentos"
  ON imported_documents FOR SELECT
  TO authenticated
  USING (movi_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins pueden insertar documentos" ON imported_documents;
CREATE POLICY "Admins pueden insertar documentos"
  ON imported_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden actualizar documentos" ON imported_documents;
CREATE POLICY "Admins pueden actualizar documentos"
  ON imported_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Permitir acceso al service role para edge functions
DROP POLICY IF EXISTS "Service role puede gestionar batches" ON document_import_batches;
CREATE POLICY "Service role puede gestionar batches"
  ON document_import_batches FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role puede gestionar documentos" ON imported_documents;
CREATE POLICY "Service role puede gestionar documentos"
  ON imported_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
