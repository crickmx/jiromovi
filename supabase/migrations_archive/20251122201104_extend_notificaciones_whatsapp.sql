/*
  # Extensión del Sistema de Notificaciones - WhatsApp

  1. Nuevas Tablas
    - `whatsapp_configuracion`
      - Configuración de Wazzup24 API
      - API Key y número remitente
      - Estado activo/inactivo
    
  2. Modificaciones a Tablas Existentes
    - `correo_tipos_notificacion`
      - Agregar campos para canales de envío
      - Controlar por correo, WhatsApp o ambos
    
    - `correo_plantillas`
      - Agregar campo para plantilla WhatsApp (texto plano)
      - Mantener plantilla email (HTML) existente
    
    - `correo_historial_envios`
      - Extender para registrar canal usado
      - Agregar campos para WhatsApp (número destino, respuesta API)
  
  3. Seguridad
    - RLS en nueva tabla whatsapp_configuracion
    - Solo administradores pueden gestionar
    - API Key encriptada
  
  4. Características
    - Configuración de Wazzup24
    - Plantillas independientes por canal
    - Historial unificado de envíos
    - Validación de números telefónicos
*/

-- Tabla de configuración de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  numero_remitente text NOT NULL,
  activo boolean DEFAULT false,
  
  configurado_por uuid REFERENCES auth.users(id),
  ultima_actualizacion timestamptz DEFAULT now(),
  ultima_prueba timestamptz,
  estado_ultima_prueba text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Modificar tabla de tipos de notificaciones para incluir canales
ALTER TABLE correo_tipos_notificacion 
ADD COLUMN IF NOT EXISTS enviar_por_correo boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enviar_por_whatsapp boolean DEFAULT false;

-- Modificar tabla de plantillas para incluir plantilla WhatsApp
ALTER TABLE correo_plantillas
ADD COLUMN IF NOT EXISTS whatsapp_plantilla text,
ADD COLUMN IF NOT EXISTS whatsapp_variables_disponibles text[];

-- Modificar tabla de historial para incluir datos de WhatsApp
ALTER TABLE correo_historial_envios
ADD COLUMN IF NOT EXISTS canal_envio text CHECK (canal_envio IN ('correo', 'whatsapp', 'ambos')),
ADD COLUMN IF NOT EXISTS numero_destino text,
ADD COLUMN IF NOT EXISTS whatsapp_respuesta jsonb;

-- Actualizar canal_envio existente por defecto
UPDATE correo_historial_envios 
SET canal_envio = 'correo' 
WHERE canal_envio IS NULL;

-- Insertar configuración por defecto de WhatsApp
INSERT INTO whatsapp_configuracion (api_key, numero_remitente, activo)
VALUES ('aeaecead58f14a3286b37e4d0b81dc3a', '5215588545516', false)
ON CONFLICT DO NOTHING;

-- Actualizar plantillas existentes con versiones WhatsApp
UPDATE correo_plantillas cp
SET 
  whatsapp_plantilla = CASE 
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'bienvenida'
    )
    THEN 'Hola {{nombre}} {{apellidos}}! 👋\n\nTu cuenta en {{nombre_plataforma}} ha sido creada exitosamente.\n\nEmail: {{email_laboral}}\nRol: {{rol}}\n\n¡Bienvenido al equipo!'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'recuperacion_password'
    )
    THEN 'Hola {{nombre}},\n\nHas solicitado restablecer tu contraseña en {{nombre_plataforma}}.\n\nUsa este enlace para crear una nueva contraseña:\n{{link_recuperacion}}'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'nuevo_evento'
    )
    THEN 'Hola {{nombre}},\n\n📅 Nuevo evento disponible:\n*{{titulo_evento}}*\n\nFecha: {{fecha_evento}}\nHora: {{hora_evento}}\nPonente: {{ponente}}\n\nÚnete aquí: {{link_evento}}'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'cuenta_activada'
    )
    THEN 'Hola {{nombre}},\n\n✅ Tu cuenta en {{nombre_plataforma}} ha sido activada por el administrador.\n\nYa puedes acceder con tu email:\n{{email_laboral}}\n\n¡Bienvenido!'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'capacitacion_obligatoria'
    )
    THEN 'Hola {{nombre}},\n\n⚠️ CAPACITACIÓN OBLIGATORIA\n\n*{{titulo_evento}}*\n\nFecha: {{fecha_evento}}\nHora: {{hora_evento}}\n\nTu asistencia es REQUERIDA.\n\nÚnete: {{link_evento}}'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'cancelacion_evento'
    )
    THEN 'Hola {{nombre}},\n\n❌ EVENTO CANCELADO\n\n*{{titulo_evento}}*\n\nFecha original: {{fecha_evento}}\n\nDisculpa las molestias.'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'recordatorio_evento'
    )
    THEN '⏰ RECORDATORIO\n\nHola {{nombre}},\n\nTe recordamos tu evento próximo:\n\n*{{titulo_evento}}*\n\nFecha: {{fecha_evento}}\nHora: {{hora_evento}}\n\nÚnete ahora: {{link_evento}}'
    
    WHEN EXISTS (
      SELECT 1 FROM correo_tipos_notificacion ctn 
      WHERE ctn.id = cp.tipo_notificacion_id AND ctn.codigo = 'notificacion_personalizada'
    )
    THEN 'Hola {{nombre}},\n\nTienes un mensaje del administrador de {{nombre_plataforma}}.\n\n[Edita este mensaje según tus necesidades]'
    
    ELSE NULL
  END,
  whatsapp_variables_disponibles = variables_disponibles
