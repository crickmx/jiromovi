/*
  # Corregir función delete_import_batch
  
  1. Cambios
    - Corregir referencias de `import_batches` a `document_import_batches`
    - La tabla correcta es `document_import_batches`
  
  2. Seguridad
    - Mantiene todas las validaciones de seguridad
    - Solo administradores pueden eliminar batches
*/

CREATE OR REPLACE FUNCTION delete_import_batch(p_batch_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  documents_deleted INTEGER,
  error TEXT
) AS $$
DECLARE
  v_documents_deleted INTEGER := 0;
  v_user_role TEXT;
BEGIN
  -- Verificar que el usuario es administrador
  SELECT rol INTO v_user_role
  FROM usuarios
  WHERE id = auth.uid();

  IF v_user_role IS NULL OR v_user_role != 'Administrador' THEN
    RETURN QUERY SELECT false, 0, 'No tienes permisos para eliminar batches de importación'::TEXT;
    RETURN;
  END IF;

  -- Verificar que el batch existe (usando el nombre correcto de tabla)
  IF NOT EXISTS (
    SELECT 1 FROM document_import_batches WHERE id = p_batch_id
  ) THEN
    RETURN QUERY SELECT false, 0, 'El batch no existe'::TEXT;
    RETURN;
  END IF;

  -- Eliminar todos los documentos asociados al batch
  DELETE FROM imported_documents
  WHERE batch_id = p_batch_id;

  GET DIAGNOSTICS v_documents_deleted = ROW_COUNT;

  -- Eliminar el batch (usando el nombre correcto de tabla)
  DELETE FROM document_import_batches
  WHERE id = p_batch_id;

  -- Verificar que el batch fue eliminado
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Error al eliminar el batch'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_documents_deleted, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_import_batch IS 'Elimina un batch de importación y todos sus documentos asociados. Solo accesible por administradores.';
