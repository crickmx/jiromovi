/*
  # Crear módulo de Registro de Actividades

  1. Nuevas Tablas
    - `tramite_activity_types`: Catálogo de tipos de trámite (Cotización, Emisión, etc.)
    - `insurance_types`: Catálogo de tipos de seguro (Auto, Vida, GMM, etc.)
    - `aseguradoras`: Catálogo de aseguradoras del sistema
    
  2. Modificaciones a tickets
    - Agregar campos para Registro de Actividades:
      - `activity_subtype_id`: FK a tramite_activity_types
      - `requester_user_id`: FK a usuarios (solicitante)
      - `insurance_type_id`: FK a insurance_types
      - `attending_user_id`: FK a usuarios (quién atiende)
      - `request_datetime`: Timestamp de solicitud
      - `completion_datetime`: Timestamp de finalización (nullable)
      - `progress_percent`: 0, 25, 50, 75, 100
      - `insurers`: JSONB array de IDs de aseguradoras
      
  3. Permisos
    - Solo Empleado, Gerente y Administrador pueden crear/ver este tipo
    - Agente bloqueado a nivel backend
    
  4. Funciones
    - Validaciones automáticas
    - Cálculo de estatus según avance
    - Control de permisos
*/

-- =====================================================
-- 1. CATÁLOGO: TIPOS DE TRÁMITE PARA REGISTRO ACTIVIDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS tramite_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tramite_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver activity types activos"
  ON tramite_activity_types FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admin puede gestionar activity types"
  ON tramite_activity_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- =====================================================
-- 2. CATÁLOGO: TIPOS DE SEGURO
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE insurance_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver insurance types activos"
  ON insurance_types FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admin puede gestionar insurance types"
  ON insurance_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- =====================================================
-- 3. CATÁLOGO: ASEGURADORAS
-- =====================================================
CREATE TABLE IF NOT EXISTS aseguradoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  nombre_corto TEXT,
  logo_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE aseguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver aseguradoras activas"
  ON aseguradoras FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admin puede gestionar aseguradoras"
  ON aseguradoras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- =====================================================
-- 4. AGREGAR CAMPOS A TICKETS PARA REGISTRO DE ACTIVIDADES
-- =====================================================
DO $$ 
BEGIN
  -- activity_subtype_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'activity_subtype_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN activity_subtype_id UUID REFERENCES tramite_activity_types(id) ON DELETE SET NULL;
  END IF;

  -- requester_user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'requester_user_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN requester_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  -- insurance_type_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'insurance_type_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN insurance_type_id UUID REFERENCES insurance_types(id) ON DELETE SET NULL;
  END IF;

  -- attending_user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'attending_user_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN attending_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  -- request_datetime
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'request_datetime'
  ) THEN
    ALTER TABLE tickets ADD COLUMN request_datetime TIMESTAMPTZ;
  END IF;

  -- completion_datetime
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'completion_datetime'
  ) THEN
    ALTER TABLE tickets ADD COLUMN completion_datetime TIMESTAMPTZ;
  END IF;

  -- progress_percent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'progress_percent'
  ) THEN
    ALTER TABLE tickets ADD COLUMN progress_percent INTEGER CHECK (progress_percent IN (0, 25, 50, 75, 100));
  END IF;

  -- insurers (array de UUIDs de aseguradoras)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'insurers'
  ) THEN
    ALTER TABLE tickets ADD COLUMN insurers JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- =====================================================
-- 5. FUNCIÓN: VALIDAR REGISTRO DE ACTIVIDADES
-- =====================================================
CREATE OR REPLACE FUNCTION validate_registro_actividades()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo aplica para tipo 'registro_actividad'
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  -- Validar que el usuario no sea Agente
  IF EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol = 'agente'
  ) THEN
    RAISE EXCEPTION 'Los agentes no pueden crear Registro de Actividades';
  END IF;

  -- Validar campos obligatorios
  IF NEW.activity_subtype_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de trámite es obligatorio';
  END IF;

  IF NEW.requester_user_id IS NULL THEN
    RAISE EXCEPTION 'El solicitante es obligatorio';
  END IF;

  IF NEW.insurance_type_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de seguro es obligatorio';
  END IF;

  IF NEW.attending_user_id IS NULL THEN
    RAISE EXCEPTION 'Quién atiende es obligatorio';
  END IF;

  IF NEW.request_datetime IS NULL THEN
    RAISE EXCEPTION 'La fecha y hora de solicitud es obligatoria';
  END IF;

  IF NEW.progress_percent IS NULL THEN
    RAISE EXCEPTION 'El avance es obligatorio';
  END IF;

  -- Validar que insurers tenga al menos 1 aseguradora
  IF NEW.insurers IS NULL OR jsonb_array_length(NEW.insurers) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una aseguradora';
  END IF;

  -- Si avance = 100% y no hay fecha de finalización, autocompletar
  IF NEW.progress_percent = 100 AND NEW.completion_datetime IS NULL THEN
    NEW.completion_datetime := now();
  END IF;

  -- Validar que fecha de finalización no sea menor a fecha de solicitud
  IF NEW.completion_datetime IS NOT NULL AND NEW.completion_datetime < NEW.request_datetime THEN
    RAISE EXCEPTION 'La fecha de finalización no puede ser anterior a la fecha de solicitud';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
DROP TRIGGER IF EXISTS validate_registro_actividades_trigger ON tickets;
CREATE TRIGGER validate_registro_actividades_trigger
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_registro_actividades();

