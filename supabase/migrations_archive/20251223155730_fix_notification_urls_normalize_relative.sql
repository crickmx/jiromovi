/*
  # Fix: Normalizar URLs de notificaciones a rutas relativas

  1. Problema
    - URLs de comunicados tienen dominio absoluto (app.movi.digital o webcontainer)
    - URLs de trámites son null
    - Esto causa páginas en blanco al hacer clic en notificaciones

  2. Solución
    - Extraer solo la ruta relativa de URLs absolutas
    - Agregar URLs de trámites usando el folio del mensaje
    - Todas las URLs ahora serán relativas (/comunicados/..., /tramites/...)

  3. Seguridad
    - Solo actualiza notificaciones existentes
    - No afecta permisos
*/

-- Normalizar URLs de comunicados (quitar dominio)
UPDATE notificaciones
SET accion_url = REGEXP_REPLACE(accion_url, '^https?://[^/]+', '')
WHERE accion_url LIKE 'http%'
  AND modulo = 'Comunicados';

-- Agregar URLs a notificaciones de trámites que no la tienen
-- Extraer el folio del mensaje y buscar el ticket_id
UPDATE notificaciones n
SET accion_url = '/tramites/' || t.id
FROM tickets t
WHERE n.accion_url IS NULL
  AND n.titulo LIKE '%trámite%'
  AND n.mensaje LIKE '%' || t.folio || '%'
  AND t.folio IS NOT NULL;

-- Para notificaciones de trámites sin match directo, intentar match por agente y fecha cercana
UPDATE notificaciones n
SET accion_url = '/tramites/' || t.id
FROM tickets t
WHERE n.accion_url IS NULL
  AND n.titulo LIKE '%trámite%'
  AND t.agente_id = n.usuario_id
  AND ABS(EXTRACT(EPOCH FROM (t.fecha_creacion - n.created_at))) < 60
  AND NOT EXISTS (
    SELECT 1 FROM notificaciones n2 
    WHERE n2.accion_url = '/tramites/' || t.id
  );

-- Crear función para generar URL de trámite al crear notificación
CREATE OR REPLACE FUNCTION generate_ticket_notification_url()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si es una notificación de trámite sin URL, extraer folio y buscar ticket
  IF NEW.titulo LIKE '%trámite%' AND NEW.accion_url IS NULL THEN
    -- Intentar extraer folio del mensaje (formato TKXXXXX)
    DECLARE
      folio_match TEXT;
      ticket_id_found UUID;
    BEGIN
      -- Buscar patrón TK seguido de números/letras
      folio_match := (regexp_matches(NEW.mensaje, 'TK[A-Z0-9]+'))[1];
      
      IF folio_match IS NOT NULL THEN
        -- Buscar el ticket con ese folio
        SELECT id INTO ticket_id_found
        FROM tickets
        WHERE folio = folio_match
        LIMIT 1;
        
        IF ticket_id_found IS NOT NULL THEN
          NEW.accion_url := '/tramites/' || ticket_id_found;
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para generar URL automáticamente en notificaciones nuevas de trámites
DROP TRIGGER IF EXISTS set_ticket_notification_url ON notificaciones;
CREATE TRIGGER set_ticket_notification_url
  BEFORE INSERT ON notificaciones
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_notification_url();