-- Optimizacion de politicas RLS en tickets
-- Helpers STABLE para evaluacion de roles en cache por transaccion

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(get_auth_user_role() IN ('Administrador', 'Gerente'), false);
$$;

-- Indices para acelerar RLS en tickets
CREATE INDEX IF NOT EXISTS idx_tickets_creado_por ON public.tickets (creado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id ON public.tickets (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attending_user_id ON public.tickets (attending_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agente_id ON public.tickets (agente_id);

-- Politicas optimizadas para tickets
DROP POLICY IF EXISTS "tickets_select_policy" ON public.tickets;
CREATE POLICY "tickets_select_policy" ON public.tickets
FOR SELECT USING (
  is_admin_or_manager()
  OR (get_auth_user_role() = 'Empleado' AND (assigned_to_user_id = auth.uid() OR attending_user_id = auth.uid() OR assigned_to_user_id IS NULL))
  OR creado_por = auth.uid()
  OR (agente_id IN (SELECT agente_id FROM public.usuarios WHERE id = auth.uid() AND agente_id IS NOT NULL))
);

DROP POLICY IF EXISTS "tickets_insert_policy" ON public.tickets;
CREATE POLICY "tickets_insert_policy" ON public.tickets
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND (creado_por = auth.uid() OR is_admin_or_manager())
);

DROP POLICY IF EXISTS "tickets_update_policy" ON public.tickets;
CREATE POLICY "tickets_update_policy" ON public.tickets
FOR UPDATE USING (
  is_admin_or_manager()
  OR (get_auth_user_role() = 'Empleado' AND (assigned_to_user_id = auth.uid() OR attending_user_id = auth.uid()))
  OR creado_por = auth.uid()
);

DROP POLICY IF EXISTS "tickets_delete_policy" ON public.tickets;
CREATE POLICY "tickets_delete_policy" ON public.tickets
FOR DELETE USING (
  is_admin_or_manager()
);
