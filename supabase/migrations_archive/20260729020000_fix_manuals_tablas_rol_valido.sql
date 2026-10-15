-- Mismo bug que el bucket de Storage (20260729010000), ahora en las tablas
-- del modulo de Manuales: todas las policies de escritura comparan
-- rol = 'admin', valor que nunca existe en usuarios.rol (el real es
-- 'Administrador'). Ningun Admin real ha podido crear/editar/borrar
-- manuales, capitulos, ni reglas de visibilidad desde la app.

-- ── manuals ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert manuals" ON manuals;
DROP POLICY IF EXISTS "Admins can update manuals" ON manuals;
DROP POLICY IF EXISTS "Admins can delete manuals" ON manuals;

CREATE POLICY "Admins can insert manuals"
  ON manuals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can update manuals"
  ON manuals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can delete manuals"
  ON manuals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

-- ── manual_visibility_rules ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert visibility rules" ON manual_visibility_rules;
DROP POLICY IF EXISTS "Admins can update visibility rules" ON manual_visibility_rules;
DROP POLICY IF EXISTS "Admins can delete visibility rules" ON manual_visibility_rules;

CREATE POLICY "Admins can insert visibility rules"
  ON manual_visibility_rules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can update visibility rules"
  ON manual_visibility_rules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can delete visibility rules"
  ON manual_visibility_rules FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

-- ── manual_chapters ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert manual chapters" ON manual_chapters;
DROP POLICY IF EXISTS "Admins can update manual chapters" ON manual_chapters;
DROP POLICY IF EXISTS "Admins can delete manual chapters" ON manual_chapters;

CREATE POLICY "Admins can insert manual chapters"
  ON manual_chapters FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can update manual chapters"
  ON manual_chapters FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));

CREATE POLICY "Admins can delete manual chapters"
  ON manual_chapters FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'Administrador'));
