/*
  # Configuración de Canales para Notificaciones Transaccionales

  1. Cambios en Tablas Existentes
    - `correo_tipos_notificacion`
      - Añade columnas para control de canales: enviar_correo, enviar_whatsapp, enviar_notificacion
      - Por defecto: whatsapp=true, notificacion=true, correo=false
      - Solo administrador puede cambiar estas configuraciones

  2. Nuevas Características
    - Control granular de canales por tipo de notificación
    - Valores por defecto configurables
    - Interfaz para que admin cambie la configuración
    - Historial de cambios en configuración

  3. Seguridad
    - Solo administradores pueden modificar configuración de canales
    - Auditoría de cambios
    - Validación de al menos un canal activo
*/

-- Agregar columnas de configuración de canales a correo_tipos_notificacion
ALTER TABLE correo_tipos_notificacion
ADD COLUMN IF NOT EXISTS enviar_correo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enviar_whatsapp boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enviar_notificacion boolean DEFAULT true;

-- Agregar constraint para asegurar que al menos un canal esté activo
ALTER TABLE correo_tipos_notificacion
ADD CONSTRAINT check_al_menos_un_canal
CHECK (enviar_correo = true OR enviar_whatsapp = true OR enviar_notificacion = true);

-- Actualizar tipos existentes con valores por defecto
UPDATE correo_tipos_notificacion
SET
  enviar_correo = false,
  enviar_whatsapp = true,
  enviar_notificacion = true
WHERE enviar_correo IS NULL;

-- Tabla de historial de cambios en configuración de canales
CREATE TABLE IF NOT EXISTS correo_canales_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_notificacion_id uuid REFERENCES correo_tipos_notificacion(id) ON DELETE CASCADE,

  -- Valores anteriores
  enviar_correo_anterior boolean,
  enviar_whatsapp_anterior boolean,
  enviar_notificacion_anterior boolean,

  -- Valores nuevos
  enviar_correo_nuevo boolean,
  enviar_whatsapp_nuevo boolean,
  enviar_notificacion_nuevo boolean,

  -- Metadatos
  cambiado_por uuid REFERENCES auth.users(id),
  motivo text,
  fecha_cambio timestamptz DEFAULT now(),

  created_at timestamptz DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_canales_historial_tipo ON correo_canales_historial(tipo_notificacion_id);
CREATE INDEX IF NOT EXISTS idx_canales_historial_fecha ON correo_canales_historial(fecha_cambio DESC);

-- RLS para historial de canales
ALTER TABLE correo_canales_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view canales historial"
  ON correo_canales_historial
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "System can insert canales historial"
  ON correo_canales_historial
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Función para registrar cambios en canales
CREATE OR REPLACE FUNCTION registrar_cambio_canales()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si realmente cambió algo
  IF (OLD.enviar_correo IS DISTINCT FROM NEW.enviar_correo OR
      OLD.enviar_whatsapp IS DISTINCT FROM NEW.enviar_whatsapp OR
      OLD.enviar_notificacion IS DISTINCT FROM NEW.enviar_notificacion) THEN

    INSERT INTO correo_canales_historial (
      tipo_notificacion_id,
      enviar_correo_anterior,
      enviar_whatsapp_anterior,
      enviar_notificacion_anterior,
      enviar_correo_nuevo,
      enviar_whatsapp_nuevo,
      enviar_notificacion_nuevo,
      cambiado_por
    ) VALUES (
      NEW.id,
      OLD.enviar_correo,
      OLD.enviar_whatsapp,
      OLD.enviar_notificacion,
      NEW.enviar_correo,
      NEW.enviar_whatsapp,
      NEW.enviar_notificacion,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar cambios
CREATE TRIGGER trigger_registrar_cambio_canales
  AFTER UPDATE ON correo_tipos_notificacion
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_canales();

-- Actualizar historial de envíos para incluir información de canales
ALTER TABLE correo_historial_envios
ADD COLUMN IF NOT EXISTS canal_envio text CHECK (canal_envio IN ('correo', 'whatsapp', 'notificacion'));

-- Crear índice para canal de envío
CREATE INDEX IF NOT EXISTS idx_historial_canal ON correo_historial_envios(canal_envio);

-- Comentarios para documentación
COMMENT ON COLUMN correo_tipos_notificacion.enviar_correo IS 'Si está activo, envía notificaciones por correo electrónico';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_whatsapp IS 'Si está activo, envía notificaciones por WhatsApp (default: true)';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_notificacion IS 'Si está activo, envía notificaciones internas (campanita) (default: true)';
COMMENT ON TABLE correo_canales_historial IS 'Registro de cambios en la configuración de canales de notificación';