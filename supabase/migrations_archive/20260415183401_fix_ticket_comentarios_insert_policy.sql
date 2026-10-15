/*
  # Fix ticket_comentarios INSERT policy

  ## Problem
  The INSERT policy uses `(SELECT auth.uid() AS uid)` which is a set-returning
  subquery. This causes "set-returning functions are not allowed in WHERE" when
  PostgREST evaluates the WITH CHECK clause.

  ## Fix
  Replace (SELECT auth.uid() AS uid) with auth.uid() directly.
*/

DROP POLICY IF EXISTS "ticket_comentarios_insert_all" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_insert_all"
  ON ticket_comentarios
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());
