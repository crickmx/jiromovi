/*
  # Add SICAS override fields to policy_deliveries

  1. Modified Tables
    - `policy_deliveries`
      - `sicas_override_tipo_docto` (text) - Manual override for Tipo Documento SICAS ID
      - `sicas_override_cia` (text) - Manual override for Aseguradora SICAS ID
      - `sicas_override_ramo` (text) - Manual override for Ramo SICAS ID
      - `sicas_override_subramo` (text) - Manual override for SubRamo SICAS ID
      - `sicas_override_moneda` (text) - Manual override for Moneda SICAS ID
      - `sicas_override_fpago` (text) - Manual override for Forma de Pago SICAS ID
      - `sicas_override_ejecutivo` (text) - Manual override for Ejecutivo SICAS ID
      - `sicas_override_grupo` (text) - Manual override for Grupo SICAS ID
      - `sicas_override_cliente` (text) - Manual override for Cliente SICAS ID
      - `sicas_override_estatus` (text) - Manual override for Estatus SICAS

  2. Purpose
    - Allow users to manually set SICAS field values when automatic detection fails
    - These override values take priority over defaults when building the HWCAPTURE payload
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_tipo_docto') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_tipo_docto text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_cia') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_cia text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_ramo') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_ramo text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_subramo') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_subramo text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_moneda') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_moneda text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_fpago') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_fpago text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_ejecutivo') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_ejecutivo text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_grupo') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_grupo text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_cliente') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_cliente text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_override_estatus') THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_override_estatus text;
  END IF;
END $$;