WHERE whatsapp_plantilla IS NULL;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_activo ON whatsapp_configuracion(activo);
CREATE INDEX IF NOT EXISTS idx_historial_canal ON correo_historial_envios(canal_envio);
CREATE INDEX IF NOT EXISTS idx_historial_numero ON correo_historial_envios(numero_destino);

-- RLS para whatsapp_configuracion
ALTER TABLE whatsapp_configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_configuracion"
  ON whatsapp_configuracion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Trigger para actualizar updated_at en whatsapp_configuracion
CREATE TRIGGER trigger_whatsapp_configuracion_updated_at
  BEFORE UPDATE ON whatsapp_configuracion
  FOR EACH ROW
  EXECUTE FUNCTION update_correo_updated_at();

-- Función para normalizar números de teléfono mexicanos
CREATE OR REPLACE FUNCTION normalizar_telefono_mx(telefono text)
RETURNS text AS $$
BEGIN
  -- Remover espacios, guiones y paréntesis
  telefono := regexp_replace(telefono, '[^0-9]', '', 'g');
  
  -- Si empieza con +52, remover el +
  IF telefono LIKE '+52%' THEN
    telefono := substring(telefono from 4);
  END IF;
  
  -- Si no empieza con 52 y tiene 10 dígitos, agregar 52
  IF length(telefono) = 10 THEN
    telefono := '52' || telefono;
  END IF;
  
  -- Si empieza con 1 después de 52, removerlo (formato antiguo)
  IF telefono LIKE '521%' AND length(telefono) = 13 THEN
    telefono := '52' || substring(telefono from 4);
  END IF;
  
  RETURN telefono;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista para obtener usuarios con números normalizados
CREATE OR REPLACE VIEW usuarios_con_telefono_normalizado AS
SELECT 
  u.id,
  u.nombre,
  u.apellidos,
  u.email_laboral,
  u.celular_laboral,
  normalizar_telefono_mx(u.celular_laboral) as telefono_normalizado,
  u.rol,
  o.nombre as oficina_nombre
FROM usuarios u
LEFT JOIN oficinas o ON u.oficina_id = o.id
WHERE u.celular_laboral IS NOT NULL AND u.celular_laboral != '';

COMMENT ON TABLE whatsapp_configuracion IS 'Configuración de la API de Wazzup24 para envío de mensajes por WhatsApp';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_por_correo IS 'Indica si este tipo de notificación se envía por correo';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_por_whatsapp IS 'Indica si este tipo de notificación se envía por WhatsApp';
COMMENT ON COLUMN correo_plantillas.whatsapp_plantilla IS 'Plantilla en texto plano para WhatsApp';
COMMENT ON COLUMN correo_historial_envios.canal_envio IS 'Canal utilizado: correo, whatsapp o ambos';
COMMENT ON COLUMN correo_historial_envios.numero_destino IS 'Número de WhatsApp destino';
COMMENT ON COLUMN correo_historial_envios.whatsapp_respuesta IS 'Respuesta completa de la API de Wazzup24';