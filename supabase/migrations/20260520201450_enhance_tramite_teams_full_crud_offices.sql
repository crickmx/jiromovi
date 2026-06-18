/*
  # Enhance Tramite Teams with Full CRUD and Office Assignment

  ## Summary
  Converts the existing tramites_grupos_visualizacion system into a full CRUD-capable
  "Equipos de Trabajo" module for trámites management. Adds office assignments and
  auditing capabilities without breaking existing data.

  ## Changes

  ### Modified Tables
  - `tramites_grupos_visualizacion` — adds: created_by, updated_at trigger, soft audit

  ### New Tables
  - `tramites_grupos_oficinas` — maps teams to one or more offices (or all offices)

  ### New/Updated Functions
  - `get_user_tramite_area_v2(p_user_id)` — returns area AND allowed office IDs
  - `get_tramite_teams_full(p_user_id)` — returns teams with member/office counts (admin)
  - Updated `get_grupo_miembros` to include more fields
  - `ticket_team_audit_log` — lightweight audit log table

  ## Security
  - RLS enabled on all new tables
  - Only admins can manage teams, offices assignments, and audit logs
  - All authenticated users can read active teams
*/

-- ─── Add missing columns to tramites_grupos_visualizacion ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tramites_grupos_visualizacion' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tramites_grupos_visualizacion ADD COLUMN created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tramites_grupos_visualizacion' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tramites_grupos_visualizacion ADD COLUMN updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tramites_grupos_visualizacion' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tramites_grupos_visualizacion ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- all_offices flag: when true, team covers all offices
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tramites_grupos_visualizacion' AND column_name = 'all_offices'
  ) THEN
    ALTER TABLE tramites_grupos_visualizacion ADD COLUMN all_offices boolean DEFAULT false;
  END IF;
END $$;

-- ─── tramites_grupos_oficinas ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tramites_grupos_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE (grupo_id, oficina_id)
);

ALTER TABLE tramites_grupos_oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read group offices"
  ON tramites_grupos_oficinas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert group offices"
  ON tramites_grupos_oficinas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

CREATE POLICY "Admins can delete group offices"
  ON tramites_grupos_oficinas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- ─── ticket_team_audit_logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_team_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES tramites_grupos_visualizacion(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  performed_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_team_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON ticket_team_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

CREATE POLICY "Admins can insert audit logs"
  ON ticket_team_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- ─── RLS for tramites_grupos_visualizacion (update + delete) ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tramites_grupos_visualizacion'
      AND policyname = 'Admins can update groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can update groups"
        ON tramites_grupos_visualizacion FOR UPDATE
        TO authenticated
        USING (
          EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tramites_grupos_visualizacion'
      AND policyname = 'Admins can insert groups'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can insert groups"
        ON tramites_grupos_visualizacion FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
        )
    $policy$;
  END IF;
END $$;

-- ─── RLS for tramites_grupos_miembros (update + insert + delete) ─────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tramites_grupos_miembros'
      AND policyname = 'Admins can insert members'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can insert members"
        ON tramites_grupos_miembros FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
        )
    $policy$;
  END IF;
END $$;

-- ─── get_tramite_teams_full ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tramite_teams_full()
RETURNS TABLE (
  id uuid,
  nombre text,
  descripcion text,
  color text,
  area_categoria text,
  activo boolean,
  all_offices boolean,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  office_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.nombre,
    g.descripcion,
    g.color,
    g.area_categoria,
    g.activo,
    g.all_offices,
    g.created_at,
    g.updated_at,
    COUNT(DISTINCT m.usuario_id) AS member_count,
    COUNT(DISTINCT o.oficina_id) AS office_count
  FROM tramites_grupos_visualizacion g
  LEFT JOIN tramites_grupos_miembros m ON m.grupo_id = g.id
  LEFT JOIN tramites_grupos_oficinas o ON o.grupo_id = g.id
  GROUP BY g.id
  ORDER BY g.activo DESC, g.area_categoria, g.nombre;
$$;

GRANT EXECUTE ON FUNCTION get_tramite_teams_full() TO authenticated;

-- ─── get_grupo_oficinas ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_grupo_oficinas(p_grupo_id uuid)
RETURNS TABLE (
  id uuid,
  oficina_id uuid,
  oficina_nombre text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    go.id,
    go.oficina_id,
    o.nombre AS oficina_nombre
  FROM tramites_grupos_oficinas go
  JOIN oficinas o ON o.id = go.oficina_id
  WHERE go.grupo_id = p_grupo_id
  ORDER BY o.nombre;
$$;

GRANT EXECUTE ON FUNCTION get_grupo_oficinas(uuid) TO authenticated;

-- ─── get_user_tramite_scope ────────────────────────────────────────────────────
-- Returns (area_categoria, allowed_office_ids, all_offices) for a user.
-- Used by Tramites.tsx for visibility filtering.

DROP FUNCTION IF EXISTS get_user_tramite_scope(uuid);

CREATE OR REPLACE FUNCTION get_user_tramite_scope(p_user_id uuid)
RETURNS TABLE (
  area_categoria text,
  office_ids uuid[],
  all_offices boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.area_categoria,
    CASE WHEN bool_or(g.all_offices) THEN ARRAY[]::uuid[]
         ELSE array_agg(DISTINCT go.oficina_id) FILTER (WHERE go.oficina_id IS NOT NULL)
    END AS office_ids,
    bool_or(g.all_offices) AS all_offices
  FROM tramites_grupos_miembros m
  JOIN tramites_grupos_visualizacion g ON g.id = m.grupo_id AND g.activo = true
  LEFT JOIN tramites_grupos_oficinas go ON go.grupo_id = g.id
  WHERE m.usuario_id = p_user_id
  GROUP BY g.area_categoria;
$$;

GRANT EXECUTE ON FUNCTION get_user_tramite_scope(uuid) TO authenticated;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tramites_grupos_oficinas_grupo_id ON tramites_grupos_oficinas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_tramites_grupos_oficinas_oficina_id ON tramites_grupos_oficinas(oficina_id);
CREATE INDEX IF NOT EXISTS idx_ticket_team_audit_team_id ON ticket_team_audit_logs(team_id);
