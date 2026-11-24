/*
  # Ejecutivo opcional por regla de auto-asignación

  Permite mapear un vendedor directamente a un ejecutivo específico.
  Si ejecutivo_id está NULL → el trámite cae al pool del equipo.
  Si ejecutivo_id tiene valor → se asigna directo a ese ejecutivo.
*/

-- 1. ejecutivo_id opcional en tramites_grupos_reglas
ALTER TABLE tramites_grupos_reglas
  ADD COLUMN IF NOT EXISTS ejecutivo_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN tramites_grupos_reglas.ejecutivo_id IS
  'Si se especifica, los trámites del vendedor se asignan directo a este ejecutivo. NULL = pool del equipo.';

-- 2. Actualizar RPC para retornar también el ejecutivo_id
DROP FUNCTION IF EXISTS public.get_grupo_para_ticket(uuid, text);
DROP FUNCTION IF EXISTS public.get_grupo_para_ticket(uuid);

CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(p_agente_id uuid)
RETURNS TABLE (grupo_id uuid, ejecutivo_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.grupo_id, r.ejecutivo_id
  FROM tramites_grupos_reglas r
  JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
  WHERE r.usuario_id = p_agente_id
    AND r.activo     = true
    AND g.activo     = true
  LIMIT 1;
END;
$$;
