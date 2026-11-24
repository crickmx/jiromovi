/*
  # Agregar Campos Faltantes para Integración Cross-Módulo
  
  1. Campos de Auditoría Faltantes
    - created_by, updated_by donde aplique
    
  2. Campos de Estado y Control
    - eliminado (soft delete)
    - activo/activa
    
  3. Campos de Metadata
    - metadata JSON para extensibilidad
    
  4. Campos de Búsqueda y Tracking
    - Campos calculados y de búsqueda
*/

-- =============================================
-- MÓDULO DE TICKETS - Campos Adicionales
-- =============================================

-- Agregar metadata para extensibilidad
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE ticket_archivos
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- =============================================
-- MÓDULO DE CHAT - Campos Adicionales
-- =============================================

-- Agregar última actividad del usuario en el chat
ALTER TABLE chat_miembros
ADD COLUMN IF NOT EXISTS ultima_lectura timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS notificaciones_activas boolean DEFAULT true;

-- Agregar contador de mensajes no leídos (se puede calcular pero es más eficiente)
CREATE TABLE IF NOT EXISTS chat_no_leidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  mensajes_no_leidos integer DEFAULT 0,
  ultimo_mensaje_id uuid REFERENCES chat_mensajes(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_usuario 
ON chat_no_leidos(usuario_id, mensajes_no_leidos) 
WHERE mensajes_no_leidos > 0;

ALTER TABLE chat_no_leidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propios no leídos"
  ON chat_no_leidos FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- =============================================
-- MÓDULO DE VACACIONES - Mejorar Tracking
-- =============================================

-- Agregar tabla para tracking de días utilizados por año
CREATE TABLE IF NOT EXISTS vacaciones_balance_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  anio integer NOT NULL,
  dias_asignados integer DEFAULT 15,
  dias_utilizados integer DEFAULT 0,
  dias_pendientes integer DEFAULT 0,
  dias_disponibles integer GENERATED ALWAYS AS (dias_asignados - dias_utilizados - dias_pendientes) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, anio)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_balance_usuario_anio 
ON vacaciones_balance_anual(usuario_id, anio);

ALTER TABLE vacaciones_balance_anual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propio balance"
  ON vacaciones_balance_anual FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Admin y Gerentes pueden gestionar balances"
  ON vacaciones_balance_anual FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =============================================
-- MÓDULO DE SEGUROS EDUCATION - Mejorar Tracking
-- =============================================

-- Agregar tiempo dedicado y calificaciones
ALTER TABLE seguros_progress
ADD COLUMN IF NOT EXISTS tiempo_dedicado_minutos integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS calificacion integer CHECK (calificacion >= 0 AND calificacion <= 100),
ADD COLUMN IF NOT EXISTS intentos integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS notas text;

-- Agregar tabla de certificados
CREATE TABLE IF NOT EXISTS seguros_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  categoria_id uuid REFERENCES seguros_categories(id) ON DELETE CASCADE NOT NULL,
  fecha_emision timestamptz DEFAULT now(),
  fecha_vencimiento timestamptz,
  codigo_certificado text UNIQUE NOT NULL,
  url_certificado text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificados_usuario ON seguros_certificados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_certificados_codigo ON seguros_certificados(codigo_certificado);

ALTER TABLE seguros_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus certificados"
  ON seguros_certificados FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- =============================================
-- MÓDULO DE PUBLICIDAD - Mejorar Tracking
-- =============================================

