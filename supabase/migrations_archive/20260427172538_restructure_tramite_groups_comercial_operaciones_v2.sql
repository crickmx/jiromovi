/*
  # Restructure tramite visibility groups to Comercial / Operaciones

  1. Changes to `tramites_grupos_visualizacion`
    - Add `area_categoria` column (text) to link groups to tipo_tramite areas
    - Set area_categoria = 'Comercial' for Equipo Comercial
    - Set area_categoria = 'Operaciones' for Operaciones
    - Deactivate "Equipo Administrativo" and "Gerencia" groups

  2. New function `get_user_tramite_area`
    - Returns the area_categoria for a given user based on their group membership

  3. Updated function `get_grupo_miembros`
    - Now includes rol and oficina_id in the result

  4. RLS policy updates
    - All authenticated can read active groups
    - Users can see their own group membership + admins see all
    - Only Administradores can manage group membership
*/

-- Step 1: Add area_categoria column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tramites_grupos_visualizacion' AND column_name = 'area_categoria'
  ) THEN
    ALTER TABLE tramites_grupos_visualizacion ADD COLUMN area_categoria text;
  END IF;
END $$;

-- Step 2: Update existing groups
UPDATE tramites_grupos_visualizacion
SET area_categoria = 'Comercial',
    descripcion = 'Usuarios que gestionan trámites comerciales (Cotización/Emisión). Solo ven trámites de su oficina.',
    color = '#0ea5e9'
WHERE id = '6565992a-5816-4fc0-8c1a-309bdac4875d';

UPDATE tramites_grupos_visualizacion
SET area_categoria = 'Operaciones',
    descripcion = 'Usuarios que gestionan trámites operativos (Correcciones, Registros, Solicitudes). Ven trámites de todas las oficinas.',
    color = '#f59e0b'
WHERE id = 'cda4665e-e0ec-436b-9a5a-5f0988beb184';

-- Step 3: Deactivate obsolete groups
UPDATE tramites_grupos_visualizacion
SET activo = false
WHERE id IN (
  '0b459332-fb14-4c47-a970-5a0e8714a101',
  '4af02044-e2b6-48bf-93af-5986e159e1c1'
);

-- Step 4: Create function to get user's area
CREATE OR REPLACE FUNCTION get_user_tramite_area(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.area_categoria
  FROM tramites_grupos_miembros m
  INNER JOIN tramites_grupos_visualizacion g ON g.id = m.grupo_id
  WHERE m.usuario_id = p_user_id
    AND g.activo = true
    AND g.area_categoria IS NOT NULL
  LIMIT 1;
$$;

-- Step 5: Drop old function (return type changed)
DROP FUNCTION IF EXISTS get_grupo_miembros(uuid);

-- Step 5b: Recreate with extended return type
CREATE OR REPLACE FUNCTION get_grupo_miembros(p_grupo_id uuid)
RETURNS TABLE(
  id uuid,
  nombre_completo text,
  oficina_nombre text,
  rol text,
  oficina_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, '')) as nombre_completo,
    o.nombre as oficina_nombre,
    u.rol,
    u.oficina_id
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE m.grupo_id = p_grupo_id
    AND u.estado = 'Activo'
  ORDER BY nombre_completo;
END;
$$;

-- Step 6: Update RLS on grupos - allow all authenticated to read active groups
DROP POLICY IF EXISTS "Admins y Gerentes pueden ver grupos" ON tramites_grupos_visualizacion;

CREATE POLICY "Authenticated users can view active groups"
  ON tramites_grupos_visualizacion
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Step 7: Update RLS on miembros - users see own membership, admins see all
DROP POLICY IF EXISTS "Admins y Gerentes pueden ver miembros" ON tramites_grupos_miembros;

CREATE POLICY "Users can view group members"
  ON tramites_grupos_miembros
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Step 8: Restrict INSERT/DELETE on miembros to Admins only
DROP POLICY IF EXISTS "Admins y Gerentes pueden agregar miembros" ON tramites_grupos_miembros;
DROP POLICY IF EXISTS "Admins y Gerentes pueden eliminar miembros" ON tramites_grupos_miembros;

CREATE POLICY "Admins can add group members"
  ON tramites_grupos_miembros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can remove group members"
  ON tramites_grupos_miembros
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Step 9: Restrict group CRUD to Admins only
DROP POLICY IF EXISTS "Admins y Gerentes pueden crear grupos" ON tramites_grupos_visualizacion;
DROP POLICY IF EXISTS "Admins y Gerentes pueden actualizar grupos" ON tramites_grupos_visualizacion;
DROP POLICY IF EXISTS "Admins y Gerentes pueden eliminar grupos" ON tramites_grupos_visualizacion;

CREATE POLICY "Admins can create groups"
  ON tramites_grupos_visualizacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update groups"
  ON tramites_grupos_visualizacion
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete groups"
  ON tramites_grupos_visualizacion
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
