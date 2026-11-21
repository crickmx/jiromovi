-- ============================================================================
-- WhatsApp personal: que la vinculación aguante
--
-- El servidor de WhatsApp (Baileys) guarda las credenciales en disco, pero su
-- estado vive en memoria: cuando el contenedor se reinicia, las sesiones
-- quedan "desconectadas" hasta que alguien entra a la página y pulsa Conectar.
-- Con `auto_reconnect` un cron puede revivirlas solo, sin QR.
-- ============================================================================

alter table public.whatsapp_sessions
  add column if not exists auto_reconnect boolean not null default false;

alter table public.whatsapp_sessions
  add column if not exists intentos_reconexion integer not null default 0;

comment on column public.whatsapp_sessions.auto_reconnect is
  'El usuario quiere esta sesión vinculada: el cron la reactiva si se cae.';
comment on column public.whatsapp_sessions.intentos_reconexion is
  'Intentos automáticos seguidos; se reinicia al conectar o al desvincular.';

-- Las que hoy están conectadas se quedan marcadas para siempre.
update public.whatsapp_sessions
set auto_reconnect = true,
    intentos_reconexion = 0
where status = 'connected';