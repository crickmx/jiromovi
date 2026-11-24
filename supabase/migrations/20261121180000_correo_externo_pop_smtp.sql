-- Canal de correo externo universal: POP3 para recibir, SMTP para enviar.
--
-- Es un canal APARTE del de IONOS y no lo toca: tablas nuevas, RPC nuevos y
-- funciones nuevas. El gestor de IONOS sigue leyendo en vivo por IMAP y sin
-- guardar nada; este canal guarda porque no tiene de otra.
--
-- Por qué guarda: POP3 no tiene carpetas, ni leído/no leído, ni mover, ni
-- borrar, ni búsqueda. Solo entrega mensajes. Para poder mostrarlos como un
-- buzón hay que bajarlos y quedárselos.
--
-- Consecuencias que quedan dichas aquí para que nadie las descubra después:
--   · "leído", "marcado" y "papelera" son NUESTROS y locales: ningún otro
--     cliente de correo los va a ver, porque POP3 no los transporta.
--   · Este canal ocupa disco de la base. La retención es una decisión, no un
--     accidente: ver `correo_externo_mensajes` al final del archivo.

-- ─── 1. El canal ────────────────────────────────────────────────────

create table if not exists public.correo_externo_canales (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.usuarios(id) on delete cascade,
  nombre            text not null,
  email             text not null,
  nombre_remitente  text,

  -- Entrada: POP3. `ssl` = TLS de entrada (995, lo normal);
  -- `starttls` = STLS sobre 110; `ninguno` = 110 pelado (solo servidores
  -- internos que lo exigen, nunca un proveedor de internet).
  pop_host          text not null,
  pop_port          integer not null default 995,
  pop_tls           text not null default 'ssl',
  pop_usuario       text,

  -- Salida: SMTP. `ssl` = 465, `starttls` = 587 (lo normal), `ninguno` = 25.
  smtp_host         text not null,
  smtp_port         integer not null default 587,
  smtp_tls          text not null default 'starttls',
  smtp_requiere_auth boolean not null default true,
  smtp_usuario      text,
  remitente_obligatorio text,

  -- No borrar del servidor al descargar. Por omisión SÍ deja copia: borrar
  -- correo de la cuenta de alguien sin que lo haya pedido es irreversible.
  dejar_copia       boolean not null default true,

  activo            boolean not null default true,
  estado_conexion   text,
  ultimo_error      text,
  ultima_sincronizacion timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'correo_externo_canales_pop_tls_check') then
    alter table public.correo_externo_canales
      add constraint correo_externo_canales_pop_tls_check check (pop_tls in ('ssl', 'starttls', 'ninguno')),
      add constraint correo_externo_canales_smtp_tls_check check (smtp_tls in ('ssl', 'starttls', 'ninguno'));
  end if;
end $$;

-- Un mismo buzón no puede estar en dos cuentas de MOVI (mismo criterio que
-- `email_configuraciones`). No se puede hacer un índice único "cruzado" entre
-- las dos tablas, así que esta regla se comprueba además en la función.
create unique index if not exists correo_externo_canales_email_unico
  on public.correo_externo_canales (lower(email));

create index if not exists correo_externo_canales_por_usuario_idx
  on public.correo_externo_canales (usuario_id, created_at);

-- ─── 2. Los mensajes bajados ────────────────────────────────────────
-- `uid_servidor` es el UIDL de POP3 y es lo que evita volver a bajar lo mismo
-- en cada sincronización. Cuando el servidor no ofrece UIDL se guarda el
-- sha256 del mensaje crudo, que cumple la misma función.

create table if not exists public.correo_externo_mensajes (
  id              uuid primary key default gen_random_uuid(),
  canal_id        uuid not null references public.correo_externo_canales(id) on delete cascade,
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  uid_servidor    text not null,

  message_id      text,
  remitente_nombre text,
  remitente_email text,
  destinatarios   text[] not null default '{}',
  cc              text[] not null default '{}',
  asunto          text,
  fecha           timestamptz,
  cuerpo_texto    text,
  cuerpo_html     text,
  tiene_adjuntos  boolean not null default false,
  tamano_bytes    integer,

  -- Estado LOCAL. POP3 no lleva ninguna de estas marcas.
  leido           boolean not null default false,
  marcado         boolean not null default false,
  eliminado_en    timestamptz,

  -- Lo que mandamos nosotros. POP3 no tiene carpeta de Enviados ni forma de
  -- archivarlos, así que sin esto "Enviados" quedaría vacío para siempre.
  es_enviado      boolean not null default false,

  descargado_en   timestamptz not null default now()
);

create unique index if not exists correo_externo_mensajes_uid_unico
  on public.correo_externo_mensajes (canal_id, uid_servidor);

-- La lista del buzón: por canal, los no borrados, más nuevos primero.
create index if not exists correo_externo_mensajes_bandeja_idx
  on public.correo_externo_mensajes (canal_id, fecha desc nulls last)
  where eliminado_en is null;

