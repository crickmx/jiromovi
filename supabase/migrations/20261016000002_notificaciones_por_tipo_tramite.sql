-- Canales de notificación por TIPO de trámite
-- ===========================================
--
-- Hoy la configuración de un aviso de trámite es una sola para todos los tipos:
-- `correo_tipos_notificacion` tiene un renglón por evento y ahí se eligen los
-- canales. Dos problemas:
--
--   1. No se puede distinguir por tipo. Un "Cambio de estatus" de Cotización y
--      uno de Registro de Póliza no tienen por qué avisarse igual.
--   2. **El despachador nunca leyó esos botones.** `ticket-notification-dispatcher`
--      no consulta `correo_tipos_notificacion`: manda correo y WhatsApp siempre
--      que el agente los tenga. O sea que apagar "Correo" en la pantalla no
--      apagaba nada. Eso se corrige en la misma entrega que esta tabla.
--
-- Un tipo SIN renglón aquí hereda lo del evento — por eso la tabla nace vacía y
-- nada cambia de comportamiento al correrla.

CREATE TABLE IF NOT EXISTS public.tramite_tipo_notificacion_canales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tipo_id  uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  -- El mismo código que usa `correo_tipos_notificacion.codigo`, que es también
  -- el `event_key` del despachador. Se guarda como texto y no como FK porque
  -- los dos motores identifican el evento por ese texto, no por un id.
  codigo          text NOT NULL,
  enviar_correo   boolean NOT NULL DEFAULT true,
  enviar_whatsapp boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.usuarios(id),
  UNIQUE (ticket_tipo_id, codigo)
);

COMMENT ON TABLE public.tramite_tipo_notificacion_canales IS
  'Excepción por tipo de trámite a los canales de un aviso. Sin renglón, el tipo hereda lo configurado en correo_tipos_notificacion para ese código.';

ALTER TABLE public.tramite_tipo_notificacion_canales ENABLE ROW LEVEL SECURITY;

-- Lectura para cualquier autenticado: la pantalla la consulta, y el despachador
-- entra con service_role. Escritura solo Administrador, igual que el resto de
-- la configuración de notificaciones.
DROP POLICY IF EXISTS tramite_tipo_notif_select ON public.tramite_tipo_notificacion_canales;
CREATE POLICY tramite_tipo_notif_select ON public.tramite_tipo_notificacion_canales
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tramite_tipo_notif_admin ON public.tramite_tipo_notificacion_canales;
CREATE POLICY tramite_tipo_notif_admin ON public.tramite_tipo_notificacion_canales
  FOR ALL TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE INDEX IF NOT EXISTS idx_tramite_tipo_notif_codigo
  ON public.tramite_tipo_notificacion_canales (codigo, ticket_tipo_id);
