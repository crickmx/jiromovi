-- ¿Qué notificaciones se disparan de verdad?
-- ==========================================
--
-- La pantalla de Transaccionales lista los tipos de `correo_tipos_notificacion`
-- y los muestra todos igual: activos, con sus canales y sus plantillas. Pero
-- que un tipo exista y esté "activo" no significa que algo lo dispare — de las
-- 6 del grupo Trámites, hoy solo una se manda (`tramite_documento_cargado`).
-- Las otras cinco llevan meses configuradas sin hacer nada, y no había forma
-- de saberlo desde la pantalla.
--
-- Esta vista contesta eso con datos: cuándo fue la última vez que ese código
-- salió, y cuántas veces. Son DOS motores con su propio historial, así que hay
-- que mirar los dos:
--   · `correo_historial_envios`           → motor de correo/WhatsApp por tipo
--   · `transactional_notification_history` → despachador de trámites (event_key)
--
-- `security_invoker` para que herede la RLS real de ambas tablas en vez de
-- crear un permiso nuevo por la puerta de atrás.

CREATE OR REPLACE VIEW public.notificaciones_uso_view
WITH (security_invoker = true) AS
SELECT
  u.codigo,
  MAX(u.ultimo)      AS ultimo_envio,
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
) u
GROUP BY u.codigo;

COMMENT ON VIEW public.notificaciones_uso_view IS
  'Último envío y total por código de notificación, uniendo los dos motores. Sirve para distinguir un tipo que de verdad se usa de uno configurado que nadie dispara.';
