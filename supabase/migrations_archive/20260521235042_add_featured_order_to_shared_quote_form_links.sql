/*
  # Add featured_on_website field to shared_quote_form_links

  1. New Columns
    - `featured_on_website` (boolean, default false) - Whether this form link should appear as a featured insurance type on the agent's public page
    - `featured_order` (integer, nullable) - Display order for featured items (lower = higher priority)

  2. Purpose
    - Allows agents/admins to manually configure which insurance types are highlighted on their public page
    - Prepares the structure for future manual featured selection UI
    - Until manually configured, the system uses a default list based on form type keywords

  3. Notes
    - No data is modified, only new optional columns added
    - Existing pages continue working with keyword-based defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_quote_form_links' AND column_name = 'featured_on_website'
  ) THEN
    ALTER TABLE shared_quote_form_links ADD COLUMN featured_on_website boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_quote_form_links' AND column_name = 'featured_order'
  ) THEN
    ALTER TABLE shared_quote_form_links ADD COLUMN featured_order integer;
  END IF;
END $$;
