/*
  # Fix CRM Contactos RLS for Edge Functions
  
  Permite que las edge functions (usando service_role) puedan crear y actualizar contactos en crm_contactos.
  Esto es necesario para el sistema de leads web.
  
  ## Cambios
  - Agregar política de INSERT para service_role en crm_contactos
  - Agregar política de UPDATE para service_role en crm_contactos
  - Agregar política de SELECT para service_role en crm_contactos
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can insert contacts" ON crm_contactos;
DROP POLICY IF EXISTS "Service role can update contacts" ON crm_contactos;
DROP POLICY IF EXISTS "Service role can select contacts" ON crm_contactos;

-- Permitir INSERT desde edge functions
CREATE POLICY "Service role can insert contacts"
  ON crm_contactos
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir UPDATE desde edge functions
CREATE POLICY "Service role can update contacts"
  ON crm_contactos
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir SELECT desde edge functions
CREATE POLICY "Service role can select contacts"
  ON crm_contactos
  FOR SELECT
  TO service_role
  USING (true);
