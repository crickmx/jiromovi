-- ============================================================================
-- MOVI Store: confirmación por correo y WhatsApp de pedidos públicos
-- ----------------------------------------------------------------------------
-- Al crear un pedido público (tienda.movi.digital, sin sesión) se llama por
-- pg_net a la edge function `store-confirmar-pedido-publico`, que escribe al
-- correo y WhatsApp capturados. pg_net despacha después del COMMIT, así que el
-- detalle del pedido ya existe cuando la función lo lee.
-- El texto se edita en Notificaciones transaccionales
-- (event_key = store_pedido_publico_confirmacion).
-- ============================================================================

ALTER TABLE store_pedidos
  ADD COLUMN IF NOT EXISTS confirmacion_enviada_en timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacion_email_ok boolean,
  ADD COLUMN IF NOT EXISTS confirmacion_whatsapp_ok boolean,
  ADD COLUMN IF NOT EXISTS confirmacion_error text;

CREATE OR REPLACE FUNCTION public.store_pedido_publico_confirmar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/store-confirmar-pedido-publico',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('pedido_id', NEW.id)
    );
  EXCEPTION WHEN others THEN
    -- Nunca bloquear el pedido por un fallo al avisar
    RAISE WARNING 'Confirmación de pedido público no enviada: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_pedido_publico_confirmar ON store_pedidos;
CREATE TRIGGER trg_store_pedido_publico_confirmar
  AFTER INSERT ON store_pedidos
  FOR EACH ROW
  WHEN (NEW.es_publico)
  EXECUTE FUNCTION public.store_pedido_publico_confirmar();

-- Plantilla editable (mismas variables que usa la edge function)
INSERT INTO transactional_notification_templates
  (event_key, name, platform, event_type, is_active,
   email_subject_template, email_body_template, whatsapp_body_template)
SELECT
  'store_pedido_publico_confirmacion',
  'Confirmación de pedido sin registro (MOVI Store)',
  'movi',
  'store_pedido_publico_confirmacion',
  true,
  'Recibimos tu pedido {{folio}} — MOVI Store',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
<h2 style="color:#164281;margin:0 0 12px;">¡Gracias por tu pedido, {{nombre}}!</h2>
<p>Recibimos tu orden en <strong>MOVI Store</strong>. El equipo de Mercadotecnia la revisará y te contactará por WhatsApp o correo para confirmar el pago y la entrega.</p>
<div style="background:#f3f6fb;border-left:4px solid #164281;border-radius:6px;padding:14px 18px;margin:18px 0;">
<p style="margin:0 0 6px;"><strong>Folio:</strong> {{folio}}</p>
<p style="margin:0 0 6px;"><strong>Fecha:</strong> {{fecha}}</p>
<p style="margin:0;"><strong>Oficina:</strong> {{oficina}}</p>
</div>
{{productos_html}}
<p style="font-size:13px;color:#6b7280;">El total es estimado; el precio final se confirma al validar tu pedido. Conserva tu folio para cualquier aclaración.</p>
</div>',
  'Hola {{nombre}} 👋

Recibimos tu pedido en *MOVI Store*.

*Folio:* {{folio}}
*Oficina:* {{oficina}}

{{productos_texto}}
*Total estimado:* {{total}}

Mercadotecnia te contactará para confirmar pago y entrega. ¡Gracias!'
WHERE NOT EXISTS (
  SELECT 1 FROM transactional_notification_templates WHERE event_key = 'store_pedido_publico_confirmacion'
);

-- Tipo de notificación visible en Configuración → Notificaciones (STORE), con
-- interruptores de correo/WhatsApp que respeta la edge function.
INSERT INTO correo_tipos_notificacion
  (codigo, nombre, descripcion, modulo, activo, enviar_correo, enviar_whatsapp, enviar_notificacion,
   trigger_event, destinatario_tipo, nombre_estandar, platform)
SELECT
  'store_pedido_publico_confirmacion',
  'Confirmación de pedido sin registro (MOVI Store)',
  'Se envía al correo y WhatsApp que captura el cliente al pedir en tienda.movi.digital sin cuenta MOVI.',
  'STORE', true, true, true, false,
  'pedido_publico_creado', 'invitado',
  'STORE - Pedido sin registro - Confirmación - Cliente', 'movi'
WHERE NOT EXISTS (SELECT 1 FROM correo_tipos_notificacion WHERE codigo = 'store_pedido_publico_confirmacion');

INSERT INTO correo_plantillas
  (tipo_notificacion_id, asunto, html_cuerpo, whatsapp_plantilla, variables_disponibles, whatsapp_variables_disponibles,
   es_plantilla_default, enviar_correo, enviar_whatsapp, enviar_notificacion, email_enabled, whatsapp_enabled)
SELECT t.id, p.email_subject_template, p.email_body_template, p.whatsapp_body_template,
       ARRAY['{{nombre}}','{{nombre_completo}}','{{folio}}','{{fecha}}','{{oficina}}','{{total}}','{{productos_html}}','{{productos_texto}}'],
       ARRAY['{{nombre}}','{{nombre_completo}}','{{folio}}','{{fecha}}','{{oficina}}','{{total}}','{{productos_texto}}'],
       true, true, true, false, true, true
  FROM correo_tipos_notificacion t
  JOIN transactional_notification_templates p ON p.event_key = t.codigo
 WHERE t.codigo = 'store_pedido_publico_confirmacion'
   AND NOT EXISTS (SELECT 1 FROM correo_plantillas cp WHERE cp.tipo_notificacion_id = t.id);
