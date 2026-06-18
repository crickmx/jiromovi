/*
  # Rebuild Standard Insurance Assistants — Conversational v2

  Complete overhaul of the 8 system-seeded automatic assistants.

  ## Key changes from v1:
  - Fields classified strictly as required / recommended / optional
  - `required` = blocks trámite creation until captured
  - `recommended` = asked once, skippable, does NOT block creation
  - `optional` = only captured if user volunteers the info
  - Block questions group 2-3 fields per message (conversational WhatsApp style)
  - system_prompt teaches the AI to: interpret natural responses, handle
    multi-field answers, accept skips gracefully, never loop on optional data
  - welcome/completion/transfer messages use {{nombre_responsable}} and {{link_tramite}}
  - No contact fields (nombre_cliente, telefono, correo) — those come from WhatsApp contact
  - No identificacion field — requested separately if needed by the agent

  ## Assistants rebuilt:
  1. GMM Individual / Familiar
  2. GMM Colectivo / Empresarial
  3. Seguro de Auto
  4. Seguro de Vida
  5. Seguro de Casa / Hogar
  6. Seguro Empresarial / PyME
  7. Seguro de Transportes / Carga
  8. Responsabilidad Civil

  ## Security
  - No RLS changes
  - generation_origin = 'system_seed' for idempotency
*/

-- Wipe previous seed (fields cascade)
DELETE FROM contact_center_assistant_fields
WHERE assistant_id IN (
  SELECT id FROM contact_center_assistants WHERE generation_origin = 'system_seed'
);
DELETE FROM contact_center_assistants WHERE generation_origin = 'system_seed';

DO $$
DECLARE
  v_gmm_id        uuid := gen_random_uuid();
  v_auto_id       uuid := gen_random_uuid();
  v_vida_id       uuid := gen_random_uuid();
  v_casa_id       uuid := gen_random_uuid();
  v_empresa_id    uuid := gen_random_uuid();
  v_transporte_id uuid := gen_random_uuid();
  v_rc_id         uuid := gen_random_uuid();
  v_gmm_col_id    uuid := gen_random_uuid();

  -- Shared system prompt header injected into every assistant
  v_skip_hint text := 'REGLAS CONVERSACIONALES:
- Interpreta respuestas naturales: "Mazda 3 2021 particular" extrae marca=Mazda, modelo=3, anio=2021, uso=particular.
- Si el usuario manda varios datos juntos, extráelos todos y no los vuelvas a preguntar.
- Si el usuario dice "no sé", "no tengo", "después", "omitir", "n/a": marca el campo como pendiente y avanza.
- Para campos recommended/optional: pide UNA sola vez; si no contesta claro, márcalo omitido y sigue.
- Para campos required: máximo 2 intentos. En el tercero acepta la respuesta con baja confianza y marca requires_human_review=true.
- NUNCA pidas teléfono, correo ni nombre del contacto: ya están en el sistema desde WhatsApp.
- NUNCA solicites identificación oficial salvo instrucción explícita.
- Usa tono conversacional de WhatsApp: breve, directo, sin tecnicismos.
- Cuando menciones seguimiento humano, usa SIEMPRE {{nombre_responsable}} en lugar de "un ejecutivo".';

BEGIN

-- ============================================================
-- 1. GMM INDIVIDUAL / FAMILIAR
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_gmm_id,
  'Cotización GMM Individual / Familiar',
  'Captura los datos esenciales para cotizar un seguro de Gastos Médicos Mayores individual o familiar.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Gastos Médicos Mayores de MOVI. Son pocos datos y en minutos tendrás tu solicitud lista. ¿Empezamos?',
  'Para continuar, usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de GMM. {{nombre_responsable}} revisará la información y te enviará las opciones por este medio.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Gastos Médicos Mayores de MOVI Seguros.
Tu trabajo es recopilar los datos mínimos para que el agente pueda cotizar correctamente.

