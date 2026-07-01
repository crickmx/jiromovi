-- Agrega soporte para medias jornadas en dias_no_habiles
ALTER TABLE public.dias_no_habiles
  ADD COLUMN IF NOT EXISTS es_media_jornada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dias_no_habiles.es_media_jornada IS
  'true = el día cuenta como hpd/2 horas productivas en cálculos de SLA (ej. día de apertura parcial)';
