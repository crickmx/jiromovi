/*
  # Corregir visibilidad de pedidos y estatus para todos los usuarios
  
  ## Problema
  La política de store_estatus_pedidos solo permite ver estatus activos,
  lo que podría causar problemas en el JOIN cuando se cargan pedidos.
  
  ## Solución
  - Permitir que todos los usuarios autenticados vean todos los estatus (activos e inactivos)
  - Esto es seguro porque es solo información de lectura
  
  ## Cambios
  - Modificar la política de SELECT en store_estatus_pedidos
*/

-- Eliminar la política restrictiva que solo muestra estatus activos
DROP POLICY IF EXISTS "Todos pueden ver estatus activos" ON store_estatus_pedidos;

-- Crear nueva política que permite ver todos los estatus
CREATE POLICY "Todos pueden ver todos los estatus"
  ON store_estatus_pedidos FOR SELECT
  TO authenticated
  USING (true);

-- Comentario explicativo
COMMENT ON POLICY "Todos pueden ver todos los estatus" ON store_estatus_pedidos 
IS 'Permite que todos los usuarios autenticados vean todos los estatus de pedidos (activos e inactivos) para asegurar que los JOINs funcionen correctamente';