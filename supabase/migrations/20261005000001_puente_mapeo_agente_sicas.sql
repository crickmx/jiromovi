-- Un solo mapeo usuario ↔ vendedor, alimentado desde las dos pantallas.
--
-- Había dos sistemas que enlazaban al MISMO vendedor sin saber uno del otro:
--
--   Admin › Base de Datos › "Mapeo MOVI ↔ Agente"
--     maestro_usuario_agente → maestro_agentes   (catálogo del Excel)
--     es lo que leen los TRÁMITES para resolver el agente y su equipo
--
--   Editar Usuario › "Enlazar usuario SICAS"
--     sicas_vendor_user_mappings                 (catálogo del web service)
--     escribe usuarios.id_sicas / nombre_sicas, que es lo que lee el Excel
--     de pólizas para SICAS
--
-- Enlazar en una NO enlazaba en la otra, y no había ninguna llave en común
-- para notarlo. Esta migración pone esa llave (`maestro_agentes.vend_id`) y
-- empareja lo que ya existe; el código de las dos pantallas escribe a partir
-- de aquí en los dos lados.

-- ── La llave que faltaba ────────────────────────────────────────────────────
ALTER TABLE public.maestro_agentes
  ADD COLUMN IF NOT EXISTS vend_id text;

COMMENT ON COLUMN public.maestro_agentes.vend_id IS
  'ID del vendedor en SICAS (sicas_vendor_user_mappings.vend_id). Es lo que une este catálogo con el de la sincronización SICAS.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_maestro_agentes_vend_id
  ON public.maestro_agentes(vend_id) WHERE vend_id IS NOT NULL;

-- Un usuario MOVI sin contraparte en SICAS no tiene despacho que ponerle. La
-- pantalla ya creaba agentes así ("Solo MOVI"), contra una columna que el repo
-- declara NOT NULL — o la base ya venía cambiada a mano, o ese botón fallaba.
ALTER TABLE public.maestro_agentes
  ALTER COLUMN despacho_id DROP NOT NULL;

-- ── Nombres comparables ─────────────────────────────────────────────────────
-- Los dos catálogos escriben el nombre igual (APELLIDOS PRIMERO) pero con
-- acentos, dobles espacios y mayúsculas distintas.
CREATE OR REPLACE FUNCTION public.nombre_comparable(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(trim(regexp_replace(public.folio_normaliza(p_texto), '\s+', ' ', 'g')), '');
$$;

-- ── 1. Emparejar los dos catálogos por nombre ───────────────────────────────
-- Solo cuando el nombre identifica a UNO de cada lado: un homónimo sin
-- resolver es peor que dejarlo sin emparejar, porque el mapeo quedaría en la
-- persona equivocada y nadie lo notaría.
WITH sicas_unicos AS (
  SELECT nombre_comparable(vend_nombre) AS clave, min(vend_id) AS vend_id
  FROM public.sicas_vendor_user_mappings
  WHERE status IN ('active', 'pending_review') AND nombre_comparable(vend_nombre) IS NOT NULL
  GROUP BY 1 HAVING count(*) = 1
), agentes_unicos AS (
  SELECT nombre_comparable(nombre) AS clave, (array_agg(id))[1] AS agente_id
  FROM public.maestro_agentes
  WHERE vend_id IS NULL AND nombre_comparable(nombre) IS NOT NULL
  GROUP BY 1 HAVING count(*) = 1
)
UPDATE public.maestro_agentes a
SET vend_id = s.vend_id
FROM sicas_unicos s
JOIN agentes_unicos g ON g.clave = s.clave
WHERE a.id = g.agente_id;

-- ── 2. Lo enlazado en SICAS entra al mapeo de trámites ──────────────────────
-- Solo rellena huecos: a un usuario que ya tiene mapeo no se le toca.
INSERT INTO public.maestro_usuario_agente (user_id, agente_id, activo)
SELECT DISTINCT ON (s.movi_user_id) s.movi_user_id, a.id, true
FROM public.sicas_vendor_user_mappings s
JOIN public.maestro_agentes a ON a.vend_id = s.vend_id
WHERE s.movi_user_id IS NOT NULL
  AND s.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.maestro_usuario_agente m WHERE m.user_id = s.movi_user_id)
ORDER BY s.movi_user_id, s.updated_at DESC NULLS LAST
ON CONFLICT (user_id) DO NOTHING;

-- ── 3. Y al revés: quien ya está mapeado estrena su ID de SICAS ─────────────
UPDATE public.usuarios u
SET id_sicas = a.vend_id,
    nombre_sicas = coalesce(u.nombre_sicas, a.nombre)
FROM public.maestro_usuario_agente m
JOIN public.maestro_agentes a ON a.id = m.agente_id
WHERE m.user_id = u.id
  AND m.activo
  AND a.vend_id IS NOT NULL
  AND (u.id_sicas IS NULL OR trim(u.id_sicas) = '');
