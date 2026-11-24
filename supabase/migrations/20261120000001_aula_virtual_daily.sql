-- ============================================================================
-- Aula Virtual sobre Daily.co (Seguros Education)
-- Aditiva e idempotente: no borra ni renombra nada existente.
-- Reutiliza aula_eventos como evento raíz y el On Demand (seguros_lessons).
-- ============================================================================

-- ── 1. Evento: columnas nuevas ──────────────────────────────────────────────
alter table public.aula_eventos
  add column if not exists fecha_inicio      timestamptz,
  add column if not exists fecha_fin         timestamptz,
  add column if not exists estado            text not null default 'programado',
  add column if not exists max_participantes int  default 100,
  add column if not exists grabar            boolean not null default true,
  add column if not exists transcribir       boolean not null default true,
  add column if not exists daily_room_name   text,
  add column if not exists daily_room_url    text,
  add column if not exists portada_url       text,
  add column if not exists link_token        text,
  add column if not exists link_activo       boolean not null default true,
  add column if not exists leccion_id        uuid references public.seguros_lessons(id) on delete set null,
  add column if not exists categoria_id      uuid references public.seguros_categories(id) on delete set null,
  add column if not exists notificar_whatsapp_todos boolean not null default false;

-- Restricciones por separado: `add column ... check` no es idempotente al re-ejecutar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_eventos_estado_check') then
    alter table public.aula_eventos add constraint aula_eventos_estado_check
      check (estado in ('programado','en_vivo','finalizado','cancelado'));
  end if;
end $$;

create unique index if not exists aula_eventos_link_token_key
  on public.aula_eventos(link_token) where link_token is not null;

create index if not exists idx_aula_eventos_estado_fecha
  on public.aula_eventos(estado, fecha_inicio);

