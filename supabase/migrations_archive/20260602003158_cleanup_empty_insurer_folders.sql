/*
  # Cleanup empty insurer folders in Centro Digital

  Deletes root-level folders (parent_id IS NULL) that have zero files AND zero subcarpetas.
  These were auto-provisioned insurer folders that were never populated.

  Only removes truly empty leaves — keeps any folder that has files or children.
*/

DELETE FROM centro_digital_carpetas
WHERE parent_id IS NULL
  AND activa = true
  AND id NOT IN (
    -- keep if has files
    SELECT DISTINCT carpeta_id FROM centro_digital_archivos
    UNION
    -- keep if has child folders
    SELECT DISTINCT parent_id FROM centro_digital_carpetas WHERE parent_id IS NOT NULL
  );
