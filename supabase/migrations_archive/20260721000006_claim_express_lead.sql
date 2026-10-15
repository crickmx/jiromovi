/*
  # seguros.express — Toma de lead atómica (Parte E)

  claim_express_lead(lead_id): el primer agente en tomar el lead gana. Se
  implementa como UPDATE condicional (agente_asignado_id IS NULL) para evitar la
  carrera entre dos agentes que lo toman al mismo tiempo. Si no regresa fila →
  ya fue tomado por otro. Al ganar, el estado pasa a 'contactado' y se revelan
  los datos completos (los devuelve el RPC). También manda al agente la
  notificación de asignación (mismo patrón que Trámites).

  SECURITY DEFINER: corre con privilegios para saltar la RLS en el UPDATE, pero
  valida al llamante (habilitado + activo + dentro de alcance) contra auth.uid().
*/

CREATE OR REPLACE FUNCTION public.claim_express_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_habilitado boolean;
  v_activo     boolean;
  v_lead       public.express_leads%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_autenticado');
  END IF;

  SELECT seguros_express_habilitado, activo
    INTO v_habilitado, v_activo
  FROM public.usuarios WHERE id = v_uid;

  IF NOT COALESCE(v_habilitado, false) OR NOT COALESCE(v_activo, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_habilitado');
  END IF;

  -- El agente debe poder ver el lead (dentro de su alcance actual).
  IF NOT public.express_lead_en_alcance(p_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'fuera_de_alcance');
  END IF;

  -- Toma atómica: sólo si sigue libre y notificado.
  UPDATE public.express_leads
     SET agente_asignado_id = v_uid,
         estado = 'contactado',
         updated_at = now()
   WHERE id = p_lead_id
     AND agente_asignado_id IS NULL
     AND estado = 'notificado'
  RETURNING * INTO v_lead;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ya_tomado');
  END IF;

  -- Notificación de asignación al agente (bell + WhatsApp), como en Trámites.
  PERFORM public.enviar_notificacion_individual(
    v_uid,
    'Lead seguros.express tomado',
    format('Tomaste el lead de %s (%s). Contáctalo pronto.',
           COALESCE(v_lead.nombre, 'cliente'),
           COALESCE(v_lead.tipo_seguro_interes, 'seguro')),
    'CRM',
    '/mi-crm/leads-seguros-express',
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'nombre', v_lead.nombre,
      'telefono', v_lead.telefono,
      'email', v_lead.email,
      'tipo_seguro_interes', v_lead.tipo_seguro_interes,
      'direccion_manual', v_lead.direccion_manual,
      'lat', v_lead.lat,
      'lng', v_lead.lng,
      'estado', v_lead.estado
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_express_lead(uuid) TO authenticated;
