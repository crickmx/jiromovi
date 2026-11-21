-- ============================================================================
-- Correos del Aula Virtual con miniatura, datos, descripción y link directo
--
-- Además se cambia el vocabulario: se habla de "capacitación" o "sesión",
-- nunca de "clase".
-- ============================================================================

-- ── Invitación al programar una capacitación ────────────────────────────────
update public.transactional_notification_templates
set name = 'Aula Virtual — invitación a una capacitación',
    email_subject_template = 'Te invitaron a la capacitación "{{capacitacion}}"',
    email_body_template = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <img src="{{imagen}}" alt="{{capacitacion}}" style="width:100%;max-width:600px;border-radius:14px 14px 0 0;display:block;" />
     <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:22px;">
       <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1C37E0;">
         Nueva capacitación
       </p>
       <h2 style="margin:0 0 10px;font-size:21px;line-height:1.3;color:#111827;">{{capacitacion}}</h2>

       <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
         <tr>
           <td style="padding:10px 12px;background:#f9fafb;border-radius:10px 10px 0 0;font-size:14px;color:#374151;">
             📅 <strong>{{fecha}}</strong>
           </td>
         </tr>
         <tr>
           <td style="padding:10px 12px;background:#f9fafb;border-radius:0 0 10px 10px;font-size:14px;color:#374151;">
             🕒 <strong>{{hora}}</strong>{{duracion}}
           </td>
         </tr>
       </table>

       <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0 0 20px;">{{descripcion}}</p>

       <p style="margin:0 0 18px;">
         <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:600;display:inline-block;">
           Ver la capacitación
         </a>
       </p>
       <p style="font-size:12px;color:#6b7280;margin:0;">{{url}}</p>
     </div>
     <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:14px;">
       Seguros Education · MOVI Digital · la sesión se graba y queda en On Demand
     </p>
   </div>',
    whatsapp_body_template = 'Nueva capacitación: {{capacitacion}} · {{fecha}} {{hora}}. Entra aquí: {{url}}',
    inapp_title_template = 'Nueva capacitación: {{capacitacion}}',
    inapp_body_template = '{{fecha}} · {{hora}}'
where event_key = 'aula_invitacion_clase';

-- ── Recordatorio a 10 minutos ───────────────────────────────────────────────
update public.transactional_notification_templates
set name = 'Aula Virtual — recordatorio a 10 minutos (con link)',
    email_subject_template = 'Tu capacitación "{{capacitacion}}" empieza en 10 minutos',
    email_body_template = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <img src="{{imagen}}" alt="{{capacitacion}}" style="width:100%;max-width:600px;border-radius:14px 14px 0 0;display:block;" />
     <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:22px;">
       <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#b45309;">
         Empieza en 10 minutos
       </p>
       <h2 style="margin:0 0 10px;font-size:21px;line-height:1.3;color:#111827;">{{capacitacion}}</h2>

       <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
         <tr>
           <td style="padding:10px 12px;background:#f9fafb;border-radius:10px 10px 0 0;font-size:14px;color:#374151;">
             📅 <strong>{{fecha}}</strong>
           </td>
         </tr>
         <tr>
           <td style="padding:10px 12px;background:#f9fafb;border-radius:0 0 10px 10px;font-size:14px;color:#374151;">
             🕒 <strong>{{hora}}</strong>{{duracion}}
           </td>
         </tr>
       </table>

       <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0 0 20px;">{{descripcion}}</p>

       <p style="margin:0 0 18px;">
         <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:600;display:inline-block;">
           Entrar a la capacitación
         </a>
       </p>
       <p style="font-size:12px;color:#6b7280;margin:0;">{{url}}</p>
     </div>
     <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:14px;">
       Seguros Education · MOVI Digital
     </p>
   </div>',
    whatsapp_body_template = 'Empieza en 10 min: {{capacitacion}} · {{hora}}. Entra aquí: {{url}}',
    inapp_title_template = 'Empieza en 10 minutos',
    inapp_body_template = '{{capacitacion}} · {{hora}}'
where event_key = 'aula_recordatorio_10';

-- ── Recordatorios de 30 y 5 minutos: mismo vocabulario ──────────────────────
update public.transactional_notification_templates
set email_subject_template = 'Tu capacitación "{{capacitacion}}" empieza en {{minutos}} minutos',
    email_body_template = replace(replace(email_body_template, '{{clase}}', '{{capacitacion}}'), 'La clase', 'La capacitación'),
    whatsapp_body_template = replace(whatsapp_body_template, '{{clase}}', '{{capacitacion}}'),
    inapp_body_template = replace(inapp_body_template, '{{clase}}', '{{capacitacion}}')
where event_key in ('aula_recordatorio', 'aula_recordatorio_email');