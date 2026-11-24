-- QA 2026-10-22 (A12) · El selector de Responsable ofrece a todo el equipo
--
-- `get_grupo_miembros_ejecutivos` solo devolvía `lider` y `ejecutivo`. Los roles
-- de equipo son cinco desde julio —director, supervisor, lider, ejecutivo,
-- miembro— así que quedaban fuera 8 directores y 2 miembros, y en un equipo sin
-- ejecutivos el selector salía con una sola persona o vacío.
--
-- Es el patrón que ya está escrito en el CLAUDE.md: cuando `rol_en_equipo` gana
-- valores nuevos hay que buscar TODOS los `IN (...)` que lo filtren, porque los
-- viejos se quedan cortos sin dar error.
--
-- **El orden importa y no es cosmético.** Seis lugares llaman a esta función, y
-- dos de ellos (`NuevoTramiteModal`, `ReportarBugModal`) toman `[0]` como "el
-- líder del equipo" para el aviso de respaldo cuando el trámite no tiene
-- responsable. Por eso la precedencia es lider → supervisor → director →
-- ejecutivo → miembro: así `[0]` sigue siendo el más parecido a un jefe, que es
-- lo que esos dos esperan. Es la misma precedencia de
-- `resolver_destinatarios_aviso`.
--
-- Y el filtro de actividad pasa de `estado` a `activo`: `activo` es la columna
-- que pinta la pantalla, y hoy hay una persona con `estado = 'activo'` y
-- `activo = false` a la que se le seguía ofreciendo trabajo aunque el directorio
-- la muestre inactiva. Lo que se ve y lo que se filtra no deben poder
-- contradecirse.

CREATE OR REPLACE FUNCTION public.get_grupo_miembros_ejecutivos(p_grupo_id uuid)
 RETURNS TABLE(id uuid, nombre_completo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.nombre_completo, UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, ''))) AS nombre_completo
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  WHERE m.grupo_id = p_grupo_id
    AND m.rol_en_equipo IN ('lider', 'supervisor', 'director', 'ejecutivo', 'miembro')
    AND u.activo
    AND COALESCE(u.is_deleted, false) = false
  ORDER BY
    CASE m.rol_en_equipo
      WHEN 'lider'      THEN 1
      WHEN 'supervisor' THEN 2
      WHEN 'director'   THEN 3
      WHEN 'ejecutivo'  THEN 4
      ELSE 5
    END,
    u.nombre_completo;
END;
$function$;

COMMENT ON FUNCTION public.get_grupo_miembros_ejecutivos(uuid) IS
  'Quién puede ser responsable de un trámite de este equipo. Devuelve a los cinco roles de equipo, ordenados de más a menos jefe: quien la llama para el aviso de respaldo toma el primero.';

-- Reversa (solo si algo falla):
-- CREATE OR REPLACE FUNCTION public.get_grupo_miembros_ejecutivos(p_grupo_id uuid)
--  RETURNS TABLE(id uuid, nombre_completo text)
--  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   RETURN QUERY
--   SELECT u.id, COALESCE(u.nombre_completo, UPPER(COALESCE(u.nombre,'') || ' ' || COALESCE(u.apellidos,''))) AS nombre_completo
--   FROM usuarios u
--   INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
--   WHERE m.grupo_id = p_grupo_id AND m.rol_en_equipo IN ('lider','ejecutivo') AND u.estado = 'activo'
--   ORDER BY CASE m.rol_en_equipo WHEN 'lider' THEN 1 ELSE 2 END, u.nombre_completo;
-- END;
-- $function$;
