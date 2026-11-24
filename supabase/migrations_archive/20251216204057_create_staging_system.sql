/*
  # Sistema de Staging para Importación de Documentos

  1. Nueva Tabla
    - `document_import_items` - Almacena todas las filas importadas con validación

  2. Cambios en Tablas Existentes
    - Agregar campos de diagnóstico a `document_import_batches`

  3. Seguridad
    - RLS habilitado con políticas para admins

  Este sistema elimina el bug NO_ITEMS_INSERTED al:
  - Parsear el Excel una sola vez durante la importación
  - Guardar todas las filas en staging con validación
  - Convertir leyendo solo de staging (no re-parsear)
  - Proporcionar diagnósticos detallados cuando no hay items insertables
*/

-- Enum para status de items en staging
DO $$ BEGIN
  CREATE TYPE document_item_status AS ENUM ('valid', 'warning', 'discard');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabla de staging para items importados
CREATE TABLE IF NOT EXISTS document_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES document_import_batches(id) ON DELETE CASCADE,

  -- Metadata de la fila
  row_index int NOT NULL,
  raw_json jsonb NOT NULL,

  -- Estado de validación
  status document_item_status NOT NULL DEFAULT 'valid',
  discard_reason text,
  warnings jsonb DEFAULT '[]'::jsonb,

  -- Campos normalizados (matching por nombre)
  vendor_name_raw text,
  vendor_name_norm text,
  agent_key text,
  agent_name_raw text,
  agent_name_norm text,
  agent_name_signature text,

  -- Datos del documento
  documento text,
  endoso text,
  fpago date,
  fpago_raw text,

  -- Datos de la póliza
  aseguradora text DEFAULT 'NO_ESPECIFICADA',
  ramo text,

  -- Datos financieros
  importe_base numeric(12,2),
  porcentaje numeric(5,2),
  comision_calculada numeric(12,2),
  prima_neta_info numeric(12,2),

  -- Otros campos
  concepto text,
  oficina text,
  nombre_completo text,

  -- Matching con usuario MOVI
  movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  match_status text,
  match_method text,
  match_confidence int,

  -- Timestamps
  created_at timestamptz DEFAULT now(),

  -- Constraints
  CHECK (match_confidence >= 0 AND match_confidence <= 100)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_import_items_batch ON document_import_items(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_items_batch_status ON document_import_items(import_batch_id, status);
CREATE INDEX IF NOT EXISTS idx_import_items_agent_key ON document_import_items(agent_key);
CREATE INDEX IF NOT EXISTS idx_import_items_user ON document_import_items(movi_user_id);

-- Agregar campos de diagnóstico a document_import_batches
ALTER TABLE document_import_batches
  ADD COLUMN IF NOT EXISTS detected_format text,
  ADD COLUMN IF NOT EXISTS sheet_name_used text,
  ADD COLUMN IF NOT EXISTS headers_json jsonb,
  ADD COLUMN IF NOT EXISTS row_count_total int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS row_count_valid int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS row_count_warning int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS row_count_discard int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_converted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversion_failed_reason text;

-- Función para actualizar contadores del batch
CREATE OR REPLACE FUNCTION update_import_batch_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE document_import_batches
    SET
      row_count_total = (
        SELECT COUNT(*) FROM document_import_items WHERE import_batch_id = NEW.import_batch_id
      ),
      row_count_valid = (
        SELECT COUNT(*) FROM document_import_items WHERE import_batch_id = NEW.import_batch_id AND status = 'valid'
      ),
      row_count_warning = (
        SELECT COUNT(*) FROM document_import_items WHERE import_batch_id = NEW.import_batch_id AND status = 'warning'
      ),
      row_count_discard = (
        SELECT COUNT(*) FROM document_import_items WHERE import_batch_id = NEW.import_batch_id AND status = 'discard'
      )
    WHERE id = NEW.import_batch_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar contadores automáticamente
DROP TRIGGER IF EXISTS trigger_update_batch_counters ON document_import_items;
CREATE TRIGGER trigger_update_batch_counters
  AFTER INSERT OR UPDATE ON document_import_items
  FOR EACH ROW
  EXECUTE FUNCTION update_import_batch_counters();

-- RLS para document_import_items
ALTER TABLE document_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all import items"
  ON document_import_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert import items"
  ON document_import_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update import items"
  ON document_import_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete import items"
  ON document_import_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Función para obtener diagnóstico de items descartados
CREATE OR REPLACE FUNCTION get_import_diagnostic(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'batch_id', p_batch_id,
    'counts', jsonb_build_object(
      'total', COUNT(*),
      'valid', COUNT(*) FILTER (WHERE status = 'valid'),
      'warning', COUNT(*) FILTER (WHERE status = 'warning'),
      'discard', COUNT(*) FILTER (WHERE status = 'discard')
    ),
    'top_discard_reasons', (
      SELECT jsonb_agg(reason_stats)
      FROM (
        SELECT
          discard_reason,
          COUNT(*) as count
        FROM document_import_items
        WHERE import_batch_id = p_batch_id
        AND status = 'discard'
        AND discard_reason IS NOT NULL
        GROUP BY discard_reason
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) reason_stats
    ),
    'sample_discard_rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'row_index', row_index,
          'reason', discard_reason,
          'documento', documento,
          'vendor_name', vendor_name_raw,
          'raw_data', raw_json
        )
      )
      FROM (
        SELECT *
        FROM document_import_items
        WHERE import_batch_id = p_batch_id
        AND status = 'discard'
        ORDER BY row_index
        LIMIT 10
      ) samples
    )
  ) INTO v_result
  FROM document_import_items
  WHERE import_batch_id = p_batch_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener items insertables
CREATE OR REPLACE FUNCTION get_insertable_items(p_batch_id uuid)
RETURNS TABLE (
  id uuid,
  row_index int,
  agent_key text,
  agent_name_raw text,
  agent_name_norm text,
  agent_name_signature text,
  documento text,
  endoso text,
  fpago date,
  aseguradora text,
  ramo text,
  importe_base numeric,
  porcentaje numeric,
  comision_calculada numeric,
  prima_neta_info numeric,
  concepto text,
  oficina text,
  movi_user_id uuid,
  match_status text,
  match_method text,
  match_confidence int,
  raw_json jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.row_index,
    i.agent_key,
    i.agent_name_raw,
    i.agent_name_norm,
    i.agent_name_signature,
    i.documento,
    i.endoso,
    i.fpago,
    i.aseguradora,
    i.ramo,
    i.importe_base,
    i.porcentaje,
    i.comision_calculada,
    i.prima_neta_info,
    i.concepto,
    i.oficina,
    i.movi_user_id,
    i.match_status,
    i.match_method,
    i.match_confidence,
    i.raw_json
  FROM document_import_items i
  WHERE i.import_batch_id = p_batch_id
  AND i.status IN ('valid', 'warning')
  ORDER BY i.row_index;
END;
$$ LANGUAGE plpgsql;