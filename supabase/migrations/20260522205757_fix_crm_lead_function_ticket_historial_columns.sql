/*
  # Fix CRM lead function - ticket_historial column names

  1. Problem
    - The `create_crm_lead_and_task_from_public_form` function references columns
      `tipo` and `creado_por` in `ticket_historial` table, but the actual columns
      are `accion` and `usuario_id`
    - This causes the entire function to error out, preventing CRM lead/task creation

  2. Fix
    - Recreate the function with correct column references for ticket_historial
    - `tipo` -> `accion`
    - `creado_por` -> `usuario_id`
*/

CREATE OR REPLACE FUNCTION public.create_crm_lead_and_task_from_public_form(
  p_agent_id uuid,
  p_office_id uuid DEFAULT NULL,
  p_client_name text DEFAULT NULL,
  p_client_phone text DEFAULT NULL,
  p_client_whatsapp text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_form_type text DEFAULT NULL,
  p_form_title text DEFAULT NULL,
  p_quote_form_id uuid DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL,
  p_shared_link_id uuid DEFAULT NULL,
  p_public_submission_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_task_id uuid;
  v_note_id uuid;
  v_is_new_lead boolean := true;
  v_existing_lead record;
  v_due_date timestamptz;
  v_task_title text;
  v_task_description text;
  v_lead_name text;
  v_celular text;
  v_has_contact boolean;
  v_note_content text;
BEGIN
  -- STEP 1: Prepare data
  v_lead_name := TRIM(COALESCE(p_client_name, 'Sin nombre'));
  v_celular := COALESCE(NULLIF(TRIM(p_client_phone), ''), NULLIF(TRIM(p_client_whatsapp), ''), '');
  v_has_contact := (NULLIF(TRIM(p_client_phone), '') IS NOT NULL)
    OR (NULLIF(TRIM(p_client_whatsapp), '') IS NOT NULL)
    OR (NULLIF(TRIM(p_client_email), '') IS NOT NULL);

  -- Calculate due date: next business day at 10:00 AM local time
  v_due_date := (now() AT TIME ZONE 'America/Mexico_City' + interval '1 day');
  IF EXTRACT(DOW FROM v_due_date) = 6 THEN
    v_due_date := v_due_date + interval '2 days';
  ELSIF EXTRACT(DOW FROM v_due_date) = 0 THEN
    v_due_date := v_due_date + interval '1 day';
  END IF;
  v_due_date := date_trunc('day', v_due_date) + interval '10 hours';
  v_due_date := v_due_date AT TIME ZONE 'America/Mexico_City';

  -- STEP 2: Check for duplicate lead
  IF v_has_contact THEN
    SELECT id, estatus INTO v_existing_lead
    FROM crm_contactos
    WHERE creado_por = p_agent_id
      AND (
        (NULLIF(TRIM(p_client_email), '') IS NOT NULL AND email = TRIM(p_client_email))
        OR (NULLIF(TRIM(p_client_phone), '') IS NOT NULL AND celular = TRIM(p_client_phone))
        OR (NULLIF(TRIM(p_client_whatsapp), '') IS NOT NULL AND whatsapp = TRIM(p_client_whatsapp))
        OR (NULLIF(TRIM(p_client_phone), '') IS NOT NULL AND whatsapp = TRIM(p_client_phone))
        OR (NULLIF(TRIM(p_client_whatsapp), '') IS NOT NULL AND celular = TRIM(p_client_whatsapp))
      )
    ORDER BY fecha_creacion DESC
    LIMIT 1;
  END IF;

  -- STEP 3: Create or update lead
  IF v_existing_lead.id IS NOT NULL THEN
    v_lead_id := v_existing_lead.id;
    v_is_new_lead := false;

    IF v_existing_lead.estatus IN ('Perdido') THEN
      UPDATE crm_contactos
      SET estatus = 'Prospecto', actualizado_en = now()
      WHERE id = v_lead_id;
    END IF;

    UPDATE crm_contactos
    SET quote_form_id = COALESCE(p_quote_form_id, quote_form_id),
        ticket_id = COALESCE(p_ticket_id, ticket_id),
        shared_link_id = COALESCE(p_shared_link_id, shared_link_id),
        public_submission_id = COALESCE(p_public_submission_id, public_submission_id),
        tipo_seguro = COALESCE(p_form_type, tipo_seguro),
        interes = COALESCE(p_form_title, interes),
        actualizado_en = now()
    WHERE id = v_lead_id;

    v_note_content := 'Nueva solicitud de cotizacion recibida desde formulario publico.' || chr(10)
      || 'Tipo de seguro: ' || COALESCE(p_form_title, p_form_type, 'No especificado') || chr(10)
      || 'Tramite relacionado: ' || COALESCE(p_ticket_id::text, 'N/A');

    IF v_existing_lead.estatus IN ('Perdido') THEN
      v_note_content := 'Lead reactivado por nuevo formulario publico recibido.' || chr(10) || v_note_content;
    END IF;

    INSERT INTO crm_notas (contacto_id, contenido, creado_por)
    VALUES (v_lead_id, v_note_content, p_agent_id)
    RETURNING id INTO v_note_id;

  ELSE
    INSERT INTO crm_contactos (
      tipo_contacto, nombre_completo, celular, email, whatsapp,
      estatus, fuente_origen, fuente_canal, tipo_lead, tipo_seguro, interes,
      notas_origen, creado_por, quote_form_id, ticket_id, shared_link_id,
      public_submission_id, contacto_incompleto, etiquetas_segmentacion, metadata_json
    ) VALUES (
      'Persona',
      v_lead_name,
      v_celular,
      NULLIF(TRIM(p_client_email), ''),
      NULLIF(TRIM(p_client_whatsapp), ''),
      'Prospecto',
      'formulario_publico',
      'link_publico',
      'cotizacion',
      p_form_type,
      p_form_title,
      p_notes,
      p_agent_id,
      p_quote_form_id,
      p_ticket_id,
      p_shared_link_id,
      p_public_submission_id,
      NOT v_has_contact,
      CASE WHEN NOT v_has_contact THEN ARRAY['contacto_incompleto'] ELSE ARRAY['formulario_publico'] END,
      jsonb_build_object(
        'source', 'formulario_compartido',
        'channel', 'link_publico',
        'form_type', p_form_type,
        'created_at', now()
      )
    )
    RETURNING id INTO v_lead_id;

    v_note_content := 'Nueva solicitud de cotizacion recibida desde formulario publico.' || chr(10)
      || 'Tipo de seguro: ' || COALESCE(p_form_title, p_form_type, 'No especificado') || chr(10)
      || 'Cliente: ' || v_lead_name || chr(10)
      || 'Tramite relacionado: ' || COALESCE(p_ticket_id::text, 'N/A');

    IF NOT v_has_contact THEN
      v_note_content := v_note_content || chr(10) || chr(10)
        || 'ATENCION: Este lead no tiene datos de contacto completos. Verificar informacion.';
    END IF;

    INSERT INTO crm_notas (contacto_id, contenido, creado_por)
    VALUES (v_lead_id, v_note_content, p_agent_id)
    RETURNING id INTO v_note_id;
  END IF;

  -- STEP 4: Create follow-up task
  v_task_title := 'Seguimiento: ' || COALESCE(p_form_title, p_form_type, 'Formulario publico') || ' - ' || v_lead_name;

  v_task_description := 'Se recibio una nueva solicitud de cotizacion desde un formulario publico compartido.' || chr(10) || chr(10)
    || 'Cliente: ' || v_lead_name || chr(10)
    || 'Seguro: ' || COALESCE(p_form_title, p_form_type, 'No especificado') || chr(10)
    || 'Origen: Link publico' || chr(10) || chr(10)
    || 'Revisar informacion, contactar al cliente y continuar seguimiento.';

  INSERT INTO crm_tareas (
    contacto_id, titulo, descripcion, tipo_actividad,
    fecha_vencimiento, estatus, prioridad, creado_por, asignado_a,
    quote_form_id, ticket_id, shared_link_id, public_submission_id, metadata_json
  ) VALUES (
    v_lead_id,
    v_task_title,
    v_task_description,
    'Llamada',
    v_due_date,
    'Pendiente',
    'Alta',
    p_agent_id,
    p_agent_id,
    p_quote_form_id,
    p_ticket_id,
    p_shared_link_id,
    p_public_submission_id,
    jsonb_build_object(
      'auto_created', true,
      'source', 'formulario_compartido',
      'form_type', p_form_type,
      'is_new_lead', v_is_new_lead
    )
  )
  RETURNING id INTO v_task_id;

  -- STEP 5: Add ticket history entries (if ticket exists)
  IF p_ticket_id IS NOT NULL THEN
    INSERT INTO ticket_historial (ticket_id, accion, descripcion, usuario_id)
    VALUES (
      p_ticket_id,
      'nota',
      CASE WHEN v_is_new_lead 
        THEN 'Lead creado automaticamente en Mi CRM desde formulario publico.'
        ELSE 'Lead existente relacionado automaticamente desde formulario publico.'
      END,
      p_agent_id
    );

    INSERT INTO ticket_historial (ticket_id, accion, descripcion, usuario_id)
    VALUES (
      p_ticket_id,
      'nota',
      'Tarea de seguimiento creada automaticamente en Mi CRM.',
      p_agent_id
    );
  END IF;

  -- STEP 6: Return result
  RETURN json_build_object(
    'lead_id', v_lead_id,
    'task_id', v_task_id,
    'note_id', v_note_id,
    'is_new_lead', v_is_new_lead,
    'due_date', v_due_date
  );
END;
$$;
