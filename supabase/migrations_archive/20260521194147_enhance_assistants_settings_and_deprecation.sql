/*
  # Enhance Automatic Assistants and Intelligent Assistant Settings

  ## Changes

  ### 1. contact_center_assistants
  - Add deprecated_at, deprecated_reason, generated_from_form columns

  ### 2. contact_center_smart_assistant_settings
  - Expand with full training panel config fields

  ### 3. Update intent map function with all 24 insurance types
*/

-- ── 1. Extend contact_center_assistants ────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='deprecated_at') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN deprecated_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='deprecated_reason') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN deprecated_reason text DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_assistants' AND column_name='generated_from_form') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN generated_from_form boolean DEFAULT false;
  END IF;
END $$;

-- ── 2. Expand contact_center_smart_assistant_settings ─────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='is_enabled_global') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN is_enabled_global boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='default_enabled_conversations') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN default_enabled_conversations boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='base_instructions') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN base_instructions text DEFAULT 'Eres MOVI IA, un asistente inteligente para agentes de seguros. Debes ayudar a identificar solicitudes de cotización, responder de forma breve y clara, activar asistentes automáticos cuando detectes intención de cotizar y evitar intervenir cuando un ejecutivo humano esté gestionando correctamente la conversación.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='tone_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN tone_json jsonb DEFAULT '["profesional","cercano","breve"]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='intervention_level') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN intervention_level text DEFAULT 'medio';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='activation_rules_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN activation_rules_json jsonb DEFAULT '[
      {"key":"detect_quote_intent","label":"Cuando detecte intención de cotizar","enabled":true},
      {"key":"detect_insurance_request","label":"Cuando detecte solicitud de seguro específico","enabled":true},
      {"key":"detect_risk_data","label":"Cuando detecte que el cliente comparte datos de riesgo","enabled":true},
      {"key":"detect_agent_help","label":"Cuando detecte que el agente pide ayuda","enabled":true},
      {"key":"detect_form_request","label":"Cuando detecte que el usuario pide formulario","enabled":true},
      {"key":"detect_requirements","label":"Cuando detecte que el usuario pide requisitos","enabled":true},
      {"key":"inactive_conversation","label":"Cuando la conversación esté inactiva cierto tiempo","enabled":false}
    ]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='silence_rules_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN silence_rules_json jsonb DEFAULT '[
      {"key":"human_responding","label":"Si un ejecutivo humano está respondiendo activamente","enabled":true},
      {"key":"user_stop_request","label":"Si el usuario pide detener IA","enabled":true},
      {"key":"conversation_closed","label":"Si la conversación está cerrada","enabled":true},
      {"key":"no_insurance_context","label":"Si el cliente no está solicitando nada relacionado con seguros","enabled":true},
      {"key":"auto_assistant_active","label":"Si ya hay un asistente automático activo","enabled":true},
      {"key":"greeting_only","label":"Si el mensaje es solo saludo y no hay contexto suficiente","enabled":true},
      {"key":"user_upset","label":"Si detecta molestia o rechazo del usuario","enabled":true}
    ]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='stop_phrases_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN stop_phrases_json jsonb DEFAULT '["detén la ia","detén la inteligencia artificial","apaga el asistente","no responder automático","quiero hablar con una persona","ejecutivo","humano","no quiero bot","stop","para","detente"]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='reactivate_phrases_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN reactivate_phrases_json jsonb DEFAULT '["activar ia","ayúdame movi","encender asistente","continuar automático","modo automático","reactivar asistente"]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='message_signature') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN message_signature text DEFAULT '- 🤖 MOVI IA';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='allowed_actions_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN allowed_actions_json jsonb DEFAULT '[
      {"key":"answer_general","label":"Responder preguntas generales","enabled":true},
      {"key":"request_quote_data","label":"Pedir datos de cotización","enabled":true},
      {"key":"activate_auto_assistants","label":"Activar asistentes automáticos","enabled":true},
      {"key":"create_tramites","label":"Crear trámites","enabled":true},
      {"key":"attach_form_links","label":"Adjuntar links de formularios","enabled":true},
      {"key":"summarize_conversations","label":"Resumir conversaciones","enabled":true},
      {"key":"detect_data_in_history","label":"Detectar datos en mensajes previos","enabled":true},
      {"key":"request_missing_docs","label":"Pedir documentos faltantes","enabled":true}
    ]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='knowledge_base_json') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN knowledge_base_json jsonb DEFAULT '{
      "que_es_movi": "MOVI es una plataforma de gestión para agentes de seguros.",
      "tramites_comercial": "Trámites Comercial gestiona solicitudes de cotización, emisión, cobranza y otros procesos comerciales.",
      "formularios_cotizacion": "Los Formularios de Cotización capturan datos estructurados de un riesgo para solicitar cotización.",
      "cuando_crear_tramite": "Crear trámite cuando el asistente tenga datos mínimos: nombre del cliente, contacto y datos básicos del riesgo.",
      "como_escalar": "Si el usuario pide hablar con persona o hay molestia, pausar IA y notificar al ejecutivo.",
      "tipos_seguros": "Hogar, Casa con Negocio, PyME, Empresa, Incendio, Gasolinera, RC General, RC Profesional, RC E&O, RC Estancias, RC Ambiental, RC Viajero, Transporte de Carga, Aviación, Buques, Construcción, Montaje, Equipo Contratista, Rotura de Maquinaria, Calderas, Equipo Electrónico, Auto Alta Gama, GMM Individual, Accidentes Escolares.",
      "datos_detectar": "Buscar en historial: nombre del cliente, teléfono, correo, ubicación del riesgo, tipo de seguro, datos técnicos mencionados."
    }'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contact_center_smart_assistant_settings' AND column_name='updated_by') THEN
    ALTER TABLE contact_center_smart_assistant_settings ADD COLUMN updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure a global default row exists (office_id IS NULL = global)
