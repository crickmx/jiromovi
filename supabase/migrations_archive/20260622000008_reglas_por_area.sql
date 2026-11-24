/*
  # Reglas de auto-asignación por área

  Permite que un agente tenga reglas distintas según el área del trámite.
  El área se lee dinámicamente desde ticket_tipos.area, por lo que al crear
  un nuevo tipo de trámite en MOVI con su área asignada, la auto-asignación
  funciona automáticamente sin cambios de código.

  NULL (comodín) → aplica si no existe regla específica para el área del trámite.

  Cambios:
  1. Eliminar UNIQUE(usuario_id) — un agente puede tener múltiples reglas
  2. Agregar columna area (text libre, nullable)
  3. Dos índices únicos parciales:
       - una regla comodín por usuario (area IS NULL)
       - una regla por (usuario, area) cuando area IS NOT NULL
  4. Actualizar RPC get_grupo_para_ticket(agente_id, tipo_tramite):
       - lee el área desde ticket_tipos en lugar de un CASE hardcodeado
       - busca regla específica primero, fallback a comodín
*/

-- ── 1. Quitar restricción única anterior ──────────────────────────────────────
ALTER TABLE tramites_grupos_reglas
  DROP CONSTRAINT IF EXISTS tramites_grupos_reglas_usuario_id_key;

-- ── 2. Columna area ───────────────────────────────────────────────────────────
ALTER TABLE tramites_grupos_reglas
  ADD COLUMN IF NOT EXISTS area text DEFAULT NULL;

COMMENT ON COLUMN tramites_grupos_reglas.area IS
  'Área del trámite a la que aplica esta regla (debe coincidir con ticket_tipos.area). '
  'NULL = comodín (aplica a todos los tipos sin regla específica).';

-- ── 3. Índices únicos parciales ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_grupos_reglas_usuario_null_area
  ON tramites_grupos_reglas (usuario_id)
  WHERE area IS NULL;

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
  -- Leer el área desde ticket_tipos de forma dinámica.
  -- Al crear un nuevo tipo en MOVI con su área asignada, esta función
  -- lo resolverá correctamente sin ningún cambio adicional.
  IF p_tipo_tramite IS NOT NULL THEN
    SELECT LOWER(tt.area)
      INTO v_area
    FROM ticket_tipos tt
    WHERE tt.value  = p_tipo_tramite
      AND tt.activo = true
    LIMIT 1;
  END IF;

  -- Intentar primero la regla específica del área
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
END;
$$;
