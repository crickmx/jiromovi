/*
  # Fix Store Pedidos Historial RLS Policy
  
  ## Problem
  Users cannot create orders because they cannot insert into store_pedidos_historial table.
  Only Administrators can insert historial, but when a regular user creates an order,
  the system tries to insert a historial record and fails.
  
  ## Solution
  Add a policy that allows users to insert historial for their own orders.
  
  ## Changes
  1. Add INSERT policy for users to create historial for their own orders
     - Users can insert if the pedido belongs to them
     - Validates that cambiado_por matches auth.uid()
  
  ## Security
  - Users can only create historial for their own orders
  - Admins maintain their existing policy for all orders
  - cambiado_por must match the authenticated user
*/

-- Add policy for users to insert historial for their own orders
CREATE POLICY "Usuarios pueden agregar historial a sus pedidos"
  ON store_pedidos_historial FOR INSERT
  TO authenticated
  WITH CHECK (
    cambiado_por = auth.uid() AND
    EXISTS (
      SELECT 1 FROM store_pedidos
      WHERE store_pedidos.id = pedido_id
      AND store_pedidos.usuario_id = auth.uid()
    )
  );

-- Log confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Política INSERT agregada para store_pedidos_historial';
  RAISE NOTICE '✅ Usuarios pueden crear historial para sus propios pedidos';
  RAISE NOTICE '✅ Administradores mantienen acceso completo';
END $$;