-- ── 2. Quién conduce la clase ───────────────────────────────────────────────
create table if not exists public.aula_evento_hosts (
  evento_id   uuid not null references public.aula_eventos(id) on delete cascade,
  usuario_id  uuid not null references public.usuarios(id)     on delete cascade,
  rol         text not null default 'cohost',
  creado_en   timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_evento_hosts_rol_check') then
    alter table public.aula_evento_hosts add constraint aula_evento_hosts_rol_check
      check (rol in ('host','cohost'));
  end if;
end $$;

-- ── 3. Invitados externos (link sin login) ──────────────────────────────────
create table if not exists public.aula_invitados (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.aula_eventos(id) on delete cascade,
  nombre          text not null check (length(btrim(nombre)) between 2 and 80),
  empresa         text not null check (length(btrim(empresa)) between 2 and 80),
  avatar_url      text,
  primera_entrada timestamptz not null default now(),
  ultima_entrada  timestamptz not null default now(),
  entradas        int not null default 1
);
create index if not exists idx_aula_invitados_evento on public.aula_invitados(evento_id);

-- ── 4. Asistencia ───────────────────────────────────────────────────────────
create table if not exists public.aula_participantes (
  id                uuid primary key default gen_random_uuid(),
  evento_id         uuid not null references public.aula_eventos(id) on delete cascade,
  usuario_id        uuid references public.usuarios(id) on delete set null,
  invitado_id       uuid references public.aula_invitados(id) on delete set null,
  rol               text not null,
  nombre            text not null,
  entrado_at        timestamptz not null default now(),
  salido_at         timestamptz,
  segundos          int,
  daily_session_id  text,
  sesion_token      text,
  mano_levantada    boolean not null default false,
  mano_levantada_at timestamptz
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_participantes_rol_check') then
    alter table public.aula_participantes add constraint aula_participantes_rol_check
      check (rol in ('host','cohost','ponente','oyente'));
  end if;
end $$;
create index if not exists idx_aula_participantes_evento on public.aula_participantes(evento_id, entrado_at desc);
create index if not exists idx_aula_participantes_usuario on public.aula_participantes(usuario_id);

-- ── 5. Chat por sala ────────────────────────────────────────────────────────
create table if not exists public.aula_chat (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references public.aula_eventos(id) on delete cascade,
  autor_tipo     text not null,
  autor_id       uuid,
  autor_nombre   text not null,
  autor_rol      text,
  texto          text,
  adjunto_path   text,
  adjunto_nombre text,
  adjunto_bytes  bigint,
  adjunto_mime   text,
  enviado_at     timestamptz not null default now(),
  borrado        boolean not null default false
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_chat_autor_tipo_check') then
    alter table public.aula_chat add constraint aula_chat_autor_tipo_check
      check (autor_tipo in ('usuario','invitado'));
  end if;
end $$;
create index if not exists idx_aula_chat_evento on public.aula_chat(evento_id, enviado_at);

-- ── 6. Grabaciones (una fila por capa: local y nube) ────────────────────────
create table if not exists public.aula_grabaciones (
  id                   uuid primary key default gen_random_uuid(),
  evento_id            uuid not null references public.aula_eventos(id) on delete cascade,
  origen               text not null,
  video_path           text,
  audio_path           text,
  daily_recording_id   text,
  duracion_segundos    int,
  tamano_bytes         bigint,
  estado               text not null default 'grabando',
  transcripcion_path   text,
  transcripcion_origen text,
  leccion_id           uuid references public.seguros_lessons(id) on delete set null,
  error_mensaje        text,
  iniciado_at          timestamptz not null default now(),
  completado_at        timestamptz,
  unique (evento_id, origen)
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_grabaciones_origen_check') then
    alter table public.aula_grabaciones add constraint aula_grabaciones_origen_check
      check (origen in ('local','cloud'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aula_grabaciones_estado_check') then
    alter table public.aula_grabaciones add constraint aula_grabaciones_estado_check
      check (estado in ('grabando','subiendo','procesando','publicando','publicada','error'));
  end if;
end $$;

-- ── 7. Recordatorios: idempotencia + cola de envío ─────────────────────────
create table if not exists public.aula_recordatorios (
  evento_id  uuid not null references public.aula_eventos(id) on delete cascade,
  tipo       text not null,
  enviado_at timestamptz not null default now(),
  primary key (evento_id, tipo)
);

create table if not exists public.aula_recordatorio_envios (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.aula_eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo       text not null,
  estado     text not null default 'pendiente',
  intentos   int not null default 0,
  error      text,
  creado_en  timestamptz not null default now(),
  enviado_en timestamptz,
  unique (evento_id, usuario_id, tipo)
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_rec_envios_estado_check') then
    alter table public.aula_recordatorio_envios add constraint aula_rec_envios_estado_check
      check (estado in ('pendiente','enviado','error'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aula_rec_envios_tipo_check') then
    alter table public.aula_recordatorio_envios add constraint aula_rec_envios_tipo_check
      check (tipo in ('30m','5m'));
  end if;
end $$;
create index if not exists idx_aula_rec_envios_pendientes
  on public.aula_recordatorio_envios(estado, creado_en) where estado = 'pendiente';

-- ── 8. Helper: ¿este usuario administra este evento? ───────────────────────
create or replace function public.aula_puede_administrar(p_evento_id uuid, p_usuario_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = p_usuario_id
      and (
        u.rol = 'Administrador'
        or (u.rol = 'Gerente' and public.tiene_permiso_admin_en_modulo(p_usuario_id, 'seguros_education'))
        or exists (
          select 1 from public.aula_evento_hosts h
          where h.evento_id = p_evento_id and h.usuario_id = p_usuario_id
        )
      )
  );
$$;

revoke all on function public.aula_puede_administrar(uuid, uuid) from public;
grant execute on function public.aula_puede_administrar(uuid, uuid) to authenticated;

-- ── 9. RLS ─────────────────────────────────────────────────────────────────
alter table public.aula_evento_hosts        enable row level security;
alter table public.aula_invitados           enable row level security;
alter table public.aula_participantes       enable row level security;
alter table public.aula_chat                enable row level security;
alter table public.aula_grabaciones         enable row level security;
alter table public.aula_recordatorios       enable row level security;
alter table public.aula_recordatorio_envios enable row level security;

-- hosts: todos los autenticados los ven (para mostrar quién conduce); escribe el admin del evento
drop policy if exists aula_hosts_select on public.aula_evento_hosts;
create policy aula_hosts_select on public.aula_evento_hosts
  for select to authenticated using (true);

drop policy if exists aula_hosts_write on public.aula_evento_hosts;
create policy aula_hosts_write on public.aula_evento_hosts
  for all to authenticated
  using (public.aula_puede_administrar(evento_id))
  with check (public.aula_puede_administrar(evento_id));

-- invitados: sin políticas → solo service_role (edge functions) entra
-- participantes: lectura para autenticados, escritura solo de la propia fila
drop policy if exists aula_part_select on public.aula_participantes;
create policy aula_part_select on public.aula_participantes
  for select to authenticated using (true);

drop policy if exists aula_part_insert on public.aula_participantes;
create policy aula_part_insert on public.aula_participantes
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists aula_part_update on public.aula_participantes;
create policy aula_part_update on public.aula_participantes
  for update to authenticated
  using (usuario_id = auth.uid() or public.aula_puede_administrar(evento_id))
  with check (usuario_id = auth.uid() or public.aula_puede_administrar(evento_id));

-- chat: lectura para autenticados, escritura de la propia autoría
drop policy if exists aula_chat_select on public.aula_chat;
create policy aula_chat_select on public.aula_chat
  for select to authenticated using (true);

drop policy if exists aula_chat_insert on public.aula_chat;
create policy aula_chat_insert on public.aula_chat
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists aula_chat_update on public.aula_chat;
create policy aula_chat_update on public.aula_chat
  for update to authenticated using (public.aula_puede_administrar(evento_id));

-- grabaciones: solo quien administra el evento las ve; escribe service_role
drop policy if exists aula_grab_select on public.aula_grabaciones;
create policy aula_grab_select on public.aula_grabaciones
  for select to authenticated using (public.aula_puede_administrar(evento_id));

-- recordatorios: solo service_role
-- (RLS encendido sin políticas = nadie más entra)

-- ── 10. Realtime para chat y manos ─────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'aula_chat'
  ) then
    alter publication supabase_realtime add table public.aula_chat;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'aula_participantes'
  ) then
    alter publication supabase_realtime add table public.aula_participantes;
  end if;
end $$;

-- ── 11. Buckets ────────────────────────────────────────────────────────────
-- Los adjuntos del chat y los avatares de invitados se leen desde la sala por
-- usuarios e invitados sin sesión, así que van en buckets públicos con rutas
-- no adivinables (uuid). Las grabaciones NO van aquí.
insert into storage.buckets (id, name, public)
values ('aula-adjuntos', 'aula-adjuntos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('aula-portadas', 'aula-portadas', true)
on conflict (id) do nothing;

drop policy if exists aula_adjuntos_insert on storage.objects;
create policy aula_adjuntos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'aula-adjuntos');

drop policy if exists aula_adjuntos_select on storage.objects;
create policy aula_adjuntos_select on storage.objects
  for select using (bucket_id = 'aula-adjuntos');

drop policy if exists aula_portadas_insert on storage.objects;
create policy aula_portadas_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'aula-portadas');

drop policy if exists aula_portadas_select on storage.objects;
create policy aula_portadas_select on storage.objects
  for select using (bucket_id = 'aula-portadas');

-- ── 12. Plantillas de notificación (correo + WhatsApp + in-app + push) ─────
-- El push nativo se dispara solo: el trigger trg_push_nativo_notificaciones
-- escucha los INSERT en notificaciones.
insert into public.transactional_notification_templates
  (event_key, name, platform, is_active,
   email_subject_template, email_body_template,
   whatsapp_body_template, inapp_title_template, inapp_body_template)
select
  'aula_recordatorio',
  'Aula Virtual — recordatorio de clase',
  'movi', true,
  'Tu clase "{{clase}}" empieza en {{minutos}} minutos',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <h2 style="color:#1C37E0;margin:0 0 12px;">Tu clase empieza pronto</h2>
     <p style="font-size:15px;line-height:1.6;">Hola {{nombre}},</p>
     <p style="font-size:15px;line-height:1.6;">
       La clase <strong>{{clase}}</strong> comienza en <strong>{{minutos}} minutos</strong>
       ({{hora}}). Te esperamos en el Aula Virtual.
     </p>
     <p style="margin:26px 0;">
       <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block;">
         Entrar al Aula Virtual
       </a>
     </p>
     <p style="font-size:13px;color:#6b7280;">Seguros Education · MOVI Digital</p>
   </div>',
  'Hola {{nombre}} 👋

La clase *{{clase}}* empieza en *{{minutos}} minutos* ({{hora}}).

Entra aquí: {{url}}',
  'Tu clase empieza en {{minutos}} min',
  '{{clase}} · {{hora}}'
where not exists (
  select 1 from public.transactional_notification_templates where event_key = 'aula_recordatorio'
);

insert into public.transactional_notification_templates
  (event_key, name, platform, is_active,
   email_subject_template, email_body_template,
   inapp_title_template, inapp_body_template)
select
  'aula_recordatorio_email',
  'Aula Virtual — recordatorio (sin WhatsApp)',
  'movi', true,
  'Tu clase "{{clase}}" empieza en {{minutos}} minutos',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
     <h2 style="color:#1C37E0;margin:0 0 12px;">Tu clase empieza pronto</h2>
     <p style="font-size:15px;line-height:1.6;">Hola {{nombre}},</p>
     <p style="font-size:15px;line-height:1.6;">
       La clase <strong>{{clase}}</strong> comienza en <strong>{{minutos}} minutos</strong>
       ({{hora}}). Te esperamos en el Aula Virtual.
     </p>
     <p style="margin:26px 0;">
       <a href="{{url}}" style="background:#1C37E0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block;">
         Entrar al Aula Virtual
       </a>
     </p>
     <p style="font-size:13px;color:#6b7280;">Seguros Education · MOVI Digital</p>
   </div>',
  'Tu clase empieza en {{minutos}} min',
  '{{clase}} · {{hora}}'
where not exists (
  select 1 from public.transactional_notification_templates where event_key = 'aula_recordatorio_email'
);

-- ── 13. Cron de recordatorios (cada minuto) ────────────────────────────────
-- Mismo patrón que el resto de jobs del proyecto: llave desde vault.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'aula-recordatorios') then
      perform cron.schedule(
        'aula-recordatorios',
        '* * * * *',
        $job$
        SELECT net.http_post(
          url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/aula-recordatorios',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
          ),
          body := '{"procesar": true}'::jsonb,
          timeout_milliseconds := 50000
        );
        $job$
      );
    end if;
  end if;
end $$;