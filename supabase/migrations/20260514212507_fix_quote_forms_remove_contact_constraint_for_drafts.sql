/*
  # Remove quote_forms_client_contact constraint

  1. Problem
    - The CHECK constraint requires at least one contact field (phone/email/whatsapp)
    - This prevents saving drafts early (auto-save on step advance)
    - Contact info should only be required at submission time, not during drafting

  2. Solution
    - Drop the constraint so drafts can be saved without contact info
    - Validation at submit time will enforce contact requirements
*/

ALTER TABLE quote_forms DROP CONSTRAINT IF EXISTS quote_forms_client_contact;