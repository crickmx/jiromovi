/*
  # Asignación por Trámites — override manual (agente+tipo) + resolución automática por oficina

  Agrega dos capas nuevas de auto-asignación, MÁS ESPECÍFICAS que la regla vieja
  (agente + área) de `tramites_grupos_reglas`:

  1. `tramites_reglas_por_tipo` — override manual: (agente, tipo de trámite) -> equipo
     [+ ejecutivo opcional, NULL = pool del equipo]. Editable desde la nueva tab
     "Asignación por Trámites" en Admin > Trámites.

  2. Resolución automática por oficina: usa `tramite_team_tipo_config` (ya existía,
     sin efecto real hasta ahora) para saber qué equipos pueden atender cada tipo,
     cruzado con `tramites_grupos_oficinas`/`all_offices` (a qué oficinas sirve cada
     equipo, ya existía) para elegir el equipo cuya oficina coincide con la del
     agente solicitante.

  Prioridad final en get_grupo_para_ticket(), de más a menos específica:
    1. tramites_reglas_por_tipo (agente + tipo específico)
    2. automático por oficina (tramite_team_tipo_config + tramites_grupos_oficinas/all_offices)
    3. tramites_grupos_reglas (agente + área) -- lógica existente, sin cambios
    4. sin match -> NULL (comportamiento actual)

  Como hoy no existe ninguna fila en tramite_team_tipo_config con efecto real,
  este cambio es retrocompatible: todo tipo sin configurar sigue resolviendo
  exactamente igual que antes (cae directo al nivel 3).
*/

-- ── 1. Tabla de override manual (agente + tipo de trámite) ─────────────────────
CREATE TABLE IF NOT EXISTS tramites_reglas_por_tipo (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_id      uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  grupo_id     uuid        NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  ejecutivo_id uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  activo       boolean     NOT NULL DEFAULT true,
  created_by   uuid        REFERENCES usuarios(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tramites_reglas_por_tipo IS
  'Override manual de asignación: agente + tipo de trámite específico -> equipo (+ ejecutivo opcional, NULL = pool). Más específico que tramites_grupos_reglas (agente + área).';

-- Solo una regla activa por (usuario_id, tipo_id) a la vez — igual patrón que
-- tramites_grupos_reglas (soft-delete con activo=false, no DELETE físico).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_reglas_por_tipo_activa
  ON tramites_reglas_por_tipo (usuario_id, tipo_id)
  WHERE activo;

CREATE INDEX IF NOT EXISTS idx_tramites_reglas_por_tipo_grupo
  ON tramites_reglas_por_tipo (grupo_id);

ALTER TABLE tramites_reglas_por_tipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramites_reglas_por_tipo_select"
  ON tramites_reglas_por_tipo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tramites_reglas_por_tipo_admin_all"
  ON tramites_reglas_por_tipo FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- ── 2. Reescribir get_grupo_para_ticket con las 4 capas ────────────────────────
DROP FUNCTION IF EXISTS public.get_grupo_para_ticket(uuid, text);

CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(
  p_agente_id    uuid,
  p_tipo_tramite text DEFAULT NULL
)
RETURNS TABLE (grupo_id uuid, ejecutivo_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo_id    uuid;
  v_area       text;
  v_oficina_id uuid;
BEGIN
  IF p_tipo_tramite IS NOT NULL THEN
    SELECT tt.id, LOWER(tt.area)
      INTO v_tipo_id, v_area
    FROM ticket_tipos tt
    WHERE tt.value  = p_tipo_tramite
      AND tt.activo = true
    LIMIT 1;
  END IF;

  SELECT u.oficina_id INTO v_oficina_id FROM usuarios u WHERE u.id = p_agente_id;

  -- ── Nivel 1: override manual (agente + tipo específico) ──────────────────────
  IF v_tipo_id IS NOT NULL THEN
    RETURN QUERY
    SELECT r.grupo_id, r.ejecutivo_id
    FROM tramites_reglas_por_tipo r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id = p_agente_id
      AND r.tipo_id    = v_tipo_id
      AND r.activo     = true
      AND g.activo     = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- ── Nivel 2: automático por oficina (equipos habilitados para el tipo) ───────
  IF v_tipo_id IS NOT NULL AND v_oficina_id IS NOT NULL THEN
    -- Prioridad: equipo con oficina específica coincidente
    RETURN QUERY
    SELECT g.id, NULL::uuid
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    JOIN tramites_grupos_oficinas go ON go.grupo_id = g.id
    WHERE c.tipo_id     = v_tipo_id
      AND c.habilitado  = true
      AND g.activo      = true
      AND go.oficina_id = v_oficina_id
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Catch-all: equipo habilitado marcado "todas las oficinas"
    RETURN QUERY
    SELECT g.id, NULL::uuid
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    WHERE c.tipo_id      = v_tipo_id
      AND c.habilitado   = true
      AND g.activo       = true
      AND g.all_offices  = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- ── Nivel 3: regla existente agente + área ("ASIGNACIÓN POR EQUIPOS") ────────
  IF v_area IS NOT NULL THEN
    RETURN QUERY
    SELECT r.grupo_id, r.ejecutivo_id
    FROM tramites_grupos_reglas r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id  = p_agente_id
      AND LOWER(r.area) = v_area
      AND r.activo      = true
      AND g.activo      = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Fallback: regla comodín (area IS NULL)
  RETURN QUERY
  SELECT r.grupo_id, r.ejecutivo_id
  FROM tramites_grupos_reglas r
  JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
  WHERE r.usuario_id = p_agente_id
    AND r.area       IS NULL
    AND r.activo     = true
    AND g.activo     = true
  LIMIT 1;

  -- ── Nivel 4: nada encontrado -> sin filas (comportamiento actual) ────────────
END;
$$;
