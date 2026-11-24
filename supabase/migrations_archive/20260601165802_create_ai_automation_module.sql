/*
  # Create AI Automation Module (Automatizacion IA por E-Mail)

  1. New Tables
    - `ia_cuentas_correo` - IONOS email accounts for monitoring
      - `id` (uuid, PK)
      - `nombre` (text) - display name
      - `email` (text, unique) - IONOS email address
      - `password_encrypted` (text) - encrypted password
      - `estado` (text) - activo/inactivo/error
      - `ultima_sincronizacion` (timestamptz) - last sync timestamp
      - `ultimo_error` (text) - last error message
      - `carpetas_incluidas` (text[]) - folders to monitor
      - `carpetas_excluidas` (text[]) - folders to exclude
      - `created_by` (uuid, FK usuarios)
      - Timestamps

    - `ia_robots` - AI robots/agents definitions
      - `id` (uuid, PK)
      - `nombre` (text)
      - `descripcion` (text)
      - `prompt_sistema` (text) - system prompt for classification
      - `prioridad` (int) - execution priority
      - `estado` (text) - activo/pausado/borrador
      - `modo` (text) - simulacion/produccion
      - `canal_correo` (boolean)
      - `canal_whatsapp` (boolean)
      - `canal_notificacion` (boolean)
      - `es_predefinido` (boolean)
      - `codigo` (text) - machine identifier for predefined bots
      - `configuracion` (jsonb) - extra config
      - `created_by` (uuid, FK usuarios)
      - Timestamps

    - `ia_bandeja` - Processed emails (Bandeja IA)
      - `id` (uuid, PK)
      - `cuenta_correo_id` (uuid, FK ia_cuentas_correo)
      - `message_id` (text) - IMAP message ID
      - `asunto` (text)
      - `remitente` (text)
      - `destinatario` (text)
      - `fecha_correo` (timestamptz)
      - `cuerpo_texto` (text)
      - `cuerpo_html` (text)
      - `adjuntos` (jsonb) - array of attachment metadata
      - `robot_id` (uuid, FK ia_robots) - assigned robot
      - `coincidencia_pct` (numeric) - match percentage
      - `razon_clasificacion` (text) - why this robot was chosen
      - `estado_procesamiento` (text) - pendiente/procesando/completado/error/no_clasificado
      - `carpeta_destino` (text) - target folder after processing
      - `resultado` (jsonb) - processing output
      - `expediente_id` (uuid) - linked record
      - Timestamps

    - `ia_bitacora` - Complete audit log
      - `id` (uuid, PK)
      - `correo_id` (uuid, FK ia_bandeja)
      - `robot_id` (uuid, FK ia_robots)
      - `cuenta_correo_id` (uuid, FK ia_cuentas_correo)
      - `accion` (text) - what happened
      - `detalle` (jsonb) - full details
      - `estado` (text) - exito/error/pendiente
      - `error_mensaje` (text)
      - `correos_enviados` (int)
      - `whatsapps_enviados` (int)
      - `tareas_creadas` (int)
      - `comunicados_creados` (int)
      - `registros_modificados` (int)
      - `sicas_consultado` (boolean)
      - `sicas_estado` (text)
      - Timestamps

    - `ia_robot_plantillas` - Templates per robot
      - `id` (uuid, PK)
      - `robot_id` (uuid, FK ia_robots)
      - `canal` (text) - correo/whatsapp/notificacion
      - `nombre` (text)
      - `asunto` (text)
      - `cuerpo` (text) - template body with {{variables}}
      - `activo` (boolean)
      - Timestamps

  2. Security
    - Enable RLS on all tables
    - Admin-only access policies (rol = 'Administrador')
    - Service role full access for edge functions

  3. Indexes
    - ia_bandeja: estado_procesamiento, cuenta_correo_id, robot_id, fecha_correo
    - ia_bitacora: correo_id, robot_id, created_at
    - ia_robots: estado, codigo
*/

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: ia_cuentas_correo
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ia_cuentas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  password_encrypted text NOT NULL,
  estado text NOT NULL DEFAULT 'activo',
  ultima_sincronizacion timestamptz,
  ultimo_error text,
  carpetas_incluidas text[] DEFAULT ARRAY['INBOX'],
  carpetas_excluidas text[] DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_cuentas_correo_estado_check CHECK (estado IN ('activo', 'inactivo', 'error'))
);