BLOQUE 1 (required): pide nombre_asegurado + fecha_nacimiento + sexo en un solo mensaje.
BLOQUE 2 (required): pide tipo_plan + suma_asegurada en un solo mensaje.
BLOQUE 3 (required): pide ciudad_estado en un mensaje breve.
BLOQUE 4 (recommended): pide padecimientos + fuma en un mensaje con opción de omitir.
BLOQUE 5 (recommended): si tipo_plan=Familiar, pide numero_miembros + edades_dependientes.
BLOQUE 6 (optional): pide deducible + maternidad con opción de omitir.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  -- REQUIRED (bloque 1)
  (v_gmm_id,'nombre_asegurado','Nombre del asegurado principal','text',true,'required',1,
   'Para empezar, compárteme:\n1. Nombre completo del asegurado principal\n2. Fecha de nacimiento (dd/mm/aaaa)\n3. Sexo (M/F)','[]','Juan García López'),
  (v_gmm_id,'fecha_nacimiento','Fecha de nacimiento','date',true,'required',2,
   '¿Cuál es la fecha de nacimiento? (dd/mm/aaaa)','[]','15/03/1985'),
  (v_gmm_id,'sexo','Sexo','select',true,'required',3,
   '¿Cuál es el sexo del asegurado?','["Masculino","Femenino"]','Masculino'),
  -- REQUIRED (bloque 2)
  (v_gmm_id,'tipo_plan','Tipo de plan','select',true,'required',4,
   'Ahora dime:\n1. ¿El seguro es Individual o Familiar?\n2. ¿Qué suma asegurada buscas?','["Individual","Familiar"]','Individual'),
  (v_gmm_id,'suma_asegurada','Suma asegurada deseada','select',true,'required',5,
   '¿Qué suma asegurada necesitas?','["$1,000,000","$2,000,000","$3,000,000","$5,000,000","Sin límite"]','$2,000,000'),
  -- REQUIRED (bloque 3)
  (v_gmm_id,'ciudad_estado','Ciudad y estado de residencia','text',true,'required',6,
   '¿En qué ciudad y estado vive el asegurado?','[]','Guadalajara, Jalisco'),
  -- RECOMMENDED (bloque 4)
  (v_gmm_id,'padecimientos','Padecimientos preexistentes','text',false,'recommended',7,
   'Opcional: ¿el asegurado tiene algún padecimiento o cirugía reciente? También dime si fuma. Puedes escribir "omitir".','[]','Diabetes tipo 2, no fuma'),
  (v_gmm_id,'fuma','¿Fuma?','boolean',false,'recommended',8,
   '¿El asegurado fuma actualmente? (Sí / No — puedes omitir)','[]','No'),
  -- RECOMMENDED (bloque 5 — solo si familiar)
  (v_gmm_id,'numero_miembros','Número de miembros (plan familiar)','number',false,'recommended',9,
   'Como es plan familiar: ¿cuántos integrantes incluirá? Puedes omitir.','[]','3'),
  (v_gmm_id,'edades_dependientes','Edades de los dependientes','text',false,'recommended',10,
   '¿Cuáles son las edades de los otros integrantes? Puedes omitir.','[]','35, 8 y 5 años'),
  -- OPTIONAL (bloque 6)
  (v_gmm_id,'deducible','Preferencia de deducible','select',false,'optional',11,
   'Opcional: ¿tienes preferencia de deducible? Puedes omitir.','["Deducible tradicional","Deducible cero","Sin preferencia"]','Sin preferencia'),
  (v_gmm_id,'maternidad','¿Cobertura de maternidad?','boolean',false,'optional',12,
   'Opcional: ¿te interesa cobertura de maternidad?','[]','No'),
  (v_gmm_id,'aseguradora_actual','Aseguradora actual','text',false,'optional',13,
   'Opcional: ¿tienes aseguradora actual? Puedes omitir.','[]','GNP'),
  (v_gmm_id,'forma_pago','Forma de pago preferida','select',false,'optional',14,
   'Opcional: ¿cómo prefieres pagar la prima?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_gmm_id,'comentarios','Comentarios adicionales','text',false,'optional',15,
   'Opcional: ¿algo más que debamos considerar?','[]','');


-- ============================================================
-- 2. SEGURO DE AUTO
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_auto_id,
  'Cotización Seguro de Auto',
  'Captura datos del vehículo para cotizar un seguro de auto particular o comercial.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 3, true,
  'Hola, soy el asistente de Seguro de Auto de MOVI. Necesito solo unos datos de tu vehículo. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud. {{nombre_responsable}} te enviará las opciones de cobertura por este medio.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Seguro de Auto de MOVI Seguros.

