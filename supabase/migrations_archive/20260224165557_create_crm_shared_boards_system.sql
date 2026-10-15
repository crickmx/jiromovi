/*
  # Sistema de Tableros Compartidos para Mi CRM

  1. Nuevas Tablas
    - `crm_boards`: Tableros de CRM (personales y compartidos)
      - `id` (uuid, PK)
      - `name` (text, nombre del tablero)
      - `owner_user_id` (uuid, FK a auth.users)
      - `owner_office_id` (uuid, FK a oficinas, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `deleted_at` (timestamptz, nullable, para soft delete)
    
    - `crm_board_members`: Miembros de tableros compartidos
      - `id` (uuid, PK)
      - `board_id` (uuid, FK a crm_boards)
      - `user_id` (uuid, FK a auth.users)
      - `member_role` (text, 'owner'|'admin'|'editor'|'viewer')
      - `added_by` (uuid, FK a auth.users)
      - `created_at` (timestamptz)
      - UNIQUE(board_id, user_id)
    
    - `crm_board_activity`: Log de actividades en tableros
      - `id` (uuid, PK)
      - `board_id` (uuid, FK a crm_boards)
      - `actor_user_id` (uuid, FK a auth.users)
      - `action` (text, descripción de la acción)
      - `meta` (jsonb, metadata adicional)
      - `created_at` (timestamptz)

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Solo roles Empleado/Gerente/Administrador pueden acceder
    - Validaciones anti-agentes en todas las políticas
    - Owner y Admin pueden gestionar miembros
    - Viewer solo puede leer
    - Editor puede modificar contenido pero no miembros
    
  3. Notas Importantes
    - Se insertará automáticamente al owner como miembro con role='owner' al crear tablero
    - Soft delete mediante deleted_at
    - Cross-office permitido
    - Validación de roles en RLS y funciones
*/

-- ============================================================
-- PASO 1: CREAR TABLAS
-- ============================================================

-- Tabla de tableros
CREATE TABLE IF NOT EXISTS crm_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_office_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crm_boards_owner ON crm_boards(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_boards_deleted ON crm_boards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_crm_boards_office ON crm_boards(owner_office_id);

-- Tabla de miembros de tableros
CREATE TABLE IF NOT EXISTS crm_board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES crm_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL CHECK (member_role IN ('owner', 'admin', 'editor', 'viewer')),
  added_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_board_members_board ON crm_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_crm_board_members_user ON crm_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_board_members_role ON crm_board_members(member_role);

-- Tabla de actividades en tableros
CREATE TABLE IF NOT EXISTS crm_board_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES crm_boards(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_board_activity_board ON crm_board_activity(board_id);
CREATE INDEX IF NOT EXISTS idx_crm_board_activity_created ON crm_board_activity(created_at DESC);

-- ============================================================
-- PASO 2: FUNCIÓN HELPER PARA OBTENER ROL DEL USUARIO
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT rol INTO user_role
  FROM usuarios
  WHERE id = user_id;
  
  RETURN user_role;
END;
$$;

-- ============================================================
-- PASO 3: HABILITAR RLS
-- ============================================================

ALTER TABLE crm_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_board_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 4: POLÍTICAS RLS PARA crm_boards
-- ============================================================

-- SELECT: Puedo ver tableros donde soy owner o miembro (y mi rol es permitido)
CREATE POLICY "Users can view boards they own or are members of"
  ON crm_boards
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND (
      owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM crm_board_members
        WHERE crm_board_members.board_id = crm_boards.id
        AND crm_board_members.user_id = auth.uid()
      )
    )
  );

-- INSERT: Solo roles permitidos pueden crear tableros
CREATE POLICY "Allowed roles can create boards"
  ON crm_boards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND owner_user_id = auth.uid()
  );

-- UPDATE: Owner o Admin del tablero pueden actualizar
CREATE POLICY "Owners and admins can update boards"
  ON crm_boards
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND (
      owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM crm_board_members
        WHERE crm_board_members.board_id = crm_boards.id
        AND crm_board_members.user_id = auth.uid()
        AND crm_board_members.member_role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
  );

-- DELETE: Solo owner puede hacer soft delete
CREATE POLICY "Only owners can soft delete boards"
  ON crm_boards
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND owner_user_id = auth.uid()
  );

-- ============================================================
-- PASO 5: POLÍTICAS RLS PARA crm_board_members
-- ============================================================

