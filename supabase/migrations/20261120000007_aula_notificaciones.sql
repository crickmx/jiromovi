-- ============================================================================
-- Aula Virtual: invitación al crear la clase y recordatorio a 10 minutos
--
-- 1) La cola de envíos solo aceptaba '30m' y '5m'; se abre a '10m' (con link
--    de acceso) y 'invitacion' (al crear la clase).
-- 2) Dos plantillas nuevas, correo + WhatsApp.
-- ============================================================================

alter table public.aula_recordatorio_envios
  drop constraint if exists aula_rec_envios_tipo_check;

alter table public.aula_recordatorio_envios
  add constraint aula_rec_envios_tipo_check
  check (tipo = any (array['30m'::text, '10m'::text, '5m'::text, 'invitacion'::text]));

-- ── Invitación al crear la clase ────────────────────────────────────────────
insert into public.transactional_notification_templates (
  event_key, name, email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template, is_active, platform
) values (
  'aula_invitacion_clase',
  'Aula Virtual — invitación a una clase nueva',
  'Te invitaron a la clase "{{clase}}"',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <h2 style="color:#1C37E0;margin:0 0 12px;">Nueva clase en Seguros Education</h2>
     <p style="font-size:15px;line-height:1.6;">Hola {{nombre}},</p>
     <p style="font-size:15px;line-height:1.6;">
       Se programó la clase <strong>{{clase}}</strong> para el <strong>{{fecha}}</strong>
       a las <strong>{{hora}}</strong>. Ya tienes tu lugar.
     </p>
     <p style="margin:26px 0;">
       <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block;">
         Ver la clase
       </a>
     </p>
     <p style="font-size:13px;color:#6b7280;">La clase se graba y queda en On Demand · Seguros Education</p>
   </div>',
  'Nueva clase: {{clase}} · {{fecha}} {{hora}}. Entra aquí: {{url}}',
  'Nueva clase: {{clase}}',
  '{{fecha}} · {{hora}}',
  true,
  'movi'
)
on conflict (event_key) do nothing;

-- ── Recordatorio a 10 minutos, con link de acceso ───────────────────────────
insert into public.transactional_notification_templates (
  event_key, name, email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template, is_active, platform
) values (
  'aula_recordatorio_10',
  'Aula Virtual — recordatorio a 10 minutos (con link)',
  'Tu clase "{{clase}}" empieza en 10 minutos',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <h2 style="color:#1C37E0;margin:0 0 12px;">Tu clase empieza en 10 minutos</h2>
     <p style="font-size:15px;line-height:1.6;">Hola {{nombre}},</p>
     <p style="font-size:15px;line-height:1.6;">
       <strong>{{clase}}</strong> comienza a las <strong>{{hora}}</strong>.
       Entra desde el enlace:
     </p>
     <p style="margin:26px 0;">
       <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block;">
         Entrar a la clase
       </a>
     </p>
     <p style="font-size:13px;color:#6b7280;">Seguros Education · MOVI Digital</p>
   </div>',
  'Empieza en 10 min: {{clase}} · {{hora}}. Entra aquí: {{url}}',
  'Empieza en 10 minutos',
  '{{clase}} · {{hora}}',
  true,
  'movi'
)
on conflict (event_key) do nothing;