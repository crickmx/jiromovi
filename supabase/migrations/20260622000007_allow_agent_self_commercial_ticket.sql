-- ─── Fix validate_commercial_ticket_rules trigger ────────────────────────────
--
-- Change 1: Allow agents to create commercial tickets FOR THEMSELVES.
--   Previously blocked ALL inserts where creado_por = Agente role.
--   Now only blocks when agente_usuario_id differs from creado_por
--   (i.e. agent trying to create a ticket on behalf of a different agent).
--
-- Change 2: Remove Rule 3 (auto-assign to creator when assigned_to_user_id IS NULL).
--   When no ejecutivo is resolved via group rules, the ticket should stay
--   unassigned (null) so the team can pick it up from the pool.
--   The Django CP view already sets assigned_to_user_id when an ejecutivo
--   is found; there is no need for the trigger to override a null value.

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

  -- Rule 1: Agents can only create commercial tickets for themselves.
  --   agente_usuario_id must match creado_por; creating for other agents is blocked.
  IF v_creator_rol = 'Agente' AND (NEW.agente_usuario_id IS DISTINCT FROM NEW.creado_por) THEN
    RAISE EXCEPTION 'Los agentes no pueden crear trámites comerciales para otros agentes';
  END IF;

  -- Rule 2: Commercial tickets must have a related agent.
  IF NEW.agente_usuario_id IS NULL AND NEW.agente_id IS NULL THEN
    RAISE EXCEPTION 'Los trámites comerciales deben tener un agente relacionado';
  END IF;

  -- Rule 3 intentionally removed: assigned_to_user_id stays NULL when no
  -- ejecutivo was resolved, allowing pool/unassigned behavior.

  RETURN NEW;
END;
$$;
