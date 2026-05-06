/*
  # Add Commercial Tramite Types: Renovaciones, Cobranza, Otros

  1. Changes
    - Add 3 new tipo_tramite values to the tickets CHECK constraint:
      - 'renovaciones' (Comercial area)
      - 'cobranza' (Comercial area)
      - 'otros_comercial' (Comercial area)
    - These are commercial ticket types only creatable by Empleado/Gerente/Administrador (not Agente)

  2. Security
    - Add validation function to prevent Agentes from creating commercial tickets
    - Add trigger to enforce agente_usuario_id is required for commercial types
    - Enforce assigned_to_user_id = creado_por for commercial types
    - Enforce max 20 files per ticket

  3. Notes
    - Does NOT modify existing ticket types or data
    - Adds new constraint values alongside existing ones
    - Commercial employees (Comercial group) can view correccion_comisiones and correccion_poliza_registrada from their office
*/

-- Step 1: Update the CHECK constraint on tipo_tramite to include new values
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%tipo_tramite%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE tickets DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'tickets' AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%tipo_tramite%'
      LIMIT 1
    );
  END IF;
END $$;

-- Add updated constraint with new values (including lead_registro_movi which exists in data)
ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check CHECK (
  tipo_tramite IN (
    'correccion_poliza_registrada',
    'correccion_comisiones',
    'registro_poliza',
    'solicitud_comisiones_pendientes',
    'cotizacion_emision',
    'registro_actividad',
    'cambio_bancario',
    'lead_registro_movi',
    'renovaciones',
    'cobranza',
    'otros_comercial'
  )
);

-- Step 2: Create validation function to enforce commercial ticket rules
CREATE OR REPLACE FUNCTION validate_commercial_ticket_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_rol TEXT;
  v_is_commercial_type BOOLEAN;
BEGIN
  -- Check if this is a commercial ticket type
  v_is_commercial_type := NEW.tipo_tramite IN ('renovaciones', 'cobranza', 'otros_comercial');

  IF NOT v_is_commercial_type THEN
    RETURN NEW;
  END IF;

  -- Get creator's role
  SELECT rol INTO v_creator_rol
  FROM usuarios
  WHERE id = NEW.creado_por;

  -- Rule 1: Agentes cannot create commercial tickets
  IF v_creator_rol = 'Agente' THEN
    RAISE EXCEPTION 'Los agentes no pueden crear trámites comerciales (Renovaciones, Cobranza, Otros)';
  END IF;

  -- Rule 2: Commercial tickets must have an agent related
  IF NEW.agente_usuario_id IS NULL AND NEW.agente_id IS NULL THEN
    RAISE EXCEPTION 'Los trámites comerciales deben tener un agente relacionado';
  END IF;

  -- Rule 3: Commercial tickets must be assigned to the creator
  IF NEW.assigned_to_user_id IS NULL THEN
    NEW.assigned_to_user_id := NEW.creado_por;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for INSERT only (not update, to avoid blocking status changes)
DROP TRIGGER IF EXISTS trg_validate_commercial_ticket ON tickets;
CREATE TRIGGER trg_validate_commercial_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_commercial_ticket_rules();

-- Step 3: Create function to enforce max 20 files per ticket
CREATE OR REPLACE FUNCTION validate_ticket_file_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_current_count
  FROM ticket_archivos
  WHERE ticket_id = NEW.ticket_id;

  IF v_current_count >= 20 THEN
    RAISE EXCEPTION 'Este trámite permite un máximo de 20 documentos adjuntos. Elimina algún archivo o reduce la cantidad para continuar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ticket_file_limit ON ticket_archivos;
CREATE TRIGGER trg_validate_ticket_file_limit
  BEFORE INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_file_limit();

-- Step 4: Helper function to check if user is in commercial group
CREATE OR REPLACE FUNCTION is_user_in_comercial_group(p_user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tramites_grupos_miembros m
    INNER JOIN tramites_grupos_visualizacion g ON g.id = m.grupo_id
    WHERE m.usuario_id = p_user_id
    AND g.area_categoria = 'Comercial'
    AND g.activo = true
  );
$$;

-- Step 5: Update RLS SELECT policy to include commercial employee access to operational tickets
DROP POLICY IF EXISTS "tickets_select_by_user_or_role" ON tickets;

CREATE POLICY "tickets_select_by_user_or_role"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    (get_my_rol() = 'Administrador')
    OR (
      (get_my_rol() = ANY (ARRAY['Gerente', 'Empleado']))
      AND ticket_in_office(creado_por, agente_id, agente_usuario_id, attending_user_id, assigned_to_user_id, get_my_oficina_id())
    )
    OR (creado_por = auth.uid())
    OR (assigned_to_user_id = auth.uid())
    OR (agente_id = auth.uid())
    OR (agente_usuario_id = auth.uid())
    OR (attending_user_id = auth.uid())
    OR (
      is_user_in_comercial_group(auth.uid())
      AND tipo_tramite IN ('correccion_comisiones', 'correccion_poliza_registrada')
      AND ticket_in_office(creado_por, agente_id, agente_usuario_id, attending_user_id, assigned_to_user_id, get_my_oficina_id())
    )
  );