BLOQUE 1 (required): pide marca + modelo + anio_vehiculo en un mensaje. Ejemplo: "Marca, modelo y año del vehículo".
Si el usuario responde "Mazda 3 2021 particular CDMX", extrae todo: marca=Mazda, modelo=3, anio=2021, uso=particular, ciudad=CDMX.

BLOQUE 2 (required): pide uso_vehiculo + ciudad_estado juntos.
BLOQUE 3 (recommended): pide cobertura_tipo. Con opción de omitir.
BLOQUE 4 (optional): pide version_vehiculo + valor_comercial. Con opción de omitir.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  -- REQUIRED (bloque 1)
  (v_auto_id,'marca_vehiculo','Marca del vehículo','text',true,'required',1,
   'Para cotizar el auto, compárteme:\n1. Marca, modelo y año\n2. Uso (particular, plataforma o comercial)\n3. Ciudad o estado','[]','Toyota'),
  (v_auto_id,'modelo_vehiculo','Modelo','text',true,'required',2,
   '¿Cuál es el modelo?','[]','Corolla'),
  (v_auto_id,'anio_vehiculo','Año del vehículo','number',true,'required',3,
   '¿De qué año es?','[]','2022'),
  -- REQUIRED (bloque 2)
  (v_auto_id,'uso_vehiculo','Uso del vehículo','select',true,'required',4,
   '¿Para qué usas el vehículo?','["Particular","Uber / DiDi / Cabify","Reparto / Mensajería","Comercial / Empresa"]','Particular'),
  (v_auto_id,'ciudad_estado','Ciudad y estado','text',true,'required',5,
   '¿En qué ciudad y estado se usa el vehículo?','[]','Monterrey, NL'),
  -- RECOMMENDED (bloque 3)
  (v_auto_id,'cobertura_tipo','Cobertura deseada','select',false,'recommended',6,
   'Opcional: ¿qué tipo de cobertura buscas? Puedes omitir.','["Amplia (todo riesgo)","Limitada (robo + RC)","Solo responsabilidad civil","No sé aún"]','Amplia (todo riesgo)'),
  (v_auto_id,'aseguradora_actual','Aseguradora actual','text',false,'recommended',7,
   'Opcional: ¿tienes aseguradora actual? Puedes omitir.','[]','Qualitas'),
  -- OPTIONAL (bloque 4)
  (v_auto_id,'version_vehiculo','Versión / Trim','text',false,'optional',8,
   'Opcional: ¿sabes la versión del vehículo? (ej. SE, XLE, Sport) Puedes omitir.','[]','SE'),
  (v_auto_id,'valor_comercial','Valor comercial aproximado','number',false,'optional',9,
   'Opcional: ¿cuál es el valor comercial aproximado del vehículo? Puedes omitir.','[]','280000'),
  (v_auto_id,'placas','Placas','text',false,'optional',10,
   'Opcional: ¿cuáles son las placas? Puedes omitir.','[]','ABC-123-D'),
  (v_auto_id,'forma_pago','Forma de pago','select',false,'optional',11,
   'Opcional: ¿cómo prefieres pagar la prima?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_auto_id,'comentarios','Comentarios','text',false,'optional',12,
   'Opcional: ¿algo más que debamos saber?','[]','');


-- ============================================================
-- 3. SEGURO DE VIDA
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_vida_id,
  'Cotización Seguro de Vida',
  'Captura los datos clave para cotizar un seguro de vida temporal o dotal.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de Seguro de Vida de MOVI. Con pocos datos podemos preparar tu solicitud. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de Seguro de Vida. {{nombre_responsable}} te enviará las opciones por este medio.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Seguro de Vida de MOVI Seguros.
Trata el tema con naturalidad. No es necesario ser solemne.

