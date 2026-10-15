/*
  # Upgrade Assistant Engine for Intelligent Conversational Mode

  ## Changes
  1. Add `synonyms` jsonb column to assistant_fields for smart field matching
  2. Add `priority` column: 'required' | 'recommended' | 'optional'  
  3. Add `skip_if_contact_has` column: field keys to auto-skip from contact data
  4. Add `failed_attempts` tracking to session_data
  5. Add `confidence_score` and `source` enrichment to session_data
  6. Add `field_notes` for low-confidence fields
  7. Add `conversation_context` jsonb to sessions (extracted data cache)
  8. Add `max_retries_per_field` and `allow_incomplete` to assistants
  9. Add `skip_contact_fields` flag to assistants
*/

-- Add intelligent fields to contact_center_assistant_fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_fields' AND column_name='synonyms') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN synonyms jsonb DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_fields' AND column_name='priority') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN priority text NOT NULL DEFAULT 'recommended' CHECK (priority IN ('required','recommended','optional'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_fields' AND column_name='skip_if_contact_has') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN skip_if_contact_has text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_fields' AND column_name='fallback_message') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN fallback_message text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_fields' AND column_name='example_value') THEN
    ALTER TABLE contact_center_assistant_fields ADD COLUMN example_value text DEFAULT NULL;
  END IF;
END $$;

-- Update priority for known contact fields to 'optional' (skip if already known)
UPDATE contact_center_assistant_fields
SET priority = 'optional', skip_if_contact_has = 'contact_phone'
WHERE field_key IN ('telefono', 'telefono_contacto', 'whatsapp', 'celular')
  AND priority = 'recommended';

UPDATE contact_center_assistant_fields
SET priority = 'optional', skip_if_contact_has = 'contact_name'
WHERE field_key IN ('nombre_cliente', 'nombre', 'nombre_completo')
  AND priority = 'recommended';

-- Add intelligent config to assistants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='max_retries_per_field') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN max_retries_per_field integer NOT NULL DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='allow_incomplete_submission') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN allow_incomplete_submission boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='skip_contact_fields') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN skip_contact_fields boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='use_ai_extraction') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN use_ai_extraction boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='handoff_after_creation') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN handoff_after_creation boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add conversation context cache to sessions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_sessions' AND column_name='conversation_context') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN conversation_context jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_sessions' AND column_name='contact_phone_prefilled') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN contact_phone_prefilled text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_sessions' AND column_name='contact_name_prefilled') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN contact_name_prefilled text DEFAULT NULL;
  END IF;
END $$;

-- Enrich session_data with confidence metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_session_data' AND column_name='source') THEN
    ALTER TABLE contact_center_assistant_session_data ADD COLUMN source text DEFAULT 'user_message';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_session_data' AND column_name='requires_human_review') THEN
    ALTER TABLE contact_center_assistant_session_data ADD COLUMN requires_human_review boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_session_data' AND column_name='field_notes') THEN
    ALTER TABLE contact_center_assistant_session_data ADD COLUMN field_notes text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_session_data' AND column_name='failed_attempts') THEN
    ALTER TABLE contact_center_assistant_session_data ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistant_session_data' AND column_name='status') THEN
    ALTER TABLE contact_center_assistant_session_data ADD COLUMN status text NOT NULL DEFAULT 'captured' CHECK (status IN ('captured','pending','skipped','low_confidence','prefilled'));
  END IF;
END $$;