-- SELECT: Puedo ver miembros de tableros que puedo ver
CREATE POLICY "Users can view members of accessible boards"
  ON crm_board_members
  FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND EXISTS (
      SELECT 1 FROM crm_boards
      WHERE crm_boards.id = crm_board_members.board_id
      AND crm_boards.deleted_at IS NULL
      AND (
        crm_boards.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM crm_board_members AS my_membership
          WHERE my_membership.board_id = crm_boards.id
          AND my_membership.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Solo owner/admin pueden agregar miembros
CREATE POLICY "Owners and admins can add members"
  ON crm_board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND get_user_role(user_id) IN ('Empleado', 'Gerente', 'Administrador')
    AND EXISTS (
      SELECT 1 FROM crm_board_members AS my_membership
      WHERE my_membership.board_id = crm_board_members.board_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.member_role IN ('owner', 'admin')
    )
  );

-- UPDATE: Solo owner/admin pueden cambiar roles
CREATE POLICY "Owners and admins can update member roles"
  ON crm_board_members
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND EXISTS (
      SELECT 1 FROM crm_board_members AS my_membership
      WHERE my_membership.board_id = crm_board_members.board_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.member_role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND get_user_role(user_id) IN ('Empleado', 'Gerente', 'Administrador')
  );

-- DELETE: Solo owner/admin pueden remover miembros
CREATE POLICY "Owners and admins can remove members"
  ON crm_board_members
  FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND EXISTS (
      SELECT 1 FROM crm_board_members AS my_membership
      WHERE my_membership.board_id = crm_board_members.board_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.member_role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- PASO 6: POLÍTICAS RLS PARA crm_board_activity
-- ============================================================

-- SELECT: Puedo ver actividad de tableros accesibles
CREATE POLICY "Users can view activity of accessible boards"
  ON crm_board_activity
  FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND EXISTS (
      SELECT 1 FROM crm_boards
      WHERE crm_boards.id = crm_board_activity.board_id
      AND crm_boards.deleted_at IS NULL
      AND (
        crm_boards.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM crm_board_members
          WHERE crm_board_members.board_id = crm_boards.id
          AND crm_board_members.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Miembros pueden crear actividad
CREATE POLICY "Members can create activity"
  ON crm_board_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('Empleado', 'Gerente', 'Administrador')
    AND actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM crm_board_members
      WHERE crm_board_members.board_id = crm_board_activity.board_id
      AND crm_board_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- PASO 7: TRIGGER PARA UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_crm_board_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_crm_boards_updated_at
  BEFORE UPDATE ON crm_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_board_updated_at();

-- ============================================================
-- PASO 8: FUNCIÓN PARA CREAR TABLERO CON OWNER AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_create_board(
  p_name text,
  p_owner_office_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_board_id uuid;
  v_user_role text;
BEGIN
  -- Validar rol del usuario
  SELECT rol INTO v_user_role FROM usuarios WHERE id = auth.uid();
  
  IF v_user_role NOT IN ('Empleado', 'Gerente', 'Administrador') THEN
    RAISE EXCEPTION 'Solo usuarios con rol Empleado, Gerente o Administrador pueden crear tableros';
  END IF;
  
  -- Crear tablero
  INSERT INTO crm_boards (name, owner_user_id, owner_office_id)
  VALUES (p_name, auth.uid(), p_owner_office_id)
  RETURNING id INTO v_board_id;
  
  -- Insertar owner como miembro
  INSERT INTO crm_board_members (board_id, user_id, member_role, added_by)
  VALUES (v_board_id, auth.uid(), 'owner', auth.uid());
  
  -- Registrar actividad
  INSERT INTO crm_board_activity (board_id, actor_user_id, action, meta)
  VALUES (v_board_id, auth.uid(), 'board_created', jsonb_build_object('name', p_name));
  
  RETURN v_board_id;
END;
$$;

-- ============================================================
-- PASO 9: FUNCIÓN PARA INVITAR MIEMBRO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_invite_member(
  p_board_id uuid,
  p_user_id uuid,
  p_member_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id uuid;
  v_caller_role text;
  v_target_user_role text;
  v_my_board_role text;
BEGIN
  -- Validar rol del caller
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role NOT IN ('Empleado', 'Gerente', 'Administrador') THEN
    RAISE EXCEPTION 'No tienes permisos para invitar miembros';
  END IF;
  
  -- Validar rol del usuario a invitar
  SELECT rol INTO v_target_user_role FROM usuarios WHERE id = p_user_id;
  IF v_target_user_role NOT IN ('Empleado', 'Gerente', 'Administrador') THEN
    RAISE EXCEPTION 'Solo puedes invitar a usuarios con rol Empleado, Gerente o Administrador';
  END IF;
  
  -- Validar que el caller es owner o admin del tablero
  SELECT member_role INTO v_my_board_role
  FROM crm_board_members
  WHERE board_id = p_board_id AND user_id = auth.uid();
  
  IF v_my_board_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Solo owners y admins pueden invitar miembros';
  END IF;
  
  -- Validar rol válido
  IF p_member_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Rol inválido. Debe ser: admin, editor o viewer';
  END IF;
  
  -- Insertar miembro (ON CONFLICT actualiza)
  INSERT INTO crm_board_members (board_id, user_id, member_role, added_by)
  VALUES (p_board_id, p_user_id, p_member_role, auth.uid())
  ON CONFLICT (board_id, user_id) 
  DO UPDATE SET member_role = p_member_role
  RETURNING id INTO v_member_id;
  
  -- Registrar actividad
  INSERT INTO crm_board_activity (board_id, actor_user_id, action, meta)
  VALUES (
    p_board_id,
    auth.uid(),
    'member_invited',
    jsonb_build_object('user_id', p_user_id, 'role', p_member_role)
  );
  
  RETURN v_member_id;
END;
$$;

-- ============================================================
-- PASO 10: FUNCIÓN PARA ACTUALIZAR ROL DE MIEMBRO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_update_member_role(
  p_board_id uuid,
  p_user_id uuid,
  p_new_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_my_board_role text;
BEGIN
  -- Validar que el caller es owner o admin
  SELECT member_role INTO v_my_board_role
  FROM crm_board_members
  WHERE board_id = p_board_id AND user_id = auth.uid();
  
  IF v_my_board_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Solo owners y admins pueden cambiar roles';
  END IF;
  
  -- No se puede cambiar el rol del owner
  IF EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id AND user_id = p_user_id AND member_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar el rol del owner';
  END IF;
  
  -- Validar rol válido
  IF p_new_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  
  -- Actualizar rol
  UPDATE crm_board_members
  SET member_role = p_new_role
  WHERE board_id = p_board_id AND user_id = p_user_id;
  
  -- Registrar actividad
  INSERT INTO crm_board_activity (board_id, actor_user_id, action, meta)
  VALUES (
    p_board_id,
    auth.uid(),
    'member_role_updated',
    jsonb_build_object('user_id', p_user_id, 'new_role', p_new_role)
  );
  
  RETURN true;
END;
$$;

-- ============================================================
-- PASO 11: FUNCIÓN PARA REMOVER MIEMBRO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_remove_member(
  p_board_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_my_board_role text;
BEGIN
  -- Validar que el caller es owner o admin
  SELECT member_role INTO v_my_board_role
  FROM crm_board_members
  WHERE board_id = p_board_id AND user_id = auth.uid();
  
  IF v_my_board_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Solo owners y admins pueden remover miembros';
  END IF;
  
  -- No se puede remover al owner
  IF EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id AND user_id = p_user_id AND member_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'No se puede remover al owner del tablero';
  END IF;
  
  -- Remover miembro
  DELETE FROM crm_board_members
  WHERE board_id = p_board_id AND user_id = p_user_id;
  
  -- Registrar actividad
  INSERT INTO crm_board_activity (board_id, actor_user_id, action, meta)
  VALUES (
    p_board_id,
    auth.uid(),
    'member_removed',
    jsonb_build_object('user_id', p_user_id)
  );
  
  RETURN true;
END;
$$;

-- ============================================================
-- PASO 12: FUNCIÓN PARA LISTAR TABLEROS DEL USUARIO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_list_boards_for_user()
RETURNS TABLE (
  board_id uuid,
  board_name text,
  is_owner boolean,
  my_role text,
  owner_name text,
  owner_office text,
  members_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS board_id,
    b.name AS board_name,
    (b.owner_user_id = auth.uid()) AS is_owner,
    COALESCE(bm.member_role, 'owner') AS my_role,
    CONCAT(u.nombre, ' ', u.apellidos) AS owner_name,
    o.nombre AS owner_office,
    (SELECT COUNT(*) FROM crm_board_members WHERE board_id = b.id) AS members_count,
    b.created_at,
    b.updated_at
  FROM crm_boards b
  LEFT JOIN crm_board_members bm ON bm.board_id = b.id AND bm.user_id = auth.uid()
  LEFT JOIN usuarios u ON u.id = b.owner_user_id
  LEFT JOIN oficinas o ON o.id = b.owner_office_id
  WHERE
    b.deleted_at IS NULL
    AND (
      b.owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM crm_board_members
        WHERE crm_board_members.board_id = b.id
        AND crm_board_members.user_id = auth.uid()
      )
    )
  ORDER BY b.updated_at DESC;
END;
$$;

-- ============================================================
-- PASO 13: FUNCIÓN PARA OBTENER MIEMBROS DE UN TABLERO
-- ============================================================

CREATE OR REPLACE FUNCTION crm_get_board_members(p_board_id uuid)
RETURNS TABLE (
  member_id uuid,
  user_id uuid,
  user_name text,
  user_office text,
  user_role_global text,
  member_role text,
  added_by_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bm.id AS member_id,
    bm.user_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS user_name,
    o.nombre AS user_office,
    u.rol AS user_role_global,
    bm.member_role,
    CONCAT(adder.nombre, ' ', adder.apellidos) AS added_by_name,
    bm.created_at
  FROM crm_board_members bm
  INNER JOIN usuarios u ON u.id = bm.user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN usuarios adder ON adder.id = bm.added_by
  WHERE bm.board_id = p_board_id
  ORDER BY
    CASE bm.member_role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'editor' THEN 3
      WHEN 'viewer' THEN 4
    END,
    u.nombre;
END;
$$;
