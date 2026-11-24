-- Per-user per-team per-tipo permissions for create/edit actions.
-- revoked_at = NULL means the permission is active (soft-revoke for audit trail).
-- tramite_tipo_id scopes the permission to a specific ticket type.

CREATE TABLE IF NOT EXISTS public.usuario_team_permisos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  tramite_tipo_id  uuid        NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  permiso          text        NOT NULL CHECK (permiso IN ('crear_tramite', 'editar_tramite')),
  granted_by       uuid        REFERENCES public.usuarios(id),
  granted_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz
);

CREATE UNIQUE INDEX idx_usuario_team_permisos_unique
  ON public.usuario_team_permisos (user_id, team_id, tramite_tipo_id, permiso)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_usuario_team_permisos_tipo ON public.usuario_team_permisos (tramite_tipo_id);
CREATE INDEX idx_usuario_team_permisos_team ON public.usuario_team_permisos (team_id);

ALTER TABLE public.usuario_team_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_write_permisos"
  ON public.usuario_team_permisos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "auth_read_permisos"
  ON public.usuario_team_permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);
