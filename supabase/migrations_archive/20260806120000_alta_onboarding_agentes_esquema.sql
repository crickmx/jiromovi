-- ============================================================================
-- Módulo /alta — Onboarding de agentes (esquema base)
-- ----------------------------------------------------------------------------
-- Fecha: 2026-08-06
-- Objetivo: dar de alta agentes (con cédula / en desarrollo) con captura por
--   pasos, guardado parcial, verificación de identidad biométrica + firma de
--   contrato (Cincel), y alta automática al aprobar.
--
-- Reglas de aislamiento (ver PLAN_ALTA.md):
--   * TODO lo nuevo va prefijado `alta_*` para no chocar con tablas/tipos
--     existentes. No se modifica ninguna tabla actual.
--   * `firma_*` YA es firma de correo → aquí se usa `alta_agente_firma` +
--     prefijo `cincel` para firma de documentos.
--   * RLS: negado por defecto. El frontend público NUNCA escribe directo con la
--     anon key; todo pasa por edge functions con service_role. Solo se abren
--     políticas de LECTURA para Administradores (tablero de revisión).
--   * Los documentos previos a que exista el usuario viven en el bucket privado
--     `altas-onboarding` y en `alta_agente_documento`; al crear el usuario se
--     migran a `expediente_usuario` (que exige usuario_id NOT NULL).
-- ============================================================================

-- ─── Tipos (enums) ──────────────────────────────────────────────────────────

do $$ begin
  create type alta_tipo_agente as enum ('con_cedula', 'en_desarrollo');
exception when duplicate_object then null; end $$;

-- Estados globales del flujo (los 12 del brief).
do $$ begin
  create type alta_estado as enum (
    'draft',            -- iniciado, sin enviar nada aún
    'in_progress',      -- capturando pasos
    'identity_pending', -- verificación biométrica en curso (Cincel)
    'signature_pending',-- firma de contrato en curso (Cincel)
    'awaiting_review',  -- esperando revisión (automática o humana)
    'approved',         -- validaciones OK, listo para crear usuario
    'rejected',         -- rechazado
    'completed',        -- usuario Agente creado y activado
    'needs_retry',      -- falló identidad/firma, reintento inmediato disponible
    'resume_later',     -- el usuario decidió continuar después
    'human_review',     -- escalado a revisión humana
    'incomplete'        -- abandonado con datos faltantes
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type alta_paso_estado as enum ('pendiente', 'en_progreso', 'completado', 'error', 'omitido');
exception when duplicate_object then null; end $$;

-- Estado de la verificación de identidad (mapea resultado Cincel/mock).
do $$ begin
  create type alta_verificacion_estado as enum (
    'no_iniciada', 'pendiente', 'en_proceso', 'aprobada', 'rechazada', 'error'
  );
exception when duplicate_object then null; end $$;

-- Estado de la firma del contrato (mapea document.status + invite.status Cincel).
do $$ begin
  create type alta_firma_estado as enum (
    'no_iniciada', 'pendiente', 'enviada', 'abierta', 'firmada', 'rechazada', 'error'
  );
exception when duplicate_object then null; end $$;

-- ─── Función utilitaria de updated_at (aislada al módulo) ────────────────────

create or replace function alta_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Helper: ¿el usuario autenticado es Administrador? ───────────────────────
-- SECURITY DEFINER para poder leer `usuarios` desde las políticas sin recursión.
create or replace function alta_es_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
    where u.id = uid and u.rol = 'Administrador' and coalesce(u.activo, true)
  );
$$;

-- ============================================================================
-- 1) alta_agente — registro principal del onboarding
-- ============================================================================
create table if not exists alta_agente (
  id                    uuid primary key default gen_random_uuid(),
  folio                 text unique,                       -- se genera en edge function
  tipo_agente           alta_tipo_agente,                  -- null hasta que elige
  estado                alta_estado not null default 'draft',
  estado_anterior       alta_estado,
  paso_actual           text,

  -- Datos personales
  nombre                text,
  apellidos             text,
  fecha_nacimiento      date,
  curp                  text,
  rfc                   text,

  -- Contacto
  email                 text,
  whatsapp              text,
  telefono              text,

  -- Datos fiscales
  razon_social          text,
  regimen_fiscal        text,
  codigo_postal_fiscal  text,
  uso_cfdi              text,

  -- Datos bancarios (sensibles — solo referencia; carátula real va como documento)
  banco                 text,
  clabe                 text,
  cuenta_banco          text,

  -- Cédula (solo tipo con_cedula)
  cedula                text,
  cedula_vigencia       date,

  -- Póliza de Responsabilidad Civil (ambos tipos)
  poliza_rc_numero      text,
  poliza_rc_aseguradora text,
  poliza_rc_vigencia    date,

  -- Oficina: la asigna el EQUIPO interno, no el agente (queda pendiente al inicio)
  oficina_id            uuid references oficinas(id),

  -- Captura flexible / datos parciales adicionales
  datos                 jsonb not null default '{}'::jsonb,

  -- Referencias externas
  registro_interesado_id uuid references registro_interesados(id),
  usuario_id            uuid references usuarios(id),       -- set al crear el Agente
  identity_provider     text not null default 'cincel',
  signature_provider    text not null default 'cincel',
  cincel_team_uuid      text,
  cincel_folder_uuid    text,
  cincel_document_uuid  text,

  -- Reintentos
  intentos_verificacion int not null default 0,
  intentos_firma        int not null default 0,

  -- Revisión humana
  revision_notas        text,
  revisado_por          uuid references usuarios(id),
  revisado_at           timestamptz,

  -- Recuperación posterior (link "continuar después")
  resume_token          uuid not null default gen_random_uuid(),

  -- Auditoría
  created_by            uuid references usuarios(id),       -- null si es anónimo
  user_agent            text,
  ip_address            text,
  metadata              jsonb not null default '{}'::jsonb,

  -- Notificación de abandono (evita duplicados)
  abandono_notificado_at timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  completed_at          timestamptz
);

