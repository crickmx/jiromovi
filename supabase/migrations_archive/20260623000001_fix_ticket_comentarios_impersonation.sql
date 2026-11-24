/*
  # Fix INSERT policies para suplantación de identidad (ticket_comentarios + ticket_archivos)

  ## Problema
  Cuando un Administrador suplanta a un Agente (ImpersonationContext),
  `usuario.id` en React = UUID del agente suplantado,
  pero `auth.uid()` en Supabase = UUID del admin autenticado.

  Las políticas `WITH CHECK (usuario_id = auth.uid())` fallan porque
  el admin inserta con `usuario_id = agente_uuid ≠ admin_uuid`.

  La política INSERT de `tickets` ya tiene el bypass para admins:
  `get_my_rol() = 'Administrador' OR creado_por = auth.uid()`

  ## Fix
  Agrega el mismo bypass de admin a ticket_comentarios y ticket_archivos,
  permitiendo a los administradores insertar en nombre de otro usuario
  durante la suplantación.
*/

-- ── ticket_comentarios ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ticket_comentarios_insert_all" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_insert_all"
  ON ticket_comentarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_rol() = 'Administrador'
    OR
    usuario_id = auth.uid()
  );

-- ── ticket_archivos ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ticket_archivos_insert_all" ON ticket_archivos;
DROP POLICY IF EXISTS "Users can insert own files" ON ticket_archivos;

CREATE POLICY "ticket_archivos_insert_all"
  ON ticket_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_rol() = 'Administrador'
    OR
    usuario_id = auth.uid()
  );
