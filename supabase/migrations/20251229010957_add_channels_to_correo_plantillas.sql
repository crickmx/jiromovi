/*
  # Agregar Canales de Notificación a Plantillas Transaccionales

  ## Descripción
  Permite que cada plantilla transaccional tenga su propia configuración de canales
  de notificación (correo, whatsapp, notificación interna), sobrescribiendo la
  configuración del tipo de notificación si está definida.

  ## Cambios
  1. Agregar columnas de canales a correo_plantillas:
    - enviar_correo (boolean, default true)
    - enviar_whatsapp (boolean, default false)
    - enviar_notificacion (boolean, default true)

  2. Estas columnas sobrescriben la configuración del tipo si están definidas

  3. Mantener backward compatibility: si no se especifican, se usan los valores del tipo

  ## Seguridad
  - Los flags por plantilla permiten control granular
  - Mantiene compatibilidad con sistema existente
*/

-- Agregar columnas de canales a correo_plantillas
ALTER TABLE correo_plantillas
ADD COLUMN IF NOT EXISTS enviar_correo boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enviar_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enviar_notificacion boolean DEFAULT true;

-- Índices para mejorar performance en consultas
CREATE INDEX IF NOT EXISTS idx_correo_plantillas_canales
  ON correo_plantillas (enviar_correo, enviar_whatsapp, enviar_notificacion);

-- Comentarios para documentar
COMMENT ON COLUMN correo_plantillas.enviar_correo IS
  'Si está definido, sobrescribe la configuración del tipo de notificación para esta plantilla';
COMMENT ON COLUMN correo_plantillas.enviar_whatsapp IS
  'Si está definido, sobrescribe la configuración del tipo de notificación para esta plantilla';
COMMENT ON COLUMN correo_plantillas.enviar_notificacion IS
  'Si está definido, sobrescribe la configuración del tipo de notificación para esta plantilla';

-- Establecer valores por defecto para plantillas existentes basándose en el tipo
UPDATE correo_plantillas p
SET
  enviar_correo = COALESCE(t.enviar_correo, true),
  enviar_whatsapp = COALESCE(t.enviar_whatsapp, false),
  enviar_notificacion = COALESCE(t.enviar_notificacion, true)
FROM correo_tipos_notificacion t
WHERE p.tipo_notificacion_id = t.id;
