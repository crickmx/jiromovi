/*
  # Rename "Corrección de Póliza" and Add New Comercial Type

  ## Summary
  Two controlled changes to the tramite/ticket type catalog:

  1. The existing Operaciones type `correccion_poliza_registrada` keeps its internal key.
     No data is lost and no existing tickets are broken.

  2. A new Comercial type `correccion_poliza_endoso` is added so that
     "Corrección de Póliza / Endoso" can be created from the Comercial area.

  ## Changes

  ### Tickets CHECK constraint
  - Adds `correccion_poliza_endoso` to the allowed tipo_tramite values.
  - All existing values remain valid (no tickets are invalidated).

  ### Commercial validation trigger
  - Updates `validate_commercial_ticket_rules` so the new type follows the
    same Comercial rules as renovaciones/cobranza/otros_comercial:
      • Agentes cannot create it.
      • An agente_usuario_id is required.
      • assigned_to_user_id defaults to creado_por.

  ### RLS SELECT policy
  - Extends the comercial-group visibility clause to also include
    `correccion_poliza_endoso` alongside `correccion_poliza_registrada`.

  ## Safety
  - Idempotent: runs safely more than once.
  - Does NOT modify or delete any existing ticket rows.
  - Does NOT change the key/slug of the existing Operaciones type.
  - The label rename ("Corrección de póliza" → "Corrección de Registro de Póliza")
    is handled entirely in the frontend TypeScript config — no DB label column exists.
*/

-- ─── 1. Update CHECK constraint to include new tipo ─────────────────────────

DO $$
BEGIN
  -- Drop the existing tipo_tramite check constraint (whatever its name is)
  DECLARE
    v_constraint_name TEXT;
  BEGIN
    SELECT constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'tickets'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%tipo_tramite%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
      EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END IF;
  END;
END $$;

ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check CHECK (
  tipo_tramite IN (
    'correccion_poliza_registrada',
    'correccion_poliza_endoso',
    'correccion_comisiones',
    'registro_poliza',
    'solicitud_comisiones_pendientes',
    'cotizacion_emision',
    'registro_actividad',
    'cambio_bancario',
    'lead_registro_movi',
    'renovaciones',
    'cobranza',
    'otros_comercial',
    'formulario_cotizacion'
  )
);

-- ─── 2. Update commercial validation trigger to include new type ─────────────

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
  -- Commercial types: the three original ones plus the new endoso type
  v_is_commercial_type := NEW.tipo_tramite IN (
    'renovaciones',
    'cobranza',
    'otros_comercial',
    'correccion_poliza_endoso'
  );

  IF NOT v_is_commercial_type THEN
    RETURN NEW;
  END IF;

  -- Get creator's role
  SELECT rol INTO v_creator_rol
  FROM usuarios
  WHERE id = NEW.creado_por;

  -- Rule 1: Agentes cannot create commercial tickets
  IF v_creator_rol = 'Agente' THEN
    RAISE EXCEPTION 'Los agentes no pueden crear trámites comerciales';
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

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_validate_commercial_ticket ON tickets;
CREATE TRIGGER trg_validate_commercial_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_commercial_ticket_rules();

-- ─── 3. Update RLS SELECT policy to expose new type to comercial group ───────

DROP POLICY IF EXISTS "tickets_select_by_user_or_role" ON tickets;

CREATE POLICY "tickets_select_by_user_or_role"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    (get_my_rol() = 'Administrador')
    OR (
      (get_my_rol() = ANY (ARRAY['Gerente', 'Empleado', 'Ejecutivo']))
      AND ticket_in_office(creado_por, agente_id, agente_usuario_id, attending_user_id, assigned_to_user_id, get_my_oficina_id())
    )
    OR (creado_por = auth.uid())
    OR (assigned_to_user_id = auth.uid())
    OR (agente_id = auth.uid())
    OR (agente_usuario_id = auth.uid())
    OR (attending_user_id = auth.uid())
    OR (
      is_user_in_comercial_group(auth.uid())
      AND tipo_tramite IN (
        'correccion_comisiones',
        'correccion_poliza_registrada',
        'correccion_poliza_endoso'
      )
      AND ticket_in_office(creado_por, agente_id, agente_usuario_id, attending_user_id, assigned_to_user_id, get_my_oficina_id())
    )
  );
