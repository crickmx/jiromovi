/*
  # Add missing columns to contact_center_smart_assistant_settings

  Adds columns required by the Training Panel UI that were missing from the schema:
  - is_active: global on/off toggle for the smart assistant
  - auto_activate_on_new_contact: whether to auto-activate on new inbound contacts
  - max_inactive_minutes: minutes of inactivity before pausing
  - default_language: default response language (es/en)
  - confidence_threshold: minimum confidence % before suggesting (0-100)
*/

ALTER TABLE contact_center_smart_assistant_settings
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_activate_on_new_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_inactive_minutes integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS confidence_threshold integer DEFAULT 70;
