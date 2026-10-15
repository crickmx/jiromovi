/*
  # Crear módulo completo Mi CRM

  1. Nuevas Tablas
    - `crm_contactos`: Gestión de prospectos y clientes
    - `crm_cotizaciones`: Cotizaciones presentadas
    - `crm_polizas`: Pólizas emitidas
    - `crm_tareas`: Tareas y actividades
    - `crm_campos_personalizados`: Configuración de campos dinámicos
    - `crm_etiquetas`: Catálogo de etiquetas de segmentación
    - `crm_fuentes_origen`: Catálogo de fuentes de origen
    - `crm_notas`: Notas del historial

  2. Security
    - RLS habilitado en todas las tablas
    - Políticas para usuarios autenticados

  3. Características
    - Campos personalizados dinámicos
    - Pipeline de ventas completo
    - Gestión de documentos
    - Timeline de actividades
*/

-- =======================
-- TABLA: crm_contactos
-- =======================

CREATE TABLE IF NOT EXISTS crm_contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_contacto TEXT NOT NULL CHECK (tipo_contacto IN ('Persona', 'Empresa')),
  nombre_completo TEXT NOT NULL,
  celular TEXT NOT NULL,
  email TEXT,
  estatus TEXT NOT NULL DEFAULT 'Prospecto' CHECK (estatus IN ('Prospecto', 'Cotización Presentada', 'Negociación', 'Cliente', 'Perdido')),
  fuente_origen TEXT,
  etiquetas_segmentacion TEXT[] DEFAULT '{}',
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  fecha_conversion_cliente TIMESTAMPTZ,
  campos_personalizados JSONB DEFAULT '{}',
  creado_por UUID REFERENCES usuarios(id),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_cotizaciones
-- =======================

CREATE TABLE IF NOT EXISTS crm_cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  nombre_documento TEXT NOT NULL,
  fecha_presentacion DATE NOT NULL DEFAULT CURRENT_DATE,
  estatus_cotizacion TEXT NOT NULL DEFAULT 'Nueva' CHECK (estatus_cotizacion IN ('Nueva', 'Pendiente de Seguimiento', 'Aprobada', 'Rechazada/Perdida')),
  archivo_url TEXT,
  monto_cotizado DECIMAL(12,2),
  observaciones TEXT,
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_polizas
-- =======================

CREATE TABLE IF NOT EXISTS crm_polizas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  numero_poliza TEXT NOT NULL,
  tipo_ramo TEXT NOT NULL,
  compania_aseguradora TEXT NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  prima_total DECIMAL(12,2) NOT NULL,
  archivo_url TEXT,
  observaciones TEXT,
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_tareas
-- =======================

CREATE TABLE IF NOT EXISTS crm_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  tipo_actividad TEXT NOT NULL DEFAULT 'Llamada' CHECK (tipo_actividad IN ('Llamada', 'Email', 'Reunión', 'Otro')),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  completada BOOLEAN DEFAULT false,
  fecha_completado TIMESTAMPTZ,
  asignado_a UUID REFERENCES usuarios(id),
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_notas
-- =======================

CREATE TABLE IF NOT EXISTS crm_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_campos_personalizados
-- =======================

CREATE TABLE IF NOT EXISTS crm_campos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_campo TEXT NOT NULL UNIQUE,
  etiqueta TEXT NOT NULL,
  tipo_campo TEXT NOT NULL CHECK (tipo_campo IN ('Texto', 'Número', 'Fecha', 'Selector')),
  opciones_selector TEXT[] DEFAULT '{}',
  requerido BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_etiquetas
-- =======================

CREATE TABLE IF NOT EXISTS crm_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- TABLA: crm_fuentes_origen
-- =======================

CREATE TABLE IF NOT EXISTS crm_fuentes_origen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =======================
-- ÍNDICES
-- =======================

