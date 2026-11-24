-- ============================================================
-- EXTRACCIÓN AUTOMÁTICA DE PDF PARA REGISTRO DE PÓLIZA
-- ============================================================
-- 1. Categoría "Póliza PDF" en maestro_adjunto_categorias
-- 2. Tabla poliza_datos_extraidos — almacena resultados de extracción
-- 3. Tabla poliza_pdf_extraccion_config — configura notificaciones por tipo+categoría
-- ============================================================

-- 1. Categoría "Póliza PDF"
INSERT INTO public.maestro_adjunto_categorias (nombre, descripcion, orden, activo)
VALUES ('Póliza PDF', 'PDF de póliza para extracción automática de datos', 99, true)
ON CONFLICT DO NOTHING;

-- 2. Tabla principal de datos extraídos
CREATE TABLE IF NOT EXISTS public.poliza_datos_extraidos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  archivo_id      uuid REFERENCES public.ticket_archivos(id) ON DELETE SET NULL,

  -- Control de extracción
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'ok', 'error', 'no_reconocida')),
  error_detalle   text,
  extraido_en     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Detección automática
  aseguradora     text,
  ramo            text,
  sub_ramo        text,

  -- Datos del asegurado
  entidad         smallint CHECK (entidad IN (0, 1)), -- 0=física, 1=moral
  nombre_completo text,    -- nombre completo; SICAS hace la división
  razon_social    text,    -- solo personas morales
  rfc             text,

  -- Datos de la póliza
  tipo_documento  text NOT NULL DEFAULT 'Póliza',
  documento       text,    -- número de póliza
  agente_clave    text,    -- clave con la compañía
  agente_nombre   text,
  forma_pago      text,
  moneda          text,

  -- Captura manual por Mesa de Control
  renovacion      integer,
  fecha_antiguedad date,
  ejecutivo_cuenta text,   -- captura manual por ahora

  -- Vigencia
  desde           date,
  hasta           date,
  estatus         smallint NOT NULL DEFAULT 0, -- siempre 0 (Vigente)

  -- Importes
  prima_neta      numeric(12,2),
  descuento       numeric(12,2),
  recargos        numeric(12,2),
  derechos        numeric(12,2),
  sub_total       numeric(12,2),
  iva             numeric(12,2),
  prima_total     numeric(12,2),
  concepto        text,

  -- Solo vehículos
  serie           text,
  descripcion_veh text,
  modelo          text,    -- año del vehículo
  motor           text,
  placas          text,

  -- Contexto adicional (no en SICAS)
  cp              text,
  colonia         text,
  municipio       text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_poliza_extraidos_archivo_unique ON public.poliza_datos_extraidos(archivo_id);
CREATE INDEX IF NOT EXISTS idx_poliza_extraidos_ticket ON public.poliza_datos_extraidos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_poliza_extraidos_estado ON public.poliza_datos_extraidos(estado);

ALTER TABLE public.poliza_datos_extraidos ENABLE ROW LEVEL SECURITY;

-- Admins y equipo interno ven todo
CREATE POLICY "poliza_extraidos_select" ON public.poliza_datos_extraidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Empleado')
      AND u.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (t.agente_id = auth.uid() OR t.creado_por = auth.uid())
    )
  );

CREATE POLICY "poliza_extraidos_insert" ON public.poliza_datos_extraidos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "poliza_extraidos_update" ON public.poliza_datos_extraidos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Empleado')
      AND u.deleted_at IS NULL
    )
  );

-- Service role sin restricciones (para edge functions)
CREATE POLICY "poliza_extraidos_service" ON public.poliza_datos_extraidos
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Configuración de notificaciones por tipo de trámite + categoría de archivo
CREATE TABLE IF NOT EXISTS public.poliza_pdf_extraccion_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tipo_id  uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  categoria_id    uuid NOT NULL REFERENCES public.maestro_adjunto_categorias(id) ON DELETE CASCADE,
  notificar_agente boolean NOT NULL DEFAULT true,
  notificar_grupos uuid[] NOT NULL DEFAULT '{}',
  plantilla_agente text,   -- tokens: {numero_poliza}, {aseguradora}, {cliente}, {desde}, {hasta}, {prima_total}, {placas}
  plantilla_equipo text,   -- mismos tokens + {agente_nombre}, {folio}
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_tipo_id, categoria_id)
);

ALTER TABLE public.poliza_pdf_extraccion_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poliza_config_select" ON public.poliza_pdf_extraccion_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "poliza_config_all_admin" ON public.poliza_pdf_extraccion_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.deleted_at IS NULL
    )
  );

CREATE POLICY "poliza_config_service" ON public.poliza_pdf_extraccion_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_poliza_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_poliza_config_updated_at
  BEFORE UPDATE ON public.poliza_pdf_extraccion_config
  FOR EACH ROW EXECUTE FUNCTION public.set_poliza_config_updated_at();
