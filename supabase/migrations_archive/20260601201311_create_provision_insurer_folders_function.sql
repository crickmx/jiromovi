/*
  # Provision insurer folder structure in Centro Digital

  Creates a database function `provision_insurer_folders()` that inserts the
  standard insurer/ramo folder hierarchy into `centro_digital_carpetas` only
  for entries that do not yet exist (safe to run multiple times).

  ## Folders created
  - One top-level folder per insurer (ANA, GNP, AXA, HDI, Qualitas, Mapfre,
    MetLife, Chubb, Banorte, SURA, Zurich, Afirme, Inbursa)
  - Sub-folders per ramo inside each insurer
  - Regulación (Leyes, CNSF, CONDUSEF, CUSF)
  - Recursos para Agentes

  All folders:
  - todas_oficinas = true
  - todos_roles    = true
  - enable_chava_ai = true
  - auto_index      = true
  - knowledge_priority = 2 (higher than default user folders)

  ## Security
  - Function runs as SECURITY DEFINER (service role) so it can insert even
    with restrictive RLS. Only callable by admins via the edge function.
*/

CREATE OR REPLACE FUNCTION provision_insurer_folders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_id uuid;
  v_created   integer := 0;
  v_skipped   integer := 0;

  -- Top-level insurer folders: (nombre, descripcion)
  v_insurers text[][] := ARRAY[
    ARRAY['ANA Seguros',       'Documentos de ANA Seguros'],
    ARRAY['GNP Seguros',       'Documentos de GNP Seguros'],
    ARRAY['AXA Seguros',       'Documentos de AXA Seguros'],
    ARRAY['HDI Seguros',       'Documentos de HDI Seguros'],
    ARRAY['Quálitas',          'Documentos de Quálitas'],
    ARRAY['Mapfre',            'Documentos de Mapfre Seguros'],
    ARRAY['MetLife',           'Documentos de MetLife'],
    ARRAY['Chubb',             'Documentos de Chubb'],
    ARRAY['Banorte Seguros',   'Documentos de Banorte Seguros'],
    ARRAY['SURA',              'Documentos de SURA Seguros'],
    ARRAY['Zurich',            'Documentos de Zurich Seguros'],
    ARRAY['Afirme',            'Documentos de Afirme Seguros'],
    ARRAY['Inbursa',           'Documentos de Inbursa Seguros'],
    ARRAY['Allianz',           'Documentos de Allianz Seguros'],
    ARRAY['Atlas',             'Documentos de Seguros Atlas'],
    ARRAY['BUPA',              'Documentos de BUPA'],
    ARRAY['BX+',               'Documentos de BX+']
  ];

  -- Sub-folders per insurer: ramo names
  v_ramos text[] := ARRAY[
    'Autos', 'GMM', 'Vida', 'Daños', 'Camiones', 'Empresarial',
    'Condiciones Generales', 'Formatos', 'Guías', 'Fianzas'
  ];

  -- Regulatory folders
  v_reg_ramos text[] := ARRAY['Leyes', 'CNSF', 'CONDUSEF', 'CUSF'];

  v_insurer text[];
  v_ramo    text;
  v_reg     text;
BEGIN
  -- Create insurer top-level folders + sub-ramo folders
  FOREACH v_insurer SLICE 1 IN ARRAY v_insurers LOOP
    -- Top-level insurer folder
    SELECT id INTO v_folder_id
      FROM centro_digital_carpetas
      WHERE nombre = v_insurer[1] AND activa = true
      LIMIT 1;

    IF v_folder_id IS NULL THEN
      INSERT INTO centro_digital_carpetas (
        nombre, descripcion, todas_oficinas, todos_roles,
        enable_chava_ai, external_chava_access, auto_index, knowledge_priority,
        activa
      ) VALUES (
        v_insurer[1], v_insurer[2], true, true,
        true, true, true, 2,
        true
      ) RETURNING id INTO v_folder_id;
      v_created := v_created + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  -- Create Regulación folder + sub-folders
  SELECT id INTO v_folder_id
    FROM centro_digital_carpetas
    WHERE nombre = 'Regulación' AND activa = true
    LIMIT 1;

  IF v_folder_id IS NULL THEN
    INSERT INTO centro_digital_carpetas (
      nombre, descripcion, todas_oficinas, todos_roles,
      enable_chava_ai, external_chava_access, auto_index, knowledge_priority,
      activa
    ) VALUES (
      'Regulación', 'Marco legal y normativo del sector asegurador',
      true, true, true, true, true, 3, true
    ) RETURNING id INTO v_folder_id;
    v_created := v_created + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- Recursos para Agentes
  IF NOT EXISTS (
    SELECT 1 FROM centro_digital_carpetas WHERE nombre = 'Recursos para Agentes' AND activa = true
  ) THEN
    INSERT INTO centro_digital_carpetas (
      nombre, descripcion, todas_oficinas, todos_roles,
      enable_chava_ai, external_chava_access, auto_index, knowledge_priority,
      activa
    ) VALUES (
      'Recursos para Agentes',
      'Materiales de apoyo, guías y recursos para agentes de seguros',
      true, true, true, true, true, 2, true
    );
    v_created := v_created + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'carpetas_creadas', v_created,
    'carpetas_existentes', v_skipped
  );
END;
$$;

-- Grant execution only to authenticated role (edge function uses service role key)
GRANT EXECUTE ON FUNCTION provision_insurer_folders() TO service_role;
REVOKE EXECUTE ON FUNCTION provision_insurer_folders() FROM anon, authenticated;