BLOQUE 1 (required): pide nombre_asegurado + fecha_nacimiento + sexo.
BLOQUE 2 (required): pide suma_asegurada + tipo_seguro_vida.
BLOQUE 3 (required): pide ocupacion + fuma (son underwriting críticos).
BLOQUE 4 (recommended): pide plazo_años + nombre_beneficiario. Con opción de omitir.
BLOQUE 5 (optional): pide padecimientos + forma_pago.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_vida_id,'nombre_asegurado','Nombre del asegurado','text',true,'required',1,
   'Para empezar:\n1. Nombre completo del asegurado\n2. Fecha de nacimiento (dd/mm/aaaa)\n3. Sexo (M/F)','[]','Ana Torres'),
  (v_vida_id,'fecha_nacimiento','Fecha de nacimiento','date',true,'required',2,
   '¿Cuál es su fecha de nacimiento?','[]','20/07/1990'),
  (v_vida_id,'sexo','Sexo','select',true,'required',3,
   '¿Cuál es el sexo?','["Masculino","Femenino"]','Femenino'),
  (v_vida_id,'suma_asegurada','Suma asegurada deseada','select',true,'required',4,
   'Ahora:\n1. ¿Qué monto de cobertura necesitas?\n2. ¿Qué tipo de seguro de vida te interesa?','["$500,000","$1,000,000","$2,000,000","$3,000,000","$5,000,000","Más de $5,000,000"]','$2,000,000'),
  (v_vida_id,'tipo_seguro_vida','Tipo de seguro de vida','select',true,'required',5,
   '¿Qué tipo de seguro de vida necesitas?','["Temporal (protección por plazo fijo)","Dotal (ahorro + protección)","Vida entera","No sé, necesito orientación"]','Temporal (protección por plazo fijo)'),
  (v_vida_id,'ocupacion','Ocupación del asegurado','text',true,'required',6,
   '¿Cuál es la ocupación del asegurado? También dime si fuma (Sí/No).','[]','Contador'),
  (v_vida_id,'fuma','¿Fuma?','boolean',true,'required',7,
   '¿El asegurado fuma actualmente?','[]','No'),
  -- RECOMMENDED
  (v_vida_id,'plazo_anios','Plazo del seguro (años)','select',false,'recommended',8,
   'Opcional: ¿por cuántos años deseas la cobertura? Puedes omitir.','["5 años","10 años","15 años","20 años","Hasta los 65 años","Hasta los 70 años"]','20 años'),
  (v_vida_id,'nombre_beneficiario','Beneficiario principal','text',false,'recommended',9,
   'Opcional: ¿quién sería el beneficiario? (nombre y parentesco) Puedes omitir.','[]','María Torres (esposa)'),
  (v_vida_id,'padecimientos','Padecimientos preexistentes','text',false,'recommended',10,
   'Opcional: ¿el asegurado tiene algún padecimiento crónico o cirugía reciente? Puedes omitir.','[]','Ninguno'),
  -- OPTIONAL
  (v_vida_id,'objetivo_seguro','Objetivo del seguro','select',false,'optional',11,
   'Opcional: ¿cuál es el objetivo principal del seguro?','["Protección familiar","Ahorro","Crédito hipotecario","Otro"]','Protección familiar'),
  (v_vida_id,'forma_pago','Forma de pago','select',false,'optional',12,
   'Opcional: ¿cómo prefieres pagar?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_vida_id,'comentarios','Comentarios','text',false,'optional',13,
   'Opcional: ¿algo más que debamos considerar?','[]','');


-- ============================================================
-- 4. SEGURO DE CASA / HOGAR
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_casa_id,
  'Cotización Seguro de Casa / Hogar',
  'Captura los datos del inmueble para cotizar un seguro de hogar.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de Seguro de Casa de MOVI. Con unos datos de tu hogar puedo preparar tu solicitud. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de Seguro de Casa. {{nombre_responsable}} revisará la información y te enviará las opciones.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Seguro de Hogar de MOVI Seguros.