INSERT INTO contact_center_smart_assistant_settings (
  office_id, auto_activate_threshold, suggest_threshold,
  pause_on_human_message, human_pause_minutes,
  stop_on_user_request, allow_auto_activate_agents,
  allow_internal_suggestions, minimum_intervention,
  is_enabled_global, default_enabled_conversations
)
SELECT NULL, 0.85, 0.55, true, 20, true, true, true, false, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM contact_center_smart_assistant_settings WHERE office_id IS NULL
);

-- ── 3. Update intent map function with all 24 insurance types ─────────────────

DROP FUNCTION IF EXISTS get_smart_assistant_intent_map();

CREATE OR REPLACE FUNCTION get_smart_assistant_intent_map()
RETURNS TABLE(
  intent text,
  keywords text[],
  boost_keywords text[],
  form_type_slug text,
  assistant_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY VALUES
    ('hogar_casa', ARRAY['casa','hogar','habitacion','domicilio','vivienda','departamento','condominio'], ARRAY['casa habitacion','seguro hogar','cotizar casa'], 'hogar_casa_habitacion', 'Hogar / Casa Habitación'),
    ('casa_negocio', ARRAY['casa con negocio','negocio en casa','tienda en casa'], ARRAY['casa negocio','local en casa'], 'casa_con_negocio', 'Casa con Negocio'),
    ('pyme', ARRAY['pyme','comercio','negocio','tienda','local','microempresa'], ARRAY['seguro pyme','cotizar comercio','seguro negocio'], 'pyme_comercio', 'PyME / Comercio'),
    ('empresa', ARRAY['empresa','corporativo','planta','fabrica','industria'], ARRAY['seguro empresa','cotizar empresa','paquete empresarial'], 'empresa_paquete', 'Empresa / Paquete Empresarial'),
    ('incendio', ARRAY['incendio','fuego','cobertura incendio'], ARRAY['seguro incendio','cotizar incendio'], 'incendio', 'Incendio'),
    ('gasolinera', ARRAY['gasolinera','gasolinero','estacion de servicio','combustible'], ARRAY['seguro gasolinera'], 'gasolinera', 'Gasolinera'),
    ('rc_general', ARRAY['responsabilidad civil','rc general','daños a terceros'], ARRAY['cotizar rc','rc actividades'], 'rc_general', 'Responsabilidad Civil General'),
    ('rc_profesional', ARRAY['rc profesional','errores y omisiones','mala praxis'], ARRAY['cotizar rc profesional'], 'rc_profesional', 'Responsabilidad Civil Profesional'),
    ('rc_agentes', ARRAY['rc agentes','eo agentes','e&o agentes','agencia de seguros rc'], ARRAY['rc agentes seguros'], 'rc_agentes_seguros', 'R.C. E&O Agentes de Seguros'),
    ('rc_estancias', ARRAY['estancia infantil','guarderia','cuidado de ninos','daycare'], ARRAY['rc estancias','seguro estancia'], 'rc_estancias_infantiles', 'R.C. Estancias Infantiles'),
    ('rc_ambiental', ARRAY['responsabilidad ambiental','contaminacion','daño ambiental'], ARRAY['rc ambiental','seguro ambiental'], 'rc_ambiental', 'Responsabilidad Ambiental'),
    ('rc_viajero', ARRAY['rc viajero','transporte de personas','pasajeros','taxi','autobus'], ARRAY['rc transporte','seguro viajero'], 'rc_viajero', 'R.C. Viajero'),
    ('transporte_carga', ARRAY['transporte','carga','mercancia','flete','logistica','embarque'], ARRAY['transporte de carga','cotizar transporte','seguro de carga'], 'transporte_carga', 'Transporte de Carga'),
    ('aviacion', ARRAY['aviacion','avion','aeronave','helicoptero','dron'], ARRAY['seguro aviacion','cotizar aeronave'], 'aviacion', 'Aviación'),
    ('buques', ARRAY['buque','barco','embarcacion','yate','lancha','maritimo'], ARRAY['seguro buque','cotizar embarcacion'], 'buques', 'Buques'),
    ('construccion', ARRAY['obra','construccion','edificacion','contratista','obra civil'], ARRAY['todo riesgo construccion','seguro obra'], 'todo_riesgo_construccion', 'Todo Riesgo Construcción / Obra Civil'),
    ('montaje', ARRAY['montaje','instalacion de maquinaria'], ARRAY['seguro montaje'], 'montaje_maquinaria', 'Montaje de Maquinaria'),
    ('equipo_contratista', ARRAY['equipo de contratista','maquinaria pesada','retroexcavadora','grua','tractor'], ARRAY['seguro equipo contratista'], 'equipo_contratista', 'Equipo de Contratista y Maquinaria Pesada'),
    ('rotura_maquinaria', ARRAY['rotura de maquinaria','maquinaria fija','falla de maquina'], ARRAY['seguro rotura maquinaria'], 'rotura_maquinaria', 'Rotura de Maquinaria'),
    ('calderas', ARRAY['caldera','recipiente a presion','tanque de presion','autoclave'], ARRAY['seguro caldera'], 'calderas_presion', 'Calderas y Recipientes a Presión'),
    ('equipo_electronico', ARRAY['equipo electronico','servidor','computo','tecnologia'], ARRAY['seguro equipo electronico'], 'equipo_electronico', 'Equipo Electrónico y Electromagnético'),
    ('auto_alta_gama', ARRAY['auto','coche','vehiculo','carro','automovil','unidad'], ARRAY['cotizar auto','seguro de auto','alta gama'], 'auto_alta_gama', 'Auto / Unidad de Alta Gama'),
    ('gmm', ARRAY['gmm','gastos medicos','salud','medico','enfermedad'], ARRAY['gastos medicos mayores','cotizar gmm','seguro de salud'], 'gmm_individual', 'Gastos Médicos Mayores Individual'),
    ('accidentes_escolares', ARRAY['escuela','escolar','colegio','alumnos','estudiantes'], ARRAY['seguro escolar','accidentes escolares','escuela segura'], 'accidentes_escolares', 'Accidentes Personales Escolares');
END;
$$;

GRANT EXECUTE ON FUNCTION get_smart_assistant_intent_map() TO authenticated;
