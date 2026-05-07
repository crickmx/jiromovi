/*
  # Enhance ticket notification templates

  1. Changes
    - Update email_subject_template for all tramite-related templates to include:
      - Folio
      - Short description (tipo_tramite label)
      - Client name (when available)
      - Policy number (when available)
      - Insurer name (when available)
    - Update whatsapp_body_template for all tramite templates to include
      richer identification data (client, policy, insurer)
    - Add new template variables support: cliente_nombre, poliza_numero, aseguradora_nombre, descripcion_breve
    - Add new template for tramite_entrega_poliza event

  2. Security
    - No RLS changes needed (templates table is admin-managed)

  3. Notes
    - Existing templates are updated in-place (not replaced)
    - New variables are optional - templates use conditional display
    - If a variable is not provided, the segment is omitted from subject
*/

-- Update tramite_actualizado
UPDATE transactional_notification_templates
SET
  email_subject_template = 'Trámite #{{folio}} - {{descripcion_breve}}{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  email_body_template = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Tu trámite <strong>#{{folio}}</strong> ha sido actualizado:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
<p><strong>Cambios:</strong> {{campos_modificados}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px;">{{estatus}}</td></tr>
{{datos_identificacion_html}}
</table>
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  whatsapp_body_template = 'Hola {{agente_nombre}},

Tu trámite #{{folio}} fue actualizado:
{{descripcion_breve}}

Actualizado por: {{modificado_por}} ({{rol_modificador}})
Cambios: {{campos_modificados}}
{{datos_identificacion_texto}}
Estatus: {{estatus}}

Ver más: {{url}}',
  updated_at = now()
WHERE event_key = 'tramite_actualizado';

-- Update tramite_cambio_estatus
UPDATE transactional_notification_templates
SET
  email_subject_template = 'Trámite #{{folio}} - {{estatus_nuevo}}{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  email_body_template = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>El estatus de tu trámite <strong>#{{folio}}</strong> ha cambiado:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Anterior:</strong> {{estatus_anterior}}</p>
<p><strong>Nuevo:</strong> <span style="color: #0284c7; font-weight: bold;">{{estatus_nuevo}}</span></p>
<p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
{{datos_identificacion_html}}
</table>
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  whatsapp_body_template = 'Hola {{agente_nombre}},

Tu trámite #{{folio}} cambió de estatus:
{{descripcion_breve}}

Anterior: {{estatus_anterior}}
Nuevo: {{estatus_nuevo}}

Actualizado por: {{modificado_por}} ({{rol_modificador}})
{{datos_identificacion_texto}}
Ver más: {{url}}',
  updated_at = now()
WHERE event_key = 'tramite_cambio_estatus';

-- Update tramite_comentario_nuevo
UPDATE transactional_notification_templates
SET
  email_subject_template = 'Trámite #{{folio}} - Nuevo comentario{{cliente_segmento}}{{poliza_segmento}}',
  email_body_template = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Nuevo comentario en tu trámite <strong>#{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>{{autor_nombre}}</strong> ({{autor_rol}}):</p>
<p style="margin: 10px 0; white-space: pre-wrap;">{{comentario}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px;">{{estatus}}</td></tr>
{{datos_identificacion_html}}
</table>
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  whatsapp_body_template = 'Hola {{agente_nombre}},

{{autor_nombre}} ({{autor_rol}}) comentó en tu trámite #{{folio}}:
{{descripcion_breve}}

"{{comentario}}"
{{datos_identificacion_texto}}
Estatus: {{estatus}}

Ver más: {{url}}',
  updated_at = now()
WHERE event_key = 'tramite_comentario_nuevo';

-- Update tramite_documento_cargado
UPDATE transactional_notification_templates
SET
  email_subject_template = 'Trámite #{{folio}} - Nuevo documento{{cliente_segmento}}{{poliza_segmento}}',
  email_body_template = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Nuevo documento en tu trámite <strong>#{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Archivo:</strong> {{nombre_archivo}}</p>
<p><strong>Cargado por:</strong> {{subido_por}} ({{rol_subidor}})</p>
<p><strong>Tamaño:</strong> {{tamano_archivo}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px;">{{estatus}}</td></tr>
{{datos_identificacion_html}}
</table>
{{adjuntos_advertencia_html}}
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite y Descargar</a>
</p>
</div>',
  whatsapp_body_template = 'Hola {{agente_nombre}},

Nuevo documento en tu trámite #{{folio}}:
{{descripcion_breve}}

Archivo: {{nombre_archivo}}
Subido por: {{subido_por}} ({{rol_subidor}})
Tamaño: {{tamano_archivo}}
{{datos_identificacion_texto}}
Estatus: {{estatus}}

Ver más: {{url}}',
  updated_at = now()
WHERE event_key = 'tramite_documento_cargado';

-- Insert new template: tramite_entrega_poliza
INSERT INTO transactional_notification_templates (event_key, name, email_subject_template, email_body_template, whatsapp_body_template, is_active)
VALUES (
  'tramite_entrega_poliza',
  'Entrega de Póliza',
  'Trámite #{{folio}} - Póliza entregada{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Se te ha entregado una póliza en el trámite <strong>#{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Entregado por:</strong> {{entregado_por}}</p>
<p><strong>Acción:</strong> {{accion_tramite}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px; color:#16a34a; font-weight:bold;">Emitido (Ganado)</td></tr>
{{datos_identificacion_html}}
</table>
<p style="font-size:13px; color:#666; margin-top:15px;">Se adjuntan los documentos de la póliza. Si algún documento no pudo adjuntarse, puedes descargarlo desde MOVI.</p>
{{adjuntos_advertencia_html}}
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  'Hola {{agente_nombre}},

Se te ha entregado una póliza en el trámite #{{folio}}.
{{descripcion_breve}}

Entregado por: {{entregado_por}}
{{datos_identificacion_texto}}
Estatus: Emitido (Ganado)

Te enviamos los documentos adjuntos de esta póliza.

Ver más: {{url}}',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  updated_at = now();

-- Insert new template: tramite_creado (new ticket created)
INSERT INTO transactional_notification_templates (event_key, name, email_subject_template, email_body_template, whatsapp_body_template, is_active)
VALUES (
  'tramite_creado',
  'Trámite Creado',
  'Trámite #{{folio}} - {{descripcion_breve}}{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Se ha creado un nuevo trámite <strong>#{{folio}}</strong> asignado a ti:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Creado por:</strong> {{creado_por}}</p>
<p><strong>Prioridad:</strong> {{prioridad}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px;">{{estatus}}</td></tr>
{{datos_identificacion_html}}
</table>
{{adjuntos_advertencia_html}}
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  'Hola {{agente_nombre}},

Se creó un nuevo trámite #{{folio}} asignado a ti:
{{descripcion_breve}}

Creado por: {{creado_por}}
Prioridad: {{prioridad}}
{{datos_identificacion_texto}}
Estatus: {{estatus}}

Ver más: {{url}}',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  updated_at = now();

-- Insert new template: tramite_cerrado (ticket closed)
INSERT INTO transactional_notification_templates (event_key, name, email_subject_template, email_body_template, whatsapp_body_template, is_active)
VALUES (
  'tramite_cerrado',
  'Trámite Cerrado',
  'Trámite #{{folio}} - {{resultado_texto}}{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Tu trámite <strong>#{{folio}}</strong> ha sido cerrado:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Resultado:</strong> <span style="color: {{resultado_color}}; font-weight: bold;">{{resultado_texto}}</span></p>
<p><strong>Cerrado por:</strong> {{cerrado_por_nombre}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
{{datos_identificacion_html}}
</table>
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  'Hola {{agente_nombre}},

Tu trámite #{{folio}} ha sido cerrado:
{{descripcion_breve}}

Resultado: {{resultado_texto}}
Cerrado por: {{cerrado_por_nombre}}
{{datos_identificacion_texto}}
Ver más: {{url}}',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  updated_at = now();

-- Insert new template: tramite_asignado (ticket assigned)
INSERT INTO transactional_notification_templates (event_key, name, email_subject_template, email_body_template, whatsapp_body_template, is_active)
VALUES (
  'tramite_asignado',
  'Trámite Asignado',
  'Trámite #{{folio}} - Asignado a ti{{cliente_segmento}}{{poliza_segmento}}{{aseguradora_segmento}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #333;">Hola {{agente_nombre}}</h2>
<p>Se te ha asignado el trámite <strong>#{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
<p><strong>Asignado por:</strong> {{asignado_por}}</p>
<p><strong>Prioridad:</strong> {{prioridad}}</p>
</div>
<table style="width:100%; border-collapse:collapse; margin:15px 0;">
<tr><td style="padding:4px 8px; color:#666;">Tipo:</td><td style="padding:4px 8px; font-weight:bold;">{{tipo_tramite}}</td></tr>
<tr><td style="padding:4px 8px; color:#666;">Estatus:</td><td style="padding:4px 8px;">{{estatus}}</td></tr>
{{datos_identificacion_html}}
</table>
<p style="margin-top: 20px;">
<a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
</p>
</div>',
  'Hola {{agente_nombre}},

Se te ha asignado el trámite #{{folio}}:
{{descripcion_breve}}

Asignado por: {{asignado_por}}
Prioridad: {{prioridad}}
{{datos_identificacion_texto}}
Estatus: {{estatus}}

Ver más: {{url}}',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  updated_at = now();