BLOQUE 1 (required): pide tipo_inmueble + regimen_propiedad + ciudad_estado.
BLOQUE 2 (required): pide valor_inmueble.
BLOQUE 3 (recommended): pide valor_contenidos + tipo_construccion. Con opción de omitir.
BLOQUE 4 (optional): pide metros_cuadrados + anio_construccion + coberturas_extra.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_casa_id,'tipo_inmueble','Tipo de inmueble','select',true,'required',1,
   'Para empezar:\n1. ¿Qué tipo de inmueble es? (casa, depa, etc.)\n2. ¿Es propio o rentado?\n3. ¿En qué ciudad y estado está?','["Casa habitación","Departamento","Casa de campo / vacacional","Otro"]','Casa habitación'),
  (v_casa_id,'regimen_propiedad','Régimen de la propiedad','select',true,'required',2,
   '¿El inmueble es propio o rentado?','["Propio","Rentado","En proceso de compra"]','Propio'),
  (v_casa_id,'ciudad_estado','Ciudad y estado','text',true,'required',3,
   '¿En qué ciudad y estado está el inmueble?','[]','Ciudad de México, CDMX'),
  (v_casa_id,'valor_inmueble','Valor del inmueble (construcción)','number',true,'required',4,
   '¿Cuál es el valor aproximado del inmueble? (solo construcción, en pesos)\nEjemplo: 1,500,000','[]','1500000'),
  -- RECOMMENDED
  (v_casa_id,'valor_contenidos','Valor de contenidos / mobiliario','number',false,'recommended',5,
   'Opcional: ¿cuál es el valor del mobiliario y contenidos del hogar? Puedes omitir.','[]','200000'),
  (v_casa_id,'tipo_construccion','Tipo de construcción','select',false,'recommended',6,
   'Opcional: ¿de qué material es la construcción?','["Sólida (tabique, concreto)","Madera / mixta","Prefabricada"]','Sólida (tabique, concreto)'),
  (v_casa_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',7,
   'Opcional: ¿tiene alarma, rejas, cámara u otra medida de seguridad? Puedes omitir.','[]','Alarma conectada a monitoreo'),
  -- OPTIONAL
  (v_casa_id,'metros_cuadrados','Metros cuadrados de construcción','number',false,'optional',8,
   'Opcional: ¿cuántos metros cuadrados de construcción tiene?','[]','120'),
  (v_casa_id,'anio_construccion','Año de construcción','number',false,'optional',9,
   'Opcional: ¿en qué año fue construido?','[]','2005'),
  (v_casa_id,'coberturas_extra','Coberturas adicionales de interés','text',false,'optional',10,
   'Opcional: ¿te interesan coberturas adicionales? (robo, terremoto, inundación...) Puedes omitir.','[]','Robo con violencia'),
  (v_casa_id,'forma_pago','Forma de pago','select',false,'optional',11,
   'Opcional: ¿cómo prefieres pagar la prima?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_casa_id,'comentarios','Comentarios','text',false,'optional',12,
   'Opcional: ¿algo más que considerar?','[]','');


-- ============================================================
-- 5. SEGURO EMPRESARIAL / PyME
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_empresa_id,
  'Cotización Seguro Empresarial / PyME',
  'Captura datos del negocio para cotizar seguros empresariales: incendio, robo, RC, equipo electrónico.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 3, true,
  'Hola, soy el asistente de Seguro Empresarial de MOVI. Necesito pocos datos de tu negocio para preparar tu solicitud. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de Seguro Empresarial. {{nombre_responsable}} revisará la información y te enviará las opciones disponibles.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Seguros Empresariales de MOVI Seguros.

BLOQUE 1 (required): pide nombre_empresa + giro_negocio + ciudad_estado.
BLOQUE 2 (required): pide coberturas_requeridas + valor_contenidos.
BLOQUE 3 (recommended): pide numero_empleados + tipo_local. Con opción de omitir.
BLOQUE 4 (optional): pide ventas_anuales + rfc + tiene_seguro_actual.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_empresa_id,'nombre_empresa','Nombre / Razón social','text',true,'required',1,
   'Para ubicar el riesgo, compárteme:\n1. Nombre del negocio\n2. Giro o actividad\n3. Ciudad y estado','[]','Ferretería El Perno'),
  (v_empresa_id,'giro_negocio','Giro del negocio','text',true,'required',2,
   '¿Cuál es la actividad principal del negocio?','[]','Venta de materiales de construcción'),
  (v_empresa_id,'ciudad_estado','Ciudad y estado','text',true,'required',3,
   '¿En qué ciudad y estado opera?','[]','Puebla, Pue.'),
  (v_empresa_id,'coberturas_requeridas','Coberturas requeridas','text',true,'required',4,
   '¿Qué quieres proteger? Por ejemplo: mercancía, equipo, robo, incendio, responsabilidad civil. Puedes listar varios.','[]','Mercancía e incendio'),
  (v_empresa_id,'valor_contenidos','Valor de bienes a asegurar','number',true,'required',5,
   '¿Cuál es el valor aproximado de los bienes que deseas asegurar? (en pesos)','[]','500000'),
  -- RECOMMENDED
  (v_empresa_id,'numero_empleados','Número de empleados','number',false,'recommended',6,
   'Opcional: ¿cuántos empleados tiene el negocio? Puedes omitir.','[]','8'),
  (v_empresa_id,'tipo_local','Tipo de local','select',false,'recommended',7,
   'Opcional: ¿el local es propio o rentado?','["Propio","Rentado","Varios locales"]','Rentado'),
  (v_empresa_id,'tiene_seguro_actual','¿Tiene seguro actualmente?','boolean',false,'recommended',8,
   'Opcional: ¿el negocio tiene algún seguro actualmente? (Sí/No) Puedes omitir.','[]','No'),
  -- OPTIONAL
  (v_empresa_id,'ventas_anuales','Ventas anuales aproximadas','number',false,'optional',9,
   'Opcional: ¿cuáles son las ventas anuales aproximadas? Puedes omitir.','[]','2000000'),
  (v_empresa_id,'rfc','RFC del negocio','text',false,'optional',10,
   'Opcional: ¿cuál es el RFC? Puedes omitir.','[]','FEP010101ABC'),
  (v_empresa_id,'forma_pago','Forma de pago','select',false,'optional',11,
   'Opcional: ¿cómo prefiere pagar la prima?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_empresa_id,'comentarios','Comentarios','text',false,'optional',12,
   'Opcional: ¿algo más que debamos saber del negocio?','[]','');