comment on table alta_agente is 'Onboarding de agentes (/alta). Un registro por proceso de alta. Datos parciales permitidos; se completa vía edge functions con service_role.';
comment on column alta_agente.oficina_id is 'Oficina asignada por el equipo interno (NO la elige el agente). Nullable hasta asignación.';
comment on column alta_agente.resume_token is 'Token opaco para retomar el alta después vía link, sin exponer el id.';

create index if not exists idx_alta_agente_estado       on alta_agente(estado);
create index if not exists idx_alta_agente_tipo          on alta_agente(tipo_agente);
create index if not exists idx_alta_agente_email         on alta_agente(lower(email));
create index if not exists idx_alta_agente_whatsapp      on alta_agente(whatsapp);
create index if not exists idx_alta_agente_resume_token  on alta_agente(resume_token);
create index if not exists idx_alta_agente_usuario_id    on alta_agente(usuario_id);
create index if not exists idx_alta_agente_cincel_doc    on alta_agente(cincel_document_uuid);
create index if not exists idx_alta_agente_created_at    on alta_agente(created_at desc);

drop trigger if exists trg_alta_agente_updated_at on alta_agente;
create trigger trg_alta_agente_updated_at before update on alta_agente
  for each row execute function alta_set_updated_at();

-- ============================================================================
-- 2) alta_agente_paso — estado por paso del wizard
-- ============================================================================
create table if not exists alta_agente_paso (
  id            uuid primary key default gen_random_uuid(),
  alta_id       uuid not null references alta_agente(id) on delete cascade,
  paso          text not null,
  estado        alta_paso_estado not null default 'pendiente',
  orden         int not null default 0,
  datos         jsonb not null default '{}'::jsonb,
  error_mensaje text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (alta_id, paso)
);

create index if not exists idx_alta_paso_alta on alta_agente_paso(alta_id);

drop trigger if exists trg_alta_paso_updated_at on alta_agente_paso;
create trigger trg_alta_paso_updated_at before update on alta_agente_paso
  for each row execute function alta_set_updated_at();

