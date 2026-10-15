/*
  # Convenio/preferente con granularidad compañía+ramo+subramo

  El Excel real que usa Ricardo para determinar convenios ("Convenio No
  Convenio.xlsx") varía por combinación compañía+ramo+subramo, no por
  compañía completa: HDI es convenio en Vehículos pero mixto en Daños;
  GNP es convenio en algunos subramos de Vehículos y no en otros (7 de
  46 compañías tienen esta mezcla dentro de un mismo ramo).

  maestro_companias.convenio (agregado 2026-06-24) es una sola bandera
  por compañía y no puede representar esto. Se agrega la granularidad
  real donde ya vive la combinación válida: maestro_combinaciones.

  pondera (0 a 1, viene tal cual del Excel) es un peso más fino que el
  booleano -- se guarda para poder ordenar dentro de "preferentes" más
  adelante, aunque hoy el selector solo use convenio.

  maestro_companias.convenio NO se toca ni se borra -- sigue existiendo
  para compañías sin combinaciones cargadas todavía, pero deja de ser la
  fuente de verdad para el selector de trámites (ver commit del mismo
  día en NuevoTramiteModal.tsx/TramiteDetalle.tsx).
*/

ALTER TABLE public.maestro_combinaciones
  ADD COLUMN IF NOT EXISTS convenio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pondera  numeric;

COMMENT ON COLUMN public.maestro_combinaciones.convenio IS 'Convenio/preferente para esta combinación específica compañía+ramo+subramo -- fuente de verdad real, no maestro_companias.convenio (que es un flag plano heredado).';
COMMENT ON COLUMN public.maestro_combinaciones.pondera IS 'Peso 0-1 del Excel de convenios, para ordenar preferentes entre sí -- no usado todavía por el selector.';

CREATE INDEX IF NOT EXISTS idx_maestro_combinaciones_convenio
  ON public.maestro_combinaciones(compania_id, ramo_id) WHERE convenio = true;
