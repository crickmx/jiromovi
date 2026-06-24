-- Version tracking for edit=copy substitution flow.
-- parent_tramite_id: NULL on root records; set on copies.
-- estado_version: 'activo' on all existing records (backwards compatible default).
-- team_origen_id: the team that initiated a copy branch.

ALTER TABLE public.tramites
  ADD COLUMN IF NOT EXISTS parent_tramite_id uuid REFERENCES public.tramites(id),
  ADD COLUMN IF NOT EXISTS estado_version     text NOT NULL DEFAULT 'activo'
                                              CHECK (estado_version IN ('activo','pendiente_revision','reemplazado','rechazado')),
  ADD COLUMN IF NOT EXISTS team_origen_id     uuid REFERENCES public.tramites_grupos_visualizacion(id),
  ADD COLUMN IF NOT EXISTS revisado_por       uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS revisado_at        timestamptz;

-- Enforce at most one active branch per (parent, team) pair
CREATE UNIQUE INDEX IF NOT EXISTS tramites_one_activo_branch_per_team
  ON public.tramites (parent_tramite_id, team_origen_id)
  WHERE estado_version = 'activo' AND parent_tramite_id IS NOT NULL;
