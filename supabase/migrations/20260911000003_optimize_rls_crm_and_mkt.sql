-- Migración para optimizar políticas RLS y rendimiento en CRM Contactos y Marketing
-- Fecha: 2026-09-11
-- Descripción: Elimina subconsultas repetitivas a usuarios y grupos de acceso en cada fila usando funciones helper STABLE

-- 1. Helper STABLE para validar si el usuario autenticado pertenece al equipo de Marketing o es Admin
CREATE OR REPLACE FUNCTION public.is_mkt_team_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.get_auth_user_role() = 'Administrador'
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
$$;

-- 2. Índices de optimización en CRM Contactos
CREATE INDEX IF NOT EXISTS idx_crm_contactos_agente_id ON public.crm_contactos(agente_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_oficina_id ON public.crm_contactos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_creado_por ON public.crm_contactos(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_estatus ON public.crm_contactos(estatus);

-- 3. Optimización de políticas RLS en CRM Contactos (crm_contactos)
DROP POLICY IF EXISTS "Users can view contacts based on role" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios solo ven sus propios contactos" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios solo crean contactos propios" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios actualizan sus propios contactos" ON public.crm_contactos;
DROP POLICY IF EXISTS "Admins y gerentes pueden actualizar contactos" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios solo actualizan sus propios contactos" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios solo eliminan sus propios contactos" ON public.crm_contactos;

-- SELECT: Administradores y Gerentes ven todos; los agentes ven sus propios contactos asignados o creados
CREATE POLICY "crm_contactos_select_policy"
  ON public.crm_contactos FOR SELECT
  TO authenticated
  USING (
    agente_id = auth.uid()
    OR creado_por = auth.uid()
    OR public.is_admin_or_manager()
  );

-- INSERT: Creador/agente es el usuario autenticado, o administradores/gerentes
CREATE POLICY "crm_contactos_insert_policy"
  ON public.crm_contactos FOR INSERT
  TO authenticated
  WITH CHECK (
    (agente_id = auth.uid() AND creado_por = auth.uid())
    OR public.is_admin_or_manager()
  );

-- UPDATE: Propietario del contacto o administradores/gerentes
CREATE POLICY "crm_contactos_update_policy"
  ON public.crm_contactos FOR UPDATE
  TO authenticated
  USING (
    agente_id = auth.uid()
    OR creado_por = auth.uid()
    OR public.is_admin_or_manager()
  )
  WITH CHECK (
    agente_id = auth.uid()
    OR creado_por = auth.uid()
    OR public.is_admin_or_manager()
  );

-- DELETE: Propietario del contacto o administradores
CREATE POLICY "crm_contactos_delete_policy"
  ON public.crm_contactos FOR DELETE
  TO authenticated
  USING (
    agente_id = auth.uid()
    OR creado_por = auth.uid()
    OR public.get_auth_user_role() = 'Administrador'
  );

-- 4. Optimización de políticas RLS en Marketing (publicidad_disenos)
DROP POLICY IF EXISTS "mkt_equipo_can_select_disenos" ON public.publicidad_disenos;
DROP POLICY IF EXISTS "mkt_equipo_can_insert_disenos" ON public.publicidad_disenos;
DROP POLICY IF EXISTS "mkt_equipo_can_update_disenos" ON public.publicidad_disenos;
DROP POLICY IF EXISTS "mkt_equipo_can_delete_disenos" ON public.publicidad_disenos;

CREATE POLICY "publicidad_disenos_mkt_select" ON public.publicidad_disenos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_mkt_team_or_admin()
  );

CREATE POLICY "publicidad_disenos_mkt_insert" ON public.publicidad_disenos
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    OR public.is_mkt_team_or_admin()
  );

CREATE POLICY "publicidad_disenos_mkt_update" ON public.publicidad_disenos
  FOR UPDATE TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_mkt_team_or_admin()
  )
  WITH CHECK (
    usuario_id = auth.uid()
    OR public.is_mkt_team_or_admin()
  );

CREATE POLICY "publicidad_disenos_mkt_delete" ON public.publicidad_disenos
  FOR DELETE TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_mkt_team_or_admin()
  );

-- 5. Optimización de campañas y presupuestos de marketing (mkt_campanias y mkt_campania_gastos)
DROP POLICY IF EXISTS "mkt_campanias_admin_equipo_all" ON public.mkt_campanias;
DROP POLICY IF EXISTS "mkt_campania_gastos_admin_equipo_all" ON public.mkt_campania_gastos;

CREATE POLICY "mkt_campanias_admin_equipo_all" ON public.mkt_campanias
  FOR ALL TO authenticated
  USING (public.is_mkt_team_or_admin())
  WITH CHECK (public.is_mkt_team_or_admin());

CREATE POLICY "mkt_campania_gastos_admin_equipo_all" ON public.mkt_campania_gastos
  FOR ALL TO authenticated
  USING (public.is_mkt_team_or_admin())
  WITH CHECK (public.is_mkt_team_or_admin());

-- 6. Optimización de triggers de marketing premium (mkt_premium_triggers y campos)
DROP POLICY IF EXISTS "mkt_premium_triggers_admin_all" ON public.mkt_premium_triggers;
DROP POLICY IF EXISTS "mkt_premium_triggers_equipo_all" ON public.mkt_premium_triggers;
DROP POLICY IF EXISTS "mkt_premium_trigger_campos_admin_all" ON public.mkt_premium_trigger_campos;
DROP POLICY IF EXISTS "mkt_premium_trigger_campos_equipo_all" ON public.mkt_premium_trigger_campos;

CREATE POLICY "mkt_premium_triggers_admin_equipo_all" ON public.mkt_premium_triggers
  FOR ALL TO authenticated
  USING (public.is_mkt_team_or_admin())
  WITH CHECK (public.is_mkt_team_or_admin());

CREATE POLICY "mkt_premium_trigger_campos_admin_equipo_all" ON public.mkt_premium_trigger_campos
  FOR ALL TO authenticated
  USING (public.is_mkt_team_or_admin())
  WITH CHECK (public.is_mkt_team_or_admin());