-- ============================================================
-- 6. SEGURO DE TRANSPORTES / CARGA
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_transporte_id,
  'Cotización Seguro de Transportes / Carga',
  'Captura datos de la mercancía y rutas para cotizar un seguro de transporte de carga.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de Seguro de Transportes de MOVI. Necesito datos de tu operación logística para preparar tu solicitud. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de Seguro de Transportes. {{nombre_responsable}} te enviará las opciones disponibles.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Seguros de Transporte y Carga de MOVI Seguros.

BLOQUE 1 (required): pide tipo_carga + valor_carga + tipo_transporte.
BLOQUE 2 (required): pide ruta_origen + ruta_destino.
BLOQUE 3 (recommended): pide frecuencia + embalaje. Con opción de omitir.
BLOQUE 4 (optional): pide almacenaje + nombre_empresa.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_transporte_id,'tipo_carga','Tipo de mercancía / carga','text',true,'required',1,
   'Para la cotización, compárteme:\n1. ¿Qué tipo de mercancía transportas?\n2. Valor por embarque (en pesos)\n3. Tipo de transporte (terrestre, aéreo, marítimo)','[]','Electrónica de consumo'),
  (v_transporte_id,'valor_carga','Valor por embarque','number',true,'required',2,
   '¿Cuál es el valor aproximado por embarque?','[]','500000'),
  (v_transporte_id,'tipo_transporte','Tipo de transporte','select',true,'required',3,
   '¿Cómo se transporta la mercancía?','["Terrestre (camión / trailer)","Aéreo","Marítimo","Multimodal"]','Terrestre (camión / trailer)'),
  (v_transporte_id,'ruta_origen','Ciudad / estado de origen','text',true,'required',4,
   'Ahora la ruta:\n1. Ciudad / estado de origen\n2. Ciudad / estado de destino','[]','Monterrey, NL'),
  (v_transporte_id,'ruta_destino','Ciudad / estado de destino','text',true,'required',5,
   '¿A dónde va el embarque?','[]','Ciudad de México, CDMX'),
  -- RECOMMENDED
  (v_transporte_id,'frecuencia','Frecuencia de embarques','select',false,'recommended',6,
   'Opcional: ¿con qué frecuencia realizas embarques? Puedes omitir.','["Diario","Semanal","Quincenal","Mensual","Eventual"]','Semanal'),
  (v_transporte_id,'embalaje','Tipo de embalaje','text',false,'recommended',7,
   'Opcional: ¿cómo va embalada la mercancía? Puedes omitir.','[]','Cajas de cartón en pallets'),
  -- OPTIONAL
  (v_transporte_id,'almacenaje','¿Incluye almacenaje?','boolean',false,'optional',8,
   'Opcional: ¿la mercancía permanece en bodega antes o después del transporte? Puedes omitir.','[]','No'),
  (v_transporte_id,'nombre_empresa','Empresa transportista o dueña de la carga','text',false,'optional',9,
   'Opcional: ¿cuál es el nombre de la empresa? Puedes omitir.','[]',''),
  (v_transporte_id,'comentarios','Comentarios','text',false,'optional',10,
   'Opcional: ¿algún detalle adicional de la operación?','[]','');


