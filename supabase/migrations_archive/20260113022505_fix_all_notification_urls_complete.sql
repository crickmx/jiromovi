/*
  # Corregir todas las URLs incorrectas en notificaciones
  
  1. Problema
    - Algunas notificaciones tienen URLs con formato incorrecto
    - Causan páginas en blanco al hacer clic
  
  2. Correcciones
    - /seguros-education-aula-digital → /seguros-education/aula-virtual
    - Asegurar que todas las URLs usen el formato correcto con slash (/)
*/

-- Corregir URLs de eventos de aula digital
UPDATE notificaciones
SET 
  accion_url = REPLACE(accion_url, '/seguros-education-aula-digital', '/seguros-education/aula-virtual')
WHERE accion_url LIKE '%seguros-education-aula-digital%';

-- Verificar y reportar notificaciones con URLs potencialmente problemáticas
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Contar notificaciones con URLs sospechosas
  SELECT COUNT(*) INTO v_count
  FROM notificaciones
  WHERE accion_url IS NOT NULL 
    AND accion_url != ''
    AND accion_url NOT LIKE '/%'  -- URLs que no empiezan con /
    AND accion_url NOT LIKE 'http%';  -- URLs que no son absolutas
  
  IF v_count > 0 THEN
    RAISE WARNING 'Se encontraron % notificaciones con URLs potencialmente incorrectas', v_count;
  END IF;
END $$;
