/*
  # Sistema Unificado de Comisiones - Campos Vendor

  1. Propósito
    - Agregar campos vendor a commission_details para matching unificado
    - Agregar campos de conversión a commission_batches
    - Permitir rastreo completo de vendedores reconocidos/pendientes
    - Integrar document_import_batches con commission_batches

  2. Cambios en commission_batches
    - source_type: 'manual_upload' | 'excel_import' | 'api'
    - source_id: referencia al document_import_batch si aplica
    - week_number: número de semana ISO
    - period_start/period_end: inicio y fin del periodo (lunes-domingo)
    - converted_from_import_at: timestamp de conversión
    - converted_by: usuario que convirtió

  3. Cambios en commission_details
    - vendor_email_raw: email original del vendedor
    - vendor_email_norm: email normalizado
    - vendor_name_raw: nombre original del vendedor
    - vendor_name_norm: nombre normalizado
    - vendor_key: clave única para agrupación
    - match_method: 'direct_email' | 'mapping_email' | 'mapping_name' | 'none' | 'manual'
    - pending_assignment: booleano para identificar pendientes
    - movi_user_id: referencia al usuario MOVI (puede ser null)

  4. Security
    - Mantener RLS existente
    - Los campos vendor no afectan permisos
*/

-- Agregar campos de source tracking a commission_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN source_type text DEFAULT 'manual_upload' CHECK (source_type IN ('manual_upload', 'excel_import', 'api'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'source_id'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN source_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'week_number'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN week_number integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN period_start date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'period_end'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN period_end date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'converted_from_import_at'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN converted_from_import_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_batches' AND column_name = 'converted_by'
  ) THEN
    ALTER TABLE commission_batches 
    ADD COLUMN converted_by uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar campos vendor a commission_details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_email_raw'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN vendor_email_raw text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_email_norm'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN vendor_email_norm text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_name_raw'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN vendor_name_raw text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_name_norm'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN vendor_name_norm text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_key'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN vendor_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'match_method'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN match_method text CHECK (match_method IN ('direct_email', 'mapping_email', 'mapping_name', 'none', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'pending_assignment'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN pending_assignment boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'movi_user_id'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_commission_batches_source ON commission_batches(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_commission_batches_week ON commission_batches(week_number, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_key ON commission_details(vendor_key);
CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_email ON commission_details(vendor_email_norm);
CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_name ON commission_details(vendor_name_norm);
CREATE INDEX IF NOT EXISTS idx_commission_details_pending ON commission_details(pending_assignment);
CREATE INDEX IF NOT EXISTS idx_commission_details_movi_user ON commission_details(movi_user_id);

-- Agregar campos de conversión a document_import_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_import_batches' AND column_name = 'converted_to_commissions'
  ) THEN
    ALTER TABLE document_import_batches 
    ADD COLUMN converted_to_commissions boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_import_batches' AND column_name = 'converted_at'
  ) THEN
    ALTER TABLE document_import_batches 
    ADD COLUMN converted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_import_batches' AND column_name = 'converted_by'
  ) THEN
    ALTER TABLE document_import_batches 
    ADD COLUMN converted_by uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_import_batches' AND column_name = 'commission_batch_ids'
  ) THEN
    ALTER TABLE document_import_batches 
    ADD COLUMN commission_batch_ids uuid[];
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_import_batches_converted ON document_import_batches(converted_to_commissions);

-- Agregar campos normalizados a imported_documents si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'imported_documents' AND column_name = 'vendor_email_norm'
  ) THEN
    ALTER TABLE imported_documents 
    ADD COLUMN vendor_email_norm text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'imported_documents' AND column_name = 'vendor_name_norm'
  ) THEN
    ALTER TABLE imported_documents 
    ADD COLUMN vendor_name_norm text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_imported_documents_vendor_email_norm ON imported_documents(vendor_email_norm);
CREATE INDEX IF NOT EXISTS idx_imported_documents_vendor_name_norm ON imported_documents(vendor_name_norm);
