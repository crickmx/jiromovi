/*
  # seguros.express — Conversión a Mi CRM (Parte G)

  convert_express_lead_to_crm(lead_id, notas): cuando el agente marca su lead
  como gestionado/ganado, se refleja en Mi CRM (mismo patrón que
  convert_lead_to_crm de Chava, pero sobre express_leads y sin depender de
  chava_lead_signals):
    - crea (o reutiliza) un crm_contactos del propio agente,
    - crea una crm_tarea de seguimiento,
    - marca el lead como 'convertido' y guarda crm_contacto_id.

  Sólo el agente dueño del lead (agente_asignado_id = auth.uid()) puede convertir.
  SECURITY DEFINER para escribir en CRM saltando RLS, validando al dueño.
*/

CREATE OR REPLACE FUNCTION public.convert_express_lead_to_crm(
  p_lead_id uuid,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_lead       public.express_leads%ROWTYPE;
  v_contacto_id uuid;
  v_tarea_id   uuid;
  v_tipo       text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_autenticado');
  END IF;

  SELECT * INTO v_lead FROM public.express_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_encontrado');
  END IF;

  IF v_lead.agente_asignado_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_es_tuyo');
  END IF;

  -- Idempotente: si ya fue convertido, regresar el contacto existente.
  IF v_lead.estado = 'convertido' AND v_lead.crm_contacto_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'contacto_id', v_lead.crm_contacto_id, 'ya_convertido', true);
  END IF;

  v_tipo := COALESCE(NULLIF(trim(v_lead.tipo_seguro_interes), ''), 'seguro');

  -- Reutiliza el contacto del agente si ya existe por teléfono; si no, lo crea.
  SELECT id INTO v_contacto_id
  FROM public.crm_contactos
  WHERE creado_por = v_uid
    AND celular = v_lead.telefono
  ORDER BY fecha_creacion DESC NULLS LAST
  LIMIT 1;

  IF v_contacto_id IS NULL THEN
    INSERT INTO public.crm_contactos (
      tipo_contacto, nombre_completo, celular, email, estatus,
      fuente_origen, fuente_canal, tipo_lead, tipo_seguro, interes,
      notas_origen, etiquetas_segmentacion, campos_personalizados, creado_por
    ) VALUES (
      'Persona',
      COALESCE(NULLIF(trim(v_lead.nombre), ''), 'Lead seguros.express'),
      v_lead.telefono,
      v_lead.email,
      'Prospecto',
      'seguros.express',
      'seguros.express',
      'cotizacion',
      v_lead.tipo_seguro_interes,
      v_lead.tipo_seguro_interes,
      p_notas,
      ARRAY['seguros-express', 'lead-' || v_tipo],
      jsonb_build_object(
        'origen', 'seguros.express',
        'express_lead_id', v_lead.id,
        'direccion_manual', v_lead.direccion_manual,
        'lat', v_lead.lat,
        'lng', v_lead.lng
      ),
      v_uid
    )
    RETURNING id INTO v_contacto_id;
  ELSE
    UPDATE public.crm_contactos
       SET tipo_seguro = COALESCE(tipo_seguro, v_lead.tipo_seguro_interes),
           interes = COALESCE(interes, v_lead.tipo_seguro_interes),
           notas_origen = COALESCE(notas_origen, p_notas),
           actualizado_en = now()
     WHERE id = v_contacto_id;
  END IF;

  -- Tarea de seguimiento (asignada al mismo agente).
  INSERT INTO public.crm_tareas (
    contacto_id, descripcion, titulo, tipo_actividad, fecha_vencimiento,
    estatus, prioridad, creado_por, asignado_a, fuente, canal
  ) VALUES (
    v_contacto_id,
    format('Dar seguimiento al lead de %s de seguros.express', v_tipo),
    format('Seguimiento lead seguros.express — %s', v_tipo),
    'Llamada',
    now() + interval '1 day',
    'Pendiente',
    'Alta',
    v_uid,
    v_uid,
    'seguros.express',
    'seguros.express'
  )
  RETURNING id INTO v_tarea_id;

  UPDATE public.express_leads
     SET estado = 'convertido',
         crm_contacto_id = v_contacto_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'contacto_id', v_contacto_id,
    'tarea_id', v_tarea_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_express_lead_to_crm(uuid, text) TO authenticated;
