/*
  # Sistema de Recordatorios de Cumpleaños para Mi CRM

  1. Cambios en Tablas Existentes
    - Agregar `fecha_nacimiento` a `crm_contactos`

  2. Nuevas Tablas
    - `crm_birthday_reminders`: Rastrea recordatorios generados (evita duplicados)
    - `dashboard_calendar_events`: Eventos del calendario del Dashboard
  
  3. Security
    - RLS habilitado en todas las tablas
    - Solo el dueño del contacto ve sus recordatorios
  
  4. Características
    - Recordatorios anuales de cumpleaños
    - Eventos en calendario del Dashboard
    - Idempotencia (no duplicados por año)
    - Deep linking a perfil del contacto
*/

-- ===========================================
-- 1. Agregar campo fecha_nacimiento a crm_contactos
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_contactos' AND column_name = 'fecha_nacimiento'
  ) THEN
    ALTER TABLE crm_contactos ADD COLUMN fecha_nacimiento DATE;
  END IF;
END $$;

-- ===========================================
-- 2. Tabla: crm_birthday_reminders
-- ===========================================

CREATE TABLE IF NOT EXISTS crm_birthday_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  notificacion_enviada BOOLEAN DEFAULT false,
  calendario_creado BOOLEAN DEFAULT false,
  fecha_generado TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(contacto_id, usuario_id, year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_reminders_contacto ON crm_birthday_reminders(contacto_id);
CREATE INDEX IF NOT EXISTS idx_birthday_reminders_usuario ON crm_birthday_reminders(usuario_id);
CREATE INDEX IF NOT EXISTS idx_birthday_reminders_year ON crm_birthday_reminders(year);

-- ===========================================
-- 3. Tabla: dashboard_calendar_events
-- ===========================================

CREATE TABLE IF NOT EXISTS dashboard_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  todo_el_dia BOOLEAN DEFAULT false,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('reunion', 'capacitacion', 'reserva', 'cumpleanos', 'otro')),
  color TEXT DEFAULT '#3b82f6',
  entidad_tipo TEXT,
  entidad_id UUID,
  metadata JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario ON dashboard_calendar_events(usuario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_fecha ON dashboard_calendar_events(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tipo ON dashboard_calendar_events(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_calendar_events_entidad ON dashboard_calendar_events(entidad_tipo, entidad_id);

-- ===========================================
-- 4. RLS Policies - crm_birthday_reminders
-- ===========================================

ALTER TABLE crm_birthday_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propios recordatorios"
  ON crm_birthday_reminders FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Sistema puede crear recordatorios"
  ON crm_birthday_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sistema puede actualizar recordatorios"
  ON crm_birthday_reminders FOR UPDATE
  TO authenticated
  USING (true);

-- ===========================================
-- 5. RLS Policies - dashboard_calendar_events
-- ===========================================

ALTER TABLE dashboard_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propios eventos"
  ON dashboard_calendar_events FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden crear sus propios eventos"
  ON dashboard_calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden actualizar sus propios eventos"
  ON dashboard_calendar_events FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus propios eventos"
  ON dashboard_calendar_events FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- ===========================================
-- 6. Función auxiliar: Obtener eventos del mes
-- ===========================================

CREATE OR REPLACE FUNCTION get_calendar_events_for_month(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  id UUID,
  titulo TEXT,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  todo_el_dia BOOLEAN,
  tipo_evento TEXT,
  color TEXT,
  entidad_tipo TEXT,
  entidad_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dce.id,
    dce.titulo,
    dce.descripcion,
    dce.fecha_inicio,
    dce.fecha_fin,
    dce.todo_el_dia,
    dce.tipo_evento,
    dce.color,
    dce.entidad_tipo,
    dce.entidad_id
  FROM dashboard_calendar_events dce
  WHERE 
    dce.usuario_id = auth.uid()
    AND EXTRACT(YEAR FROM dce.fecha_inicio) = p_year
    AND EXTRACT(MONTH FROM dce.fecha_inicio) = p_month
  ORDER BY dce.fecha_inicio;
END;
$$;

-- ===========================================
-- 7. Comentarios
-- ===========================================

COMMENT ON TABLE crm_birthday_reminders IS 'Rastrea recordatorios de cumpleaños generados para evitar duplicados';
COMMENT ON TABLE dashboard_calendar_events IS 'Eventos del calendario mostrados en el Dashboard';
COMMENT ON COLUMN crm_contactos.fecha_nacimiento IS 'Fecha de nacimiento del contacto (solo para tipo Persona)';
COMMENT ON FUNCTION get_calendar_events_for_month IS 'Obtiene eventos del calendario para un mes específico del usuario actual';