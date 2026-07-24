-- Acceso al panel de Admin de Mercadotecnia (Brand Kit, Fotos de Estudio, Plan
-- Premium) para miembros de un equipo, ademas de rol = 'Administrador'.
-- Mismo patron ya usado en store_equipos_acceso.

CREATE TABLE IF NOT EXISTS mkt_equipos_acceso (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    uuid        NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grupo_id)
);

ALTER TABLE mkt_equipos_acceso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_equipos_acceso_admin_all" ON mkt_equipos_acceso
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "mkt_equipos_acceso_read" ON mkt_equipos_acceso
  FOR SELECT TO authenticated USING (true);
