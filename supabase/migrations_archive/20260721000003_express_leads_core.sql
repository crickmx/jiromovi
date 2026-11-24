/*
  # seguros.express — Tablas base (Parte C.2 / C.3)

  - express_leads: el lead capturado desde la landing pública seguros.express.
  - express_leads_config: fila única de configuración del motor de matching
    (Parte D), editable desde panel admin. Defaults confirmados: anillo inicial
    5 km, incremento +5 km, intervalo 3 min, tope 50 km.
  - express_lead_agentes_notificados: registro de a qué agentes ya se notificó
    cada lead (evita re-notificar al expandir el anillo — Parte D.2).

  Todo aditivo. RLS y funciones de matching viven en la migración 000004.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- express_leads
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.express_leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL,
  telefono              text NOT NULL,
  email                 text,
  tipo_seguro_interes   text,
  lat                   numeric,
  lng                   numeric,
  direccion_manual      text,
  ubicacion_metodo      text CHECK (ubicacion_metodo IS NULL OR ubicacion_metodo IN ('gps', 'manual')),
  anillo_km_actual      integer NOT NULL DEFAULT 5,
  estado                text NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'notificado', 'contactado', 'convertido', 'expirado')),
  agente_asignado_id    uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  crm_contacto_id       uuid REFERENCES public.crm_contactos(id) ON DELETE SET NULL,
  -- Timing del motor de escalamiento
  ultima_expansion_at   timestamptz NOT NULL DEFAULT now(),
  tope_alcanzado_at     timestamptz,        -- cuándo llegó al tope máximo de km
  admin_notificado_at   timestamptz,        -- cuándo se avisó a Admin de "sin match" (una sola vez)
  -- Metadatos de origen / antifraude
  recaptcha_score       numeric,
  origen                text DEFAULT 'seguros.express',
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS express_leads_estado_idx
  ON public.express_leads (estado);
CREATE INDEX IF NOT EXISTS express_leads_agente_idx
  ON public.express_leads (agente_asignado_id);
-- Para el cron: leads notificados sin tomar, listos para expandir.
CREATE INDEX IF NOT EXISTS express_leads_pendientes_escalar_idx
  ON public.express_leads (ultima_expansion_at)
  WHERE estado = 'notificado' AND agente_asignado_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- express_leads_config (fila única)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.express_leads_config (
  id                       integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  anillo_km_inicial        integer NOT NULL DEFAULT 5,
  incremento_km            integer NOT NULL DEFAULT 5,
  intervalo_minutos        integer NOT NULL DEFAULT 3,
  tope_maximo_km           integer NOT NULL DEFAULT 50,
  -- Extra (documentado): minutos adicionales tras llegar al tope sin ser tomado
  -- antes de marcar el lead como 'expirado'. Configurable, no hardcodeado.
  expiracion_minutos_extra integer NOT NULL DEFAULT 30,
  -- Interruptor maestro del motor (por si se quiere pausar todo desde admin).
  activo                   boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- Sembrar la fila única con los defaults confirmados.
INSERT INTO public.express_leads_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- express_lead_agentes_notificados
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.express_lead_agentes_notificados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.express_leads(id) ON DELETE CASCADE,
  usuario_id   uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  anillo_km    integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS express_lead_agentes_notificados_lead_idx
  ON public.express_lead_agentes_notificados (lead_id);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_express_leads_updated_at ON public.express_leads;
CREATE TRIGGER trg_express_leads_updated_at
  BEFORE UPDATE ON public.express_leads
  FOR EACH ROW EXECUTE FUNCTION public.express_set_updated_at();

DROP TRIGGER IF EXISTS trg_express_leads_config_updated_at ON public.express_leads_config;
CREATE TRIGGER trg_express_leads_config_updated_at
  BEFORE UPDATE ON public.express_leads_config
  FOR EACH ROW EXECUTE FUNCTION public.express_set_updated_at();
