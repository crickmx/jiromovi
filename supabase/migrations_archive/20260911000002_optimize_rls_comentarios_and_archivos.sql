-- ============================================================================
-- Migración: Optimización de Políticas RLS para Comentarios y Archivos
-- ============================================================================

-- 1. Helper STABLE para validar si un usuario tiene acceso al ticket
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
        OR t.creado_por = auth.uid()
        OR t.assigned_to_user_id = auth.uid()
        OR t.attending_user_id = auth.uid()
        OR t.agente_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.id = auth.uid() AND u.rol = 'Empleado'
        )
      )
  );
$$;

-- 2. Índices dedicados para Foreign Keys en ticket_comentarios y ticket_archivos
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket_id ON public.ticket_comentarios (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_usuario_id ON public.ticket_comentarios (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_usuario_id ON public.ticket_archivos (usuario_id);

-- 3. Optimización RLS en ticket_comentarios
DROP POLICY IF EXISTS "ticket_comentarios_select_policy" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_policy" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_update_policy" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_delete_policy" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "Users can view comments" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "Users can insert comments" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "Users can update comments" ON public.ticket_comentarios;
DROP POLICY IF EXISTS "Users can delete comments" ON public.ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_policy"
ON public.ticket_comentarios
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_manager()
  OR public.can_access_ticket(ticket_id)
);

CREATE POLICY "ticket_comentarios_insert_policy"
ON public.ticket_comentarios
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_manager()
  OR (usuario_id = auth.uid() AND public.can_access_ticket(ticket_id))
);

CREATE POLICY "ticket_comentarios_update_policy"
ON public.ticket_comentarios
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
)
WITH CHECK (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
);

CREATE POLICY "ticket_comentarios_delete_policy"
ON public.ticket_comentarios
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
);

-- 4. Optimización RLS en ticket_archivos
DROP POLICY IF EXISTS "ticket_archivos_select_policy" ON public.ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_policy" ON public.ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_update_policy" ON public.ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_delete_policy" ON public.ticket_archivos;
DROP POLICY IF EXISTS "Users can view ticket files" ON public.ticket_archivos;
DROP POLICY IF EXISTS "Users can insert ticket files" ON public.ticket_archivos;
DROP POLICY IF EXISTS "Users can update ticket files" ON public.ticket_archivos;
DROP POLICY IF EXISTS "Users can delete ticket files" ON public.ticket_archivos;

CREATE POLICY "ticket_archivos_select_policy"
ON public.ticket_archivos
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_manager()
  OR public.can_access_ticket(ticket_id)
);

CREATE POLICY "ticket_archivos_insert_policy"
ON public.ticket_archivos
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_manager()
  OR (usuario_id = auth.uid() AND public.can_access_ticket(ticket_id))
);

CREATE POLICY "ticket_archivos_update_policy"
ON public.ticket_archivos
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
)
WITH CHECK (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
);

CREATE POLICY "ticket_archivos_delete_policy"
ON public.ticket_archivos
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_manager()
  OR usuario_id = auth.uid()
);
