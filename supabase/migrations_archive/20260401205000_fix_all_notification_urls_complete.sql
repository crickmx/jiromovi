/*
  # Fix: Corregir todas las URLs de notificaciones

  1. Cambios
    - Reemplazar movidigital.com.mx por app.movi.digital
    - Asegurar que todas las plantillas usen el dominio correcto
    
  2. Verificación
    - Actualizar todas las plantillas de correo
*/

-- Actualizar plantillas que usen movidigital.com.mx
UPDATE correo_plantillas
SET html_cuerpo = REPLACE(html_cuerpo, 'https://movidigital.com.mx', 'https://app.movi.digital')
WHERE html_cuerpo LIKE '%movidigital.com.mx%';

-- Asegurar que www.movi.digital se mantenga para referencias al sitio público
-- pero app.movi.digital para la aplicación

-- Verificar resultado
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM correo_plantillas
  WHERE html_cuerpo LIKE '%movidigital.com.mx%' 
     OR html_cuerpo LIKE '%moviapp.com%';
  
  IF v_count > 0 THEN
    RAISE WARNING 'Aún hay % plantillas con URLs incorrectas', v_count;
  ELSE
    RAISE NOTICE 'Todas las plantillas tienen URLs correctas';
  END IF;
END $$;
