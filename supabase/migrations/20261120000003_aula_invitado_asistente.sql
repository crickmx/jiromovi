-- Invitación de asistentes externos al Aula Virtual (Seguros Education).
--
-- El link de asistentes es un token propio por evento, distinto del link de
-- ponentes: pide nombre, correo, WhatsApp y oficina, registra al invitado como
-- usuario con rol Agente y status 'pendiente_activacion' (para que un
-- administrador complete su registro y lo active) y lo deja entrar a la sala
-- como oyente. El link caduca al concluir la clase, igual que el de ponentes.
--
-- Aditiva: no cambia ninguna columna existente ni el flujo de ponentes.

begin;

alter table public.aula_eventos
  add column if not exists link_token_asistente text;

create unique index if not exists aula_eventos_link_token_asistente_key
  on public.aula_eventos (link_token_asistente)
  where link_token_asistente is not null;

alter table public.aula_invitados
  add column if not exists email      text,
  add column if not exists whatsapp   text,
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists usuario_id uuid references public.usuarios(id) on delete set null,
  add column if not exists tipo       text not null default 'ponente',
  add column if not exists registrado boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aula_invitados_tipo_check') then
    alter table public.aula_invitados
      add constraint aula_invitados_tipo_check check (tipo in ('ponente', 'asistente'));
  end if;
end $$;

-- Un asistente no se duplica por evento: se busca por correo.
create index if not exists aula_invitados_evento_email_idx
  on public.aula_invitados (evento_id, lower(email));

commit;
