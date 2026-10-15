/*
  # Fix seguwallet_insurers RLS policies — admin role case

  ## Problem
  INSERT, UPDATE, DELETE policies check for rol IN ('admin', 'superadmin') (lowercase).
  The application uses rol = 'Administrador' (capitalized). Admins can see the UI
  but writes are rejected silently.

  ## Fix
  Add 'Administrador' and 'Gerente' to the allowed roles array for all write policies.
*/

-- UPDATE policy
DROP POLICY IF EXISTS "Admins can update insurers" ON seguwallet_insurers;
CREATE POLICY "Admins can update insurers"
  ON seguwallet_insurers FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = ANY (ARRAY['admin', 'superadmin', 'Administrador', 'Gerente'])
      AND (u.estado IS NULL OR u.estado <> 'eliminado')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = ANY (ARRAY['admin', 'superadmin', 'Administrador', 'Gerente'])
      AND (u.estado IS NULL OR u.estado <> 'eliminado')
  ));

-- INSERT policy
DROP POLICY IF EXISTS "Admins can insert insurers" ON seguwallet_insurers;
CREATE POLICY "Admins can insert insurers"
  ON seguwallet_insurers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = ANY (ARRAY['admin', 'superadmin', 'Administrador', 'Gerente'])
      AND (u.estado IS NULL OR u.estado <> 'eliminado')
  ));

-- DELETE policy
DROP POLICY IF EXISTS "Admins can delete insurers" ON seguwallet_insurers;
CREATE POLICY "Admins can delete insurers"
  ON seguwallet_insurers FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = ANY (ARRAY['admin', 'superadmin', 'Administrador', 'Gerente'])
      AND (u.estado IS NULL OR u.estado <> 'eliminado')
  ));
