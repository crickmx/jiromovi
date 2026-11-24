/*
  # Fix tramite notifications - send only to Agente

  1. Changes
    - Update `notify_tramite_recipients()` to only notify the Agente (`agente_id`)
    - Previously notified three parties: agente_id, assigned_to_user_id, creado_por
    - Now only notifies `agente_id` (the actual client/agent)
    - The Responsable (assigned_to_user_id) and creator (creado_por) are internal staff
      who already know about changes since they are the ones making them

  2. Behavior
    - If the Agente is the same person who triggered the change, they are excluded
      (no self-notifications)
    - If there is no agente_id set on the ticket, no notification is sent
    - The `agente_nombre` variable is populated with the Agente's name for personalized greetings

  3. Security
    - No RLS changes
    - Function remains SECURITY DEFINER with fixed search_path
*/

CREATE OR REPLACE FUNCTION notify_tramite_recipients(
  p_ticket_id uuid,
  p_codigo_tipo text,
  p_variables jsonb,
  p_excluir_user_id uuid DEFAULT NULL,
  p_adjuntos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agente_id uuid;
  v_agente_name text;
  v_personalized_vars jsonb;
BEGIN
  SELECT agente_id
  INTO v_agente_id
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND OR v_agente_id IS NULL THEN
    RETURN;
  END IF;

  -- Skip if the agente is the one who triggered the change
  IF p_excluir_user_id IS NOT NULL AND v_agente_id = p_excluir_user_id THEN
    RETURN;
  END IF;

  -- Look up agente name to personalize the greeting
  SELECT nombre_completo INTO v_agente_name
  FROM usuarios
  WHERE id = v_agente_id;

  v_personalized_vars := p_variables || jsonb_build_object(
    'agente_nombre', COALESCE(v_agente_name, '')
  );

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo     := p_codigo_tipo,
    p_destinatario_id := v_agente_id,
    p_variables       := v_personalized_vars,
    p_adjuntos        := p_adjuntos
  );
END;
$$;
