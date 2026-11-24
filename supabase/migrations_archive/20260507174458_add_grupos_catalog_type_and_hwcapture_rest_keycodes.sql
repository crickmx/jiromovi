/*
  # Add Grupos catalog type and configure HWCAPTURE catalog rest keycodes

  1. New catalog type
    - Adds "Grupos" (id 62) to sicas_catalog_types with enum_name 'eGrupos'
    
  2. Updates
    - Updates sicas_hwcapture_defaults IDGrupo record to reference catalog_type_id 62
    
  3. Notes
    - The SICAS SOAP ReadInfoData uses enum_name strings (eMonedas, eRamos, etc.)
    - The REST API uses Prop_KeyCode headers
    - For HWCAPTURE catalogs, we'll sync via SOAP using the enum_name
*/

-- Add Grupos catalog type (doesn't exist yet)
INSERT INTO sicas_catalog_types (id, name, enum_name)
VALUES (62, 'Grupos', 'eGrupos')
ON CONFLICT (id) DO NOTHING;

-- Update the IDGrupo default to reference the new catalog type
UPDATE sicas_hwcapture_defaults
SET catalog_type_id = 62, notes = 'ID del grupo default. Sincronizar catalogo tipo 62 (eGrupos).'
WHERE field_name = 'IDGrupo' AND catalog_type_id IS NULL;
