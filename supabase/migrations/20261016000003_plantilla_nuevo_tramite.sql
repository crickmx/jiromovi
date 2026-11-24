-- Plantilla del aviso "Nuevo trámite"
-- ===================================
--
-- Hasta hoy este aviso se armaba a mano en `NuevoTramiteModal.tsx`, así que la
-- pantalla de Admin › Transaccionales no podía cambiarlo. Con el evento ya
-- conectado al motor (`nuevo_tramite`), falta lo que el motor va a leer.
--
-- Notas de diseño, por si alguien lo edita desde la pantalla:
--
-- · El HTML es un **fragmento**, no un documento. `wrapWithGlobalLayout` ya lo
--   mete en una tarjeta blanca de 600px con 32px de padding, sobre fondo gris,
--   con el encabezado y el pie globales. Meter aquí <html> o <body> rompe eso.
-- · Todo va con **estilos en línea y tablas**: Gmail borra las hojas de estilo
--   y no respeta flex ni grid. Tampoco hay modo oscuro — Gmail ignora las
--   media queries, así que los colores se eligieron para leerse en claro.
-- · `renderTemplate` solo sustituye texto, **no tiene condicionales**: un campo
--   vacío deja su renglón en blanco. Por eso `NuevoTramiteModal` manda un
--   guion largo cuando no hay dato, en vez de cadena vacía.
-- · Solo lo que sirve para decidir si abrirlo: quién lo pide, de dónde, qué
--   urgencia y qué pide. Lo demás está a un clic.

INSERT INTO public.transactional_notification_templates (
  event_key, name, platform, is_active,
  email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template
) VALUES (
  'nuevo_tramite',
  'Nuevo Trámite Generado',
  'movi',
  true,
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
)
-- Si alguien ya la editó desde la pantalla, esta migración NO le pisa el texto.
-- Correrla dos veces tampoco duplica nada.
ON CONFLICT (event_key) DO NOTHING;

-- El nombre traía "(Mesa de Control)" desde la siembra de enero, y ya no
-- describe lo que es: este aviso sale de cualquier trámite nuevo, caiga en el
-- equipo que caiga.
UPDATE public.correo_tipos_notificacion
SET nombre = 'Nuevo Trámite Generado'
WHERE codigo = 'nuevo_tramite';

UPDATE public.transactional_notification_templates
SET name = 'Nuevo Trámite Generado'
WHERE event_key = 'nuevo_tramite';
