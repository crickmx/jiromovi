/*
  # Sistema Completo de Aula Virtual

  ## Descripción General
  Sistema completo de videoconferencia en tiempo real con WebRTC, grabación,
  gestión de participantes y conversión automática a contenido On Demand.

  ## 1. Nuevas Tablas

  ### `aula_virtual_sesiones`
  Gestión de sesiones de videoconferencia en tiempo real
  - Integración con WebRTC para video en vivo
  - Generación de enlaces únicos para sala e invitados
  - Control de estado de sesión en tiempo real
  
  ### `aula_virtual_participantes`
  Control granular de acceso y permisos por participante
  
  ### `aula_virtual_grabaciones`
  Gestión de grabaciones con conversión automática a On Demand
  
  ### `aula_virtual_chat`
  Chat en tiempo real durante las sesiones
  
  ### `aula_virtual_eventos`
  Analytics y log de eventos de la sesión

  ## 2. Storage
  - Bucket `aula-grabaciones` para almacenar grabaciones

  ## 3. Seguridad
  - RLS completo en todas las tablas
  - Control de acceso por rol y participación
  - Enlaces únicos seguros con tokens
*/

-- ============================================================================
-- TABLAS PRINCIPALES
-- ============================================================================

-- Tabla principal de sesiones del Aula Virtual
CREATE TABLE IF NOT EXISTS aula_virtual_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  instructor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  duracion_minutos integer NOT NULL DEFAULT 60,
  esta_activa boolean DEFAULT false,
  iniciada_at timestamptz,
  finalizada_at timestamptz,
  grabar_sesion boolean DEFAULT true,
  enlace_sala text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  enlace_invitado text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  max_participantes integer DEFAULT 50,
  room_id text UNIQUE,
  estado text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'en_vivo', 'finalizada', 'cancelada')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fecha_fin_despues_inicio CHECK (fecha_fin > fecha_inicio)
);

COMMENT ON TABLE aula_virtual_sesiones IS 'Sesiones de videoconferencia en tiempo real con WebRTC';
COMMENT ON COLUMN aula_virtual_sesiones.enlace_sala IS 'Token único para acceder a la sala principal';
COMMENT ON COLUMN aula_virtual_sesiones.enlace_invitado IS 'Token único para invitados externos';
COMMENT ON COLUMN aula_virtual_sesiones.room_id IS 'ID de la sala en el servidor WebRTC';

