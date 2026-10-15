-- Agenda nativa MOVI.digital - Fase 1
create extension if not exists btree_gist;

create table if not exists public.agenda_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.usuarios(id) on delete cascade,
  brand text,
  name text not null,
  color text not null default '#2563eb',
  timezone text not null default 'America/Mexico_City',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_event_types (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.agenda_calendars(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#2563eb',
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 720),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  min_notice_minutes integer not null default 60 check (min_notice_minutes >= 0),
  daily_limit integer check (daily_limit > 0),
  allowed_locations jsonb not null default '["jitsi"]'::jsonb,
  location_details jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_locations_array check (jsonb_typeof(allowed_locations) = 'array')
);

create table if not exists public.agenda_availability_rules (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.agenda_calendars(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.agenda_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.agenda_calendars(id) on delete cascade,
  exception_date date not null,
  is_full_day boolean not null default true,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.agenda_bookings (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.agenda_event_types(id),
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  location_type text not null check (location_type in ('in_person', 'phone', 'jitsi', 'google_meet')),
  meeting_url text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'rescheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at)
);

create table if not exists public.website_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.usuarios(id) on delete cascade,
  event_type_id uuid not null references public.agenda_event_types(id) on delete cascade,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, event_type_id)
);

create index if not exists agenda_calendars_user_idx on public.agenda_calendars(user_id);
create index if not exists agenda_event_types_calendar_idx on public.agenda_event_types(calendar_id);
create index if not exists agenda_rules_calendar_weekday_idx on public.agenda_availability_rules(calendar_id, weekday);
create index if not exists agenda_bookings_event_start_idx on public.agenda_bookings(event_type_id, start_at);

alter table public.agenda_calendars enable row level security;
alter table public.agenda_event_types enable row level security;
alter table public.agenda_availability_rules enable row level security;
alter table public.agenda_availability_exceptions enable row level security;
alter table public.agenda_bookings enable row level security;
alter table public.website_calendar_blocks enable row level security;

create policy "agenda calendars owner" on public.agenda_calendars for all
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "agenda event types owner" on public.agenda_event_types for all
  to authenticated
  using (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()));
create policy "agenda rules owner" on public.agenda_availability_rules for all
  to authenticated
  using (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()));
create policy "agenda exceptions owner" on public.agenda_availability_exceptions for all
  to authenticated
  using (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.agenda_calendars c where c.id = calendar_id and c.user_id = auth.uid()));
create policy "agenda bookings owner read" on public.agenda_bookings for select
  to authenticated
  using (exists (
    select 1 from public.agenda_event_types et join public.agenda_calendars c on c.id = et.calendar_id
    where et.id = event_type_id and c.user_id = auth.uid()
  ));
create policy "website calendar blocks owner" on public.website_calendar_blocks for all
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.agenda_calendars to authenticated;
grant select, insert, update, delete on public.agenda_event_types to authenticated;
grant select, insert, update, delete on public.agenda_availability_rules to authenticated;
grant select, insert, update, delete on public.agenda_availability_exceptions to authenticated;
grant select on public.agenda_bookings to authenticated;
grant select, insert, update, delete on public.website_calendar_blocks to authenticated;

create or replace function public.get_public_agenda_event_type(p_event_type_id uuid)
returns table (
  id uuid, calendar_id uuid, name text, description text, color text,
  duration_minutes integer, buffer_before_minutes integer, buffer_after_minutes integer,
  min_notice_minutes integer, daily_limit integer, allowed_locations jsonb,
  location_details jsonb, is_active boolean, calendar_name text, timezone text,
  organizer_name text
)
language sql stable security definer set search_path = public
as $$
  select et.id, et.calendar_id, et.name, et.description, et.color, et.duration_minutes,
    et.buffer_before_minutes, et.buffer_after_minutes, et.min_notice_minutes, et.daily_limit,
    et.allowed_locations, et.location_details, et.is_active, c.name, c.timezone,
    coalesce(u.nombre_publico, u.nombre_completo, 'Asesor')
  from agenda_event_types et
  join agenda_calendars c on c.id = et.calendar_id
  join usuarios u on u.id = c.user_id
  where et.id = p_event_type_id and et.is_active and c.is_active;
$$;

create or replace function public.get_agenda_available_slots(p_event_type_id uuid, p_date date)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_event agenda_event_types%rowtype;
  v_calendar agenda_calendars%rowtype;
  v_rule agenda_availability_rules%rowtype;
  v_cursor timestamptz;
  v_end timestamptz;
  v_day_count integer;
