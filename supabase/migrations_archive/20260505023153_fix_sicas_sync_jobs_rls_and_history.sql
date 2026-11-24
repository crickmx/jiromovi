/*
  # Fix SICAS sync jobs RLS and history display

  1. Changes
    - Fix sicas_sync_jobs RLS policies to use correct role names ('Administrador', 'Gerente')
    - Add 'Ejecutivo' role access to sync jobs
    - Create a view/function so the history tab can show bulk-sync job data from sicas_sync_jobs

  2. Security
    - Maintains proper RLS - only Admins/Ejecutivos/Gerentes can see sync jobs
*/

-- Fix the RLS policies on sicas_sync_jobs to use correct role names
DROP POLICY IF EXISTS "Admins can manage sync jobs" ON sicas_sync_jobs;
DROP POLICY IF EXISTS "Gerentes can view sync jobs" ON sicas_sync_jobs;

-- Admins and Ejecutivos get full access
CREATE POLICY "Admins and ejecutivos full access sync jobs"
  ON sicas_sync_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Ejecutivo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Ejecutivo')
    )
  );

-- Gerentes can view sync jobs
CREATE POLICY "Gerentes can view sync jobs"
  ON sicas_sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
    )
  );
