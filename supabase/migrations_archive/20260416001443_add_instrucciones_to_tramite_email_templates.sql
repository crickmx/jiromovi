/*
  # Add instrucciones/descripción to tramite email and WhatsApp templates

  Updates the html_cuerpo of all 4 tramite email templates in correo_plantillas
  to display the "Instrucciones / Descripción" field.
  Also adds WhatsApp templates that include instrucciones.

  ## Changes
  - tramite_comentario_nuevo   - add instrucciones block + WhatsApp template
  - tramite_documento_cargado  - add instrucciones block + WhatsApp template
  - tramite_cambio_estatus     - add instrucciones block + WhatsApp template
  - tramite_actualizado        - add instrucciones block + WhatsApp template
*/

UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>Hola {{agente_nombre}}</h2>
<p>Se ha agregado un nuevo comentario en tu trámite <strong>{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>{{autor_nombre}}</strong> ({{autor_rol}}):</p>
  <p>{{comentario}}</p>
</div>
<p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
<p><strong>Estatus actual:</strong> {{estatus}}</p>
<div style="background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 15px; margin: 16px 0; border-radius: 0 5px 5px 0;">
  <p style="margin: 0 0 4px 0;"><strong>Instrucciones / Descripción:</strong></p>
  <p style="margin: 0;">{{instrucciones}}</p>
</div>
<p><em>Nota: Todos los documentos del trámite están adjuntos a este correo.</em></p>
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
  whatsapp_plantilla = '{{autor_nombre}} comentó en tu trámite {{folio}}:

"{{comentario}}"

📋 Descripción: {{instrucciones}}

Ver trámite: {{url}}'
WHERE id = 'ac860009-b38f-4eeb-8bb3-ac3541e70a59';

UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>Hola {{agente_nombre}}</h2>
<p>Se ha cargado un nuevo documento en tu trámite <strong>{{folio}}</strong>:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Archivo:</strong> {{nombre_archivo}}</p>
  <p><strong>Cargado por:</strong> {{subido_por}} ({{rol_subidor}})</p>
  <p><strong>Tamaño:</strong> {{tamano_archivo}}</p>
</div>
<p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
<p><strong>Estatus actual:</strong> {{estatus}}</p>
<div style="background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 15px; margin: 16px 0; border-radius: 0 5px 5px 0;">
  <p style="margin: 0 0 4px 0;"><strong>Instrucciones / Descripción:</strong></p>
  <p style="margin: 0;">{{instrucciones}}</p>
</div>
<p>Todos los documentos del trámite están adjuntos a este correo.</p>
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
  whatsapp_plantilla = '{{subido_por}} cargó un documento en tu trámite {{folio}}:

📄 {{nombre_archivo}} ({{tamano_archivo}})

📋 Descripción: {{instrucciones}}

Ver trámite: {{url}}'
WHERE id = '8fde4db1-5c57-4f85-ac81-db790ff69138';

UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>Hola {{agente_nombre}}</h2>
<p>El estatus de tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Estatus anterior:</strong> {{estatus_anterior}}</p>
  <p><strong>Estatus nuevo:</strong> {{estatus_nuevo}}</p>
  <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
</div>
<p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
<div style="background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 15px; margin: 16px 0; border-radius: 0 5px 5px 0;">
  <p style="margin: 0 0 4px 0;"><strong>Instrucciones / Descripción:</strong></p>
  <p style="margin: 0;">{{instrucciones}}</p>
</div>
<p><em>Nota: Todos los documentos del trámite están adjuntos a este correo.</em></p>
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
  whatsapp_plantilla = 'El estatus de tu trámite {{folio}} cambió:

{{estatus_anterior}} → {{estatus_nuevo}}
Actualizado por: {{modificado_por}}

📋 Descripción: {{instrucciones}}

Ver trámite: {{url}}'
WHERE id = '1bb82114-8f98-4b01-93ab-7c7457849922';

UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>Hola {{agente_nombre}}</h2>
<p>Tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
  <p><strong>Campos modificados:</strong> {{campos_modificados}}</p>
</div>
<p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
<p><strong>Estatus actual:</strong> {{estatus}}</p>
<div style="background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 15px; margin: 16px 0; border-radius: 0 5px 5px 0;">
  <p style="margin: 0 0 4px 0;"><strong>Instrucciones / Descripción:</strong></p>
  <p style="margin: 0;">{{instrucciones}}</p>
</div>
<p><em>Nota: Todos los documentos del trámite están adjuntos a este correo.</em></p>
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
  whatsapp_plantilla = 'Tu trámite {{folio}} fue actualizado:

Cambios: {{campos_modificados}}
Por: {{modificado_por}}

📋 Descripción: {{instrucciones}}

Ver trámite: {{url}}'
WHERE id = 'c338dcb7-39fd-4984-b9f4-617eba8b34a2';
