/*
  # Registro de usuarios Beta

  Un usuario queda registrado aquí solo cuando un Admin APRUEBA su trámite
  "Alta Usuario Beta" (estatus del FormBuilder llega a "Alta Finalizada",
  clasificación 'terminacion') -- ver TramiteDetalle.tsx (proceedWithSave).
  No se inserta al momento de solicitar, solo al aprobar.
*/

CREATE TABLE IF NOT EXISTS usuarios_beta (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  tramite_id  uuid        REFERENCES tickets(id) ON DELETE SET NULL,
  fecha_alta  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuarios_beta IS
  'Usuarios con acceso Beta aprobado. Se llena al aprobar (no al solicitar) el trámite alta_usuario_beta.';

ALTER TABLE usuarios_beta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_beta_select"
  ON usuarios_beta FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "usuarios_beta_admin_all"
  ON usuarios_beta FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
  );
