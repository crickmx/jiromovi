/*
  # Fix crm_contactos UPDATE policies for all roles + auto-promote on Seguwallet activation

  ## Changes
  1. Add UPDATE policy for Administrador and Gerente to update any contact
  2. Fix existing UPDATE policy to include proper WITH CHECK
  3. Add function to auto-promote a contact to Cliente when Seguwallet is activated
*/

-- Fix existing update policy to include WITH CHECK
DROP POLICY IF EXISTS "Usuarios solo actualizan sus propios contactos" ON crm_contactos;

CREATE POLICY "Usuarios actualizan sus propios contactos"
  ON crm_contactos FOR UPDATE
  TO authenticated
  USING (creado_por = (SELECT auth.uid()))
  WITH CHECK (creado_por = (SELECT auth.uid()));

-- Add admin/gerente update policy
DROP POLICY IF EXISTS "Admins y gerentes pueden actualizar contactos" ON crm_contactos;

CREATE POLICY "Admins y gerentes pueden actualizar contactos"
  ON crm_contactos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND u.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (SELECT auth.uid())
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

-- Function: promote crm contact to Cliente when Seguwallet is activated
CREATE OR REPLACE FUNCTION promote_crm_contact_to_cliente(p_crm_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_crm_contact_id IS NULL THEN RETURN; END IF;
  UPDATE crm_contactos
  SET estatus = 'Cliente',
      actualizado_en = now(),
      fecha_conversion_cliente = COALESCE(fecha_conversion_cliente, now())
  WHERE id = p_crm_contact_id
    AND estatus = 'Prospecto';
END;
$$;

GRANT EXECUTE ON FUNCTION promote_crm_contact_to_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_crm_contact_to_cliente(uuid) TO service_role;