ALTER TABLE ia_cuentas_correo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ia_cuentas_correo"
  ON ia_cuentas_correo FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage ia_cuentas_correo"
  ON ia_cuentas_correo FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  );

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: ia_robots
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ia_robots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  prompt_sistema text NOT NULL DEFAULT '',
  prioridad int NOT NULL DEFAULT 50,
  estado text NOT NULL DEFAULT 'borrador',
  modo text NOT NULL DEFAULT 'simulacion',
  canal_correo boolean NOT NULL DEFAULT false,
  canal_whatsapp boolean NOT NULL DEFAULT false,
  canal_notificacion boolean NOT NULL DEFAULT true,
  es_predefinido boolean NOT NULL DEFAULT false,
  codigo text UNIQUE,
  configuracion jsonb DEFAULT '{}',
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_robots_estado_check CHECK (estado IN ('activo', 'pausado', 'borrador')),
  CONSTRAINT ia_robots_modo_check CHECK (modo IN ('simulacion', 'produccion'))
);

ALTER TABLE ia_robots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ia_robots"
  ON ia_robots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage ia_robots"
  ON ia_robots FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ia_robots_estado ON ia_robots(estado);
CREATE INDEX IF NOT EXISTS idx_ia_robots_codigo ON ia_robots(codigo) WHERE codigo IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: ia_bandeja
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ia_bandeja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_correo_id uuid NOT NULL REFERENCES ia_cuentas_correo(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  asunto text NOT NULL DEFAULT '',
  remitente text NOT NULL DEFAULT '',
  destinatario text NOT NULL DEFAULT '',
  fecha_correo timestamptz,
  cuerpo_texto text,
  cuerpo_html text,
  adjuntos jsonb DEFAULT '[]',
  robot_id uuid REFERENCES ia_robots(id) ON DELETE SET NULL,
  coincidencia_pct numeric(5,2) DEFAULT 0,
  razon_clasificacion text,
  estado_procesamiento text NOT NULL DEFAULT 'pendiente',
  carpeta_destino text,
  resultado jsonb DEFAULT '{}',
  expediente_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_bandeja_estado_check CHECK (
    estado_procesamiento IN ('pendiente', 'procesando', 'completado', 'error', 'no_clasificado', 'simulado')
  ),
  CONSTRAINT ia_bandeja_message_unique UNIQUE (cuenta_correo_id, message_id)
);

ALTER TABLE ia_bandeja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ia_bandeja"
  ON ia_bandeja FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read ia_bandeja"
  ON ia_bandeja FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ia_bandeja_estado ON ia_bandeja(estado_procesamiento);
CREATE INDEX IF NOT EXISTS idx_ia_bandeja_cuenta ON ia_bandeja(cuenta_correo_id);
CREATE INDEX IF NOT EXISTS idx_ia_bandeja_robot ON ia_bandeja(robot_id) WHERE robot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_bandeja_fecha ON ia_bandeja(fecha_correo DESC);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: ia_bitacora
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ia_bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo_id uuid REFERENCES ia_bandeja(id) ON DELETE SET NULL,
  robot_id uuid REFERENCES ia_robots(id) ON DELETE SET NULL,
  cuenta_correo_id uuid REFERENCES ia_cuentas_correo(id) ON DELETE SET NULL,
  accion text NOT NULL,
  detalle jsonb DEFAULT '{}',
  estado text NOT NULL DEFAULT 'exito',
  error_mensaje text,
  correos_enviados int NOT NULL DEFAULT 0,
  whatsapps_enviados int NOT NULL DEFAULT 0,
  tareas_creadas int NOT NULL DEFAULT 0,
  comunicados_creados int NOT NULL DEFAULT 0,
  registros_modificados int NOT NULL DEFAULT 0,
  sicas_consultado boolean NOT NULL DEFAULT false,
  sicas_estado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_bitacora_estado_check CHECK (estado IN ('exito', 'error', 'pendiente', 'simulado'))
);

