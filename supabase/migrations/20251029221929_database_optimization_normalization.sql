/*
  # Optimización y Normalización Integral de Base de Datos
  
  1. Estandarización de Nombres
    - Unificar nomenclatura a español consistente
    - Agregar columnas faltantes comunes
    
  2. Optimización de Índices
    - Agregar índices compuestos para búsquedas frecuentes
    - Optimizar índices de foreign keys
    
  3. Constraints y Validaciones
    - Agregar checks para enumeraciones
    - Estandarizar defaults
    
  4. Soft Deletes
    - Agregar columna eliminado donde aplique
*/

-- =============================================
-- OPTIMIZACIÓN DE MEETING (MOVI MEET)
-- =============================================

-- Renombrar columnas en inglés a español (meeting_participants)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'meeting_participants' AND column_name = 'user_id') THEN
    ALTER TABLE meeting_participants RENAME COLUMN user_id TO usuario_id;
  END IF;
END $$;

-- Renombrar columnas en inglés a español (meeting_chat_messages)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'meeting_chat_messages' AND column_name = 'sender_id') THEN
    ALTER TABLE meeting_chat_messages RENAME COLUMN sender_id TO remitente_id;
  END IF;
END $$;

-- =============================================
-- ESTANDARIZACIÓN DE TIMESTAMPS
-- =============================================

-- Agregar updated_at a tablas que solo tienen created_at
ALTER TABLE areas 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE accesos_nacional 
ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false;

-- =============================================
-- OPTIMIZACIÓN DE NOTIFICACIONES
-- =============================================

-- Agregar índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida 
ON notificaciones(usuario_id, leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_modulo_tipo 
ON notificaciones(modulo, tipo) WHERE NOT leida;

-- =============================================
-- OPTIMIZACIÓN DE TICKETS
-- =============================================

-- Índices compuestos para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_tickets_agente_estatus 
ON tickets(agente_id, estatus_id) WHERE cerrado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_poliza_folio 
ON tickets(poliza, folio) WHERE poliza IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_fecha_prioridad 
ON tickets(fecha_creacion DESC, prioridad) WHERE cerrado_en IS NULL;

-- =============================================
-- OPTIMIZACIÓN DE CHAT
-- =============================================

-- Índices para mensajes no leídos y búsquedas
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_chat_fecha 
ON chat_mensajes(chat_id, created_at DESC) WHERE NOT eliminado;

CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario 
ON chat_miembros(usuario_id, chat_id);

-- =============================================
-- OPTIMIZACIÓN DE VACACIONES
-- =============================================

-- Índice para consultas de aprobación
CREATE INDEX IF NOT EXISTS idx_vacaciones_estado_fecha 
ON solicitudes_vacaciones(estado, fecha_inicio) 
WHERE estado IN ('pendiente', 'aprobada');

CREATE INDEX IF NOT EXISTS idx_vacaciones_usuario_año 
ON solicitudes_vacaciones(usuario_id, fecha_inicio);

-- =============================================
-- OPTIMIZACIÓN DE SEGUROS EDUCATION
-- =============================================

-- Índices para progreso y lecciones activas
CREATE INDEX IF NOT EXISTS idx_seguros_progress_usuario_completada 
ON seguros_progress(usuario_id, completada, lesson_id);

CREATE INDEX IF NOT EXISTS idx_seguros_lessons_session_orden 
ON seguros_lessons(session_id, orden) WHERE activa;

CREATE INDEX IF NOT EXISTS idx_seguros_sessions_categoria_orden 
ON seguros_sessions(categoria_id, orden) WHERE activa;

-- =============================================
-- OPTIMIZACIÓN DE PUBLICIDAD
-- =============================================

-- Índices para búsqueda de plantillas
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_activa_tipo 
ON publicidad_plantillas(activa, tipo, categoria_id);

CREATE INDEX IF NOT EXISTS idx_publicidad_disenos_usuario_fecha 
ON publicidad_disenos(usuario_id, created_at DESC);

-- =============================================
-- OPTIMIZACIÓN DE ESPACIOS (JIRO)
-- =============================================

-- Índice para consulta de disponibilidad
CREATE INDEX IF NOT EXISTS idx_reservas_area_fechas 
ON reservas_espacio(area_id, fecha_inicio, fecha_fin) 
WHERE estado != 'cancelada';

-- =============================================
-- OPTIMIZACIÓN DE CONTACTOS
-- =============================================

-- Índices para búsqueda de contactos
CREATE INDEX IF NOT EXISTS idx_contactos_usuario_empresa 
ON contactos(usuario_id, empresa);

CREATE INDEX IF NOT EXISTS idx_contactos_email 
ON contactos(email) WHERE email IS NOT NULL;

-- =============================================
-- OPTIMIZACIÓN DE USUARIOS
-- =============================================

-- Índice para búsqueda por nombre completo
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_completo_busqueda 
ON usuarios USING gin(to_tsvector('spanish', nombre_completo));

-- Índice para usuarios activos por oficina
CREATE INDEX IF NOT EXISTS idx_usuarios_oficina_activo 
ON usuarios(oficina_id, activo) WHERE activo;

-- Índice para email laboral (búsquedas de login)
CREATE INDEX IF NOT EXISTS idx_usuarios_email_laboral 
ON usuarios(email_laboral) WHERE email_laboral IS NOT NULL AND email_laboral != '';

-- =============================================
-- CONSTRAINTS Y VALIDACIONES
-- =============================================

-- Agregar check constraints donde falten
DO $$ 
BEGIN
  -- Validar prioridad en tickets
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'tickets_prioridad_check') THEN
    ALTER TABLE tickets 
    ADD CONSTRAINT tickets_prioridad_check 
    CHECK (prioridad IN ('Alta', 'Media', 'Baja'));
  END IF;

  -- Validar estado en solicitudes_vacaciones
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'vacaciones_estado_check') THEN
    ALTER TABLE solicitudes_vacaciones 
    ADD CONSTRAINT vacaciones_estado_check 
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada'));
  END IF;

  -- Validar estado en reservas_espacio
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'reservas_estado_check') THEN
    ALTER TABLE reservas_espacio 
    ADD CONSTRAINT reservas_estado_check 
    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada'));
  END IF;

  -- Validar tipo de chat
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'chats_tipo_check') THEN
    ALTER TABLE chats 
    ADD CONSTRAINT chats_tipo_check 
    CHECK (tipo IN ('directo', 'grupo'));
  END IF;

  -- Validar rol en usuarios
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'usuarios_rol_check') THEN
    ALTER TABLE usuarios 
    ADD CONSTRAINT usuarios_rol_check 
    CHECK (rol IN ('Administrador', 'Gerente', 'Agente', 'Ejecutivo'));
  END IF;
