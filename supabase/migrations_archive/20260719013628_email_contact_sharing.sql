-- Contactos personales y compartidos para Correo MOVI.
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS visibilidad text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS compartir_oficina_id uuid REFERENCES public.oficinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compartir_grupo_id uuid REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compartido_at timestamptz;

ALTER TABLE public.contactos
  DROP CONSTRAINT IF EXISTS contactos_visibilidad_check,
  ADD CONSTRAINT contactos_visibilidad_check CHECK (
    (visibilidad = 'personal' AND compartir_oficina_id IS NULL AND compartir_grupo_id IS NULL)
    OR (visibilidad = 'oficina' AND compartir_oficina_id IS NOT NULL AND compartir_grupo_id IS NULL)
    OR (visibilidad = 'grupo' AND compartir_oficina_id IS NULL AND compartir_grupo_id IS NOT NULL)
    OR (visibilidad = 'empresa' AND compartir_oficina_id IS NULL AND compartir_grupo_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_contactos_visibilidad ON public.contactos(visibilidad);
CREATE INDEX IF NOT EXISTS idx_contactos_compartir_oficina ON public.contactos(compartir_oficina_id)
  WHERE compartir_oficina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contactos_compartir_grupo ON public.contactos(compartir_grupo_id)
  WHERE compartir_grupo_id IS NOT NULL;

DROP POLICY IF EXISTS "Admins can view all contacts" ON public.contactos;
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contactos;

CREATE POLICY "Contactos visibles por alcance"
  ON public.contactos FOR SELECT
  TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR asignado_a = (SELECT auth.uid())
    OR visibilidad = 'empresa'
    OR (
      visibilidad = 'oficina'
      AND compartir_oficina_id = (
        SELECT u.oficina_id FROM public.usuarios u WHERE u.id = (SELECT auth.uid())
      )
    )
    OR (
      visibilidad = 'grupo'
      AND EXISTS (
        SELECT 1
        FROM public.tramites_grupos_miembros gm
        WHERE gm.grupo_id = contactos.compartir_grupo_id
          AND gm.usuario_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Propietario crea contactos"
  ON public.contactos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND (
      visibilidad = 'personal'
      OR visibilidad = 'empresa'
      OR (
        visibilidad = 'oficina'
        AND compartir_oficina_id = (
          SELECT u.oficina_id FROM public.usuarios u WHERE u.id = (SELECT auth.uid())
        )
      )
      OR (
        visibilidad = 'grupo'
        AND EXISTS (
          SELECT 1 FROM public.tramites_grupos_miembros gm
          WHERE gm.grupo_id = contactos.compartir_grupo_id
            AND gm.usuario_id = (SELECT auth.uid())
        )
      )
    )
  );

CREATE POLICY "Propietario actualiza contactos"
  ON public.contactos FOR UPDATE
  TO authenticated
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND (
      visibilidad = 'personal'
      OR visibilidad = 'empresa'
      OR (
        visibilidad = 'oficina'
        AND compartir_oficina_id = (
          SELECT u.oficina_id FROM public.usuarios u WHERE u.id = (SELECT auth.uid())
        )
      )
      OR (
        visibilidad = 'grupo'
        AND EXISTS (
          SELECT 1 FROM public.tramites_grupos_miembros gm
          WHERE gm.grupo_id = contactos.compartir_grupo_id
            AND gm.usuario_id = (SELECT auth.uid())
        )
      )
    )
  );

CREATE POLICY "Propietario elimina contactos"
  ON public.contactos FOR DELETE
  TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contactos TO authenticated;
