/*
  # Update Promotional Banner and Seed Chava Knowledge Base

  ## Changes
  1. Updates existing promotional banner with new fields (descripcion, placement, start_date, end_date)
  2. Inserts second banner for GMM comparison
  3. Creates "Base de Conocimiento Seguros" folder in Chava IA
  4. Seeds chava_documentos entries linked to digital_center_documents
  5. Seeds chava_fragmentos text chunks for RAG indexing (embeddings generated later)

  ## Notes
  - acceso = 'todos' (valid constraint value)
  - estado = 'ready' (valid constraint value)
  - Embeddings are NULL; the edge function generates them
*/

-- Update the existing promotional banner
UPDATE digital_center_ads
SET
  descripcion = 'Accede a cotizadores, materiales de capacitación y guías de productos actualizadas al 2026. Todo lo que necesitas para cerrar más ventas desde MOVI Digital.',
  placement = 'centro-digital',
  start_date = CURRENT_DATE,
  end_date = (CURRENT_DATE + INTERVAL '180 days')::date
WHERE titulo = 'Impulsa tus ventas con herramientas digitales';

-- Insert second promotional banner focused on GMM
INSERT INTO digital_center_ads (titulo, subtitulo, descripcion, cta_texto, cta_url, imagen_url, color_fondo, color_texto, activo, orden, placement, start_date, end_date)
SELECT
  'Compara GMM de todas las aseguradoras',
  'GNP, CHUBB, AXA, Allianz, MAPFRE, BUPA, BX+ y más en un solo lugar.',
  'Descarga tablas de beneficios, condiciones generales y guías de cotización de los mejores planes del mercado.',
  'Ver materiales GMM',
  '/centro-digital',
  NULL,
  '#1B5E20',
  '#FFFFFF',
  true,
  2,
  'centro-digital',
  CURRENT_DATE,
  (CURRENT_DATE + INTERVAL '180 days')::date
WHERE NOT EXISTS (
  SELECT 1 FROM digital_center_ads WHERE titulo = 'Compara GMM de todas las aseguradoras'
);

-- Create Chava IA folder for insurance knowledge base
INSERT INTO chava_carpetas (nombre, descripcion, icono, orden, activo)
SELECT 'Base de Conocimiento Seguros', 'Documentos, guías y materiales del sector asegurador indexados para Chava IA', 'BookOpen', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM chava_carpetas WHERE nombre = 'Base de Conocimiento Seguros'
);

-- Seed chava_documentos linked to digital_center_documents
DO $$
DECLARE
  v_carpeta_id uuid;
  v_doc RECORD;
  v_chava_doc_id uuid;
  v_chunk_text text;
BEGIN
  SELECT id INTO v_carpeta_id FROM chava_carpetas WHERE nombre = 'Base de Conocimiento Seguros' LIMIT 1;
  IF v_carpeta_id IS NULL THEN RETURN; END IF;

  FOR v_doc IN
    SELECT id, titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, url_original, tags, insurer_logo_url
    FROM digital_center_documents
    WHERE visibilidad = 'global' AND activo = true AND subido_por IS NULL
    ORDER BY aseguradora, ramo, titulo
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM chava_documentos WHERE archivo_url = v_doc.url_original
    ) THEN
      v_chunk_text := format(
        'DOCUMENTO: %s' || chr(10) ||
        'ASEGURADORA: %s' || chr(10) ||
        'RAMO: %s' || chr(10) ||
        'CATEGORÍA: %s' || chr(10) ||
        'TIPO: %s' || chr(10) ||
        'FORMATO: %s' || chr(10) ||
        'DESCRIPCIÓN: %s' || chr(10) ||
        'ETIQUETAS: %s',
        v_doc.titulo,
        v_doc.aseguradora,
        v_doc.ramo,
        v_doc.categoria,
        v_doc.tipo,
        v_doc.formato,
        COALESCE(v_doc.descripcion, ''),
        COALESCE(array_to_string(v_doc.tags, ', '), '')
      );

      INSERT INTO chava_documentos (
        carpeta_id, titulo, descripcion, archivo_url, archivo_nombre,
        archivo_tipo, estado, version, acceso, contenido_extraido, total_fragmentos
      )
      VALUES (
        v_carpeta_id,
        v_doc.titulo,
        COALESCE(v_doc.descripcion, v_doc.titulo),
        v_doc.url_original,
        v_doc.titulo || '.' || lower(COALESCE(v_doc.formato, 'pdf')),
        COALESCE(v_doc.formato, 'PDF'),
        'ready',
        1,
        'todos',
        v_chunk_text,
        1
      )
      RETURNING id INTO v_chava_doc_id;

      INSERT INTO chava_fragmentos (
        documento_id, contenido, embedding, metadata, orden
      )
      VALUES (
        v_chava_doc_id,
        v_chunk_text,
        NULL,
        jsonb_build_object(
          'aseguradora', v_doc.aseguradora,
          'ramo', v_doc.ramo,
          'categoria', v_doc.categoria,
          'tipo', v_doc.tipo,
          'formato', v_doc.formato,
          'url_original', COALESCE(v_doc.url_original, ''),
          'digital_center_document_id', v_doc.id::text,
          'insurer_logo_url', COALESCE(v_doc.insurer_logo_url, '')
        ),
        1
      );
    END IF;
  END LOOP;
END $$;