begin
  select * into v_event from agenda_event_types where id = p_event_type_id and is_active;
  if not found then return; end if;
  select * into v_calendar from agenda_calendars where id = v_event.calendar_id and is_active;
  if not found then return; end if;
  if exists (select 1 from agenda_availability_exceptions where calendar_id = v_calendar.id and exception_date = p_date and is_full_day) then return; end if;

  select count(*) into v_day_count from agenda_bookings b
  where b.event_type_id = p_event_type_id and b.status = 'confirmed'
    and (b.start_at at time zone v_calendar.timezone)::date = p_date;
  if v_event.daily_limit is not null and v_day_count >= v_event.daily_limit then return; end if;

  for v_rule in select * from agenda_availability_rules
    where calendar_id = v_calendar.id and weekday = extract(dow from p_date)::int and is_active
  loop
    v_cursor := (p_date + v_rule.start_time) at time zone v_calendar.timezone;
    v_end := (p_date + v_rule.end_time) at time zone v_calendar.timezone;
    while v_cursor + make_interval(mins => v_event.duration_minutes) <= v_end loop
      if v_cursor >= now() + make_interval(mins => v_event.min_notice_minutes)
        and not exists (
          select 1 from agenda_bookings b
          where b.event_type_id in (select id from agenda_event_types where calendar_id = v_calendar.id)
            and b.status = 'confirmed'
            and tstzrange(
              b.start_at - make_interval(mins => v_event.buffer_before_minutes),
              b.end_at + make_interval(mins => v_event.buffer_after_minutes), '[)'
            ) && tstzrange(v_cursor, v_cursor + make_interval(mins => v_event.duration_minutes), '[)')
        )
      then
        start_at := v_cursor;
        end_at := v_cursor + make_interval(mins => v_event.duration_minutes);
        return next;
      end if;
      v_cursor := v_cursor + interval '15 minutes';
    end loop;
  end loop;
end;
$$;

create or replace function public.create_public_agenda_booking(
  p_event_type_id uuid, p_start_at timestamptz, p_guest_name text, p_guest_email text,
  p_guest_phone text, p_location_type text
)
returns table (booking_id uuid, meeting_url text)
language plpgsql security definer set search_path = public
as $$
declare
  v_event agenda_event_types%rowtype;
  v_slot record;
  v_id uuid := gen_random_uuid();
  v_url text;
begin
  if length(trim(p_guest_name)) < 2 or p_guest_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Datos del invitado inválidos';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_event_type_id::text));
  select * into v_event from agenda_event_types where id = p_event_type_id and is_active;
  if not found or not (v_event.allowed_locations ? p_location_type) then raise exception 'Tipo de cita o modalidad inválida'; end if;
  select * into v_slot from get_agenda_available_slots(p_event_type_id, (p_start_at at time zone
    (select timezone from agenda_calendars where id = v_event.calendar_id))::date)
    where start_at = p_start_at;
  if not found then raise exception 'El horario ya no está disponible'; end if;
  if p_location_type = 'jitsi' then v_url := 'https://meet.jit.si/movi-' || replace(v_id::text, '-', ''); end if;
  insert into agenda_bookings(id, event_type_id, guest_name, guest_email, guest_phone, location_type, meeting_url, start_at, end_at)
  values(v_id, p_event_type_id, trim(p_guest_name), lower(trim(p_guest_email)), nullif(trim(p_guest_phone), ''), p_location_type, v_url, v_slot.start_at, v_slot.end_at);
  booking_id := v_id; meeting_url := v_url; return next;
end;
$$;

revoke all on function public.get_public_agenda_event_type(uuid) from public;
revoke all on function public.get_agenda_available_slots(uuid,date) from public;
revoke all on function public.create_public_agenda_booking(uuid,timestamptz,text,text,text,text) from public;
grant execute on function public.get_public_agenda_event_type(uuid) to anon, authenticated;
grant execute on function public.get_agenda_available_slots(uuid,date) to anon, authenticated;
grant execute on function public.create_public_agenda_booking(uuid,timestamptz,text,text,text,text) to anon, authenticated;

create or replace function public.get_public_website_calendar_blocks(p_slug text)
returns table (id uuid, name text, description text, duration_minutes integer)
language sql stable security definer set search_path = public
as $$
  select et.id, et.name, et.description, et.duration_minutes
  from website_calendar_blocks wb
  join usuarios u on u.id = wb.user_id
  join agenda_event_types et on et.id = wb.event_type_id
  join agenda_calendars c on c.id = et.calendar_id
  where u.web_slug = p_slug and wb.is_visible and et.is_active and c.is_active
  order by wb.display_order, wb.created_at;
$$;
revoke all on function public.get_public_website_calendar_blocks(text) from public;
grant execute on function public.get_public_website_calendar_blocks(text) to anon, authenticated;
