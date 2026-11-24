/*
  # Add clave_agente field to accesos_nacional table

  1. Purpose
    - Add a new field to store the agent key (clave de agente)
    - This is NOT a password field and does not require encryption or masking
    - This is informational data that can be displayed and copied

  2. Changes
    - Add column: clave_agente (text, nullable)
    - No security restrictions on this field
    - Does not affect any existing fields or functionality

  3. Backward Compatibility
    - Nullable field ensures existing records continue working
    - No data migration required
    - No breaking changes to existing queries or policies
*/

-- Add clave_agente column to accesos_nacional table
ALTER TABLE accesos_nacional
ADD COLUMN IF NOT EXISTS clave_agente text;

-- Add comment explaining the field
COMMENT ON COLUMN accesos_nacional.clave_agente IS 'Clave de agente - información alfanumérica no sensible para identificación del agente';

-- Add index for better search performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_clave_agente ON accesos_nacional(clave_agente);
