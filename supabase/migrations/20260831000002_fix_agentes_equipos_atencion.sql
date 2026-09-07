/*
  Los equipos seleccionados al crear/editar un Agente son equipos que ATIENDEN
  sus trámites. No convierten al agente en miembro operativo del equipo.

  1. Migra asignaciones erróneas de tramites_grupos_miembros a
     tramites_grupos_reglas (una por agente y categoría).
  2. Elimina todas las membresías de usuarios con rol Agente.
  3. Impide que vuelvan a insertarse, incluso desde otros clientes o funciones.
*/

-- Elegir determinísticamente una asignación por agente/categoría. Si ya existe
-- una regla para esa categoría, se respeta y no se reemplaza.
WITH candidatos AS (
  SELECT
    m.usuario_id,
    m.grupo_id,
    g.area_categoria AS area,
    row_number() OVER (
      PARTITION BY m.usuario_id, lower(g.area_categoria)
      ORDER BY m.created_at, m.grupo_id
    ) AS prioridad
  FROM public.tramites_grupos_miembros m
  JOIN public.usuarios u
    ON u.id = m.usuario_id
   AND u.rol = 'Agente'
  JOIN public.tramites_grupos_visualizacion g
    ON g.id = m.grupo_id
   AND g.activo = true
  WHERE nullif(trim(g.area_categoria), '') IS NOT NULL
)
INSERT INTO public.tramites_grupos_reglas (
  usuario_id,
  grupo_id,
  area,
  activo
)
SELECT
  c.usuario_id,
  c.grupo_id,
  c.area,
  true
FROM candidatos c
WHERE c.prioridad = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.tramites_grupos_reglas r
    WHERE r.usuario_id = c.usuario_id
      AND lower(r.area) = lower(c.area)
  );

DELETE FROM public.tramites_grupos_miembros m
USING public.usuarios u
WHERE u.id = m.usuario_id
  AND u.rol = 'Agente';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prevent_agent_tramite_team_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = NEW.usuario_id
      AND u.rol = 'Agente'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Un agente no puede ser miembro de un equipo de trámites; configure el equipo que lo atiende en tramites_grupos_reglas';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_agent_tramite_team_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_agent_tramite_team_membership
  ON public.tramites_grupos_miembros;

CREATE TRIGGER prevent_agent_tramite_team_membership
BEFORE INSERT OR UPDATE OF usuario_id
ON public.tramites_grupos_miembros
FOR EACH ROW
EXECUTE FUNCTION private.prevent_agent_tramite_team_membership();

COMMENT ON FUNCTION private.prevent_agent_tramite_team_membership() IS
  'Protege la separación entre miembros operativos del equipo y agentes cuyos trámites atiende el equipo.';
