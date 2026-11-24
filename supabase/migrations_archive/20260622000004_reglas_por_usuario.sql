/*
  # Auto-asignación por usuario (vendedor) en lugar de por oficina

  Las reglas ahora mapean usuario_id → grupo_id.
  Al crear un trámite se busca si el agente tiene regla; si la tiene,
  el trámite se asigna automáticamente a ese equipo sin importar el tipo.
*/

-- ── 1. Cambiar estructura de tramites_grupos_reglas ────────────────────────────

-- Eliminar restricción única anterior (oficina+area)
ALTER TABLE tramites_grupos_reglas
  DROP CONSTRAINT IF EXISTS tramites_grupos_reglas_oficina_id_area_categoria_key;

-- Vaciar datos anteriores (eran por oficina, ya no aplican)
DELETE FROM tramites_grupos_reglas;

-- Eliminar columnas viejas
ALTER TABLE tramites_grupos_reglas
  DROP COLUMN IF EXISTS oficina_id,
  DROP COLUMN IF EXISTS area_categoria;

-- Agregar usuario_id
ALTER TABLE tramites_grupos_reglas
  ADD COLUMN IF NOT EXISTS usuario_id UUID
    NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE;

-- Un usuario solo puede tener una regla (un equipo asignado)
ALTER TABLE tramites_grupos_reglas
  ADD CONSTRAINT tramites_grupos_reglas_usuario_id_key UNIQUE (usuario_id);

-- ── 2. Actualizar RPC get_grupo_para_ticket ────────────────────────────────────
-- Nueva firma: p_agente_id (usuario que crea el trámite)

DROP FUNCTION IF EXISTS public.get_grupo_para_ticket(uuid, text);

CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(p_agente_id uuid)
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
  WHERE r.usuario_id = p_agente_id
    AND r.activo     = true
    AND g.activo     = true
  LIMIT 1;

  RETURN v_grupo_id; -- NULL si el agente no tiene regla
END;
$$;
