/*
  # Grant Public Access to Web Page Function
  
  1. Descripción
    - Permitir que usuarios anónimos (no autenticados) puedan llamar la función
    - Esta función es necesaria para mostrar las páginas públicas en agentedeseguros.online
    
  2. Permisos
    - GRANT EXECUTE a anon (usuarios no autenticados)
    - GRANT EXECUTE a authenticated (usuarios autenticados también)
*/

-- Asegurar que usuarios anónimos puedan ejecutar la función
GRANT EXECUTE ON FUNCTION get_public_web_page_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION get_public_web_page_by_slug(text) TO authenticated;
