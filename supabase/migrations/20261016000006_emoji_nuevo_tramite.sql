-- Un emoji al aviso de trámite nuevo
-- ==================================
--
-- Uno solo, y el mismo en los tres canales: el portapapeles 📋, que es el que
-- ya usaba la plantilla vieja para esto. Más de uno y el mensaje se vuelve
-- ruido; en WhatsApp sobre todo, donde compite con conversaciones reales.
--
-- El cuerpo del correo se toca con `replace` sobre el renglón del rótulo en
-- vez de reescribir el HTML completo: así esta migración no puede pisar sin
-- querer otros ajustes que alguien haya hecho desde la pantalla.

UPDATE public.transactional_notification_templates SET
  whatsapp_body_template = '📋 *Nuevo trámite {{folio}}*
{{tipo_tramite}}

*Solicitante:* {{solicitante}}
*Oficina:* {{oficina}}
*Prioridad:* {{prioridad}}

_{{instrucciones}}_

Ábrelo aquí:
{{url}}',
  inapp_title_template = '📋 Nuevo trámite {{folio}}',
  email_subject_template = '📋 Nuevo trámite {{folio}} — {{tipo_tramite}}',
  email_body_template = replace(
    email_body_template,
    '>Nuevo trámite</p>',
    '>📋 Nuevo trámite</p>'
  )
WHERE event_key = 'nuevo_tramite';