-- ============================================================
-- 7. RESPONSABILIDAD CIVIL
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_rc_id,
  'Cotización Responsabilidad Civil',
  'Captura datos del negocio o actividad para cotizar RC general o profesional.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de Responsabilidad Civil de MOVI. Necesito datos de tu actividad para preparar tu solicitud. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de RC. {{nombre_responsable}} te enviará las opciones de cobertura.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para continuar con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Responsabilidad Civil de MOVI Seguros.
Si el usuario no sabe qué tipo de RC necesita, explícale brevemente: RC General = daños a terceros, RC Profesional = errores en servicios, RC Patronal = accidentes de empleados.

BLOQUE 1 (required): pide tipo_rc + giro_negocio + ciudad_estado.
BLOQUE 2 (required): pide suma_asegurada_rc.
BLOQUE 3 (recommended): pide numero_empleados + ventas_anuales. Con opción de omitir.
BLOQUE 4 (optional): pide alcance_geografico + tiene_rc_actual.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_rc_id,'tipo_rc','Tipo de RC','select',true,'required',1,
   'Para cotizar la RC, compárteme:\n1. ¿Qué tipo de RC necesitas?\n2. ¿A qué se dedica tu negocio o actividad?\n3. ¿En qué ciudad y estado operas?','["RC General (daños a terceros)","RC Profesional (errores y omisiones)","RC Patronal (accidentes de empleados)","RC Productos (bienes que comercializo)","No sé, necesito orientación"]','RC General (daños a terceros)'),
  (v_rc_id,'giro_negocio','Giro del negocio / actividad profesional','text',true,'required',2,
   '¿Cuál es la actividad principal?','[]','Consultora de tecnología'),
  (v_rc_id,'ciudad_estado','Ciudad y estado de operación','text',true,'required',3,
   '¿En qué ciudad y estado operas principalmente?','[]','Guadalajara, Jalisco'),
  (v_rc_id,'suma_asegurada_rc','Límite de cobertura requerido','select',true,'required',4,
   '¿Qué límite de cobertura necesitas?','["$1,000,000","$2,000,000","$5,000,000","$10,000,000","No sé, necesito orientación"]','$2,000,000'),
  -- RECOMMENDED
  (v_rc_id,'numero_empleados','Número de empleados','number',false,'recommended',5,
   'Opcional: ¿cuántos empleados o colaboradores hay? Puedes omitir.','[]','15'),
  (v_rc_id,'ventas_anuales','Facturación anual aproximada','number',false,'recommended',6,
   'Opcional: ¿cuál es la facturación anual aproximada? Puedes omitir.','[]','3000000'),
  (v_rc_id,'alcance_geografico','Alcance geográfico','select',false,'recommended',7,
   'Opcional: ¿las operaciones son solo en México o también en el extranjero?','["Solo en México","México y Estados Unidos","Internacional"]','Solo en México'),
  -- OPTIONAL
  (v_rc_id,'tiene_rc_actual','¿Tiene RC actualmente?','boolean',false,'optional',8,
   'Opcional: ¿cuentas con alguna RC actualmente? (Sí/No) Puedes omitir.','[]','No'),
  (v_rc_id,'nombre_empresa','Nombre de la empresa','text',false,'optional',9,
   'Opcional: ¿cuál es el nombre de la empresa o razón social? Puedes omitir.','[]',''),
  (v_rc_id,'comentarios','Comentarios','text',false,'optional',10,
   'Opcional: ¿algún aspecto específico de tu operación que debamos considerar?','[]','');