ALTER TABLE ia_bitacora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ia_bitacora"
  ON ia_bitacora FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read ia_bitacora"
  ON ia_bitacora FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ia_bitacora_correo ON ia_bitacora(correo_id) WHERE correo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_bitacora_robot ON ia_bitacora(robot_id) WHERE robot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_bitacora_created ON ia_bitacora(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: ia_robot_plantillas
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ia_robot_plantillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid NOT NULL REFERENCES ia_robots(id) ON DELETE CASCADE,
  canal text NOT NULL,
  nombre text NOT NULL,
  asunto text,
  cuerpo text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_robot_plantillas_canal_check CHECK (canal IN ('correo', 'whatsapp', 'notificacion'))
);

ALTER TABLE ia_robot_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ia_robot_plantillas"
  ON ia_robot_plantillas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage ia_robot_plantillas"
  ON ia_robot_plantillas FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND deleted_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ia_robot_plantillas_robot ON ia_robot_plantillas(robot_id);

-- ═══════════════════════════════════════════════════════════════════
-- SEED: Predefined Robots
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO ia_robots (nombre, descripcion, prompt_sistema, prioridad, estado, modo, canal_correo, canal_whatsapp, canal_notificacion, es_predefinido, codigo) VALUES
(
  'Pólizas por vencer y canceladas',
  'Detecta avisos de vencimiento, cancelación o renovación de pólizas de aseguradoras.',
  'Eres un clasificador de correos especializado en seguros. Tu tarea es identificar correos que contengan avisos de vencimiento de pólizas, cancelaciones, no renovaciones o estados críticos de pólizas. Busca referencias a números de póliza, fechas de vencimiento, avisos de cancelación por falta de pago, o comunicados de no renovación. Responde con un JSON que incluya: coincidencia (0-100), razon, poliza_numero, aseguradora, tipo_aviso (vencimiento/cancelacion/renovacion/critico), fecha_relevante.',
  90, 'borrador', 'simulacion', true, true, true, true, 'polizas_vencer_canceladas'
),
(
  'Comunicados de aseguradoras',
  'Identifica comunicados oficiales, circulares, avisos generales y actualizaciones de aseguradoras.',
  'Eres un clasificador especializado en comunicados de aseguradoras mexicanas. Identifica correos que contengan: circulares, comunicados oficiales, cambios de productos, actualizaciones de cobertura, nuevos lanzamientos, cambios operativos, o avisos institucionales. Responde con un JSON que incluya: coincidencia (0-100), razon, aseguradora, tipo_comunicado (circular/aviso/lanzamiento/operativo/institucional), resumen_breve, requiere_accion (boolean).',
  80, 'borrador', 'simulacion', true, false, true, true, 'comunicados_aseguradoras'
),
(
  'Cobranza y recibos pendientes',
  'Detecta avisos de cobranza, recibos pendientes, estados de cuenta y pagos vencidos.',
  'Eres un clasificador de correos especializado en cobranza de seguros. Identifica correos relacionados con: recibos pendientes de pago, estados de cuenta, avisos de cobranza, pagos vencidos, notificaciones de no pago de clientes. Busca montos, fechas de vencimiento, números de recibo o póliza. Responde con un JSON: coincidencia (0-100), razon, tipo (recibo_pendiente/aviso_cobranza/estado_cuenta/pago_vencido), monto, poliza_numero, cliente_nombre, fecha_vencimiento.',
  85, 'borrador', 'simulacion', true, true, true, true, 'cobranza_recibos'
),
(
  'Siniestros y solicitudes urgentes',
  'Identifica reportes de siniestros, solicitudes urgentes de clientes o aseguradoras.',
  'Eres un clasificador especializado en siniestros de seguros. Identifica correos que reporten: siniestros nuevos, seguimiento de siniestros existentes, solicitudes urgentes de documentación, requerimientos de ajustadores, o comunicaciones de emergencia. Responde con JSON: coincidencia (0-100), razon, tipo (siniestro_nuevo/seguimiento/documentacion/urgente), poliza_numero, cliente_nombre, aseguradora, descripcion_breve, urgencia (alta/media/baja).',
  95, 'borrador', 'simulacion', true, true, true, true, 'siniestros_urgentes'
),
(
  'Actualización de clientes y contactos',
  'Detecta solicitudes de cambio de datos, actualizaciones de información de contacto.',
  'Eres un clasificador de correos que identifica solicitudes de actualización de datos de clientes: cambios de dirección, teléfono, email, beneficiarios, o cualquier modificación de datos personales. También detecta confirmaciones de cambios realizados por aseguradoras. Responde con JSON: coincidencia (0-100), razon, tipo (cambio_direccion/cambio_contacto/cambio_beneficiario/actualizacion_general), cliente_nombre, datos_nuevos.',
  60, 'borrador', 'simulacion', false, false, true, true, 'actualizacion_clientes'
),
(
  'Clasificación documental inteligente',
  'Clasifica documentos adjuntos: pólizas, endosos, recibos, carátulas, condiciones generales.',
  'Eres un clasificador de documentos de seguros. Analiza los adjuntos del correo e identifica: pólizas emitidas, endosos, recibos de pago, carátulas, condiciones generales, certificados, constancias de antigüedad, o documentos operativos. Responde con JSON: coincidencia (0-100), razon, documentos (array con tipo, nombre_archivo, descripcion), aseguradora, requiere_archivo_expediente (boolean).',
  70, 'borrador', 'simulacion', false, false, true, true, 'clasificacion_documental'
),
(
  'Robot Supervisor',
  'Monitorea la salud del sistema, detecta errores recurrentes y genera alertas administrativas.',
  'Eres un supervisor del sistema de automatización por email. Tu tarea es analizar correos que puedan indicar problemas sistémicos: bounces repetidos, errores de entrega, notificaciones de servidores, alertas de seguridad, o patrones anómalos. Responde con JSON: coincidencia (0-100), razon, tipo (bounce/error_sistema/alerta_seguridad/anomalia), severidad (critica/alta/media/baja), accion_recomendada.',
  100, 'borrador', 'simulacion', false, false, true, true, 'robot_supervisor'
)
ON CONFLICT (codigo) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ia_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_cuentas_correo_updated_at') THEN
    CREATE TRIGGER trg_ia_cuentas_correo_updated_at
      BEFORE UPDATE ON ia_cuentas_correo
      FOR EACH ROW EXECUTE FUNCTION ia_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_robots_updated_at') THEN
    CREATE TRIGGER trg_ia_robots_updated_at
      BEFORE UPDATE ON ia_robots
      FOR EACH ROW EXECUTE FUNCTION ia_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_bandeja_updated_at') THEN
    CREATE TRIGGER trg_ia_bandeja_updated_at
      BEFORE UPDATE ON ia_bandeja
      FOR EACH ROW EXECUTE FUNCTION ia_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_robot_plantillas_updated_at') THEN
    CREATE TRIGGER trg_ia_robot_plantillas_updated_at
      BEFORE UPDATE ON ia_robot_plantillas
      FOR EACH ROW EXECUTE FUNCTION ia_set_updated_at();
  END IF;
END $$;
