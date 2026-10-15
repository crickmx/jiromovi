/*
  # Secciones del FormBuilder

  Permite agrupar visualmente los campos de un tipo de trámite en secciones
  con nombre/descripción propios, opcionalmente condicionadas a que otra
  sección del mismo tipo se haya completado antes (todos sus campos
  requeridos con respuesta). Una sección puede marcarse "opcional" (se
  renderiza colapsada por default en el modal de creación).

  Retrocompatible: tramite_tipo_campos.seccion_id es NULL por default —
  todos los tipos existentes siguen sin secciones hasta que se cree una.
*/

CREATE TABLE IF NOT EXISTS tramite_tipo_secciones (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_tipo_id       uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  nombre                text        NOT NULL,
  descripcion           text,
  orden                 integer     NOT NULL DEFAULT 0,
  opcional              boolean     NOT NULL DEFAULT false,
  depende_de_seccion_id uuid        REFERENCES tramite_tipo_secciones(id) ON DELETE SET NULL,
  activo                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tramite_tipo_secciones_tipo ON tramite_tipo_secciones(tramite_tipo_id);

ALTER TABLE tramite_tipo_campos
  ADD COLUMN IF NOT EXISTS seccion_id uuid REFERENCES tramite_tipo_secciones(id) ON DELETE SET NULL;

ALTER TABLE tramite_tipo_secciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramite_tipo_secciones_select"
  ON tramite_tipo_secciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tramite_tipo_secciones_admin_all"
  ON tramite_tipo_secciones FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo')
  );
