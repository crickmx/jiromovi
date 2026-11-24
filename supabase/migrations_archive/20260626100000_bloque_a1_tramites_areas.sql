-- ─── Bloque A1: tramites_areas ────────────────────────────────────────────────
-- Normaliza el campo TEXT libre ticket_tipos.area en una tabla maestra.
-- Agrega area_id FK a ticket_tipos.
-- Elimina el CHECK constraint hardcoded en tickets.tipo_tramite.
-- Agrega completed_at a tickets para calcular Lead Time.

-- 1. Tabla maestra de áreas
CREATE TABLE IF NOT EXISTS public.tramites_areas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL UNIQUE,
  slug        text        NOT NULL UNIQUE,
  color_hex   text        NOT NULL DEFAULT '#64748b',
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tramites_areas IS
  'Áreas funcionales del módulo de trámites. Normaliza el campo TEXT ticket_tipos.area.';

-- 2. Seed automático desde valores existentes
INSERT INTO public.tramites_areas (nombre, slug)
SELECT DISTINCT
  area,
  lower(regexp_replace(area, '[^a-zA-Z0-9áéíóúüñ]', '_', 'g'))
FROM public.ticket_tipos
WHERE area IS NOT NULL
  AND area <> ''
ON CONFLICT (nombre) DO NOTHING;

-- 3. FK en ticket_tipos
ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS area_id uuid
    REFERENCES public.tramites_areas(id) ON DELETE SET NULL;

-- Migrar valores text → FK
UPDATE public.ticket_tipos tt
SET    area_id = ta.id
FROM   public.tramites_areas ta
WHERE  tt.area = ta.nombre
  AND  tt.area_id IS NULL;

-- 4. Eliminar CHECK constraint hardcoded en tickets.tipo_tramite
--    Los tipos ahora se validan contra ticket_tipos.value (clave foránea lógica).
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

-- 5. completed_at para calcular Lead Time en el motor de reportes
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.tickets.completed_at IS
  'Timestamp de cierre del trámite. Alimentado por trigger al alcanzar estatus con clasificacion=terminacion.';

-- Índice para filtrar reportes por fecha de cierre
CREATE INDEX IF NOT EXISTS idx_tickets_completed_at
  ON public.tickets(completed_at)
  WHERE completed_at IS NOT NULL;

-- 6. RLS
ALTER TABLE public.tramites_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramites_areas_select"
  ON public.tramites_areas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tramites_areas_admin"
  ON public.tramites_areas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND activo = true
    )
  );
