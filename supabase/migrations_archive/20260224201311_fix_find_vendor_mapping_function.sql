/*
  # Fix find_vendor_mapping Function

  1. Problem
    - La función tiene un error al asignar columnas al RECORD
    - Los nombres de las columnas en el SELECT no coinciden con los campos del RECORD
    
  2. Changes
    - Reescribir la función para usar nombres de columna explícitos
    - Asegurar que todos los RETURN QUERY usen los nombres correctos
    
  3. Security
    - Mantener SECURITY DEFINER para acceso a la tabla usuarios
*/

CREATE OR REPLACE FUNCTION find_vendor_mapping(vendor_email TEXT, vendor_name TEXT)
RETURNS TABLE (
  movi_user_id UUID,
  match_method TEXT,
  mapping_id UUID
) AS $$
DECLARE
  normalized_email TEXT;
  normalized_name TEXT;
  found_user_id UUID;
  found_method TEXT;
  found_mapping_id UUID;
BEGIN
  normalized_email := normalize_email(vendor_email);
  normalized_name := normalize_name(vendor_name);

  -- Paso 1: Buscar por email directo en usuarios
  IF normalized_email IS NOT NULL THEN
    SELECT u.id INTO found_user_id
    FROM usuarios u
    WHERE normalize_email(COALESCE(u.email_laboral, u.email_personal)) = normalized_email
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT found_user_id, 'direct_email'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  -- Paso 2: Buscar mapeo por email
  IF normalized_email IS NOT NULL THEN
    SELECT vm.movi_user_id, vm.id
    INTO found_user_id, found_mapping_id
    FROM vendor_mappings vm
    WHERE vm.source_type = 'email'
      AND vm.source_value = normalized_email
      AND vm.status = 'active'
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT found_user_id, 'mapping_email'::TEXT, found_mapping_id;
      RETURN;
    END IF;
  END IF;

  -- Paso 3: Buscar mapeo por nombre
  IF normalized_name IS NOT NULL THEN
    SELECT vm.movi_user_id, vm.id
    INTO found_user_id, found_mapping_id
    FROM vendor_mappings vm
    WHERE vm.source_type = 'name'
      AND vm.source_value = normalized_name
      AND vm.status = 'active'
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT found_user_id, 'mapping_name'::TEXT, found_mapping_id;
      RETURN;
    END IF;
  END IF;

  -- No se encontró match
  RETURN QUERY SELECT NULL::UUID, 'none'::TEXT, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION find_vendor_mapping IS 
'Busca un mapeo de vendedor por email o nombre. Retorna movi_user_id, match_method y mapping_id si se encuentra.';
