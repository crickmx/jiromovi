/*
  # Catálogos Maestros MOVI

  Módulo de catálogos maestros alimentados por importación Excel/CSV.
  Fuente de verdad para compañías, ramos, subramos, agentes, despachos y gerencias.
  Reemplaza las tablas insurance_types y aseguradoras para trámites.

  Estructura del Excel (3 pestañas con headers fijos):

    Pestaña "catalogo"   → compania | ramo | subramo | convenio
    Pestaña "vendedores" → vendedor | despacho | gerencia
    Pestaña "mapeo"      → vendedor | email_movi

  Modos de importación:
    "adicion"   → INSERT … ON CONFLICT DO NOTHING  (agrega, nunca sobreescribe)
    "reemplazo" → Borra todo el grupo y re-inserta  (ver función reemplazar_maestro_catalogo)

  Cascada de filtros habilitada por maestro_combinaciones:
    Ramo → Compañías que lo cubren
    Ramo + Compañía → Subramos válidos para esa combinación
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS DE VENDEDORES (se crean primero porque agentes depende de ellas)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maestro_despachos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL UNIQUE,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.maestro_despachos IS 'Oficinas / despachos de agentes. Pestaña "vendedores" col despacho.';

CREATE TABLE IF NOT EXISTS public.maestro_gerencias (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text        NOT NULL,
  despacho_id uuid        NOT NULL REFERENCES public.maestro_despachos(id) ON DELETE CASCADE,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nombre, despacho_id)
);
COMMENT ON TABLE public.maestro_gerencias IS 'Gerencias dentro de cada despacho. Pestaña "vendedores" col gerencia.';

CREATE TABLE IF NOT EXISTS public.maestro_agentes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text        NOT NULL,
  despacho_id uuid        NOT NULL REFERENCES public.maestro_despachos(id) ON DELETE RESTRICT,
  gerencia_id uuid        REFERENCES public.maestro_gerencias(id) ON DELETE SET NULL,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nombre, despacho_id)
);
COMMENT ON TABLE public.maestro_agentes IS 'Vendedores / agentes. Pestaña "vendedores" col vendedor.';

-- Un usuario de MOVI corresponde a un único agente de la base de datos
CREATE TABLE IF NOT EXISTS public.maestro_usuario_agente (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  agente_id  uuid        NOT NULL REFERENCES public.maestro_agentes(id) ON DELETE CASCADE,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.maestro_usuario_agente IS 'Mapeo usuario MOVI ↔ agente de la BD de Central de Producción. Pestaña "mapeo".';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS DE CATÁLOGO (compañías, ramos, subramos y sus combinaciones)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maestro_ramos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL UNIQUE,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.maestro_ramos IS 'Ramos de seguro. Pestaña "catalogo" col ramo.';

CREATE TABLE IF NOT EXISTS public.maestro_subramos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL,
  ramo_id    uuid        NOT NULL REFERENCES public.maestro_ramos(id) ON DELETE CASCADE,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nombre, ramo_id)
);
COMMENT ON TABLE public.maestro_subramos IS 'Subramos agrupados por ramo. Pestaña "catalogo" col subramo.';

CREATE TABLE IF NOT EXISTS public.maestro_companias (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL UNIQUE,
  convenio   boolean     NOT NULL DEFAULT false,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.maestro_companias IS 'Aseguradoras. convenio=true indica compañía preferente/con convenio. Pestaña "catalogo" col compania+convenio.';

-- Cada fila del Excel "catalogo" genera una combinación válida.
-- Esta tabla es la fuente de las cascadas: ramo→compañía y ramo+compañía→subramo.
CREATE TABLE IF NOT EXISTS public.maestro_combinaciones (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  compania_id uuid        NOT NULL REFERENCES public.maestro_companias(id) ON DELETE CASCADE,
  ramo_id     uuid        NOT NULL REFERENCES public.maestro_ramos(id) ON DELETE CASCADE,
  subramo_id  uuid        NOT NULL REFERENCES public.maestro_subramos(id) ON DELETE CASCADE,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compania_id, ramo_id, subramo_id)
);
COMMENT ON TABLE public.maestro_combinaciones IS 'Combinaciones válidas compañía+ramo+subramo. Fuente de verdad para filtros en cascada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- LOG DE IMPORTACIONES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maestro_importaciones (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  pestana        text        NOT NULL CHECK (pestana IN ('catalogo', 'vendedores', 'mapeo')),
  modo           text        NOT NULL CHECK (modo IN ('reemplazo', 'adicion')),
  nombre_archivo text        NOT NULL,
  total_filas    integer     NOT NULL DEFAULT 0,
  exitosas       integer     NOT NULL DEFAULT 0,
  omitidas       integer     NOT NULL DEFAULT 0,
  errores_json   jsonb,
  importado_por  uuid        NOT NULL REFERENCES public.usuarios(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.maestro_importaciones IS 'Historial de cada importación Excel/CSV. errores_json = [{fila, error}].';

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES PARA FILTROS EN CASCADA
-- ─────────────────────────────────────────────────────────────────────────────

-- Cascade ramo → compañías
CREATE INDEX IF NOT EXISTS idx_comb_ramo
  ON public.maestro_combinaciones(ramo_id) WHERE activo = true;

-- Cascade compañía → ramos
CREATE INDEX IF NOT EXISTS idx_comb_compania
  ON public.maestro_combinaciones(compania_id) WHERE activo = true;

-- Cascade ramo + compañía → subramos
CREATE INDEX IF NOT EXISTS idx_comb_ramo_compania
  ON public.maestro_combinaciones(ramo_id, compania_id) WHERE activo = true;

-- Subramos por ramo (lista simple)
CREATE INDEX IF NOT EXISTS idx_subramos_ramo
  ON public.maestro_subramos(ramo_id) WHERE activo = true;

-- Agentes por despacho y gerencia
CREATE INDEX IF NOT EXISTS idx_agentes_despacho
  ON public.maestro_agentes(despacho_id) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_agentes_gerencia
  ON public.maestro_agentes(gerencia_id) WHERE activo = true;

-- Gerencias por despacho
CREATE INDEX IF NOT EXISTS idx_gerencias_despacho
  ON public.maestro_gerencias(despacho_id) WHERE activo = true;

-- Mapeo usuario → agente
CREATE INDEX IF NOT EXISTS idx_usuario_agente_user
  ON public.maestro_usuario_agente(user_id) WHERE activo = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.maestro_despachos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_gerencias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_agentes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_usuario_agente   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_ramos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_subramos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_companias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_combinaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_importaciones    ENABLE ROW LEVEL SECURITY;

-- maestro_despachos
DROP POLICY IF EXISTS "auth_read_maestro_despachos"  ON public.maestro_despachos;
DROP POLICY IF EXISTS "admin_write_maestro_despachos" ON public.maestro_despachos;
CREATE POLICY "auth_read_maestro_despachos"  ON public.maestro_despachos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_despachos" ON public.maestro_despachos FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_gerencias
DROP POLICY IF EXISTS "auth_read_maestro_gerencias"  ON public.maestro_gerencias;
DROP POLICY IF EXISTS "admin_write_maestro_gerencias" ON public.maestro_gerencias;
CREATE POLICY "auth_read_maestro_gerencias"  ON public.maestro_gerencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_gerencias" ON public.maestro_gerencias FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_agentes
DROP POLICY IF EXISTS "auth_read_maestro_agentes"  ON public.maestro_agentes;
DROP POLICY IF EXISTS "admin_write_maestro_agentes" ON public.maestro_agentes;
CREATE POLICY "auth_read_maestro_agentes"  ON public.maestro_agentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_agentes" ON public.maestro_agentes FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_usuario_agente
DROP POLICY IF EXISTS "auth_read_maestro_usuario_agente"  ON public.maestro_usuario_agente;
DROP POLICY IF EXISTS "admin_write_maestro_usuario_agente" ON public.maestro_usuario_agente;
CREATE POLICY "auth_read_maestro_usuario_agente"  ON public.maestro_usuario_agente FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_usuario_agente" ON public.maestro_usuario_agente FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_ramos
DROP POLICY IF EXISTS "auth_read_maestro_ramos"  ON public.maestro_ramos;
DROP POLICY IF EXISTS "admin_write_maestro_ramos" ON public.maestro_ramos;
CREATE POLICY "auth_read_maestro_ramos"  ON public.maestro_ramos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_ramos" ON public.maestro_ramos FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_subramos
DROP POLICY IF EXISTS "auth_read_maestro_subramos"  ON public.maestro_subramos;
DROP POLICY IF EXISTS "admin_write_maestro_subramos" ON public.maestro_subramos;
CREATE POLICY "auth_read_maestro_subramos"  ON public.maestro_subramos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_subramos" ON public.maestro_subramos FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_companias
DROP POLICY IF EXISTS "auth_read_maestro_companias"  ON public.maestro_companias;
DROP POLICY IF EXISTS "admin_write_maestro_companias" ON public.maestro_companias;
CREATE POLICY "auth_read_maestro_companias"  ON public.maestro_companias FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_companias" ON public.maestro_companias FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_combinaciones
DROP POLICY IF EXISTS "auth_read_maestro_combinaciones"  ON public.maestro_combinaciones;
DROP POLICY IF EXISTS "admin_write_maestro_combinaciones" ON public.maestro_combinaciones;
CREATE POLICY "auth_read_maestro_combinaciones"  ON public.maestro_combinaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_maestro_combinaciones" ON public.maestro_combinaciones FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- maestro_importaciones (solo admins ven el historial de cargas)
DROP POLICY IF EXISTS "admin_all_maestro_importaciones" ON public.maestro_importaciones;
CREATE POLICY "admin_all_maestro_importaciones" ON public.maestro_importaciones FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador') WITH CHECK (get_my_rol() = 'Administrador');

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIONES DE CASCADA (usadas por el hook useMaestroCatalogos en el frontend)
-- ─────────────────────────────────────────────────────────────────────────────

-- Todas las compañías que cubren un ramo dado
CREATE OR REPLACE FUNCTION public.get_companias_por_ramo(p_ramo_id uuid)
RETURNS TABLE(id uuid, nombre text, convenio boolean)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT mc.id, mc.nombre, mc.convenio
  FROM   public.maestro_companias mc
  JOIN   public.maestro_combinaciones c ON c.compania_id = mc.id
  WHERE  c.ramo_id = p_ramo_id
    AND  c.activo  = true
    AND  mc.activo = true
  ORDER  BY mc.nombre;
$$;

-- Subramos válidos para una combinación ramo + compañía
CREATE OR REPLACE FUNCTION public.get_subramos_por_combinacion(
  p_ramo_id     uuid,
  p_compania_id uuid
)
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT ms.id, ms.nombre
  FROM   public.maestro_subramos ms
  JOIN   public.maestro_combinaciones c ON c.subramo_id = ms.id
  WHERE  c.ramo_id     = p_ramo_id
    AND  c.compania_id = p_compania_id
    AND  c.activo      = true
    AND  ms.activo     = true
  ORDER  BY ms.nombre;
$$;

-- Todos los ramos cubiertos por una compañía (cascada inversa)
CREATE OR REPLACE FUNCTION public.get_ramos_por_compania(p_compania_id uuid)
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT mr.id, mr.nombre
  FROM   public.maestro_ramos mr
  JOIN   public.maestro_combinaciones c ON c.ramo_id = mr.id
  WHERE  c.compania_id = p_compania_id
    AND  c.activo      = true
    AND  mr.activo     = true
  ORDER  BY mr.nombre;
$$;

-- Agente mapeado al usuario MOVI logueado (para auto-populate en formularios)
CREATE OR REPLACE FUNCTION public.get_mi_agente(p_user_id uuid)
RETURNS TABLE(
  agente_id uuid,
  nombre    text,
  despacho  text,
  gerencia  text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    a.id             AS agente_id,
    a.nombre,
    d.nombre         AS despacho,
    g.nombre         AS gerencia
  FROM   public.maestro_usuario_agente mua
  JOIN   public.maestro_agentes     a ON a.id = mua.agente_id
  JOIN   public.maestro_despachos   d ON d.id = a.despacho_id
  LEFT JOIN public.maestro_gerencias g ON g.id = a.gerencia_id
  WHERE  mua.user_id = p_user_id
    AND  mua.activo  = true
    AND  a.activo    = true
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: REEMPLAZO TOTAL POR PESTAÑA
--
-- Borra todos los registros de la pestaña indicada en el orden correcto
-- (respetando FKs) dentro de una sola transacción.
-- El frontend llama esta función ANTES de insertar los nuevos datos.
--
-- ADVERTENCIA: reemplazo de "vendedores" también borra el mapeo de usuarios
-- porque los IDs de agentes cambian. Deberás volver a importar la pestaña "mapeo".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reemplazar_maestro_catalogo(p_pestana text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo administradores pueden ejecutar esto
  IF (SELECT get_my_rol()) != 'Administrador' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol Administrador';
  END IF;

  IF p_pestana = 'catalogo' THEN
    DELETE FROM public.maestro_combinaciones;
    DELETE FROM public.maestro_subramos;
    DELETE FROM public.maestro_companias;
    DELETE FROM public.maestro_ramos;

  ELSIF p_pestana = 'vendedores' THEN
    -- Los mapeos apuntan a agentes; si borramos agentes se rompe la FK.
    -- Borramos mapeos también para que el admin los reimporte con la nueva data.
    DELETE FROM public.maestro_usuario_agente;
    DELETE FROM public.maestro_agentes;
    DELETE FROM public.maestro_gerencias;
    DELETE FROM public.maestro_despachos;

  ELSIF p_pestana = 'mapeo' THEN
    DELETE FROM public.maestro_usuario_agente;

  ELSE
    RAISE EXCEPTION 'Pestaña inválida: %. Valores válidos: catalogo | vendedores | mapeo', p_pestana;
  END IF;
END;
$$;