-- Participantes de las sesiones
CREATE TABLE IF NOT EXISTS aula_virtual_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES aula_virtual_sesiones(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_invitado text,
  email_invitado text,
  rol_participante text NOT NULL DEFAULT 'participante' CHECK (rol_participante IN ('instructor', 'participante', 'invitado')),
  puede_compartir_pantalla boolean DEFAULT false,
  puede_hablar boolean DEFAULT true,
  puede_video boolean DEFAULT true,
  ingreso_at timestamptz,
  salida_at timestamptz,
  duracion_conexion_segundos integer DEFAULT 0,
  peer_id text,
  estado_conexion text DEFAULT 'desconectado' CHECK (estado_conexion IN ('conectado', 'desconectado', 'expulsado')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT usuario_o_invitado CHECK (usuario_id IS NOT NULL OR (nombre_invitado IS NOT NULL AND email_invitado IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_participantes_sesion_estado ON aula_virtual_participantes(sesion_id, estado_conexion);
CREATE INDEX IF NOT EXISTS idx_participantes_usuario ON aula_virtual_participantes(usuario_id);

-- Grabaciones de sesiones
CREATE TABLE IF NOT EXISTS aula_virtual_grabaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES aula_virtual_sesiones(id) ON DELETE CASCADE,
  archivo_original_url text,
  archivo_procesado_url text,
  miniatura_url text,
  duracion_segundos integer,
  tamano_bytes bigint,
  formato_original text DEFAULT 'webm',
  formato_procesado text DEFAULT 'mp4',
  estado_procesamiento text NOT NULL DEFAULT 'grabando' CHECK (estado_procesamiento IN ('grabando', 'procesando', 'completado', 'error')),
  iniciado_at timestamptz DEFAULT now(),
  completado_at timestamptz,
  error_mensaje text,
  publicado_ondemand boolean DEFAULT false,
  leccion_ondemand_id uuid REFERENCES seguros_lessons(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grabaciones_sesion ON aula_virtual_grabaciones(sesion_id);
CREATE INDEX IF NOT EXISTS idx_grabaciones_estado ON aula_virtual_grabaciones(estado_procesamiento);

-- Chat de la sesión
CREATE TABLE IF NOT EXISTS aula_virtual_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES aula_virtual_sesiones(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES aula_virtual_participantes(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  es_privado boolean DEFAULT false,
  destinatario_id uuid REFERENCES aula_virtual_participantes(id) ON DELETE SET NULL,
  enviado_at timestamptz DEFAULT now(),
  editado_at timestamptz,
  eliminado boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_chat_sesion ON aula_virtual_chat(sesion_id, enviado_at DESC);

-- Log de eventos para analytics
CREATE TABLE IF NOT EXISTS aula_virtual_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES aula_virtual_sesiones(id) ON DELETE CASCADE,
  participante_id uuid REFERENCES aula_virtual_participantes(id) ON DELETE SET NULL,
  tipo_evento text NOT NULL,
  datos_evento jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_sesion ON aula_virtual_eventos(sesion_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON aula_virtual_eventos(tipo_evento);

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('aula-grabaciones', 'aula-grabaciones', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aula_sesiones_updated_at ON aula_virtual_sesiones;
CREATE TRIGGER aula_sesiones_updated_at
  BEFORE UPDATE ON aula_virtual_sesiones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Calcular duración de conexión automáticamente
CREATE OR REPLACE FUNCTION calcular_duracion_conexion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.salida_at IS NOT NULL AND NEW.ingreso_at IS NOT NULL THEN
    NEW.duracion_conexion_segundos = EXTRACT(EPOCH FROM (NEW.salida_at - NEW.ingreso_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calcular_duracion_participante ON aula_virtual_participantes;
CREATE TRIGGER calcular_duracion_participante
  BEFORE UPDATE ON aula_virtual_participantes
  FOR EACH ROW
  WHEN (NEW.salida_at IS NOT NULL AND OLD.salida_at IS NULL)
  EXECUTE FUNCTION calcular_duracion_conexion();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE aula_virtual_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_virtual_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_virtual_grabaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_virtual_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_virtual_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas para aula_virtual_sesiones
CREATE POLICY "Usuarios pueden ver sesiones donde participan"
  ON aula_virtual_sesiones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE aula_virtual_participantes.sesion_id = aula_virtual_sesiones.id
      AND aula_virtual_participantes.usuario_id = auth.uid()
    )
    OR instructor_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Instructores y admins pueden crear sesiones"
  ON aula_virtual_sesiones FOR INSERT
  TO authenticated
  WITH CHECK (
    instructor_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Instructores y admins pueden actualizar sus sesiones"
  ON aula_virtual_sesiones FOR UPDATE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Instructores y admins pueden eliminar sus sesiones"
  ON aula_virtual_sesiones FOR DELETE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

-- Políticas para aula_virtual_participantes
CREATE POLICY "Usuarios pueden ver participantes de sus sesiones"
  ON aula_virtual_participantes FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM aula_virtual_sesiones
      WHERE aula_virtual_sesiones.id = aula_virtual_participantes.sesion_id
      AND aula_virtual_sesiones.instructor_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Sistema puede insertar participantes"
  ON aula_virtual_participantes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Participantes pueden actualizar su propio estado"
  ON aula_virtual_participantes FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador');

-- Políticas para aula_virtual_grabaciones
CREATE POLICY "Usuarios pueden ver grabaciones de sus sesiones"
  ON aula_virtual_grabaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE aula_virtual_participantes.sesion_id = aula_virtual_grabaciones.sesion_id
      AND aula_virtual_participantes.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM aula_virtual_sesiones
      WHERE aula_virtual_sesiones.id = aula_virtual_grabaciones.sesion_id
      AND aula_virtual_sesiones.instructor_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Sistema puede gestionar grabaciones"
  ON aula_virtual_grabaciones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para aula_virtual_chat
CREATE POLICY "Participantes pueden ver chat de su sesión"
  ON aula_virtual_chat FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE aula_virtual_participantes.sesion_id = aula_virtual_chat.sesion_id
      AND aula_virtual_participantes.usuario_id = auth.uid()
      AND aula_virtual_participantes.estado_conexion = 'conectado'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Participantes pueden enviar mensajes"
  ON aula_virtual_chat FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE aula_virtual_participantes.id = aula_virtual_chat.participante_id
      AND aula_virtual_participantes.usuario_id = auth.uid()
      AND aula_virtual_participantes.estado_conexion = 'conectado'
    )
  );

-- Políticas para aula_virtual_eventos
CREATE POLICY "Usuarios pueden ver eventos de sus sesiones"
  ON aula_virtual_eventos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE aula_virtual_participantes.sesion_id = aula_virtual_eventos.sesion_id
      AND aula_virtual_participantes.usuario_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

CREATE POLICY "Sistema puede registrar eventos"
  ON aula_virtual_eventos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

CREATE POLICY "Usuarios pueden ver grabaciones públicas"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'aula-grabaciones');

CREATE POLICY "Sistema puede subir grabaciones"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'aula-grabaciones');

CREATE POLICY "Sistema puede actualizar grabaciones"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'aula-grabaciones');

CREATE POLICY "Admins pueden eliminar grabaciones"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'aula-grabaciones'
    AND (auth.jwt() -> 'app_metadata' ->> 'rol')::text = 'Administrador'
  );

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

DO $$
DECLARE
  v_instructor_id uuid;
  v_sesion_id uuid;
BEGIN
  SELECT id INTO v_instructor_id
  FROM usuarios
  WHERE rol = 'Administrador'
  LIMIT 1;

  IF v_instructor_id IS NOT NULL THEN
    INSERT INTO aula_virtual_sesiones (
      titulo,
      descripcion,
      instructor_id,
      fecha_inicio,
      fecha_fin,
      duracion_minutos,
      grabar_sesion,
      max_participantes,
      estado
    ) VALUES (
      'Introducción a Seguros de Vida',
      'Sesión inicial del programa Seguros Education. Aprenderemos los conceptos básicos de seguros de vida y sus beneficios.',
      v_instructor_id,
      now() + interval '2 hours',
      now() + interval '3 hours',
      60,
      true,
      30,
      'programada'
    ) RETURNING id INTO v_sesion_id;

    INSERT INTO aula_virtual_participantes (
      sesion_id,
      usuario_id,
      rol_participante,
      puede_compartir_pantalla,
      puede_hablar,
      puede_video
    ) VALUES (
      v_sesion_id,
      v_instructor_id,
      'instructor',
      true,
      true,
      true
    );
  END IF;
END $$;
