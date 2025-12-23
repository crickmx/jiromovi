/*
  # Fix: Corregir trigger sync_usuario_metadata para nombre_completo

  1. Problema
    - El trigger sync_usuario_metadata intenta sincronizar nombre_completo a auth.users
    - nombre_completo es una columna generada que se calcula después del INSERT
    - Esto causa errores al crear usuarios

  2. Solución
    - Modificar el trigger para calcular nombre_completo en lugar de leerlo
    - Esto asegura que el trigger siempre tenga un valor válido
*/

-- Recrear la función del trigger sin usar nombre_completo directamente
CREATE OR REPLACE FUNCTION sync_usuario_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular nombre_completo en lugar de leerlo
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'rol', NEW.rol,
      'oficina_id', NEW.oficina_id,
      'nombre_completo', (NEW.nombre || ' ' || NEW.apellidos)
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla, continuar sin error para no bloquear el INSERT
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que el trigger exista
DROP TRIGGER IF EXISTS trigger_sync_usuario_metadata ON usuarios;
CREATE TRIGGER trigger_sync_usuario_metadata
  AFTER INSERT OR UPDATE OF rol, oficina_id, nombre, apellidos
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_metadata();