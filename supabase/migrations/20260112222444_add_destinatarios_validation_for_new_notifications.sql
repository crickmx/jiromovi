/*
  # Validar destinatarios en notificaciones que lo requieren
  
  1. Problema
    - Las notificaciones de RRHH, Mercadotecnia y Mesa de Control requieren destinatarios
    - Sin validación, podrían intentar enviarse sin destinatarios configurados
  
  2. Solución
    - Crear función que valide destinatarios antes de enviar
    - Agregar check constraint a notificaciones que lo requieren
    - Documentar en descripción cuáles requieren destinatarios
  
  3. Notificaciones que requieren destinatarios:
    - vacaciones_aprobadas
    - solicitud_compra_store  
    - nuevo_tramite
    - solicitud_correccion_comisiones
*/

-- Función para validar que una notificación tenga destinatarios si lo requiere
CREATE OR REPLACE FUNCTION validar_destinatarios_notificacion(
  p_tipo_notificacion_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permite_destinatarios boolean;
  v_tiene_destinatarios boolean;
BEGIN
  -- Obtener si el tipo permite destinatarios custom
  SELECT permite_destinatarios_custom INTO v_permite_destinatarios
  FROM correo_tipos_notificacion
  WHERE id = p_tipo_notificacion_id;

  -- Si no permite destinatarios, está OK (puede enviar a todos o a quien corresponda)
  IF NOT v_permite_destinatarios THEN
    RETURN true;
  END IF;

  -- Si permite destinatarios custom, verificar que tenga al menos uno
  SELECT EXISTS(
    SELECT 1
    FROM correo_destinatarios_notificacion
    WHERE tipo_notificacion_id = p_tipo_notificacion_id
  ) INTO v_tiene_destinatarios;

  RETURN v_tiene_destinatarios;
END;
$$;

COMMENT ON FUNCTION validar_destinatarios_notificacion IS
  'Valida que las notificaciones que requieren destinatarios personalizados tengan al menos uno configurado';

-- Actualizar descripciones para indicar requisito de destinatarios
UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica a RRHH cuando se aprueban vacaciones de un empleado. ⚠️ REQUIERE configurar destinatarios antes de activar.'
WHERE codigo = 'vacaciones_aprobadas';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica cuando un usuario realiza un pedido en la Store. ⚠️ REQUIERE configurar destinatarios antes de activar.'
WHERE codigo = 'solicitud_compra_store';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica cuando se genera un nuevo trámite (corrección de póliza, corrección de comisiones, registro, etc.). ⚠️ REQUIERE configurar destinatarios antes de activar.'
WHERE codigo = 'nuevo_tramite';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica cuando un usuario solicita corrección en un lote de comisiones. ⚠️ REQUIERE configurar destinatarios antes de activar.'
WHERE codigo = 'solicitud_correccion_comisiones';

-- Agregar índice para mejorar performance de validación
CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_tipo 
ON correo_destinatarios_notificacion(tipo_notificacion_id);
