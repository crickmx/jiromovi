-- Marca de bot en usuarios
-- ========================
--
-- Los agentes de IA son usuarios de MOVI como cualquier otro: tienen oficina,
-- equipo y levantan trámites. Eso es a propósito —así las reglas de asignación
-- los alcanzan sin excepciones, sin un camino aparte que se desincronice— pero
-- satura el tablero del Administrador, que es el único que ve TODO.
--
-- Una columna, no una tabla: ser bot es un atributo de la persona. Cualquier
-- otra forma de reconocerlos —una lista de ids en el código, el equipo al que
-- pertenecen, el dominio de su correo— deja de ser cierta el día que alguien
-- los mueve de equipo o da de alta otro, y nadie se entera.
--
-- Esto NO cambia permisos ni RLS: un bot ve y puede exactamente lo mismo que
-- antes. Lo único que decide es de qué lado del toggle cae su trámite.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS es_bot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usuarios.es_bot IS
  'true = agente de IA, no una persona. Solo separa el tablero de Trámites del Administrador (Reales / Bots / Todo); no cambia permisos ni RLS.';
