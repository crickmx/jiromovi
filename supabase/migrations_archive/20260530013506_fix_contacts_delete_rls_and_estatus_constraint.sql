/*
  # Fix CRM contacts: delete RLS for admins/gerentes + simplify estatus constraint

  ## Changes
  1. Add DELETE policy for Administrador and Gerente roles so they can delete any contact in their scope
  2. Update estatus CHECK constraint to only allow 'Prospecto' and 'Cliente'
     (removes: Cotización Presentada, Negociación, Perdido)
  3. Migrate existing contacts with other statuses to 'Prospecto'
*/

-- 1. Add admin/gerente delete policy
CREATE POLICY "Admins y gerentes pueden eliminar contactos"
  ON crm_contactos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

-- 2. Migrate existing non-standard estatus values to Prospecto
UPDATE crm_contactos
SET estatus = 'Prospecto'
WHERE estatus NOT IN ('Prospecto', 'Cliente');

-- 3. Drop old constraint and add new simplified one
ALTER TABLE crm_contactos
  DROP CONSTRAINT IF EXISTS crm_contactos_estatus_check;

ALTER TABLE crm_contactos
  ADD CONSTRAINT crm_contactos_estatus_check
  CHECK (estatus = ANY (ARRAY['Prospecto'::text, 'Cliente'::text]));
