/*
  # Reglas de auto-asignación por área

  Permite que un agente tenga reglas distintas según el área del trámite:
    - 'comercial'   → renovaciones, cobranza, otros_comercial, correccion_poliza_endoso
    - 'operaciones' → cualquier otro tipo de trámite
    - NULL          → comodín: aplica si no existe regla específica para el área

  Cambios:
  1. Eliminar UNIQUE(usuario_id) — un agente ahora puede tener múltiples reglas
  2. Agregar columna area (text, nullable)
  3. Dos índices únicos parciales para garantizar una regla por (usuario, área):
       - una regla por usuario cuando area IS NULL
       - una regla por (usuario, area) cuando area IS NOT NULL
  4. Actualizar RPC get_grupo_para_ticket para aceptar p_tipo_tramite y resolver
     primero la regla específica del área, con fallback a la regla comodín.
*/

-- ── 1. Quitar restricción única anterior ──────────────────────────────────────
ALTER TABLE tramites_grupos_reglas
  DROP CONSTRAINT IF EXISTS tramites_grupos_reglas_usuario_id_key;

-- ── 2. Columna area ───────────────────────────────────────────────────────────
ALTER TABLE tramites_grupos_reglas
  ADD COLUMN IF NOT EXISTS area text
    CHECK (area IN ('comercial', 'operaciones'))
    DEFAULT NULL;

COMMENT ON COLUMN tramites_grupos_reglas.area IS
  'Área a la que aplica esta regla: comercial | operaciones | NULL (comodín).';

-- ── 3. Índices únicos parciales ───────────────────────────────────────────────
-- Un usuario solo puede tener UN comodín (area IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_grupos_reglas_usuario_null_area
  ON tramites_grupos_reglas (usuario_id)
  WHERE area IS NULL;

-- Un usuario solo puede tener UNA regla por área específica
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_grupos_reglas_usuario_area
  ON tramites_grupos_reglas (usuario_id, area)
  WHERE area IS NOT NULL;

-- ── 4. Actualizar RPC get_grupo_para_ticket ───────────────────────────────────
DROP FUNCTION IF EXISTS public.get_grupo_para_ticket(uuid);

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
  v_area text;
BEGIN
  -- Determinar área a partir del tipo de trámite
  v_area := CASE
    WHEN p_tipo_tramite IN (
      'renovaciones', 'cobranza', 'otros_comercial', 'correccion_poliza_endoso'
    ) THEN 'comercial'
    WHEN p_tipo_tramite IS NOT NULL THEN 'operaciones'
    ELSE NULL
  END;

  -- Intentar primero la regla específica del área
  IF v_area IS NOT NULL THEN
    RETURN QUERY
    SELECT r.grupo_id, r.ejecutivo_id
    FROM tramites_grupos_reglas r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id = p_agente_id
      AND r.area       = v_area
      AND r.activo     = true
      AND g.activo     = true
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
END;
$$;