END $$;

-- =============================================
-- FUNCIONES DE UTILIDAD
-- =============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas relevantes
DO $$ 
BEGIN
  -- Tickets
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_tickets_updated_at') THEN
    CREATE TRIGGER trigger_tickets_updated_at
      BEFORE UPDATE ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_updated_at();
  END IF;

  -- Usuarios
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_usuarios_updated_at') THEN
    CREATE TRIGGER trigger_usuarios_updated_at
      BEFORE UPDATE ON usuarios
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_updated_at();
  END IF;

  -- Oficinas
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_oficinas_updated_at') THEN
    CREATE TRIGGER trigger_oficinas_updated_at
      BEFORE UPDATE ON oficinas
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_updated_at();
  END IF;

  -- Contactos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_contactos_updated_at') THEN
    CREATE TRIGGER trigger_contactos_updated_at
      BEFORE UPDATE ON contactos
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_updated_at();
  END IF;
END $$;

-- =============================================
-- COMENTARIOS DESCRIPTIVOS
-- =============================================

COMMENT ON TABLE tickets IS 'Sistema de tickets CRM para solicitudes de soporte interno';
COMMENT ON TABLE chats IS 'Sistema de mensajería interna 1:1 y grupal';
COMMENT ON TABLE solicitudes_vacaciones IS 'Solicitudes y gestión de vacaciones de empleados';
COMMENT ON TABLE seguros_lessons IS 'Lecciones del sistema Seguros Education';
COMMENT ON TABLE publicidad_plantillas IS 'Plantillas personalizables de publicidad';
COMMENT ON TABLE reservas_espacio IS 'Reservas del Espacio JIRO';
COMMENT ON TABLE accesos_nacional IS 'Accesos y credenciales compartidas de Nacional';
COMMENT ON TABLE notificaciones IS 'Notificaciones personales por usuario';
COMMENT ON TABLE contactos IS 'CRM básico de contactos por usuario';

-- =============================================
-- ESTADÍSTICAS Y MANTENIMIENTO
-- =============================================

-- Actualizar estadísticas para mejor rendimiento
ANALYZE usuarios;
ANALYZE tickets;
ANALYZE chats;
ANALYZE chat_mensajes;
ANALYZE notificaciones;
ANALYZE solicitudes_vacaciones;
ANALYZE seguros_lessons;
ANALYZE seguros_progress;
