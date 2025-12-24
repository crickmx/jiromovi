/*
  # Corregir paths duplicados en URLs de avatares

  1. Problema
    - Las URLs de `imagen_perfil_url` tienen paths duplicados: `/avatars/avatars/`
    - Esto causa errores ERR_TIMED_OUT al cargar las imágenes
  
  2. Solución
    - Actualizar todas las URLs que contengan `/avatars/avatars/`
    - Reemplazar con el path correcto `/avatars/`
    - También corregir otros buckets que puedan tener el mismo problema
*/

-- Corregir URLs de imagen de perfil duplicadas en usuarios
UPDATE usuarios 
SET imagen_perfil_url = replace(imagen_perfil_url, '/avatars/avatars/', '/avatars/')
WHERE imagen_perfil_url LIKE '%/avatars/avatars/%';

-- Corregir URLs de logotipos duplicadas
UPDATE usuarios 
SET mi_logotipo_url = replace(mi_logotipo_url, '/logos/logos/', '/logos/')
WHERE mi_logotipo_url LIKE '%/logos/logos/%';

-- Corregir URLs de oficinas
UPDATE oficinas 
SET logo_url = replace(logo_url, '/logos/logos/', '/logos/')
WHERE logo_url LIKE '%/logos/logos/%';

-- Log de correcciones realizadas
DO $$
DECLARE
  v_usuarios_corregidos INTEGER;
  v_logos_corregidos INTEGER;
  v_oficinas_corregidas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_usuarios_corregidos 
  FROM usuarios 
  WHERE imagen_perfil_url LIKE '%/avatars/avatars/%';
  
  SELECT COUNT(*) INTO v_logos_corregidos 
  FROM usuarios 
  WHERE mi_logotipo_url LIKE '%/logos/logos/%';
  
  SELECT COUNT(*) INTO v_oficinas_corregidas 
  FROM oficinas 
  WHERE logo_url LIKE '%/logos/logos/%';
  
  RAISE NOTICE 'URLs corregidas:';
  RAISE NOTICE '- Usuarios (avatares): %', COALESCE(v_usuarios_corregidos, 0);
  RAISE NOTICE '- Usuarios (logotipos): %', COALESCE(v_logos_corregidos, 0);
  RAISE NOTICE '- Oficinas (logos): %', COALESCE(v_oficinas_corregidas, 0);
END $$;