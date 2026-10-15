-- Create ticket_tipos table for dynamic tramite type management
CREATE TABLE IF NOT EXISTS ticket_tipos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  value       TEXT        UNIQUE NOT NULL,
  label       TEXT        NOT NULL,
  area        TEXT        NOT NULL DEFAULT 'Comercial',
  color       TEXT        NOT NULL DEFAULT '#0369a1',
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  orden       INTEGER     NOT NULL DEFAULT 0,
  is_custom   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed built-in types (Comercial = sky-700, Operaciones = amber-700)
INSERT INTO ticket_tipos (value, label, area, color, orden, is_custom) VALUES
  ('cotizacion_emision',              'Cotización / Emisión',              'Comercial',   '#0369a1', 1,  FALSE),
  ('correccion_poliza_endoso',        'Corrección de Póliza / Endoso',     'Comercial',   '#0369a1', 2,  FALSE),
  ('renovaciones',                    'Renovaciones',                      'Comercial',   '#0369a1', 3,  FALSE),
  ('cobranza',                        'Cobranza',                          'Comercial',   '#0369a1', 4,  FALSE),
  ('otros_comercial',                 'Otros Comercial',                   'Comercial',   '#0369a1', 5,  FALSE),
  ('formulario_cotizacion',           'Formulario de cotización',          'Comercial',   '#0369a1', 6,  FALSE),
  ('correccion_poliza_registrada',    'Corrección de Registro de Póliza',  'Operaciones', '#b45309', 7,  FALSE),
  ('correccion_comisiones',           'Corrección de comisiones',          'Operaciones', '#b45309', 8,  FALSE),
  ('registro_poliza',                 'Registro de póliza',                'Operaciones', '#b45309', 9,  FALSE),
  ('solicitud_comisiones_pendientes', 'Solicitud de comisiones',           'Operaciones', '#b45309', 10, FALSE),
  ('cambio_bancario',                 'Cambio bancario',                   'Operaciones', '#b45309', 11, FALSE),
  ('cancelacion_poliza',              'Cancelación de Póliza',             'Operaciones', '#b45309', 12, FALSE)
ON CONFLICT (value) DO NOTHING;

-- Drop the hardcoded CHECK constraint so custom types can be stored
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

-- Enable RLS
ALTER TABLE ticket_tipos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active types
CREATE POLICY "ticket_tipos_select_all" ON ticket_tipos
  FOR SELECT TO authenticated USING (TRUE);

-- Only Administradores can insert
CREATE POLICY "ticket_tipos_insert_admin" ON ticket_tipos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

-- Only Administradores can update
CREATE POLICY "ticket_tipos_update_admin" ON ticket_tipos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

-- Only Administradores can delete custom types (never built-in)
CREATE POLICY "ticket_tipos_delete_custom_admin" ON ticket_tipos
  FOR DELETE TO authenticated
  USING (
    is_custom = TRUE AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );
