/*
  # Sincronizar áreas de ticket_tipos con la tabla maestra tramites_areas

  Encontrado 2026-07-06: el formulario de "Tipos de Trámite" (GestionCatalogosRegistro.tsx)
  usaba una lista de áreas HARDCODEADA en el frontend (`AREAS` en catalogos/types.ts),
  en vez de leer la tabla `tramites_areas` que ya usan tanto la tab "Áreas" de
  Admin > Trámites como el panel de "Equipo" (GestionGruposVisualizacion.tsx). Resultado:
  un tipo de trámite podía guardarse con un área ("Administración", "Otro") que nunca
  existió como fila en `tramites_areas`, y por lo tanto nunca aparecía como opción al
  crear/editar un equipo -- ni nuevas áreas creadas desde el panel de equipo llegaban al
  formulario de tipos, porque ese formulario nunca releía la tabla.

  Este script:
  1. Crea en tramites_areas cualquier área que ya esté en uso en ticket_tipos.area
     pero que no exista todavía como fila (mismo patrón de seed que la migración
     original 20260626100000_bloque_a1_tramites_areas.sql).
  2. Backfillea ticket_tipos.area_id para las filas que quedaron en NULL (tipos
     personalizados creados después de esa migración original, ya que el formulario
     nunca lo seteaba).
*/

-- 1. Sembrar áreas en uso que no existan todavía
INSERT INTO public.tramites_areas (nombre, slug)
SELECT DISTINCT
  tt.area,
  lower(regexp_replace(tt.area, '[^a-zA-Z0-9áéíóúüñ]', '_', 'g'))
FROM public.ticket_tipos tt
WHERE tt.area IS NOT NULL
  AND tt.area <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.tramites_areas ta WHERE ta.nombre = tt.area
  )
ON CONFLICT (nombre) DO NOTHING;

-- 2. Backfill de area_id donde quedó NULL
UPDATE public.ticket_tipos tt
SET area_id = ta.id
FROM public.tramites_areas ta
WHERE tt.area = ta.nombre
  AND tt.area_id IS NULL;
