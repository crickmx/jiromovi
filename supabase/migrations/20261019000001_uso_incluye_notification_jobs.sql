-- La marca de "se envió / nunca se ha disparado" miraba dos de los TRES motores
-- =========================================================================
--
-- `notificaciones_uso_view` (16/10) unía `correo_historial_envios` y
-- `transactional_notification_history`. Falta el tercero, y es justo el de los
-- avisos de trámite que salen por trigger de base:
--
--   trigger → notify_tramite_recipients → enviar_notificacion_transaccional
--           → notification_jobs → el cron `notification-dispatcher` los manda
--
-- Esos envíos no dejan huella en ninguna de las dos tablas anteriores, así que
-- la pantalla marcaba "Nunca se ha disparado" sobre avisos que llevan meses
-- saliendo todos los días. Una marca equivocada ahí es peor que no tenerla:
-- invita a apagar algo que sí sirve.

CREATE OR REPLACE VIEW public.notificaciones_uso_view
WITH (security_invoker = true) AS
SELECT
  u.codigo,
  MAX(u.ultimo)        AS ultimo_envio,
  SUM(u.total)::bigint AS envios
FROM (
  SELECT tipo_notificacion_codigo AS codigo, MAX(created_at) AS ultimo, COUNT(*) AS total
  FROM public.correo_historial_envios
  WHERE tipo_notificacion_codigo IS NOT NULL
  GROUP BY 1
  UNION ALL
  SELECT event_key AS codigo, MAX(created_at) AS ultimo, COUNT(*) AS total
  FROM public.transactional_notification_history
  WHERE event_key IS NOT NULL
  GROUP BY 1
  UNION ALL
  -- Solo los que de verdad salieron: un job en 'pending' o 'failed' no es un
  -- envío, y contarlo diría que el aviso funciona cuando quizá lleva semanas
  -- atorado.
  SELECT event_code AS codigo, MAX(COALESCE(sent_at, updated_at)) AS ultimo, COUNT(*) AS total
  FROM public.notification_jobs
  WHERE event_code IS NOT NULL AND status = 'sent'
  GROUP BY 1
) u
GROUP BY u.codigo;

COMMENT ON VIEW public.notificaciones_uso_view IS
  'Último envío y total por código de notificación, uniendo los TRES motores: correo_historial_envios, transactional_notification_history y notification_jobs (solo status=sent).';
