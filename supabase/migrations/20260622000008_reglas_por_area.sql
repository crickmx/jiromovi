/*
  # Reglas de auto-asignación por área

  Permite que un agente tenga reglas distintas según el área del trámite.
  Las áreas actuales son 'comercial' y 'operaciones', pero la columna acepta
  cualquier texto para facilitar agregar nuevas áreas en el futuro sin cambio
  de esquema — solo requiere actualizar el CASE en la RPC.

  Mapeo tipo_tramite → área:
    comercial   → renovaciones, cobranza, otros_comercial, correccion_poliza_endoso
    operaciones → cancelacion_poliza, endoso, nueva_poliza, siniestro, otros_operaciones

  NULL (comodín) → aplica si no existe regla específica para el área del trámite.

  Cambios:
  1. Eliminar UNIQUE(usuario_id) — un agente puede tener múltiples reglas
  2. Agregar columna area (text libre, nullable — sin CHECK para permitir áreas futuras)
  3. Dos índices únicos parciales:
       - una regla comodín por usuario (area IS NULL)
       - una regla por (usuario, area) cuando area IS NOT NULL
  4. Actualizar RPC get_grupo_para_ticket(agente_id, tipo_tramite):
       - resuelve área desde tipo_tramite con CASE explícito
       - busca regla específica primero, fallback a comodín
*/

-- ── 1. Quitar restricción única anterior ──────────────────────────────────────
ALTER TABLE tramites_grupos_reglas
  DROP CONSTRAINT IF EXISTS tramites_grupos_reglas_usuario_id_key;

-- ── 2. Columna area (sin CHECK — acepta cualquier área futura) ────────────────
ALTER TABLE tramites_grupos_reglas
  ADD COLUMN IF NOT EXISTS area text DEFAULT NULL;

COMMENT ON COLUMN tramites_grupos_reglas.area IS
  'Área del trámite a la que aplica esta regla. NULL = comodín (todos los tipos). '
  'Valores actuales: comercial, operaciones. Agregar nuevos valores no requiere '
  'cambio de esquema, solo actualizar la RPC get_grupo_para_ticket.';

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
  -- Mapear tipo_tramite → área de forma explícita.
  -- Para agregar un área nueva: añadir un WHEN con los tipos correspondientes
  -- y correr CREATE OR REPLACE FUNCTION con el bloque actualizado.
  v_area := CASE
    WHEN p_tipo_tramite IN (
      'renovaciones', 'cobranza', 'otros_comercial', 'correccion_poliza_endoso'
    ) THEN 'comercial'
    WHEN p_tipo_tramite IN (
      'cancelacion_poliza', 'endoso', 'nueva_poliza', 'siniestro', 'otros_operaciones'
    ) THEN 'operaciones'
    -- Agregar aquí nuevas áreas:
    -- WHEN p_tipo_tramite IN ('...') THEN 'nueva_area'
    ELSE NULL  -- tipo desconocido → solo usará la regla comodín
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