-- =====================================================
-- 6. FUNCIÓN: VERIFICAR PERMISO REGISTRO ACTIVIDADES
-- =====================================================
CREATE OR REPLACE FUNCTION user_can_access_registro_actividades()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol IN ('empleado', 'gerente', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNCIÓN: OBTENER USUARIOS DE MI OFICINA (para Solicitante)
-- =====================================================
CREATE OR REPLACE FUNCTION get_office_users_for_requester()
RETURNS TABLE(
  id UUID,
  nombre_completo TEXT,
  rol TEXT,
  oficina_id UUID,
  oficina_nombre TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre_completo,
    u.rol,
    u.oficina_id,
    o.nombre as oficina_nombre
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE u.estado = 'activo'
    AND u.deleted_at IS NULL
    AND (
      -- Admin ve todos
      EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
      OR
      -- Gerente ve usuarios de su oficina
      EXISTS (
        SELECT 1 FROM usuarios me
        WHERE me.id = auth.uid()
        AND me.rol = 'gerente'
        AND me.oficina_id = u.oficina_id
      )
      OR
      -- Empleado ve usuarios de su oficina
      EXISTS (
        SELECT 1 FROM usuarios me
        WHERE me.id = auth.uid()
        AND me.rol = 'empleado'
        AND me.oficina_id = u.oficina_id
      )
    )
  ORDER BY u.nombre_completo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. FUNCIÓN: OBTENER USUARIOS QUE PUEDEN ATENDER (Empleado, Gerente, Admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_users_who_can_attend()
RETURNS TABLE(
  id UUID,
  nombre_completo TEXT,
  rol TEXT,
  oficina_id UUID,
  oficina_nombre TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre_completo,
    u.rol,
    u.oficina_id,
    o.nombre as oficina_nombre
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE u.estado = 'activo'
    AND u.deleted_at IS NULL
    AND u.rol IN ('empleado', 'gerente', 'admin')
  ORDER BY u.nombre_completo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. CARGAR DATOS INICIALES
-- =====================================================
-- Tipos de trámite iniciales
INSERT INTO tramite_activity_types (nombre, descripcion) VALUES
  ('Cotización', 'Elaboración de cotización de seguro'),
  ('Emisión', 'Emisión de póliza de seguro')
ON CONFLICT DO NOTHING;

-- Tipos de seguro iniciales
INSERT INTO insurance_types (nombre, descripcion) VALUES
  ('Seguro de auto', 'Seguros para vehículos automotores'),
  ('Seguro de vida', 'Seguros de vida individual o colectivo'),
  ('Seguro de gastos médicos', 'Seguros de gastos médicos mayores'),
  ('Seguro empresarial', 'Seguros para empresas y negocios'),
  ('Seguro de hogar', 'Seguros para viviendas y contenidos'),
  ('Seguro de moto', 'Seguros para motocicletas'),
  ('Seguro de viaje', 'Seguros para viajeros nacionales e internacionales')
ON CONFLICT (nombre) DO NOTHING;

-- Aseguradoras iniciales (reutilizar las existentes en el sistema)
INSERT INTO aseguradoras (nombre, nombre_corto) VALUES
  ('GNP Seguros', 'GNP'),
  ('AXA Seguros', 'AXA'),
  ('Qualitas', 'Qualitas'),
  ('Seguros Atlas', 'Atlas'),
  ('Afirme Seguros', 'Afirme'),
  ('Chubb Seguros', 'Chubb'),
  ('ANA Seguros', 'ANA'),
  ('Zurich Seguros', 'Zurich'),
  ('MAPFRE', 'MAPFRE'),
  ('Allianz', 'Allianz'),
  ('Inbursa', 'Inbursa'),
  ('Bupa', 'Bupa'),
  ('Banorte Seguros', 'Banorte')
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- 10. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tickets_activity_subtype ON tickets(activity_subtype_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_user ON tickets(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_insurance_type ON tickets(insurance_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attending_user ON tickets(attending_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_progress_percent ON tickets(progress_percent);
CREATE INDEX IF NOT EXISTS idx_tickets_request_datetime ON tickets(request_datetime);
CREATE INDEX IF NOT EXISTS idx_tickets_tipo_tramite ON tickets(tipo_tramite);

-- =====================================================
-- 11. COMENTARIOS DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE tramite_activity_types IS 'Catálogo administrable de tipos de trámite para Registro de Actividades';
COMMENT ON TABLE insurance_types IS 'Catálogo administrable de tipos de seguro';
COMMENT ON TABLE aseguradoras IS 'Catálogo de aseguradoras del sistema';
COMMENT ON COLUMN tickets.activity_subtype_id IS 'Tipo de trámite (Cotización, Emisión, etc.) - solo para tipo_tramite=registro_actividad';
COMMENT ON COLUMN tickets.requester_user_id IS 'Usuario solicitante del trámite';
COMMENT ON COLUMN tickets.insurance_type_id IS 'Tipo de seguro del trámite';
COMMENT ON COLUMN tickets.attending_user_id IS 'Usuario que atiende el trámite';
COMMENT ON COLUMN tickets.request_datetime IS 'Fecha y hora de solicitud del trámite';
COMMENT ON COLUMN tickets.completion_datetime IS 'Fecha y hora de finalización del trámite';
COMMENT ON COLUMN tickets.progress_percent IS 'Porcentaje de avance: 0, 25, 50, 75, 100';
COMMENT ON COLUMN tickets.insurers IS 'Array JSON de UUIDs de aseguradoras involucradas';
