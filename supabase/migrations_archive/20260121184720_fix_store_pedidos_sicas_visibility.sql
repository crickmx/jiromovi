/*
  # Permitir visibilidad de pedidos por nombre SICAS compartido

  1. Problema
     - Los usuarios solo pueden ver sus propios pedidos (usuario_id = auth.uid())
     - Si múltiples usuarios están mapeados al mismo vendedor externo (source_value en vendor_mappings), 
       no pueden ver los pedidos de los demás
     - Ejemplo: "Agente Demo" tiene varios usuarios MOVI asociados pero solo cada uno ve sus propios pedidos

  2. Solución
     - Actualizar la política de SELECT en store_pedidos
     - Permitir que usuarios mapeados al mismo source_value (nombre SICAS) puedan ver los pedidos entre sí
     - Los administradores y gerentes siguen viendo todos los pedidos

  3. Cambios
     - Modificar política "Usuarios pueden ver sus pedidos"
     - Agregar condición para verificar source_value compartido en vendor_mappings
*/

-- Eliminar política actual
DROP POLICY IF EXISTS "Usuarios pueden ver sus pedidos" ON store_pedidos;

-- Crear nueva política que considera vendor_mappings
CREATE POLICY "Usuarios pueden ver sus pedidos" ON store_pedidos
  FOR SELECT TO authenticated
  USING (
    -- El usuario ve sus propios pedidos
    usuario_id = auth.uid()
    OR
    -- Administradores y gerentes ven todos los pedidos
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol IN ('admin', 'gerente')
    )
    OR
    -- Usuarios mapeados al mismo source_value en vendor_mappings pueden ver pedidos entre sí
    EXISTS (
      SELECT 1 FROM vendor_mappings v1
      JOIN vendor_mappings v2 ON v1.source_value = v2.source_value 
        AND v1.source_type = v2.source_type
      WHERE v1.movi_user_id = auth.uid()
      AND v2.movi_user_id = store_pedidos.usuario_id
      AND v1.status = 'active'
      AND v2.status = 'active'
    )
  );

-- Comentario explicativo
COMMENT ON POLICY "Usuarios pueden ver sus pedidos" ON store_pedidos
IS 'Permite que usuarios vean sus propios pedidos, pedidos de usuarios mapeados al mismo source_value en vendor_mappings, o todos los pedidos si son admin/gerente';
