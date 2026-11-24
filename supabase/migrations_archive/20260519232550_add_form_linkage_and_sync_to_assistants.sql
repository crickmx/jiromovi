/*
  # Add form linkage and sync metadata to contact_center_assistants

  ## Changes
  - Adds `form_version` (text) to track which version of the form was used
  - Adds `last_synced_at` (timestamptz) to record last sync with form
  - Adds `sync_history` (jsonb) to keep an audit log of sync events
  - Adds `generation_origin` (text) to distinguish auto-generated vs manual
  - Adds `form_title` (text) to cache the form title at generation time
  - Adds `form_type` (text) to cache the form type (cotizacion, emision, etc.)
  - Adds `office_id_ref` (text) to store origin office visibility from form
  - Adds `field_count` (integer) computed/cached field count
  - Adds `has_documents` (boolean) whether the assistant requires document capture
  - Creates assistant_sync_logs table for full sync audit trail

  ## Security
  - assistant_sync_logs has RLS enabled, admin/gerente can insert, all authenticated can view own office
*/

-- Add sync/form metadata columns to contact_center_assistants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'form_version') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN form_version text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'last_synced_at') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN last_synced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'sync_history') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN sync_history jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'generation_origin') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN generation_origin text DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'form_title') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN form_title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'form_type_cache') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN form_type_cache text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'has_documents') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN has_documents boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'field_count') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN field_count integer DEFAULT 0;
  END IF;
END $$;

-- Add document capture support to assistant_fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'is_document') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN is_document boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'document_label') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN document_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'accepted_formats') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN accepted_formats text[] DEFAULT ARRAY['image', 'pdf'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'confirmation_message') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN confirmation_message text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'menu_options') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN menu_options jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'validation_hint') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN validation_hint text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'is_synced_from_form') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN is_synced_from_form boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_fields' AND column_name = 'manually_edited') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN manually_edited boolean DEFAULT false;
  END IF;
END $$;

-- Create assistant sync logs table
CREATE TABLE IF NOT EXISTS contact_center_assistant_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES contact_center_assistants(id) ON DELETE CASCADE,
  form_id uuid REFERENCES quote_form_templates(id) ON DELETE SET NULL,
  sync_type text NOT NULL CHECK (sync_type IN ('initial_generation', 'manual_sync', 'sync_all', 'field_added', 'field_removed', 'field_changed')),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary jsonb DEFAULT '{}'::jsonb,
  fields_added integer DEFAULT 0,
  fields_updated integer DEFAULT 0,
  fields_removed integer DEFAULT 0,
  fields_skipped integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_center_assistant_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view sync logs"
  ON contact_center_assistant_sync_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gerentes can insert sync logs"
  ON contact_center_assistant_sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE INDEX IF NOT EXISTS idx_cc_assistant_sync_logs_assistant ON contact_center_assistant_sync_logs(assistant_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistant_sync_logs_form ON contact_center_assistant_sync_logs(form_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistants_quote_form ON contact_center_assistants(quote_form_template_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistants_generation_origin ON contact_center_assistants(generation_origin);
