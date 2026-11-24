-- El equipo con acceso a Mercadotecnia también puede crear plantillas.
--
-- El panel de "Equipos con acceso a Marketing Admin" promete que sus miembros
-- "pueden administrar... igual que un Administrador", pero el botón "Nueva
-- Plantilla" no les salía: Publicidad decide quién es admin con
-- `tienePermisoAdminEnModulo`, que solo mira el rol y nunca consultó
-- `mkt_equipos_acceso`.
--
-- Y aunque el botón hubiera salido, el alta habría fallado igual: las tres
-- escrituras que hace —la imagen, la plantilla y sus oficinas— están
-- restringidas a Administrador (y Gerente, en la tabla principal).
--
-- Es el patrón #1 del proyecto: un acceso por equipo que llega a una mitad del
-- sistema y no a la otra. Aquí faltaban las dos mitades.
--
-- `mkt_puede_administrar()` ya existía (Administrador o miembro de un equipo
-- habilitado); se reutiliza para no tener dos definiciones de lo mismo.

-- ── La plantilla ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and Gerentes can create plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins and Gerentes can update plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins and Gerentes can delete plantillas" ON publicidad_plantillas;

CREATE POLICY "Mkt puede crear plantillas" ON publicidad_plantillas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Mkt puede actualizar plantillas" ON publicidad_plantillas
  FOR UPDATE TO authenticated
  USING (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  )
  WITH CHECK (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Mkt puede borrar plantillas" ON publicidad_plantillas
  FOR DELETE TO authenticated
  USING (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

-- ── A qué oficinas se muestra ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage plantilla office visibility" ON publicidad_plantilla_oficinas;
DROP POLICY IF EXISTS "Admins can update plantilla office visibility" ON publicidad_plantilla_oficinas;
DROP POLICY IF EXISTS "Admins can delete plantilla office visibility" ON publicidad_plantilla_oficinas;

CREATE POLICY "Mkt puede crear visibilidad de plantilla" ON publicidad_plantilla_oficinas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Mkt puede actualizar visibilidad de plantilla" ON publicidad_plantilla_oficinas
  FOR UPDATE TO authenticated
  USING (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  )
  WITH CHECK (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Mkt puede borrar visibilidad de plantilla" ON publicidad_plantilla_oficinas
  FOR DELETE TO authenticated
  USING (
    public.mkt_puede_administrar()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

-- ── La imagen ───────────────────────────────────────────────────────────────
-- Subir estaba limitado a Administrador: ni siquiera un Gerente con permiso de
-- módulo podía, así que el botón habría fallado a medio camino.
DROP POLICY IF EXISTS "Admin puede subir plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Mkt puede subir plantillas" ON storage.objects;
CREATE POLICY "Mkt puede subir plantillas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-plantillas'
    AND (
      public.mkt_puede_administrar()
      OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
    )
  );

DROP POLICY IF EXISTS "Mkt puede borrar plantillas del storage" ON storage.objects;
CREATE POLICY "Mkt puede borrar plantillas del storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'publicidad-plantillas'
    AND (
      public.mkt_puede_administrar()
      OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
    )
  );
