-- Oficinas adicionales para Gerentes.
--
-- usuarios.oficina_id sigue siendo la oficina principal (no se toca: la usan
-- 147 archivos de código vivo, cambiar su significado es alto riesgo). Esta
-- tabla puente es SOLO para el caso "un Gerente también ve/gestiona otra(s)
-- oficina(s)" -- mismo molde que tramites_grupos_oficinas (equipo↔oficina).

CREATE TABLE IF NOT EXISTS public.usuario_oficinas_adicionales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  oficina_id  uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  UNIQUE (usuario_id, oficina_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_oficinas_adicionales_usuario
  ON public.usuario_oficinas_adicionales(usuario_id);

ALTER TABLE public.usuario_oficinas_adicionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read usuario oficinas adicionales" ON public.usuario_oficinas_adicionales;
CREATE POLICY "Authenticated can read usuario oficinas adicionales"
  ON public.usuario_oficinas_adicionales
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert usuario oficinas adicionales" ON public.usuario_oficinas_adicionales;
CREATE POLICY "Admins can insert usuario oficinas adicionales"
  ON public.usuario_oficinas_adicionales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

DROP POLICY IF EXISTS "Admins can delete usuario oficinas adicionales" ON public.usuario_oficinas_adicionales;
CREATE POLICY "Admins can delete usuario oficinas adicionales"
  ON public.usuario_oficinas_adicionales
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

COMMENT ON TABLE public.usuario_oficinas_adicionales IS
  'Oficinas extra de un Gerente, además de su oficina principal (usuarios.oficina_id). Solo Administrador puede asignarlas.';
