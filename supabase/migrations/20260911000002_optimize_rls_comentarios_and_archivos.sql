-- Optimizacion de politicas RLS en ticket_comentarios y ticket_archivos

CREATE OR REPLACE FUNCTION public.can_access_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = p_ticket_id
    AND (
      public.is_admin_or_manager()
      OR (public.get_auth_user_role() = 'Empleado' AND (t.assigned_to_user_id = auth.uid() OR t.attending_user_id = auth.uid() OR t.assigned_to_user_id IS NULL))
      OR t.creado_por = auth.uid()
      OR (t.agente_id IN (SELECT agente_id FROM public.usuarios WHERE id = auth.uid() AND agente_id IS NOT NULL))
    )
  );
$$;

-- Indices para RLS y Joins
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket_id ON public.ticket_comentarios (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_autor_id ON public.ticket_comentarios (autor_id);
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_subido_por_id ON public.ticket_archivos (subido_por_id);

-- RLS ticket_comentarios
DROP POLICY IF EXISTS "ticket_comentarios_select_policy" ON public.ticket_comentarios;
CREATE POLICY "ticket_comentarios_select_policy" ON public.ticket_comentarios
FOR SELECT USING (
  public.can_access_ticket(ticket_id)
  AND (
    NOT es_interno
    OR public.get_auth_user_role() IN ('Administrador', 'Gerente', 'Empleado')
  )
);

DROP POLICY IF EXISTS "ticket_comentarios_insert_policy" ON public.ticket_comentarios;
CREATE POLICY "ticket_comentarios_insert_policy" ON public.ticket_comentarios
FOR INSERT WITH CHECK (
  autor_id = auth.uid()
  AND public.can_access_ticket(ticket_id)
);

DROP POLICY IF EXISTS "ticket_comentarios_update_policy" ON public.ticket_comentarios;
CREATE POLICY "ticket_comentarios_update_policy" ON public.ticket_comentarios
FOR UPDATE USING (
  autor_id = auth.uid() OR public.is_admin_or_manager()
);

DROP POLICY IF EXISTS "ticket_comentarios_delete_policy" ON public.ticket_comentarios;
CREATE POLICY "ticket_comentarios_delete_policy" ON public.ticket_comentarios
FOR DELETE USING (
  autor_id = auth.uid() OR public.is_admin_or_manager()
);

-- RLS ticket_archivos
DROP POLICY IF EXISTS "ticket_archivos_select_policy" ON public.ticket_archivos;
CREATE POLICY "ticket_archivos_select_policy" ON public.ticket_archivos
FOR SELECT USING (
  public.can_access_ticket(ticket_id)
  AND eliminado_at IS NULL
);

DROP POLICY IF EXISTS "ticket_archivos_insert_policy" ON public.ticket_archivos;
CREATE POLICY "ticket_archivos_insert_policy" ON public.ticket_archivos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.can_access_ticket(ticket_id)
);

DROP POLICY IF EXISTS "ticket_archivos_update_policy" ON public.ticket_archivos;
CREATE POLICY "ticket_archivos_update_policy" ON public.ticket_archivos
FOR UPDATE USING (
  subido_por_id = auth.uid()
  OR public.is_admin_or_manager()
);

DROP POLICY IF EXISTS "ticket_archivos_delete_policy" ON public.ticket_archivos;
CREATE POLICY "ticket_archivos_delete_policy" ON public.ticket_archivos
FOR DELETE USING (
  subido_por_id = auth.uid()
  OR public.is_admin_or_manager()
);
