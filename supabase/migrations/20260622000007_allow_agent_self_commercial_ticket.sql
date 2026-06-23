-- ─── Allow agents to create commercial tramites for themselves ────────────────
--
-- Previously, the trigger blocked ALL inserts where creado_por belonged to an
-- 'Agente' user. This prevented Central de Producción (CP) from creating
-- renovaciones/cobranza tickets on behalf of an agent for their own policies.
--
-- New rule: agents MAY create commercial tickets as long as agente_usuario_id
-- equals creado_por (i.e. the agent is creating the ticket for themselves).
-- Creating commercial tickets for OTHER agents is still blocked.

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

  -- Rule 1: Agents can only create commercial tickets for themselves
  -- (agente_usuario_id must equal creado_por). Blocked when creating for others.
  IF v_creator_rol = 'Agente' AND (NEW.agente_usuario_id IS DISTINCT FROM NEW.creado_por) THEN
    RAISE EXCEPTION 'Los agentes no pueden crear trámites comerciales para otros agentes';
  END IF;

  -- Rule 2: Commercial tickets must have an agent related
  IF NEW.agente_usuario_id IS NULL AND NEW.agente_id IS NULL THEN
    RAISE EXCEPTION 'Los trámites comerciales deben tener un agente relacionado';
  END IF;

  -- Rule 3: Commercial tickets must be assigned (default to creator)
  IF NEW.assigned_to_user_id IS NULL THEN
    NEW.assigned_to_user_id := NEW.creado_por;
  END IF;

  RETURN NEW;
END;
$$;
