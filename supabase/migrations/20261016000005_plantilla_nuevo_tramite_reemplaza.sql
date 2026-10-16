-- La plantilla de "Nuevo trámite" sí existía — y por eso la del 16/10 no entró
-- ==========================================================================
--
-- `20261016000003` insertó con `ON CONFLICT DO NOTHING` para no pisarle el
-- texto a nadie. Pero ya había un renglón para `nuevo_tramite`, sembrado en
-- enero, así que la plantilla nueva nunca se guardó y siguió mandando la vieja.
--
-- Y la vieja está rota: usa nombres de variable que el despachador no entrega,
-- así que llegaba el WhatsApp con las etiquetas y los valores en blanco —
-- "Folio:", "Usuario:", "Fecha:" sin nada. `renderTemplate` borra lo que no
-- puede sustituir, así que un nombre equivocado no da error: deja un hueco.
--
-- Esta sí la reemplaza, a propósito. Lo que se pierde es la versión de enero,
-- que ya no servía.

UPDATE public.transactional_notification_templates SET
  name = 'Nuevo Trámite Generado',
  is_active = true,
  email_subject_template = 'Nuevo trámite {{folio}} — {{tipo_tramite}}',
  email_body_template = $html$
<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;">Nuevo trámite</p>

<h1 style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:bold;color:#0f172a;">{{folio}}</h1>
<p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.4;color:#334155;">{{tipo_tramite}}</p>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-top:1px solid #e2e8f0;">
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;width:38%;">Solicitante</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0f172a;">{{solicitante}}</td>
  </tr>
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Oficina</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;">{{oficina}}</td>
  </tr>
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Prioridad</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0f172a;">{{prioridad}}</td>
  </tr>
</table>

<p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;">Lo que se pide</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
  <tr>
    <td style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #1d4ed8;border-radius:0 6px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;">{{instrucciones}}</td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 0;">
  <tr>
    <td style="background-color:#1d4ed8;border-radius:6px;">
      <a href="{{url}}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Abrir el trámite</a>
    </td>
  </tr>
</table>

<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">Si el botón no abre, copia esta dirección:<br /><span style="color:#1d4ed8;word-break:break-all;">{{url}}</span></p>

{{adjuntos_lista_html}}
  $html$,
  whatsapp_body_template = $wa$*Nuevo trámite {{folio}}*
{{tipo_tramite}}

*Solicitante:* {{solicitante}}
*Oficina:* {{oficina}}
*Prioridad:* {{prioridad}}

_{{instrucciones}}_

Ábrelo aquí:
{{url}}$wa$,
  inapp_title_template = 'Nuevo trámite {{folio}}',
  inapp_body_template = '{{tipo_tramite}} · {{solicitante}} ({{oficina}}) · Prioridad {{prioridad}}'
WHERE event_key = 'nuevo_tramite';

-- Por si el renglón no existiera en algún ambiente.
INSERT INTO public.transactional_notification_templates (
  event_key, name, platform, is_active,
  email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template
)
SELECT 'nuevo_tramite', 'Nuevo Trámite Generado', 'movi', true,
  'Nuevo trámite {{folio}} — {{tipo_tramite}}',
  $html$
<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;">Nuevo trámite</p>

<h1 style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:bold;color:#0f172a;">{{folio}}</h1>
<p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.4;color:#334155;">{{tipo_tramite}}</p>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-top:1px solid #e2e8f0;">
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;width:38%;">Solicitante</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0f172a;">{{solicitante}}</td>
  </tr>
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Oficina</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;">{{oficina}}</td>
  </tr>
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Prioridad</td>
    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0f172a;">{{prioridad}}</td>
  </tr>
</table>

<p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;">Lo que se pide</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
  <tr>
    <td style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #1d4ed8;border-radius:0 6px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;">{{instrucciones}}</td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 0;">
  <tr>
    <td style="background-color:#1d4ed8;border-radius:6px;">
      <a href="{{url}}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Abrir el trámite</a>
    </td>
  </tr>
</table>

<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">Si el botón no abre, copia esta dirección:<br /><span style="color:#1d4ed8;word-break:break-all;">{{url}}</span></p>

{{adjuntos_lista_html}}
  $html$,
  $wa$*Nuevo trámite {{folio}}*
{{tipo_tramite}}

*Solicitante:* {{solicitante}}
*Oficina:* {{oficina}}
*Prioridad:* {{prioridad}}

_{{instrucciones}}_

Ábrelo aquí:
{{url}}$wa$,
  'Nuevo trámite {{folio}}',
  '{{tipo_tramite}} · {{solicitante}} ({{oficina}}) · Prioridad {{prioridad}}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactional_notification_templates WHERE event_key = 'nuevo_tramite'
);
