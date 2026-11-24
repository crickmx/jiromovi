/*
  # Auto-publicar página web al crear usuario

  1. Función
    - Se ejecuta automáticamente al crear o actualizar un usuario con web_slug
    - Crea o actualiza su registro en user_web_pages con is_published = true
    - Asigna categorías y aseguradoras por defecto si no existen

  2. Trigger
    - Se dispara AFTER INSERT OR UPDATE en usuarios
    - Solo si el usuario tiene web_slug configurado

  3. Configuración por defecto
    - Página publicada automáticamente
    - Colores: Azul (#2563eb) y Verde (#10b981)
    - Todas las categorías activas
    - Todas las aseguradoras activas
*/

-- Función para auto-publicar página web
CREATE OR REPLACE FUNCTION auto_publish_user_web_page()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_web_page_id uuid;
  v_category_id uuid;
  v_insurer_id uuid;
BEGIN
  -- Solo procesar si el usuario tiene web_slug configurado
  IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
    
    -- Crear o actualizar la página web
    INSERT INTO user_web_pages (
      user_id,
      primary_color,
      secondary_color,
      custom_text,
      is_published
    )
    VALUES (
      NEW.id,
      '#2563eb', -- Azul por defecto
      '#10b981', -- Verde por defecto
      'Asesor profesional de seguros comprometido con tu protección y tranquilidad. Te ofrezco soluciones personalizadas y las mejores opciones del mercado.',
      true -- Publicada automáticamente
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      is_published = true,
      updated_at = now()
    RETURNING id INTO v_web_page_id;

    -- Agregar todas las categorías activas si no existen
    INSERT INTO user_web_page_categories (user_web_page_id, category_id)
    SELECT v_web_page_id, id
    FROM web_page_categories
    WHERE is_active = true
    ON CONFLICT (user_web_page_id, category_id) DO NOTHING;

    -- Agregar todas las aseguradoras activas si no existen
    INSERT INTO user_web_page_insurers (user_web_page_id, insurer_id)
    SELECT v_web_page_id, id
    FROM web_page_insurers
    WHERE is_active = true
    ON CONFLICT (user_web_page_id, insurer_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_auto_publish_web_page ON usuarios;

-- Crear trigger que se ejecuta al crear o actualizar usuario
CREATE TRIGGER trigger_auto_publish_web_page
  AFTER INSERT OR UPDATE OF web_slug ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION auto_publish_user_web_page();

-- Comentarios
COMMENT ON FUNCTION auto_publish_user_web_page IS 'Crea y publica automáticamente la página web del usuario cuando se configura su web_slug';
COMMENT ON TRIGGER trigger_auto_publish_web_page ON usuarios IS 'Auto-publica la página web del usuario al crear o actualizar su slug';
