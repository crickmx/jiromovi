/*
  # Reglas de auto-asignación por equipo + campo grupo_asignado_id en tickets

  1. tickets.grupo_asignado_id  — equipo al que pertenece el trámite
  2. tramites_grupos_reglas     — regla: oficina X → equipo Y (por área)
  3. get_grupo_para_ticket      — RPC que resuelve el equipo dado una oficina + área
  4. get_grupo_miembros_ejecutivos — RPC para dropdown de Responsable (líderes + ejecutivos)
  5. Política RLS UPDATE para tramites_grupos_miembros (fix cambio de rol)
*/

-- ── 1. grupo_asignado_id en tickets ────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS grupo_asignado_id UUID
  REFERENCES tramites_grupos_visualizacion(id) ON DELETE SET NULL;

COMMENT ON COLUMN tickets.grupo_asignado_id IS
  'Equipo de Operaciones al que está asignado este trámite (resuelto automáticamente o manual)';

-- ── 2. Tabla de reglas de auto-asignación ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tramites_grupos_reglas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id        UUID        NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  oficina_id      UUID        NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  area_categoria  TEXT        NOT NULL CHECK (area_categoria IN ('Comercial', 'Operaciones')),
  activo          BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oficina_id, area_categoria)
);

COMMENT ON TABLE tramites_grupos_reglas IS
  'Define qué equipo recibe automáticamente los trámites de una oficina, por área.';

-- ── 3. RPC: resolver equipo para un ticket ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(
  p_oficina_id     uuid,
  p_area_categoria text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  SELECT r.grupo_id
    INTO v_grupo_id
  FROM tramites_grupos_reglas r
  JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
  WHERE r.oficina_id      = p_oficina_id
    AND r.area_categoria  = p_area_categoria
    AND r.activo          = true
    AND g.activo          = true
  LIMIT 1;

  RETURN v_grupo_id; -- NULL si no hay regla
END;
$$;

-- ── 4. RPC: miembros ejecutivos de un equipo (para dropdown Responsable) ────────
CREATE OR REPLACE FUNCTION public.get_grupo_miembros_ejecutivos(p_grupo_id uuid)
RETURNS TABLE (id uuid, nombre_completo text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.nombre_completo, UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, ''))) AS nombre_completo
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  WHERE m.grupo_id          = p_grupo_id
    AND m.rol_en_equipo     IN ('lider', 'ejecutivo')
    AND u.estado            = 'activo'
  ORDER BY
    CASE m.rol_en_equipo WHEN 'lider' THEN 1 ELSE 2 END,
    u.nombre_completo;
END;
$$;

-- ── 5. Fix RLS UPDATE en tramites_grupos_miembros (permite cambiar rol) ─────────
ALTER TABLE tramites_grupos_miembros ENABLE ROW LEVEL SECURITY;

-- Eliminar política UPDATE anterior si existe y recrear
DROP POLICY IF EXISTS "allow_update_grupo_miembros_rol" ON tramites_grupos_miembros;

CREATE POLICY "allow_update_grupo_miembros_rol" ON tramites_grupos_miembros
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id   = auth.uid()
        AND rol  = 'Administrador'
        AND estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id   = auth.uid()
        AND rol  = 'Administrador'
        AND estado = 'activo'
    )
  );
