/*
  # Fix CRM Tareas RLS for Edge Functions
  
  Permite que las edge functions (usando service_role) puedan crear tareas en crm_tareas.
  Esto es necesario para el sistema de leads web que crea tareas de seguimiento automáticamente.
  
  ## Cambios
  - Agregar política de INSERT para service_role en crm_tareas
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can insert tasks" ON crm_tareas;

-- Permitir INSERT desde edge functions
CREATE POLICY "Service role can insert tasks"
  ON crm_tareas
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir SELECT desde edge functions (para verificar tareas creadas)
DROP POLICY IF EXISTS "Service role can select tasks" ON crm_tareas;

CREATE POLICY "Service role can select tasks"
  ON crm_tareas
  FOR SELECT
  TO service_role
  USING (true);
