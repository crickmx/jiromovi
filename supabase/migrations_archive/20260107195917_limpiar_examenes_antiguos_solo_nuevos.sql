/*
  # Limpiar Exámenes Antiguos - Solo mantener Módulos 1 y 2 nuevos

  1. Eliminar todos los exámenes antiguos
  2. Solo mantener los exámenes nuevos de Módulos 1 y 2
  3. Las preguntas se eliminarán automáticamente por CASCADE
*/

-- Eliminar TODOS los exámenes antiguos excepto los nuevos de Módulos 1 y 2
DELETE FROM cedula_a_preguntas 
WHERE examen_id NOT IN (
  SELECT e.id 
  FROM cedula_a_examenes e
  JOIN cedula_a_modulos m ON m.id = e.modulo_id
  WHERE m.orden IN (1, 2)
  AND e.tipo = 'practica'
  AND e.titulo LIKE '%Módulo%:%'
  AND e.created_at >= NOW() - INTERVAL '1 hour'
);

DELETE FROM cedula_a_examenes 
WHERE id NOT IN (
  SELECT e.id 
  FROM cedula_a_examenes e
  JOIN cedula_a_modulos m ON m.id = e.modulo_id
  WHERE m.orden IN (1, 2)
  AND e.tipo = 'practica'
  AND e.titulo LIKE '%Módulo%:%'
  AND e.created_at >= NOW() - INTERVAL '1 hour'
);