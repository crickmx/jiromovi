/*
  # Fix tramite notifications - personalize recipient name

  1. Changes
    - Update `notify_tramite_recipients()` to inject each recipient's name as `agente_nombre`
      so the email greeting "Hola {{agente_nombre}}" shows the actual recipient's name
    - Previously `agente_nombre` was set to empty string '' by all trigger functions,
      resulting in emails saying "Hola " with a blank name

  2. How it works
    - For each recipient in the loop, we look up their `nombre_completo`
    - We override the `agente_nombre` key in the variables payload with that name
    - This personalizes the greeting for each recipient (agente, responsable, or creator)

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
  v_t RECORD;
  v_recipient_ids uuid[];
  v_uid uuid;
  v_recipient_name text;
  v_personalized_vars jsonb;
BEGIN
  SELECT agente_id, assigned_to_user_id, creado_por
  INTO v_t
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_recipient_ids := ARRAY[]::uuid[];

  IF v_t.agente_id IS NOT NULL THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.agente_id);
  END IF;

  IF v_t.assigned_to_user_id IS NOT NULL AND NOT (v_t.assigned_to_user_id = ANY(v_recipient_ids)) THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.assigned_to_user_id);
  END IF;

  IF v_t.creado_por IS NOT NULL AND NOT (v_t.creado_por = ANY(v_recipient_ids)) THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.creado_por);
  END IF;

  FOREACH v_uid IN ARRAY v_recipient_ids LOOP
    IF p_excluir_user_id IS NOT NULL AND v_uid = p_excluir_user_id THEN
      CONTINUE;
    END IF;

    -- Look up recipient name to personalize the greeting
    SELECT nombre_completo INTO v_recipient_name
    FROM usuarios
    WHERE id = v_uid;

    v_personalized_vars := p_variables || jsonb_build_object(
      'agente_nombre', COALESCE(v_recipient_name, '')
    );

    PERFORM enviar_notificacion_transaccional(
      p_codigo_tipo     := p_codigo_tipo,
      p_destinatario_id := v_uid,
      p_variables       := v_personalized_vars,
      p_adjuntos        := p_adjuntos
    );
  END LOOP;
END;
$$;
