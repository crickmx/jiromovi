-- Permite que Marketing suba contenido semanal para un agente especifico
-- desde /mercadotecnia/admin (Marketing Premium), visible en la pestana
-- "Mis Disenos" de Publicidad de ese agente. Hasta ahora publicidad_disenos
-- solo soportaba disenos auto-generados por el propio agente: las policies
-- de SELECT/INSERT/DELETE exigen usuario_id = auth.uid() sin excepcion para
-- Administrador ni para equipos con acceso a Marketing Admin
-- (mkt_equipos_acceso), y no existe ninguna policy de UPDATE (el boton
-- "Guardar"/"Restaurar" del copy de Chava AI en DesignDetailModal nunca ha
-- podido escribir).

ALTER TABLE publicidad_disenos
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'agente' CHECK (origen IN ('agente', 'equipo_mkt')),
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('imagen', 'video')),
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- UPDATE faltante para el propio dueno del diseno (copy de Chava AI)
CREATE POLICY "Usuarios pueden actualizar sus propios disenos" ON publicidad_disenos
  FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()))
  WITH CHECK (usuario_id = (select auth.uid()));

-- Admin / equipo de Marketing: gestionan disenos de cualquier agente
CREATE POLICY "mkt_equipo_can_select_disenos" ON publicidad_disenos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "mkt_equipo_can_insert_disenos" ON publicidad_disenos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "mkt_equipo_can_update_disenos" ON publicidad_disenos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "mkt_equipo_can_delete_disenos" ON publicidad_disenos
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
