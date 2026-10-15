/*
  # Add CRM linking columns for public form submissions

  1. Changes to crm_contactos
    - `fuente_canal` (text) - channel: link_publico, whatsapp, etc.
    - `tipo_lead` (text) - cotizacion, referido, etc.
    - `whatsapp` (text) - separate WhatsApp field
    - `tipo_seguro` (text) - insurance type of interest
    - `interes` (text) - specific interest description
    - `notas_origen` (text) - origin notes/summary
    - `quote_form_id` (uuid) - link to quote_forms
    - `ticket_id` (uuid) - link to tickets (commercial process)
    - `shared_link_id` (uuid) - link to shared_quote_form_links
    - `public_submission_id` (uuid) - link to shared_quote_form_submissions
    - `contacto_incompleto` (boolean) - flag for incomplete contact data
    - `metadata_json` (jsonb) - additional metadata

  2. Changes to crm_tareas
    - `titulo` (text) - task title (separate from descripcion)
    - `tipo_tarea` (text) - seguimiento_cotizacion, llamada, etc.
    - `fuente` (text) - formulario_publico, manual, etc.
    - `canal` (text) - link_publico, whatsapp, etc.
    - `quote_form_id` (uuid) - link to quote_forms
    - `ticket_id` (uuid) - link to tickets (commercial process)
    - `shared_link_id` (uuid) - link to shared_quote_form_links
    - `public_submission_id` (uuid) - link to shared_quote_form_submissions
    - `metadata_json` (jsonb) - additional metadata

  3. New index for duplicate detection on crm_contactos

  4. Security
    - No RLS changes needed (existing policies cover these columns)
*/

-- ═══════════════════════════════════════════════════════════
-- crm_contactos: add linking columns
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'fuente_canal') THEN
    ALTER TABLE crm_contactos ADD COLUMN fuente_canal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'tipo_lead') THEN
    ALTER TABLE crm_contactos ADD COLUMN tipo_lead text DEFAULT 'cotizacion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'whatsapp') THEN
    ALTER TABLE crm_contactos ADD COLUMN whatsapp text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'tipo_seguro') THEN
    ALTER TABLE crm_contactos ADD COLUMN tipo_seguro text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'interes') THEN
    ALTER TABLE crm_contactos ADD COLUMN interes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'notas_origen') THEN
    ALTER TABLE crm_contactos ADD COLUMN notas_origen text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'quote_form_id') THEN
    ALTER TABLE crm_contactos ADD COLUMN quote_form_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'ticket_id') THEN
    ALTER TABLE crm_contactos ADD COLUMN ticket_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'shared_link_id') THEN
    ALTER TABLE crm_contactos ADD COLUMN shared_link_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'public_submission_id') THEN
    ALTER TABLE crm_contactos ADD COLUMN public_submission_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'contacto_incompleto') THEN
    ALTER TABLE crm_contactos ADD COLUMN contacto_incompleto boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_contactos' AND column_name = 'metadata_json') THEN
    ALTER TABLE crm_contactos ADD COLUMN metadata_json jsonb DEFAULT '{}';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- crm_tareas: add linking columns
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'titulo') THEN
    ALTER TABLE crm_tareas ADD COLUMN titulo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'tipo_tarea') THEN
    ALTER TABLE crm_tareas ADD COLUMN tipo_tarea text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'fuente') THEN
    ALTER TABLE crm_tareas ADD COLUMN fuente text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'canal') THEN
    ALTER TABLE crm_tareas ADD COLUMN canal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'quote_form_id') THEN
    ALTER TABLE crm_tareas ADD COLUMN quote_form_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'ticket_id') THEN
    ALTER TABLE crm_tareas ADD COLUMN ticket_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'shared_link_id') THEN
    ALTER TABLE crm_tareas ADD COLUMN shared_link_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'public_submission_id') THEN
    ALTER TABLE crm_tareas ADD COLUMN public_submission_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_tareas' AND column_name = 'metadata_json') THEN
    ALTER TABLE crm_tareas ADD COLUMN metadata_json jsonb DEFAULT '{}';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Indexes for duplicate detection and linking
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_crm_contactos_creado_por ON crm_contactos(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_email ON crm_contactos(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contactos_celular ON crm_contactos(celular) WHERE celular IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contactos_whatsapp ON crm_contactos(whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contactos_quote_form_id ON crm_contactos(quote_form_id) WHERE quote_form_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contactos_ticket_id ON crm_contactos(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tareas_quote_form_id ON crm_tareas(quote_form_id) WHERE quote_form_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tareas_ticket_id ON crm_tareas(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tareas_contacto_id ON crm_tareas(contacto_id) WHERE contacto_id IS NOT NULL;
