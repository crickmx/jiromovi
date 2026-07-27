/*
  # seguros.express — Acciones de admin sobre leads (dashboard de monitoreo)

  El dashboard de Admin > seguros.express necesita poder intervenir un lead
  para monitorear/administrar el servicio. Como `express_leads` NO tiene
  políticas de UPDATE para `authenticated` (todas las escrituras van por service
  role o por RPC SECURITY DEFINER — ver 20260721000004), estas acciones se
  exponen como RPC SECURITY DEFINER gateados a Administrador (`express_es_admin`).

  RPCs:
    - express_admin_reasignar_lead(lead_id, agente_id): asigna el lead a un agente
      específico (estado -> 'contactado') y le manda la notificación de asignación.
    - express_admin_liberar_lead(lead_id): libera el lead (agente NULL,
      estado -> 'notificado') para que vuelva al pool y se pueda tomar/expandir.
    - express_admin_expirar_lead(lead_id): marca el lead como 'expirado'.

  Todo aditivo: no cambia tablas, políticas existentes ni el motor de matching.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- Reasignar un lead a un agente específico (override manual del admin)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_admin_reasignar_lead(
  p_lead_id uuid, p_agente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead       public.express_leads%ROWTYPE;
  v_habilitado boolean;
  v_activo     boolean;
BEGIN
  IF NOT public.express_es_admin() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_admin');
  END IF;

  SELECT seguros_express_habilitado, activo
    INTO v_habilitado, v_activo
  FROM public.usuarios WHERE id = p_agente_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agente_inexistente');
  END IF;
  IF NOT COALESCE(v_habilitado, false) OR NOT COALESCE(v_activo, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agente_no_habilitado');
  END IF;

  UPDATE public.express_leads
     SET agente_asignado_id = p_agente_id,
         estado = 'contactado',
         updated_at = now()
   WHERE id = p_lead_id
     AND estado <> 'convertido'
  RETURNING * INTO v_lead;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_inexistente_o_convertido');
  END IF;

  -- Registra al agente como notificado (idempotente) para dejar rastro.
  INSERT INTO public.express_lead_agentes_notificados (lead_id, usuario_id, anillo_km)
  VALUES (p_lead_id, p_agente_id, v_lead.anillo_km_actual)
  ON CONFLICT (lead_id, usuario_id) DO NOTHING;

  PERFORM public.enviar_notificacion_individual(
    p_agente_id,
    'Lead seguros.express asignado',
    format('Un administrador te asignó el lead de %s (%s). Contáctalo pronto.',
           COALESCE(v_lead.nombre, 'cliente'),
           COALESCE(v_lead.tipo_seguro_interes, 'seguro')),
    'CRM',
    '/mi-crm/leads-seguros-express',
    true
  );

  RETURN jsonb_build_object('success', true, 'estado', v_lead.estado);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Liberar un lead (vuelve al pool como 'notificado', sin agente)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_admin_liberar_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead public.express_leads%ROWTYPE;
BEGIN
  IF NOT public.express_es_admin() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_admin');
  END IF;

  UPDATE public.express_leads
     SET agente_asignado_id = NULL,
         estado = 'notificado',
         updated_at = now()
   WHERE id = p_lead_id
     AND estado <> 'convertido'
  RETURNING * INTO v_lead;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_inexistente_o_convertido');
  END IF;

  RETURN jsonb_build_object('success', true, 'estado', v_lead.estado);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Expirar un lead manualmente
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_admin_expirar_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead public.express_leads%ROWTYPE;
BEGIN
  IF NOT public.express_es_admin() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_admin');
  END IF;

  UPDATE public.express_leads
     SET estado = 'expirado',
         updated_at = now()
   WHERE id = p_lead_id
     AND estado <> 'convertido'
  RETURNING * INTO v_lead;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_inexistente_o_convertido');
  END IF;

  RETURN jsonb_build_object('success', true, 'estado', v_lead.estado);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Permisos: sólo authenticated (los RPC ya validan admin internamente)
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.express_admin_reasignar_lead(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.express_admin_liberar_lead(uuid) FROM public;
REVOKE ALL ON FUNCTION public.express_admin_expirar_lead(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.express_admin_reasignar_lead(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_admin_liberar_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_admin_expirar_lead(uuid) TO authenticated;