comment on table public.correo_externo_mensajes is
  'Mensajes bajados por POP3. Guardar es obligatorio aquí: POP3 no permite leer en vivo ni consultar al servidor después. Los adjuntos NO se guardan (solo se marca que los hay): necesitan Storage y firma de URL, y son la parte que más pesa.';

-- ─── 3. La credencial, cifrada y aparte ─────────────────────────────
-- Tabla propia a propósito: `email_credenciales` la usa el canal de IONOS y
-- no se toca ni se comparte con él. Misma llave maestra, mismo cifrado.

create table if not exists public.correo_externo_credenciales (
  canal_id        uuid primary key references public.correo_externo_canales(id) on delete cascade,
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  secreto_cifrado bytea not null,
  updated_at      timestamptz not null default now()
);

alter table public.correo_externo_credenciales enable row level security;
revoke all on table public.correo_externo_credenciales from anon, authenticated;

create or replace function public.correo_externo_cred_get(p_canal_id uuid, p_key text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result text;
begin
  select extensions.pgp_sym_decrypt(secreto_cifrado, p_key) into v_result
    from public.correo_externo_credenciales where canal_id = p_canal_id;
  return v_result;
exception when others then
  return null;
end;
$function$;

create or replace function public.correo_externo_cred_set(p_canal_id uuid, p_secreto text, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid;
begin
  select usuario_id into v_usuario from public.correo_externo_canales where id = p_canal_id;
  if v_usuario is null then
    raise exception 'El canal % no existe.', p_canal_id;
  end if;

  insert into public.correo_externo_credenciales (canal_id, usuario_id, secreto_cifrado, updated_at)
  values (p_canal_id, v_usuario, extensions.pgp_sym_encrypt(p_secreto, p_key), now())
  on conflict (canal_id) do update
    set secreto_cifrado = excluded.secreto_cifrado, updated_at = now();
end;
$function$;

revoke all on function public.correo_externo_cred_get(uuid, text) from public, anon, authenticated;
revoke all on function public.correo_externo_cred_set(uuid, text, text) from public, anon, authenticated;
grant execute on function public.correo_externo_cred_get(uuid, text) to service_role;
grant execute on function public.correo_externo_cred_set(uuid, text, text) to service_role;

-- ─── 4. Quién ve qué ────────────────────────────────────────────────
-- Regla única y en un solo lugar: es tuyo si es tu canal. Se escribe como un
-- EXISTS contra `correo_externo_canales` en vez de repetir la condición, así
-- las dos reglas —quién ve el canal y quién ve sus mensajes— no se pueden
-- separar nunca (es el mismo molde que la política de cargos de Store).

alter table public.correo_externo_canales enable row level security;
alter table public.correo_externo_mensajes enable row level security;

drop policy if exists correo_externo_canales_propio on public.correo_externo_canales;
create policy correo_externo_canales_propio on public.correo_externo_canales
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists correo_externo_mensajes_propio on public.correo_externo_mensajes;
create policy correo_externo_mensajes_propio on public.correo_externo_mensajes
  for all to authenticated
  using (exists (select 1 from public.correo_externo_canales c
                  where c.id = canal_id and c.usuario_id = auth.uid()))
  with check (exists (select 1 from public.correo_externo_canales c
                       where c.id = canal_id and c.usuario_id = auth.uid()));

grant select, insert, update, delete on public.correo_externo_canales to authenticated;
grant select, update, delete on public.correo_externo_mensajes to authenticated;

comment on policy correo_externo_canales_propio on public.correo_externo_canales is
  'Es tuyo si es tu canal. Ninguna otra política: ni Administrador ni Gerente ven el correo de nadie, igual que en el canal de IONOS.';

-- ─── 5. Fecha de cambio ─────────────────────────────────────────────

create or replace function public.correo_externo_toca_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_correo_externo_canales_updated on public.correo_externo_canales;
create trigger trg_correo_externo_canales_updated
  before update on public.correo_externo_canales
  for each row execute function public.correo_externo_toca_updated_at();

-- ─── 6. Retención: la decisión, explícita ───────────────────────────
-- Este canal guarda. Sin una regla, la tabla crece para siempre. Se deja la
-- consulta escrita para que borrar sea una decisión y no un descuido; NO se
-- programa ningún cron aquí (el canal de IONOS tampoco tiene, y meter uno
-- nuevo es otra conversación).
--
--   -- Borrar lo que ya está en la papelera desde hace más de 30 días:
--   delete from public.correo_externo_mensajes
--    where eliminado_en is not null and eliminado_en < now() - interval '30 days';
--
--   -- Ver cuánto ocupa el canal, por usuario:
--   select usuario_id, count(*), pg_size_pretty(sum(coalesce(tamano_bytes,0))::bigint)
--     from public.correo_externo_mensajes group by 1 order by 3 desc;