CREATE INDEX IF NOT EXISTS idx_crm_contactos_estatus ON crm_contactos(estatus);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_creado_por ON crm_contactos(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_fecha_creacion ON crm_contactos(fecha_creacion DESC);

CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_contacto ON crm_cotizaciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_estatus ON crm_cotizaciones(estatus_cotizacion);

CREATE INDEX IF NOT EXISTS idx_crm_polizas_contacto ON crm_polizas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_polizas_vencimiento ON crm_polizas(fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_crm_tareas_contacto ON crm_tareas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_completada ON crm_tareas(completada);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_vencimiento ON crm_tareas(fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_crm_notas_contacto ON crm_notas(contacto_id);

-- =======================
-- TRIGGERS
-- =======================

-- Trigger para actualizar fecha_conversion_cliente
CREATE OR REPLACE FUNCTION actualizar_fecha_conversion_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus = 'Cliente' AND (OLD.estatus IS NULL OR OLD.estatus != 'Cliente') THEN
    NEW.fecha_conversion_cliente := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversion_cliente
  BEFORE UPDATE ON crm_contactos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_conversion_cliente();

-- Trigger para actualizar fecha_completado en tareas
CREATE OR REPLACE FUNCTION actualizar_fecha_completado_tarea()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completada = true AND (OLD.completada IS NULL OR OLD.completada = false) THEN
    NEW.fecha_completado := now();
  ELSIF NEW.completada = false THEN
    NEW.fecha_completado := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_completado_tarea
  BEFORE UPDATE ON crm_tareas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_completado_tarea();

-- Trigger para actualizar timestamps
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_timestamp_contactos
  BEFORE UPDATE ON crm_contactos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_timestamp_cotizaciones
  BEFORE UPDATE ON crm_cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_timestamp_polizas
  BEFORE UPDATE ON crm_polizas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_actualizar_timestamp_tareas
  BEFORE UPDATE ON crm_tareas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_timestamp();

-- =======================
-- ROW LEVEL SECURITY
-- =======================

ALTER TABLE crm_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_polizas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_fuentes_origen ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_contactos
CREATE POLICY "Usuarios autenticados pueden ver todos los contactos"
  ON crm_contactos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear contactos"
  ON crm_contactos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar contactos"
  ON crm_contactos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar contactos"
  ON crm_contactos FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_cotizaciones
CREATE POLICY "Usuarios autenticados pueden ver cotizaciones"
  ON crm_cotizaciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear cotizaciones"
  ON crm_cotizaciones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar cotizaciones"
  ON crm_cotizaciones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar cotizaciones"
  ON crm_cotizaciones FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_polizas
CREATE POLICY "Usuarios autenticados pueden ver pólizas"
  ON crm_polizas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear pólizas"
  ON crm_polizas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar pólizas"
  ON crm_polizas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar pólizas"
  ON crm_polizas FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_tareas
CREATE POLICY "Usuarios autenticados pueden ver tareas"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear tareas"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar tareas"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar tareas"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_notas
CREATE POLICY "Usuarios autenticados pueden ver notas"
  ON crm_notas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear notas"
  ON crm_notas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar notas"
  ON crm_notas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar notas"
  ON crm_notas FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_campos_personalizados
CREATE POLICY "Usuarios autenticados pueden ver campos personalizados"
  ON crm_campos_personalizados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear campos personalizados"
  ON crm_campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar campos personalizados"
  ON crm_campos_personalizados FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar campos personalizados"
  ON crm_campos_personalizados FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_etiquetas
CREATE POLICY "Usuarios autenticados pueden ver etiquetas"
  ON crm_etiquetas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear etiquetas"
  ON crm_etiquetas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar etiquetas"
  ON crm_etiquetas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar etiquetas"
  ON crm_etiquetas FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para crm_fuentes_origen
CREATE POLICY "Usuarios autenticados pueden ver fuentes origen"
  ON crm_fuentes_origen FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear fuentes origen"
  ON crm_fuentes_origen FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar fuentes origen"
  ON crm_fuentes_origen FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar fuentes origen"
  ON crm_fuentes_origen FOR DELETE
  TO authenticated
  USING (true);

-- =======================
-- DATOS INICIALES
-- =======================

-- Fuentes de origen predeterminadas
INSERT INTO crm_fuentes_origen (nombre) VALUES
  ('Redes Sociales'),
  ('Referido'),
  ('Sitio Web'),
  ('Publicidad'),
  ('Evento'),
  ('Llamada Directa'),
  ('WhatsApp')
ON CONFLICT (nombre) DO NOTHING;

-- Etiquetas predeterminadas
INSERT INTO crm_etiquetas (nombre, color) VALUES
  ('VIP', '#ef4444'),
  ('Renovación', '#f59e0b'),
  ('Nuevo', '#10b981'),
  ('Urgente', '#dc2626'),
  ('Potencial Alto', '#8b5cf6')
ON CONFLICT (nombre) DO NOTHING;

-- =======================
-- BUCKET DE STORAGE
-- =======================

-- Crear bucket para archivos del CRM
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-documentos', 'crm-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Usuarios autenticados pueden subir archivos CRM"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crm-documentos');

CREATE POLICY "Usuarios autenticados pueden ver archivos CRM"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crm-documentos');

CREATE POLICY "Usuarios autenticados pueden actualizar archivos CRM"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crm-documentos')
WITH CHECK (bucket_id = 'crm-documentos');

CREATE POLICY "Usuarios autenticados pueden eliminar archivos CRM"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crm-documentos');
