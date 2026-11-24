
/*
  # Fix seguwallet_terms RLS policies

  ## Problem
  Multiple conflicting RLS policies on seguwallet_terms cause INSERT failures for admins.
  Some policies only check `rol = 'admin'` excluding superadmin, and the FOR ALL + INSERT
  combination creates conflicts.

  ## Fix
  Drop all existing policies and replace with clean, non-conflicting set:
  - SELECT: authenticated users see active terms; admins/superadmins see all
  - INSERT: admins and superadmins can insert
  - UPDATE: admins and superadmins can update
  - DELETE: admins and superadmins can delete
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can insert terms" ON seguwallet_terms;
DROP POLICY IF EXISTS "Admins can manage terms" ON seguwallet_terms;
DROP POLICY IF EXISTS "Admins can update terms" ON seguwallet_terms;
DROP POLICY IF EXISTS "Authenticated users can read active terms" ON seguwallet_terms;

-- SELECT: active terms visible to all authenticated; admins see all
CREATE POLICY "Users can read active terms"
  ON seguwallet_terms
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

-- INSERT: admins and superadmins only
CREATE POLICY "Admins can insert terms"
  ON seguwallet_terms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

-- UPDATE: admins and superadmins only
CREATE POLICY "Admins can update terms"
  ON seguwallet_terms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

-- DELETE: admins and superadmins only
CREATE POLICY "Admins can delete terms"
  ON seguwallet_terms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );
