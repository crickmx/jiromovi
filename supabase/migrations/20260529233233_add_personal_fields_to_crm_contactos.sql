/*
  # Add personal fields to crm_contactos

  1. Changes
    - Add `genero` (text, nullable) to crm_contactos
    - Add `estado` (text, nullable) to crm_contactos
    - Add `municipio` (text, nullable) to crm_contactos

  These fields mirror the equivalent fields in seguwallet_customers (gender, state, municipality)
  so the Movi agent can see and edit information the customer entered in Seguwallet, and vice versa.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_contactos' AND column_name = 'genero'
  ) THEN
    ALTER TABLE crm_contactos ADD COLUMN genero text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_contactos' AND column_name = 'estado'
  ) THEN
    ALTER TABLE crm_contactos ADD COLUMN estado text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_contactos' AND column_name = 'municipio'
  ) THEN
    ALTER TABLE crm_contactos ADD COLUMN municipio text;
  END IF;
END $$;
