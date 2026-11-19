-- Tope anti-abuso del gestor de correo.
--
-- Cada acción de `ionos-webmail` abre y cierra su propia conexión TLS contra
-- imap.ionos.mx: no hay pool de conexiones ni caché de mensajes. Eso está bien
-- con el uso normal de una persona leyendo su correo, pero una ráfaga —un
-- refresco en bucle, una pestaña que reintenta sola, un script— deja el buzón
-- de esa persona sin poder abrir sesión, porque IONOS limita las conexiones
-- simultáneas POR BUZÓN.
--
-- La función cuenta los eventos del último minuto por usuario y responde 429
-- al pasarse del tope. Se guardan como filas y no en un contador por dos
-- razones: el tope sobrevive a un reinicio del worker de la función, y queda
-- el rastro de quién y cuándo — que es lo que hoy no existe en ningún lado.

create table if not exists public.email_webmail_eventos (
  id         bigserial primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

-- La consulta del tope es siempre (usuario, últimos 60 segundos).
create index if not exists email_webmail_eventos_usuario_creado_idx
  on public.email_webmail_eventos (usuario_id, creado_en desc);

-- Solo la toca la edge function, que entra con la llave de servicio y no pasa
-- por RLS. Con RLS encendida y sin ninguna política, nadie más la lee ni la
-- escribe. Lo de abajo es por si el esquema tiene permisos por defecto.
alter table public.email_webmail_eventos enable row level security;

revoke all on table public.email_webmail_eventos from anon, authenticated;
revoke all on sequence public.email_webmail_eventos_id_seq from anon, authenticated;

comment on table public.email_webmail_eventos is
  'Una fila por petición atendida por ionos-webmail. Sirve para el tope por usuario y como rastro de uso del gestor de correo.';
