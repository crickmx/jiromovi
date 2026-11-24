/*
  # Corregir estructura de disponibilidad_semanal en areas

  ## Descripción
  Convierte la estructura de disponibilidad_semanal de objetos simples a arrays de franjas
  horarias para que coincida con la expectativa del frontend.

  ## Cambios
  - Convierte estructura antigua: {activo, inicio, fin}
  - A nueva estructura: [{inicio, fin}]
  - Mantiene compatibilidad con áreas existentes

  ## Seguridad
  - No hay cambios en RLS
*/

-- Actualizar todas las áreas existentes para convertir la estructura
UPDATE areas
SET disponibilidad_semanal = jsonb_build_object(
  'lunes', CASE 
    WHEN (disponibilidad_semanal->'lunes'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'lunes'->>'inicio',
        'fin', disponibilidad_semanal->'lunes'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'martes', CASE 
    WHEN (disponibilidad_semanal->'martes'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'martes'->>'inicio',
        'fin', disponibilidad_semanal->'martes'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'miercoles', CASE 
    WHEN (disponibilidad_semanal->'miercoles'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'miercoles'->>'inicio',
        'fin', disponibilidad_semanal->'miercoles'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'jueves', CASE 
    WHEN (disponibilidad_semanal->'jueves'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'jueves'->>'inicio',
        'fin', disponibilidad_semanal->'jueves'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'viernes', CASE 
    WHEN (disponibilidad_semanal->'viernes'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'viernes'->>'inicio',
        'fin', disponibilidad_semanal->'viernes'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'sabado', CASE 
    WHEN (disponibilidad_semanal->'sabado'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'sabado'->>'inicio',
        'fin', disponibilidad_semanal->'sabado'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END,
  'domingo', CASE 
    WHEN (disponibilidad_semanal->'domingo'->>'activo')::boolean = true 
    THEN jsonb_build_array(
      jsonb_build_object(
        'inicio', disponibilidad_semanal->'domingo'->>'inicio',
        'fin', disponibilidad_semanal->'domingo'->>'fin'
      )
    )
    ELSE '[]'::jsonb
  END
)
WHERE disponibilidad_semanal IS NOT NULL 
  AND disponibilidad_semanal->'lunes' ? 'activo';

-- Actualizar el default para nuevas áreas
ALTER TABLE areas 
ALTER COLUMN disponibilidad_semanal SET DEFAULT '{
  "lunes": [],
  "martes": [],
  "miercoles": [],
  "jueves": [],
  "viernes": [],
  "sabado": [],
  "domingo": []
}'::jsonb;
