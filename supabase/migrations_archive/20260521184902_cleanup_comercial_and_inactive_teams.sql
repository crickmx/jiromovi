/*
  # Cleanup Comercial and inactive tramite teams

  ## Summary
  - Remove all inactive teams (they serve no purpose and clutter the UI)
  - Remove Comercial teams (commercial visibility is now handled by role+office, not teams)
  - Only Operaciones teams should exist and be managed via the UI
*/

-- Delete members and office assignments for teams being removed first
DELETE FROM tramites_grupos_miembros
WHERE grupo_id IN (
  SELECT id FROM tramites_grupos_visualizacion
  WHERE activo = false OR area_categoria = 'Comercial' OR area_categoria IS NULL
);

DELETE FROM tramites_grupos_oficinas
WHERE grupo_id IN (
  SELECT id FROM tramites_grupos_visualizacion
  WHERE activo = false OR area_categoria = 'Comercial' OR area_categoria IS NULL
);

-- Delete the teams themselves
DELETE FROM tramites_grupos_visualizacion
WHERE activo = false OR area_categoria = 'Comercial' OR area_categoria IS NULL;