-- ============================================================================
-- 3) alta_agente_documento — documentos cargados (previos al usuario)
-- ============================================================================
create table if not exists alta_agente_documento (
  id             uuid primary key default gen_random_uuid(),
  alta_id        uuid not null references alta_agente(id) on delete cascade,
  tipo_documento text not null,   -- ine_frente | ine_reverso | selfie | csf | caratula_bancaria | cedula | poliza_rc | comprobante_domicilio | contrato | otro
  nombre_archivo text not null,
  archivo_path   text not null,   -- ruta en bucket privado `altas-onboarding`
  archivo_url    text,
  size_bytes     bigint default 0,
  mime_type      text default 'application/octet-stream',
  -- id del expediente_usuario creado al migrar (tras crear el usuario)
  migrado_expediente_id uuid references expediente_usuario(id),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_alta_doc_alta on alta_agente_documento(alta_id);
create index if not exists idx_alta_doc_tipo on alta_agente_documento(tipo_documento);

drop trigger if exists trg_alta_doc_updated_at on alta_agente_documento;
create trigger trg_alta_doc_updated_at before update on alta_agente_documento
  for each row execute function alta_set_updated_at();

-- ============================================================================
-- 4) alta_agente_verificacion — verificación de identidad (Cincel biométrico)
-- ============================================================================
create table if not exists alta_agente_verificacion (
  id             uuid primary key default gen_random_uuid(),
  alta_id        uuid not null references alta_agente(id) on delete cascade,
  proveedor      text not null default 'cincel',
  estado         alta_verificacion_estado not null default 'no_iniciada',
  external_id    text,   -- Cincel identity_verification_uuid
  invite_uuid    text,   -- invite asociado al firmante
  resultado      jsonb not null default '{}'::jsonb,  -- evidencias, rfc_validated, background check
  intentos       int not null default 0,
  limite_intentos int,
  error_mensaje  text,
  iniciada_at    timestamptz,
  resuelta_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_alta_verif_alta on alta_agente_verificacion(alta_id);
create index if not exists idx_alta_verif_external on alta_agente_verificacion(external_id);

drop trigger if exists trg_alta_verif_updated_at on alta_agente_verificacion;
create trigger trg_alta_verif_updated_at before update on alta_agente_verificacion
  for each row execute function alta_set_updated_at();

-- ============================================================================
-- 5) alta_agente_firma — firma del contrato (Cincel documento/invite)
-- ============================================================================
create table if not exists alta_agente_firma (
  id                    uuid primary key default gen_random_uuid(),
  alta_id               uuid not null references alta_agente(id) on delete cascade,
  proveedor             text not null default 'cincel',
  estado                alta_firma_estado not null default 'no_iniciada',
  documento_external_id text,   -- Cincel document uuid
  invite_external_id    text,   -- Cincel invite uuid
  contrato_version      text,
  documento_status      text,   -- raw: unsigned | partially_signed | signed
  invite_status         text,   -- raw: idle | sent | opened | completed
  documento_firmado_path text,  -- PDF firmado en storage
  constancia_path       text,   -- ZIP NOM-151 en storage
  error_mensaje         text,
  enviada_at            timestamptz,
  firmada_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_alta_firma_alta on alta_agente_firma(alta_id);
create index if not exists idx_alta_firma_doc on alta_agente_firma(documento_external_id);

drop trigger if exists trg_alta_firma_updated_at on alta_agente_firma;
create trigger trg_alta_firma_updated_at before update on alta_agente_firma
  for each row execute function alta_set_updated_at();

-- ============================================================================
-- 6) alta_agente_bitacora — historial / auditoría del avance
-- ============================================================================
create table if not exists alta_agente_bitacora (
  id              uuid primary key default gen_random_uuid(),
  alta_id         uuid not null references alta_agente(id) on delete cascade,
  evento          text not null,
  estado_anterior alta_estado,
  estado_nuevo    alta_estado,
  detalle         jsonb not null default '{}'::jsonb,
  actor           text not null default 'sistema',  -- sistema | usuario | admin | webhook | cron
  actor_usuario_id uuid references usuarios(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_alta_bitacora_alta on alta_agente_bitacora(alta_id, created_at desc);

-- ============================================================================
-- 7) cincel_webhook_logs — bitácora cruda de webhooks entrantes de Cincel
-- ============================================================================
create table if not exists cincel_webhook_logs (
  id         uuid primary key default gen_random_uuid(),
  evento     text,
  payload    jsonb,
  headers    jsonb,
  valido     boolean not null default false,   -- pasó validación de secret/HMAC
  alta_id    uuid references alta_agente(id),
  procesado  boolean not null default false,
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cincel_webhook_created on cincel_webhook_logs(created_at desc);
create index if not exists idx_cincel_webhook_alta on cincel_webhook_logs(alta_id);

-- ============================================================================
-- RLS — negado por defecto; solo lectura para Administradores.
-- Toda escritura ocurre vía edge functions con service_role (bypassa RLS).
-- ============================================================================
alter table alta_agente               enable row level security;
alter table alta_agente_paso          enable row level security;
alter table alta_agente_documento     enable row level security;
alter table alta_agente_verificacion  enable row level security;
alter table alta_agente_firma         enable row level security;
alter table alta_agente_bitacora      enable row level security;
alter table cincel_webhook_logs       enable row level security;

-- Lectura para Administradores (tablero de revisión de altas).
do $$
declare t text;
begin
  foreach t in array array[
    'alta_agente','alta_agente_paso','alta_agente_documento',
    'alta_agente_verificacion','alta_agente_firma','alta_agente_bitacora',
    'cincel_webhook_logs'
  ]
  loop
    execute format(
      'drop policy if exists %I on %I;',
      'admin_select_' || t, t
    );
    execute format(
      'create policy %I on %I for select to authenticated using (alta_es_admin(auth.uid()));',
      'admin_select_' || t, t
    );
  end loop;
end $$;

-- NOTA: no se crean políticas de INSERT/UPDATE/DELETE para anon/authenticated.
-- El acceso de escritura es exclusivo de service_role (edge functions).

-- ============================================================================
-- Storage: bucket privado para documentos del alta (previos al usuario).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('altas-onboarding', 'altas-onboarding', false)
on conflict (id) do nothing;

-- Sin políticas de storage para anon: la subida se hace con signed upload URLs
-- generadas por una edge function (service_role). Admin puede leer vía signed URL.
