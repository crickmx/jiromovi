-- ─── Bloque A2: tramites_usuarios + _empleados + _agentes ────────────────────
-- Perfil modular del módulo de trámites separado de la tabla global 'usuarios'.
-- tramites_usuarios_empleados: permite polivalencia (usuario en N equipos).
-- tramites_usuarios_agentes: asignación de agentes externos.

-- 1. tramites_usuarios: perfil con rol global del módulo
CREATE TABLE IF NOT EXISTS public.tramites_usuarios (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE
                              REFERENCES public.usuarios(id) ON DELETE CASCADE,
  rol_global      text        NOT NULL DEFAULT 'empleado'
                              CHECK (rol_global IN (
                                'empleado', 'agente', 'supervisor', 'admin'
                              )),
  oficina_id      uuid        REFERENCES public.maestro_despachos(id) ON DELETE SET NULL,
  activo          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tramites_usuarios IS
  'Perfil de usuario específico del módulo TRÁMITES. No reemplaza la tabla usuarios global.';
COMMENT ON COLUMN public.tramites_usuarios.rol_global IS
  'empleado: ejecutivo interno; agente: externo con despacho; supervisor: líder multi-equipo; admin: configuración del módulo.';

-- Seed desde usuarios existentes
INSERT INTO public.tramites_usuarios (user_id, rol_global)
SELECT
  id,
  CASE rol
    WHEN 'Administrador' THEN 'admin'
    WHEN 'Agente'        THEN 'agente'
    ELSE                      'empleado'
  END
FROM public.usuarios
WHERE activo = true
ON CONFLICT (user_id) DO NOTHING;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tramites_usuarios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tramites_usuarios_updated ON public.tramites_usuarios;
CREATE TRIGGER trg_tramites_usuarios_updated
  BEFORE UPDATE ON public.tramites_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.tramites_usuarios_updated_at();

-- 2. tramites_usuarios_empleados: membresía polivalente multi-equipo
--    UNIQUE(tramite_usuario_id, equipo_id) = un rol por equipo, N equipos por usuario
CREATE TABLE IF NOT EXISTS public.tramites_usuarios_empleados (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_usuario_id  uuid        NOT NULL
                                  REFERENCES public.tramites_usuarios(id) ON DELETE CASCADE,
  equipo_id           uuid        NOT NULL
                                  REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  rol_equipo          text        NOT NULL DEFAULT 'ejecutivo'
                                  CHECK (rol_equipo IN ('lider', 'ejecutivo')),
  activo              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tramite_usuario_id, equipo_id)
);

COMMENT ON TABLE public.tramites_usuarios_empleados IS
  'Membresía de un empleado en equipos. Un usuario puede pertenecer a N equipos (polivalencia). rol_equipo = lider | ejecutivo.';
COMMENT ON COLUMN public.tramites_usuarios_empleados.rol_equipo IS
  'lider: puede asignar a otros en el equipo; ejecutivo: puede auto-asignarse trámites del pool.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_tue_tramite_usuario
  ON public.tramites_usuarios_empleados(tramite_usuario_id);
CREATE INDEX IF NOT EXISTS idx_tue_equipo
  ON public.tramites_usuarios_empleados(equipo_id);

-- Seed desde tramites_grupos_miembros (tabla existente)
-- 'miembro' mapea a 'ejecutivo' (rol mínimo con auto-asignación)
INSERT INTO public.tramites_usuarios_empleados (tramite_usuario_id, equipo_id, rol_equipo)
SELECT
  tu.id,
  gm.grupo_id,
  CASE gm.rol_en_equipo
    WHEN 'lider'    THEN 'lider'
    ELSE                 'ejecutivo'
  END
FROM   public.tramites_grupos_miembros gm
JOIN   public.tramites_usuarios        tu ON tu.user_id = gm.usuario_id
ON CONFLICT (tramite_usuario_id, equipo_id) DO NOTHING;

-- 3. tramites_usuarios_agentes: agentes externos con asignación doble
CREATE TABLE IF NOT EXISTS public.tramites_usuarios_agentes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_usuario_id      uuid        NOT NULL
                                      REFERENCES public.tramites_usuarios(id) ON DELETE CASCADE,
  maestro_agente_id       uuid        REFERENCES public.maestro_agentes(id) ON DELETE SET NULL,
  equipo_asignado_id      uuid        REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE SET NULL,
  ejecutivo_asignado_id   uuid        REFERENCES public.tramites_usuarios(id) ON DELETE SET NULL,
  activo                  boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tramites_usuarios_agentes IS
  'Datos de agente externo: referencia al catálogo maestro, equipo y ejecutivo JIRO que lo atiende.';

-- Seed desde maestro_usuario_agente (si un agente ya tiene usuario mapeado)
INSERT INTO public.tramites_usuarios_agentes (tramite_usuario_id, maestro_agente_id)
SELECT
  tu.id,
  mua.agente_id
FROM   public.maestro_usuario_agente mua
JOIN   public.tramites_usuarios      tu  ON tu.user_id = mua.user_id
WHERE  mua.activo = true
ON CONFLICT DO NOTHING;

-- ─── RLS para las 3 tablas ────────────────────────────────────────────────────

ALTER TABLE public.tramites_usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tramites_usuarios_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tramites_usuarios_agentes   ENABLE ROW LEVEL SECURITY;

-- tramites_usuarios: autenticados pueden leer; solo admin modifica
CREATE POLICY "tramites_usuarios_select"
  ON public.tramites_usuarios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tramites_usuarios_admin"
  ON public.tramites_usuarios FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

-- tramites_usuarios_empleados: autenticados pueden leer
CREATE POLICY "tue_select"
  ON public.tramites_usuarios_empleados FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tue_admin"
  ON public.tramites_usuarios_empleados FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente') AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente') AND activo = true)
  );

-- tramites_usuarios_agentes: autenticados pueden leer
CREATE POLICY "tua_select"
  ON public.tramites_usuarios_agentes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tua_admin"
  ON public.tramites_usuarios_agentes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );
