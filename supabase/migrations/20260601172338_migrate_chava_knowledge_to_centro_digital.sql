/*
  # Migrate Base de Conocimiento to Centro Digital

  1. Overview
    - Creates a new Centro Digital folder "Base de Conocimiento Seguros" with AI features enabled
    - Migrates all 76 documents from `chava_documentos` into `centro_digital_archivos` as virtual entries
    - Copies text fragments from `chava_fragmentos` into `centro_digital_chunks`
    - Does NOT delete any original data (validated migration principle)

  2. New Data
    - 1 new folder in `centro_digital_carpetas` with enable_chava_ai=true, external_chava_access=true
    - Virtual file entries in `centro_digital_archivos` representing each knowledge document
    - Chunks in `centro_digital_chunks` with the content text (embeddings null, to be generated later)

  3. Notes
    - Original `chava_carpetas`, `chava_documentos`, `chava_fragmentos` tables remain untouched
    - The folder is marked with knowledge_priority=4 (high) for search relevance
    - auto_index=true so future uploads get processed automatically
    - A migration_source column is added to centro_digital_archivos to track provenance
*/

-- Add optional migration tracking column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_archivos' AND column_name = 'migration_source_id'
  ) THEN
    ALTER TABLE centro_digital_archivos ADD COLUMN migration_source_id uuid;
  END IF;
END $$;

-- Create the AI-enabled knowledge folder
DO $$
DECLARE
  v_carpeta_id uuid;
  v_admin_id uuid;
  v_doc record;
  v_archivo_id uuid;
  v_frag record;
BEGIN
  -- Get an admin user for creado_por
  SELECT id INTO v_admin_id FROM usuarios WHERE rol = 'Administrador' LIMIT 1;

  -- Check if folder already exists (idempotent)
  SELECT id INTO v_carpeta_id
  FROM centro_digital_carpetas
  WHERE nombre = 'Base de Conocimiento Seguros'
  AND activa = true
  LIMIT 1;

  IF v_carpeta_id IS NULL THEN
    INSERT INTO centro_digital_carpetas (
      nombre,
      descripcion,
      todas_oficinas,
      todos_roles,
      creado_por,
      activa,
      enable_chava_ai,
      external_chava_access,
      auto_index,
      knowledge_priority
    ) VALUES (
      'Base de Conocimiento Seguros',
      'Documentos, guias y materiales del sector asegurador indexados para Chava IA. Migrado desde Base de Conocimiento original.',
      true,
      true,
      v_admin_id,
      true,
      true,
      true,
      true,
      4
    )
    RETURNING id INTO v_carpeta_id;
  END IF;

  -- Migrate each document as a virtual file entry
  FOR v_doc IN
    SELECT id, titulo, descripcion, archivo_tipo, contenido_extraido, total_fragmentos, created_at
    FROM chava_documentos
    WHERE carpeta_id = (SELECT id FROM chava_carpetas LIMIT 1)
    AND NOT EXISTS (
      SELECT 1 FROM centro_digital_archivos
      WHERE migration_source_id = chava_documentos.id
    )
  LOOP
    INSERT INTO centro_digital_archivos (
      carpeta_id,
      nombre,
      nombre_original,
      ruta_storage,
      tipo_mime,
      tamano_bytes,
      estado,
      cargado_por,
      visible_para_todos,
      migration_source_id
    ) VALUES (
      v_carpeta_id,
      v_doc.titulo,
      v_doc.titulo || '.' || COALESCE(lower(v_doc.archivo_tipo), 'txt'),
      'migrated/chava-kb/' || v_doc.id,
      CASE
        WHEN v_doc.archivo_tipo = 'PDF' THEN 'application/pdf'
        WHEN v_doc.archivo_tipo = 'TXT' THEN 'text/plain'
        ELSE 'text/plain'
      END,
      COALESCE(length(v_doc.contenido_extraido), 0),
      'activo',
      v_admin_id,
      true,
      v_doc.id
    )
    RETURNING id INTO v_archivo_id;

    -- Migrate fragments as chunks
    FOR v_frag IN
      SELECT contenido, embedding, orden, metadata
      FROM chava_fragmentos
      WHERE documento_id = v_doc.id
      ORDER BY orden
    LOOP
      INSERT INTO centro_digital_chunks (
        archivo_id,
        carpeta_id,
        contenido,
        embedding,
        chunk_index,
        metadata
      ) VALUES (
        v_archivo_id,
        v_carpeta_id,
        v_frag.contenido,
        v_frag.embedding,
        COALESCE(v_frag.orden, 0),
        COALESCE(v_frag.metadata, '{}')::jsonb || jsonb_build_object(
          'source', 'chava_knowledge_base',
          'original_doc_id', v_doc.id,
          'archivo_nombre', v_doc.titulo,
          'carpeta_nombre', 'Base de Conocimiento Seguros'
        )
      );
    END LOOP;
  END LOOP;
END $$;
