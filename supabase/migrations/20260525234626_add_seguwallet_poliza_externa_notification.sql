/*
  # Add seguwallet_poliza_externa_cargada notification event

  ## Changes
  1. Registers new event code in notification_events_catalog
  2. Registers template in transactional_notification_templates
  3. Creates DB trigger on seguwallet_external_policies to auto-notify agent on INSERT
  4. Adds RPC get_customer_external_policies for admin/agent access with RLS bypass

  ## Security
  - Trigger runs as SECURITY DEFINER to call notify()
  - RPC enforces: admin sees all, agent sees own customers only
*/

-- ─── Register notification event ─────────────────────────────────────────────
INSERT INTO notification_events_catalog (
  event_code, event_name, module, description,
  enable_in_app, enable_email, enable_whatsapp,
  template_in_app, template_whatsapp,
  priority, active
) VALUES (
  'seguwallet_poliza_externa_cargada',
  'SeguWallet - Nueva poliza externa cargada',
  'seguwallet',
  'Notifica al agente cuando su cliente carga una nueva poliza externa en SeguWallet.',
  true,
  false,
  true,
  jsonb_build_object(
    'titulo', 'Nueva poliza externa cargada',
    'mensaje', 'Tu cliente {{cliente_nombre}} cargo una poliza de {{aseguradora}} ({{ramo}})',
    'accion_url', '/seguwallet'
  ),
  jsonb_build_object(
    'variables', ARRAY['agente_nombre', 'cliente_nombre', 'aseguradora', 'ramo', 'numero_poliza', 'fecha_carga']
  ),
  'normal',
  true
)
ON CONFLICT (event_code) DO UPDATE SET
  enable_in_app = true,
  enable_whatsapp = true,
  active = true,
  updated_at = now();

-- ─── Register editable template ──────────────────────────────────────────────
INSERT INTO transactional_notification_templates (
  event_key, name,
  email_subject_template, email_body_template,
  whatsapp_body_template,
  inapp_title_template, inapp_body_template,
  is_active
) VALUES (
  'seguwallet_poliza_externa_cargada',
  'SeguWallet - Nueva poliza externa cargada',
  'Tu cliente {{cliente_nombre}} cargo una nueva poliza externa',
  '',
  E'Hola {{agente_nombre}}, tu cliente *{{cliente_nombre}}* acabo de cargar una poliza externa en SeguWallet.\n\nAseguradora: {{aseguradora}}\nTipo de seguro: {{ramo}}\nPoliza: {{numero_poliza}}\n\nPuedes revisarla desde tu panel de Seguwallet.',
  'Nueva poliza externa cargada',
  'Tu cliente {{cliente_nombre}} cargo una poliza de {{aseguradora}} ({{ramo}})',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = true,
  updated_at = now();

-- ─── Trigger function to notify agent on new external policy ─────────────────
CREATE OR REPLACE FUNCTION notify_agent_on_external_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name  text;
  v_agent_id       uuid;
  v_agent_name     text;
  v_insurer        text;
  v_ramo           text;
  v_policy_number  text;
  v_payload        jsonb;
BEGIN
  -- Only fire on INSERT (not updates/deletes)
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  -- Skip soft-deleted
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  -- Resolve customer name and agent
  SELECT sc.full_name, sc.agent_user_id
    INTO v_customer_name, v_agent_id
    FROM seguwallet_customers sc
   WHERE sc.id = NEW.seguwallet_customer_id
   LIMIT 1;

  IF v_agent_id IS NULL THEN RETURN NEW; END IF;

  -- Resolve agent name
  SELECT COALESCE(u.nombre_completo, u.nombre, 'Agente')
    INTO v_agent_name
    FROM usuarios u
   WHERE u.id = v_agent_id
   LIMIT 1;

  v_insurer       := COALESCE(NULLIF(trim(NEW.insurer_name), ''), 'Aseguradora no especificada');
  v_ramo          := COALESCE(NULLIF(trim(NEW.ramo), ''), 'No especificado');
  v_policy_number := COALESCE(NULLIF(trim(NEW.policy_number), ''), 'N/A');

  v_payload := jsonb_build_object(
    'agente_nombre',  v_agent_name,
    'cliente_nombre', COALESCE(v_customer_name, 'Cliente'),
    'aseguradora',    v_insurer,
    'ramo',           v_ramo,
    'numero_poliza',  v_policy_number,
    'fecha_carga',    to_char(now() AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI')
  );

  -- Fire notify() — creates in-app bell + WhatsApp job via notification dispatcher
  PERFORM notify(
    p_event_code := 'seguwallet_poliza_externa_cargada',
    p_user_ids   := ARRAY[v_agent_id],
    p_payload    := v_payload,
    p_entity_id  := NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block policy save
  RAISE WARNING 'notify_agent_on_external_policy error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger cleanly
DROP TRIGGER IF EXISTS trg_notify_agent_external_policy ON seguwallet_external_policies;
CREATE TRIGGER trg_notify_agent_external_policy
  AFTER INSERT ON seguwallet_external_policies
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_on_external_policy();

-- ─── SECURITY DEFINER RPC for admin/agent to read a customer's external policies ─
CREATE OR REPLACE FUNCTION get_customer_external_policies(p_customer_id uuid)
RETURNS TABLE (
  id                    uuid,
  insurer_name          text,
  ramo                  text,
  subramo               text,
  policy_number         text,
  contractor_name       text,
  insured_name          text,
  start_date            date,
  end_date              date,
  status                text,
  total_premium         numeric,
  currency              text,
  notes                 text,
  created_at            timestamptz,
  -- documents aggregated
  documents             jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_rol       text;
  v_agent_id  uuid;
BEGIN
  -- Resolve caller role
  SELECT u.rol INTO v_rol FROM usuarios u WHERE u.id = v_caller_id LIMIT 1;

  -- If not a MOVI user, check if seguwallet agent owns this customer
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Admin sees all; agent sees only own customers
  IF v_rol NOT IN ('Administrador', 'admin', 'superadmin') THEN
    SELECT sc.agent_user_id INTO v_agent_id
      FROM seguwallet_customers sc
     WHERE sc.id = p_customer_id
     LIMIT 1;

    IF v_agent_id IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'Unauthorized: this customer does not belong to you';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.insurer_name,
    p.ramo,
    p.subramo,
    p.policy_number,
    p.contractor_name,
    p.insured_name,
    p.start_date,
    p.end_date,
    p.status,
    p.total_premium,
    p.currency,
    p.notes,
    p.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id',            d.id,
          'document_type', d.document_type,
          'document_name', d.document_name,
          'file_path',     d.file_path,
          'file_size',     d.file_size,
          'mime_type',     d.mime_type,
          'created_at',    d.created_at
        ) ORDER BY d.created_at)
        FROM seguwallet_external_policy_documents d
       WHERE d.external_policy_id = p.id
         AND d.deleted_at IS NULL
      ),
      '[]'::jsonb
    ) AS documents
  FROM seguwallet_external_policies p
  WHERE p.seguwallet_customer_id = p_customer_id
    AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_external_policies(uuid) TO authenticated;
