
-- Table to store module visibility rules (hide/show nav items per role or per office)
CREATE TABLE IF NOT EXISTS module_visibility (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key   text NOT NULL,        -- e.g. 'entrega-polizas', 'lector-qualitas'
  target_type  text NOT NULL CHECK (target_type IN ('role', 'office')),
  target_value text NOT NULL,        -- role name OR oficina_id
  visible      boolean NOT NULL DEFAULT true,
  updated_by   uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, target_type, target_value)
);

ALTER TABLE module_visibility ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; authenticated users can read
CREATE POLICY "admins_all_module_visibility" ON module_visibility
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "authenticated_read_module_visibility" ON module_visibility
  FOR SELECT TO authenticated USING (true);
