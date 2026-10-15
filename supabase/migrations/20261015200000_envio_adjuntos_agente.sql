-- Envío de adjuntos al agente: configuración por tipo de trámite + candado
-- =========================================================================
--
-- Hoy, cuando una notificación de trámite lleva adjuntos y no se le pasa una
-- lista específica, el despachador adjunta TODOS los archivos del trámite. Con
-- cada cambio de estatus el agente recibe otra vez lo mismo, y recibe también
-- lo que era de uso interno.
--
-- Dos piezas para arreglarlo:
--   1. Por tipo de trámite se elige QUÉ categorías de adjunto salen solas y por
--      qué canales. Un tipo sin configurar no manda nada automáticamente.
--   2. Un candado: un archivo que ya se envió con éxito no se vuelve a mandar
--      solo. El botón de reenviar del detalle del trámite sí lo ignora — si
--      alguien lo presiona, es a propósito.

ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS envio_adjuntos_canales text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS envio_adjuntos_categorias_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ticket_tipos.envio_adjuntos_canales IS
  'Canales por los que este tipo manda adjuntos al agente: whatsapp, correo. Vacío = no manda adjuntos automáticamente.';
COMMENT ON COLUMN public.ticket_tipos.envio_adjuntos_categorias_ids IS
  'Categorías de maestro_adjunto_categorias que salen solas al adjuntarse. Vacío = ninguna.';

-- El log ya registraba por nombre de archivo. El nombre se repite entre
-- trámites y cambia si alguien renombra, así que para el candado hace falta el
-- id real del archivo.
ALTER TABLE public.notification_attachments_log
  ADD COLUMN IF NOT EXISTS archivo_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_attachments_log_archivo_id_fkey'
  ) THEN
    ALTER TABLE public.notification_attachments_log
      ADD CONSTRAINT notification_attachments_log_archivo_id_fkey
      FOREIGN KEY (archivo_id) REFERENCES public.ticket_archivos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Lo ya enviado se reconoce por id de aquí en adelante; para las filas viejas
-- se rellena emparejando por nombre dentro del MISMO trámite, que es justo la
-- comparación que el candado quiere hacer.
UPDATE public.notification_attachments_log l
SET archivo_id = a.id
FROM public.ticket_archivos a
WHERE l.archivo_id IS NULL
  AND a.ticket_id = l.ticket_id
  AND a.nombre = l.file_name;

CREATE INDEX IF NOT EXISTS idx_notif_attach_log_enviados
  ON public.notification_attachments_log (ticket_id, archivo_id)
  WHERE sent_successfully;