-- ============================================================
-- 8. GMM COLECTIVO / EMPRESARIAL
-- ============================================================
INSERT INTO contact_center_assistants (
  id, nombre, descripcion, generation_origin, is_active, is_global,
  model, language, question_block_size, mention_responsible_name,
  welcome_message, consent_message, completion_message, transfer_message,
  auto_create_tramite, tramite_tipo, tramite_prioridad,
  skip_contact_fields, use_ai_extraction, handoff_after_creation,
  allow_incomplete_submission, max_retries_per_field, system_prompt
) VALUES (
  v_gmm_col_id,
  'Cotización GMM Colectivo / Empresarial',
  'Captura datos de la empresa y plantilla para cotizar GMM grupal.',
  'system_seed', true, true, 'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de GMM Empresarial de MOVI. Necesito datos de tu empresa para preparar la cotización grupal. ¿Empezamos?',
  'Usaré la información que me compartas solo para preparar tu cotización. ¿Me das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de GMM Empresarial. {{nombre_responsable}} te enviará las opciones de cobertura grupal.

Puedes consultar tu trámite aquí:
{{link_tramite}}',
  'Voy a transferirte con {{nombre_responsable}} para continuar con tu atención.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres el asistente de cotización de Gastos Médicos Mayores Colectivo/Empresarial de MOVI Seguros.

BLOQUE 1 (required): pide nombre_empresa + giro_negocio + ciudad_estado.
BLOQUE 2 (required): pide numero_empleados + rango_edades + suma_asegurada.
BLOQUE 3 (recommended): pide incluye_dependientes + deducible. Con opción de omitir.
BLOQUE 4 (optional): pide tiene_seguro_actual + aseguradora_actual.

' || v_skip_hint
);

INSERT INTO contact_center_assistant_fields
  (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options, example_value)
VALUES
  (v_gmm_col_id,'nombre_empresa','Nombre / Razón social','text',true,'required',1,
   'Para empezar:\n1. Nombre o razón social de la empresa\n2. Giro o actividad\n3. Ciudad y estado donde opera','[]','Constructora Vidal'),
  (v_gmm_col_id,'giro_negocio','Giro del negocio','text',true,'required',2,
   '¿A qué se dedica la empresa?','[]','Construcción residencial'),
  (v_gmm_col_id,'ciudad_estado','Ciudad y estado','text',true,'required',3,
   '¿En qué ciudad y estado?','[]','Monterrey, NL'),
  (v_gmm_col_id,'numero_empleados','Total de empleados a asegurar','number',true,'required',4,
   'Ahora:\n1. ¿Cuántos empleados incluirá el plan?\n2. ¿Cuál es el rango de edades?\n3. ¿Qué suma asegurada por empleado?','[]','25'),
  (v_gmm_col_id,'rango_edades','Rango de edades del grupo','text',true,'required',5,
   '¿Cuál es el rango de edades?','[]','25 a 55 años'),
  (v_gmm_col_id,'suma_asegurada','Suma asegurada por empleado','select',true,'required',6,
   '¿Qué suma asegurada por empleado?','["$500,000","$1,000,000","$2,000,000","$3,000,000","Sin límite"]','$1,000,000'),
  -- RECOMMENDED
  (v_gmm_col_id,'incluye_dependientes','¿Incluye dependientes familiares?','boolean',false,'recommended',7,
   'Opcional: ¿el plan incluirá también a los familiares de los empleados? (Sí/No) Puedes omitir.','[]','No'),
  (v_gmm_col_id,'deducible','Tipo de deducible','select',false,'recommended',8,
   'Opcional: ¿tienen preferencia de deducible? Puedes omitir.','["Deducible tradicional","Deducible cero","Sin preferencia"]','Sin preferencia'),
  -- OPTIONAL
  (v_gmm_col_id,'tiene_seguro_actual','¿Tienen GMM actualmente?','boolean',false,'optional',9,
   'Opcional: ¿la empresa tiene GMM grupal actualmente? (Sí/No) Puedes omitir.','[]','No'),
  (v_gmm_col_id,'aseguradora_actual','Aseguradora actual','text',false,'optional',10,
   'Opcional: ¿con qué aseguradora? Puedes omitir.','[]',''),
  (v_gmm_col_id,'forma_pago','Forma de pago','select',false,'optional',11,
   'Opcional: ¿cómo prefiere pagar la empresa?','["Anual","Semestral","Trimestral","Mensual"]','Anual'),
  (v_gmm_col_id,'comentarios','Comentarios','text',false,'optional',12,
   'Opcional: ¿algo más que considerar para la cotización grupal?','[]','');


-- ============================================================
-- Sync field_count
-- ============================================================
UPDATE contact_center_assistants a
SET field_count = (
  SELECT COUNT(*) FROM contact_center_assistant_fields f WHERE f.assistant_id = a.id
)
WHERE a.generation_origin = 'system_seed';

END $$;
