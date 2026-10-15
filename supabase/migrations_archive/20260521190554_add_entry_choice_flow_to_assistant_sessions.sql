/*
  # Add entry choice flow to contact center assistant sessions

  ## Summary
  Adds support for the new "entry choice" flow where the automatic assistant first
  asks the contact whether they want to fill the online form or answer guided questions.

  ### New columns on contact_center_assistant_sessions:
  - `entry_choice` — what the contact chose: 'online_form' | 'whatsapp_questions' | null
  - `form_link_sent_at` — timestamp when the form link was sent
  - `guided_questions_started_at` — timestamp when guided questions started
  - `ambiguous_entry_attempts` — how many times the user gave an ambiguous response at entry

  ### New column on contact_center_assistants:
  - `form_type_slug` — the quote_form_templates.form_type/slug to use for the online form link.
    Nullable — if null, the online form option is hidden.

  ### Security
  - No new tables, existing RLS policies apply
*/

-- Add entry choice tracking columns to sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'entry_choice'
  ) THEN
    ALTER TABLE contact_center_assistant_sessions
      ADD COLUMN entry_choice text CHECK (entry_choice IN ('online_form', 'whatsapp_questions', 'whatsapp_questions_default_after_ambiguous'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'form_link_sent_at'
  ) THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN form_link_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'guided_questions_started_at'
  ) THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN guided_questions_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'ambiguous_entry_attempts'
  ) THEN
    ALTER TABLE contact_center_assistant_sessions
      ADD COLUMN ambiguous_entry_attempts int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add form_type_slug to assistants (links to quote_form_templates.form_type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_assistants' AND column_name = 'form_type_slug'
  ) THEN
    ALTER TABLE contact_center_assistants ADD COLUMN form_type_slug text;
  END IF;
END $$;

-- Wire up form_type_slug for existing assistants based on their nombre
UPDATE contact_center_assistants SET form_type_slug = 'gmm_individual'
  WHERE nombre ILIKE '%GMM Individual%' AND form_type_slug IS NULL;

UPDATE contact_center_assistants SET form_type_slug = 'gmm_individual'
  WHERE nombre ILIKE '%GMM Colectivo%' AND form_type_slug IS NULL;

UPDATE contact_center_assistants SET form_type_slug = 'hogar_casa_habitacion'
  WHERE nombre ILIKE '%Casa%' AND nombre ILIKE '%Hogar%' AND form_type_slug IS NULL;

UPDATE contact_center_assistants SET form_type_slug = 'transporte_carga'
  WHERE nombre ILIKE '%Transporte%' AND form_type_slug IS NULL;

UPDATE contact_center_assistants SET form_type_slug = 'rc_general'
  WHERE nombre ILIKE '%Responsabilidad Civil%' AND form_type_slug IS NULL;

UPDATE contact_center_assistants SET form_type_slug = 'empresa_paquete'
  WHERE nombre ILIKE '%Empresarial%' OR nombre ILIKE '%PyME%' AND form_type_slug IS NULL;
