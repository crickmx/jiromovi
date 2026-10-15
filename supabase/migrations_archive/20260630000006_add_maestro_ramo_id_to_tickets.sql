-- Agrega maestro_ramo_id a tickets para tipos de trámite que usan el catálogo maestro.
-- Reemplaza el uso de insurance_type_id (FK a insurance_types) en cotizacion_emision.
-- insurance_type_id se conserva para registros históricos existentes.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS maestro_ramo_id uuid REFERENCES public.maestro_ramos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_maestro_ramo_id
  ON public.tickets(maestro_ramo_id)
  WHERE maestro_ramo_id IS NOT NULL;
