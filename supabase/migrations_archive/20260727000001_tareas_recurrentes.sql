-- Fase 1: Tareas Recurrentes
-- Tabla de configuración de recurrencia para tipos de trámite,
-- log de generaciones (evita duplicados del cron), y extensión de tickets.

CREATE TABLE public.ticket_tipos_recurrencia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tipo_id    UUID NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  activo            BOOLEAN NOT NULL DEFAULT true,

  -- Frecuencia
  frecuencia        TEXT NOT NULL CHECK (frecuencia IN ('diaria', 'semanal', 'mensual')),
  dias_semana       INT[],  -- 0=dom..6=sab; solo cuando frecuencia='semanal'
  dia_mes           INT CHECK (dia_mes BETWEEN 1 AND 28),  -- solo cuando frecuencia='mensual'

  -- Plazo (días desde la fecha de creación)
  dias_para_vencer  INT NOT NULL DEFAULT 1,

  -- Asignación
  asignacion_tipo   TEXT NOT NULL DEFAULT 'pool'
                      CHECK (asignacion_tipo IN ('pool', 'todos_del_grupo', 'usuario_especifico')),
  grupo_id          UUID REFERENCES public.tramites_grupos_visualizacion(id),
  usuario_id        UUID REFERENCES public.usuarios(id),

  -- Estatus inicial del ticket generado (si NULL usa el primero activo global)
  estatus_id_inicial UUID REFERENCES public.ticket_estatus(id),

  -- Rango temporal de la recurrencia
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin         DATE,

  created_by        UUID REFERENCES public.usuarios(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.ticket_tipos_recurrencia(activo);
CREATE INDEX ON public.ticket_tipos_recurrencia(ticket_tipo_id);

-- Previene que el cron genere duplicados el mismo día
CREATE TABLE public.ticket_recurrencia_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrencia_id  UUID NOT NULL REFERENCES public.ticket_tipos_recurrencia(id) ON DELETE CASCADE,
  fecha_generada  DATE NOT NULL,
  tickets_creados INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recurrencia_id, fecha_generada)
);

-- Extensión de tickets: origen de recurrencia y fecha de vencimiento
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS recurrencia_id         UUID REFERENCES public.ticket_tipos_recurrencia(id),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_tarea DATE;

CREATE INDEX ON public.tickets(recurrencia_id) WHERE recurrencia_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.ticket_tipos_recurrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_recurrencia_log   ENABLE ROW LEVEL SECURITY;

-- Administrador y Gerente: acceso completo
CREATE POLICY "recurrencia_admin_all" ON public.ticket_tipos_recurrencia
  FOR ALL TO authenticated
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

-- Líderes, supervisores y directores: leen las de su grupo
CREATE POLICY "recurrencia_lider_read" ON public.ticket_tipos_recurrencia
  FOR SELECT TO authenticated
  USING (
    grupo_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.tramites_grupos_miembros tgm
      WHERE tgm.grupo_id   = ticket_tipos_recurrencia.grupo_id
        AND tgm.usuario_id = auth.uid()
        AND tgm.rol_en_equipo IN ('lider', 'supervisor', 'director')
    )
  );

CREATE POLICY "log_admin_all" ON public.ticket_recurrencia_log
  FOR ALL TO authenticated
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );
