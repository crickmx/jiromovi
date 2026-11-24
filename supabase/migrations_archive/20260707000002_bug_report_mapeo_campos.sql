-- El tipo de trámite a disparar ahora es elegible desde Admin > Reportes de Bugs,
-- no un value fijo en el código (evita depender de cómo se llame el tipo en cada ambiente).
ALTER TABLE bug_report_config
  ADD COLUMN IF NOT EXISTS tipo_tramite_id uuid REFERENCES ticket_tipos(id) ON DELETE SET NULL;

-- Mapeo configurable: de dónde sale el valor de cada campo del FormBuilder del tipo elegido.
-- Mismo patrón que store_tramite_trigger_campos.
CREATE TABLE IF NOT EXISTS bug_report_campo_mapeo (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id       uuid        NOT NULL UNIQUE REFERENCES tramite_tipo_campos(id) ON DELETE CASCADE,
  fuente         text        NOT NULL DEFAULT 'vacio' CHECK (fuente IN ('vacio', 'template')),
  valor_template text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bug_report_campo_mapeo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_report_campo_mapeo_select" ON bug_report_campo_mapeo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bug_report_campo_mapeo_admin" ON bug_report_campo_mapeo
  FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador')
  WITH CHECK (get_my_rol() = 'Administrador');