-- Agregar tabla de uso y estadísticas
CREATE TABLE IF NOT EXISTS publicidad_uso_estadisticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diseno_id uuid REFERENCES publicidad_disenos(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  vistas integer DEFAULT 0,
  descargas integer DEFAULT 0,
  compartidos integer DEFAULT 0,
  ultima_vista timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(diseno_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_publicidad_stats_diseno 
ON publicidad_uso_estadisticas(diseno_id);

-- =============================================
-- MÓDULO DE ESPACIOS (JIRO) - Mejorar Gestión
-- =============================================

-- Agregar campos de capacidad y equipamiento a áreas
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS equipamiento jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS imagen_url text,
ADD COLUMN IF NOT EXISTS ubicacion text,
ADD COLUMN IF NOT EXISTS piso integer;

-- Agregar tabla de evaluaciones de reservas
CREATE TABLE IF NOT EXISTS reservas_evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid REFERENCES reservas_espacio(id) ON DELETE CASCADE NOT NULL UNIQUE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  calificacion integer CHECK (calificacion >= 1 AND calificacion <= 5),
  comentarios text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_area 
ON reservas_evaluaciones(reserva_id);

-- =============================================
-- MÓDULO DE CONTACTOS - CRM Mejorado
-- =============================================

-- Agregar campos CRM adicionales
ALTER TABLE contactos
ADD COLUMN IF NOT EXISTS estado_prospecto text DEFAULT 'nuevo' 
  CHECK (estado_prospecto IN ('nuevo', 'contactado', 'calificado', 'propuesta', 'ganado', 'perdido')),
ADD COLUMN IF NOT EXISTS valor_estimado decimal(12,2),
ADD COLUMN IF NOT EXISTS fecha_proximo_contacto date,
ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS etiquetas text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contactos_estado ON contactos(estado_prospecto);
CREATE INDEX IF NOT EXISTS idx_contactos_asignado ON contactos(asignado_a);
CREATE INDEX IF NOT EXISTS idx_contactos_proximo_contacto 
ON contactos(fecha_proximo_contacto) 
WHERE fecha_proximo_contacto IS NOT NULL AND NOT eliminado;

-- =============================================
-- MÓDULO DE NOTIFICACIONES - Mejorar Sistema
-- =============================================

-- Agregar prioridad y acciones a notificaciones
ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'normal' 
  CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
ADD COLUMN IF NOT EXISTS accion_url text,
ADD COLUMN IF NOT EXISTS accion_texto text,
ADD COLUMN IF NOT EXISTS expira_en timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notificaciones_prioridad 
ON notificaciones(usuario_id, prioridad, leida);

-- =============================================
-- MÓDULO DE MEETINGS - Mejorar Gestión
-- =============================================

-- Agregar campos de configuración
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS password text,
ADD COLUMN IF NOT EXISTS max_participantes integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS grabacion_activa boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS grabacion_url text,
ADD COLUMN IF NOT EXISTS configuracion jsonb DEFAULT '{}'::jsonb;

-- =============================================
-- AUDITORÍA GLOBAL - Sistema de Logs
-- =============================================

-- Tabla de auditoría global
CREATE TABLE IF NOT EXISTS auditoria_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre text NOT NULL,
  registro_id uuid NOT NULL,
  accion text NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro 
ON auditoria_logs(tabla_nombre, registro_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_fecha 
ON auditoria_logs(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_accion 
ON auditoria_logs(accion, created_at DESC);

-- =============================================
-- CONFIGURACIÓN GLOBAL DEL SISTEMA
-- =============================================

-- Tabla de configuraciones globales
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE NOT NULL,
  valor jsonb NOT NULL,
  descripcion text,
  tipo text CHECK (tipo IN ('string', 'number', 'boolean', 'json', 'array')),
  modificado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_clave ON configuracion_sistema(clave);

ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin puede gestionar configuración"
  ON configuracion_sistema FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Todos pueden leer configuración"
  ON configuracion_sistema FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- COMENTARIOS EN NUEVAS TABLAS
-- =============================================

COMMENT ON TABLE chat_no_leidos IS 'Tracking de mensajes no leídos por usuario en cada chat';
COMMENT ON TABLE vacaciones_balance_anual IS 'Balance anual de días de vacaciones por usuario';
COMMENT ON TABLE seguros_certificados IS 'Certificados emitidos por completar categorías de Seguros Education';
COMMENT ON TABLE publicidad_uso_estadisticas IS 'Estadísticas de uso de diseños publicitarios';
COMMENT ON TABLE reservas_evaluaciones IS 'Evaluaciones y feedback de reservas de espacios';
COMMENT ON TABLE auditoria_logs IS 'Log de auditoría global del sistema';
COMMENT ON TABLE configuracion_sistema IS 'Configuraciones globales del sistema';
