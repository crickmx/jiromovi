/*
  # Agregar estado de catálogo al historial de sincronización

  1. Cambios en `sicas_sync_history`
    - Agregar campo `catalog_status` para rastrear el estado real del catálogo
    - Estados posibles:
      - 'available': Catálogo sincronizado exitosamente
      - 'not_available': Catálogo no disponible o sin permisos (RESPONSENBR=0)
      - 'denied': Autenticación denegada (RESPONSETXT=DENIED)
      - 'error': Error de conexión, timeout, o parse
    - Agregar campo `response_nbr` para guardar el RESPONSENBR de SICAS
    - Agregar campo `xml_snippet` para auditoría (primeros 1000 chars)

  2. Seguridad
    - Solo admins pueden ver el historial completo
*/

-- Agregar campos de estado
ALTER TABLE sicas_sync_history
ADD COLUMN IF NOT EXISTS catalog_status text
  CHECK (catalog_status IN ('available', 'not_available', 'denied', 'error')),
ADD COLUMN IF NOT EXISTS response_nbr text,
ADD COLUMN IF NOT EXISTS xml_snippet text;

-- Comentarios
COMMENT ON COLUMN sicas_sync_history.catalog_status IS 'Estado del catálogo: available, not_available, denied, error';
COMMENT ON COLUMN sicas_sync_history.response_nbr IS 'RESPONSENBR devuelto por SICAS (0=no disponible, >0=éxito)';
COMMENT ON COLUMN sicas_sync_history.xml_snippet IS 'Primeros 1000 caracteres de la respuesta SOAP para auditoría';
