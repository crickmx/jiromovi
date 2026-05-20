/*
  # Seed Standard Insurance Automatic Assistants

  Creates 8 pre-configured automatic assistants for the most common
  insurance types in the Mexican market. Each assistant:

  - Skips contact/identification fields (phone, name, email, ID documents)
    because those come from the WhatsApp contact context automatically.
  - Captures only the fields genuinely needed to generate a competitive quote.
  - Uses question_block_size = 2 (ask 2-3 fields at a time for natural flow).
  - Marks fields as `required` or `recommended` based on underwriting needs.
  - Does NOT include: nombre_cliente, telefono, correo, identificacion.

  ## Assistants Created

  1. Seguro de Gastos Médicos Mayores (GMM) — Individual/Familiar
  2. Seguro de Auto — Particular
  3. Seguro de Vida — Temporal/Dotación
  4. Seguro de Casa — Hogar / Inmueble
  5. Seguro Empresarial — PyMEs y Negocios
  6. Seguro de Transportes — Carga y Mercancías
  7. Seguro de Responsabilidad Civil — General
  8. Seguro de Gastos Médicos — Colectivo / Empresarial

  ## Security
  - No RLS rows inserted (assistants are managed by RLS policies on the table)
  - Records are marked is_global = true so all offices can use them
  - created_by is NULL (system-generated)
*/

-- ============================================================
-- Delete any previous system-seeded assistants to avoid
-- duplicates on re-runs (idempotent by generation_origin)
-- ============================================================
DELETE FROM contact_center_assistant_fields
WHERE assistant_id IN (
  SELECT id FROM contact_center_assistants
  WHERE generation_origin = 'system_seed'
);

DELETE FROM contact_center_assistants
WHERE generation_origin = 'system_seed';

-- ============================================================
-- Helper: insert assistants with UUIDs we control
-- ============================================================

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
  v_ord           integer;
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
  allow_incomplete_submission, max_retries_per_field,
  system_prompt
) VALUES (
  v_gmm_id,
  'Cotización GMM Individual / Familiar',
  'Recopila los datos necesarios para cotizar un seguro de Gastos Médicos Mayores individual o familiar.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Gastos Médicos Mayores de MOVI. En unos minutos te ayudaré a preparar tu solicitud. ¿Comenzamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Perfecto, ya registré tu solicitud de cotización de GMM. {{nombre_responsable}} revisará la información y te enviará las opciones por este medio.',
  'Voy a transferirte con {{nombre_responsable}} para que te dé seguimiento personalizado.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de Gastos Médicos Mayores. Recoge los datos del asegurado de manera amigable y conversacional. No solicites datos de contacto ni identificación oficial; esos se manejan por separado. Si el usuario menciona más de un asegurado, confirma que se trata de un plan familiar. Usa lenguaje sencillo y accesible.'
);

v_ord := 0;
-- Datos del asegurado principal
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_gmm_id, 'nombre_asegurado',   'Nombre del asegurado principal', 'text',   true,  'required',     v_ord + 1,  '¿Cuál es el nombre completo del asegurado principal?',  '[]'),
(v_gmm_id, 'fecha_nacimiento',   'Fecha de nacimiento',            'date',   true,  'required',     v_ord + 2,  '¿Cuál es su fecha de nacimiento? (dd/mm/aaaa)',          '[]'),
(v_gmm_id, 'sexo',               'Sexo',                           'select', true,  'required',     v_ord + 3,  '¿Cuál es el sexo del asegurado?',                       '["Masculino","Femenino"]'),
(v_gmm_id, 'tipo_plan',          'Tipo de plan',                   'select', true,  'required',     v_ord + 4,  '¿El seguro es solo para una persona o incluye familia?', '["Individual","Familiar"]'),
-- Miembros si es familiar
(v_gmm_id, 'numero_miembros',    'Número de miembros (si familiar)', 'number', false, 'recommended', v_ord + 5,  '¿Cuántos miembros incluirá el plan familiar?',           '[]'),
(v_gmm_id, 'edades_dependientes','Edades de dependientes',         'text',   false, 'recommended',  v_ord + 6,  '¿Cuáles son las edades de los demás integrantes?',       '[]'),
-- Cobertura
(v_gmm_id, 'suma_asegurada',     'Suma asegurada deseada',         'select', true,  'required',     v_ord + 7,  '¿Qué suma asegurada necesitas?',                        '["$1,000,000","$2,000,000","$3,000,000","$5,000,000","Sin límite / Suma mayor"]'),
(v_gmm_id, 'deducible',          'Preferencia de deducible',       'select', false, 'recommended',  v_ord + 8,  '¿Tienes preferencia sobre el tipo de deducible?',       '["Deducible tradicional","Deducible cero","Coaseguro","No tengo preferencia"]'),
-- Salud
(v_gmm_id, 'padecimientos',      'Padecimientos preexistentes',    'text',   false, 'recommended',  v_ord + 9,  '¿El asegurado tiene algún padecimiento preexistente o cirugía reciente? (o escribe "ninguno")', '[]'),
(v_gmm_id, 'medicamentos',       'Medicamentos actuales',          'text',   false, 'recommended',  v_ord + 10, '¿Toma algún medicamento de manera habitual? (o escribe "no")', '[]'),
(v_gmm_id, 'fuma',               '¿Fuma?',                         'boolean',false, 'recommended',  v_ord + 11, '¿El asegurado fuma actualmente? (Sí / No)',              '[]'),
-- Cobertura extra
(v_gmm_id, 'maternidad',         '¿Cobertura de maternidad?',      'boolean',false, 'optional',     v_ord + 12, '¿Te interesa incluir cobertura de maternidad? (Sí / No)', '[]'),
(v_gmm_id, 'dental_vision',      '¿Dental / Visión?',              'boolean',false, 'optional',     v_ord + 13, '¿Te interesa incluir beneficios de dental o visión? (Sí / No)', '[]'),
-- Ciudad / estado para red médica
(v_gmm_id, 'ciudad_estado',      'Ciudad y estado de residencia',  'text',   true,  'required',     v_ord + 14, '¿En qué ciudad y estado vive el asegurado principal?',  '[]'),
(v_gmm_id, 'forma_pago',         'Forma de pago preferida',        'select', false, 'optional',     v_ord + 15, '¿Cómo prefieres pagar la prima?',                       '["Anual","Semestral","Trimestral","Mensual"]'),
(v_gmm_id, 'comentarios',        'Comentarios adicionales',        'text',   false, 'optional',     v_ord + 16, '¿Hay algo más que debamos considerar para tu cotización?', '[]');


-- ============================================================
-- 2. SEGURO DE AUTO — PARTICULAR
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
  'Captura datos del vehículo y necesidades de cobertura para cotizar seguro de auto particular.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Seguro de Auto de MOVI. Necesito unos datos de tu vehículo para preparar tu solicitud. ¿Empezamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de cotización de Auto. {{nombre_responsable}} te enviará las opciones de cobertura por este medio.',
  'Voy a transferirte con {{nombre_responsable}} para darte seguimiento.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de automóvil. Recopila los datos del vehículo de manera conversacional. No pidas identificación ni datos de contacto. Si el usuario da marca y modelo junto, extráelos por separado. Si menciona el año, el modelo y la marca en una sola frase, extráelos todos.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_auto_id, 'marca_vehiculo',  'Marca del vehículo',       'text',   true,  'required',     v_ord + 1,  '¿Cuál es la marca del vehículo? (ej. Nissan, Toyota, Honda...)', '[]'),
(v_auto_id, 'modelo_vehiculo', 'Modelo',                   'text',   true,  'required',     v_ord + 2,  '¿Cuál es el modelo?',                                           '[]'),
(v_auto_id, 'anio_vehiculo',   'Año del vehículo',         'number', true,  'required',     v_ord + 3,  '¿De qué año es?',                                               '[]'),
(v_auto_id, 'uso_vehiculo',    'Uso del vehículo',         'select', true,  'required',     v_ord + 4,  '¿Para qué usas el vehículo principalmente?',                    '["Particular","Uber / DiDi / Cabify","Reparto / Mensajería","Comercial / Empresa"]'),
(v_auto_id, 'version_vehiculo','Versión / Trim',           'text',   false, 'recommended',  v_ord + 5,  '¿Sabes la versión o trim del vehículo? (ej. XLE, Sport, Sense... o escribe "no sé")', '[]'),
(v_auto_id, 'cobertura_tipo',  'Tipo de cobertura deseada','select', true,  'required',     v_ord + 6,  '¿Qué tipo de cobertura te interesa?',                           '["Amplia (todo riesgo)","Limitada (robo y daños a terceros)","Solo responsabilidad civil"]'),
(v_auto_id, 'valor_comercial', 'Valor comercial aproximado','number',false, 'recommended',  v_ord + 7,  '¿Cuál es el valor comercial aproximado del vehículo? (en pesos, o escribe "no sé")', '[]'),
(v_auto_id, 'ciudad_estado',   'Ciudad y estado',          'text',   true,  'required',     v_ord + 8,  '¿En qué ciudad y estado se usa principalmente el vehículo?',    '[]'),
(v_auto_id, 'placas',          'Placas',                   'text',   false, 'optional',     v_ord + 9,  '¿Cuáles son las placas? (o escribe "no tengo" si es vehículo nuevo)', '[]'),
(v_auto_id, 'forma_pago',      'Forma de pago',            'select', false, 'optional',     v_ord + 10, '¿Cómo prefieres pagar la prima?',                               '["Anual","Semestral","Trimestral","Mensual"]'),
(v_auto_id, 'comentarios',     'Comentarios',              'text',   false, 'optional',     v_ord + 11, '¿Hay algo más que debamos saber?',                              '[]');


-- ============================================================
-- 3. SEGURO DE VIDA — INDIVIDUAL
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
  'Recopila los datos esenciales para cotizar un seguro de vida temporal o dotal.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Seguro de Vida de MOVI. En minutos tendrás tu solicitud lista. ¿Empezamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Perfecto, ya registré tu solicitud de Seguro de Vida. {{nombre_responsable}} te enviará las opciones de cobertura por este medio.',
  'Voy a transferirte con {{nombre_responsable}} para atenderte personalmente.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de vida. Trata el tema con sensibilidad. No pidas identificación ni datos de contacto. Explica de manera simple qué es una suma asegurada si el usuario no lo sabe.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_vida_id, 'nombre_asegurado',  'Nombre del asegurado',       'text',   true,  'required',     v_ord + 1,  '¿Cuál es el nombre completo de la persona a asegurar?',         '[]'),
(v_vida_id, 'fecha_nacimiento',  'Fecha de nacimiento',        'date',   true,  'required',     v_ord + 2,  '¿Cuál es su fecha de nacimiento? (dd/mm/aaaa)',                 '[]'),
(v_vida_id, 'sexo',              'Sexo',                       'select', true,  'required',     v_ord + 3,  '¿Cuál es el sexo del asegurado?',                               '["Masculino","Femenino"]'),
(v_vida_id, 'tipo_seguro_vida',  'Tipo de seguro de vida',     'select', true,  'required',     v_ord + 4,  '¿Qué tipo de seguro de vida necesitas?',                        '["Temporal (protección por cierto plazo)","Dotal (ahorro + protección)","Vida entera","No sé, necesito orientación"]'),
(v_vida_id, 'suma_asegurada',    'Suma asegurada deseada',     'select', true,  'required',     v_ord + 5,  '¿Qué monto de cobertura necesitas en caso de fallecimiento?',   '["$500,000","$1,000,000","$2,000,000","$3,000,000","$5,000,000","Más de $5,000,000"]'),
(v_vida_id, 'plazo_años',        'Plazo del seguro (años)',    'select', false, 'recommended',  v_ord + 6,  '¿Por cuántos años deseas la cobertura?',                        '["5 años","10 años","15 años","20 años","Hasta los 65 años","Hasta los 70 años"]'),
(v_vida_id, 'ocupacion',         'Ocupación del asegurado',   'text',   true,  'required',     v_ord + 7,  '¿Cuál es la ocupación o profesión del asegurado?',              '[]'),
(v_vida_id, 'fuma',              '¿Fuma?',                     'boolean',true,  'required',     v_ord + 8,  '¿El asegurado fuma actualmente? (Sí / No)',                     '[]'),
(v_vida_id, 'padecimientos',     'Padecimientos preexistentes','text',   false, 'recommended',  v_ord + 9,  '¿Tiene algún padecimiento crónico o cirugía importante? (o escribe "ninguno")', '[]'),
(v_vida_id, 'nombre_beneficiario','Nombre del beneficiario',  'text',   false, 'recommended',  v_ord + 10, '¿Quién será el beneficiario principal del seguro? (nombre completo)', '[]'),
(v_vida_id, 'parentesco',        'Parentesco del beneficiario','select', false, 'recommended',  v_ord + 11, '¿Qué parentesco tiene el beneficiario con el asegurado?',       '["Cónyuge","Hijo/a","Padre / Madre","Hermano/a","Otro"]'),
(v_vida_id, 'forma_pago',        'Forma de pago',              'select', false, 'optional',     v_ord + 12, '¿Cómo prefieres pagar la prima?',                               '["Anual","Semestral","Trimestral","Mensual"]'),
(v_vida_id, 'comentarios',       'Comentarios',                'text',   false, 'optional',     v_ord + 13, '¿Hay algún dato adicional que debamos considerar?',             '[]');


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
  'Recopila datos del inmueble y coberturas deseadas para cotizar un seguro de hogar.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Seguro de Casa de MOVI. Voy a pedirte unos datos de tu hogar para preparar tu solicitud. ¿Comenzamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de Seguro de Casa. {{nombre_responsable}} revisará la información y te enviará las opciones de cobertura.',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de hogar. Recopila los datos del inmueble de manera amigable. No solicites identificación. Si el usuario menciona una dirección completa, extrae el estado y ciudad de ella.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_casa_id, 'tipo_inmueble',     'Tipo de inmueble',             'select', true,  'required',     v_ord + 1,  '¿Qué tipo de inmueble deseas asegurar?',                         '["Casa habitación","Departamento","Casa de campo / vacacional","Otro"]'),
(v_casa_id, 'regimen_propiedad', 'Régimen de la propiedad',      'select', true,  'required',     v_ord + 2,  '¿El inmueble es propio o rentado?',                              '["Propio","Rentado","En proceso de compra"]'),
(v_casa_id, 'ciudad_estado',     'Ciudad y estado',              'text',   true,  'required',     v_ord + 3,  '¿En qué ciudad y estado está ubicado el inmueble?',             '[]'),
(v_casa_id, 'valor_inmueble',    'Valor del inmueble',           'number', true,  'required',     v_ord + 4,  '¿Cuál es el valor aproximado del inmueble? (solo construcción, en pesos)', '[]'),
(v_casa_id, 'valor_contenidos',  'Valor de contenidos',          'number', false, 'recommended',  v_ord + 5,  '¿Cuál es el valor del mobiliario y contenidos del hogar? (en pesos, o escribe 0)', '[]'),
(v_casa_id, 'metros_cuadrados',  'Metros cuadrados de construcción', 'number', false, 'recommended', v_ord + 6, '¿Cuántos metros cuadrados de construcción tiene el inmueble?', '[]'),
(v_casa_id, 'anio_construccion', 'Año de construcción',          'number', false, 'recommended',  v_ord + 7,  '¿En qué año fue construido?',                                   '[]'),
(v_casa_id, 'tipo_construccion', 'Tipo de construcción',         'select', false, 'recommended',  v_ord + 8,  '¿De qué material es la construcción?',                          '["Sólida (tabique, concreto)","Madera / mixta","Prefabricada"]'),
(v_casa_id, 'coberturas_extra',  'Coberturas adicionales',       'text',   false, 'optional',     v_ord + 9,  '¿Te interesa incluir alguna cobertura adicional? (robo con violencia, daños por terremoto, inundación...)', '[]'),
(v_casa_id, 'forma_pago',        'Forma de pago',                'select', false, 'optional',     v_ord + 10, '¿Cómo prefieres pagar la prima?',                               '["Anual","Semestral","Trimestral","Mensual"]'),
(v_casa_id, 'comentarios',       'Comentarios',                  'text',   false, 'optional',     v_ord + 11, '¿Hay algo adicional que debamos considerar?',                   '[]');


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
  'Recopila datos del negocio para cotizar seguros empresariales (incendio, robo, RC, equipo electrónico).',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Seguro Empresarial de MOVI. Necesito unos datos de tu negocio para preparar tu solicitud. ¿Empezamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Perfecto, ya registré tu solicitud de Seguro Empresarial. {{nombre_responsable}} revisará la información y te contactará con las opciones disponibles.',
  'Voy a transferirte con {{nombre_responsable}} para atenderte de manera personalizada.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros empresariales. Recopila los datos del negocio de manera profesional. No pidas identificación personal. Ayuda al usuario a identificar qué tipo de cobertura necesita si no lo sabe.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_empresa_id, 'nombre_empresa',       'Nombre / Razón social',       'text',   true,  'required',     v_ord + 1,  '¿Cuál es el nombre o razón social del negocio?',                '[]'),
(v_empresa_id, 'giro_negocio',         'Giro del negocio',            'text',   true,  'required',     v_ord + 2,  '¿Cuál es la actividad principal del negocio? (ej. restaurante, ferretería, consultorio...)', '[]'),
(v_empresa_id, 'ciudad_estado',        'Ciudad y estado',             'text',   true,  'required',     v_ord + 3,  '¿En qué ciudad y estado opera el negocio?',                    '[]'),
(v_empresa_id, 'tipo_local',           'Tipo de local',               'select', true,  'required',     v_ord + 4,  '¿El negocio opera en local propio o rentado?',                 '["Local propio","Local rentado","Oficina virtual / desde casa","Varios locales"]'),
(v_empresa_id, 'coberturas_requeridas','Coberturas requeridas',       'text',   true,  'required',     v_ord + 5,  '¿Qué quieres proteger? (ej. mobiliario, mercancía, equipo electrónico, robo, incendio, responsabilidad civil...)', '[]'),
(v_empresa_id, 'valor_contenidos',     'Valor de bienes a asegurar',  'number', true,  'required',     v_ord + 6,  '¿Cuál es el valor aproximado de los bienes que deseas asegurar? (en pesos)', '[]'),
(v_empresa_id, 'numero_empleados',     'Número de empleados',         'number', false, 'recommended',  v_ord + 7,  '¿Cuántos empleados tiene el negocio?',                         '[]'),
(v_empresa_id, 'ventas_anuales',       'Ventas anuales aproximadas',  'number', false, 'recommended',  v_ord + 8,  '¿Cuáles son las ventas anuales aproximadas del negocio? (en pesos)', '[]'),
(v_empresa_id, 'tiene_seguro_actual',  '¿Tiene seguro actualmente?',  'boolean',false, 'recommended',  v_ord + 9,  '¿El negocio cuenta con algún seguro actualmente? (Sí / No)',   '[]'),
(v_empresa_id, 'forma_pago',           'Forma de pago',               'select', false, 'optional',     v_ord + 10, '¿Cómo prefieres pagar la prima?',                              '["Anual","Semestral","Trimestral","Mensual"]'),
(v_empresa_id, 'comentarios',          'Comentarios',                 'text',   false, 'optional',     v_ord + 11, '¿Hay algo más que debamos saber sobre tu negocio?',            '[]');


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
  'Recopila datos de la mercancía y rutas para cotizar un seguro de transporte de carga.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Seguro de Transportes de MOVI. Necesito unos datos de tu operación logística para preparar tu solicitud. ¿Comenzamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Perfecto, ya registré tu solicitud de Seguro de Transportes. {{nombre_responsable}} te enviará las opciones disponibles.',
  'Voy a transferirte con {{nombre_responsable}} para continuar con tu atención.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de transporte y carga. Recopila los datos de la mercancía y rutas de forma clara. No pidas identificación personal.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_transporte_id, 'tipo_carga',       'Tipo de mercancía / carga',      'text',   true,  'required',     v_ord + 1,  '¿Qué tipo de mercancía o carga deseas asegurar?',               '[]'),
(v_transporte_id, 'valor_carga',      'Valor de la carga',              'number', true,  'required',     v_ord + 2,  '¿Cuál es el valor aproximado de la carga? (en pesos por embarque)', '[]'),
(v_transporte_id, 'tipo_transporte',  'Tipo de transporte',             'select', true,  'required',     v_ord + 3,  '¿Cómo se transporta la mercancía?',                             '["Terrestre (camión / trailer)","Aéreo","Marítimo","Multimodal"]'),
(v_transporte_id, 'ruta_origen',      'Ciudad / estado de origen',      'text',   true,  'required',     v_ord + 4,  '¿Desde qué ciudad o estado salen los embarques?',               '[]'),
(v_transporte_id, 'ruta_destino',     'Ciudad / estado de destino',     'text',   true,  'required',     v_ord + 5,  '¿A qué ciudad o estado van los embarques?',
 '[]'),
(v_transporte_id, 'frecuencia',       'Frecuencia de embarques',        'select', false, 'recommended',  v_ord + 6,  '¿Con qué frecuencia realizas embarques?',                       '["Diario","Semanal","Quincenal","Mensual","Eventual"]'),
(v_transporte_id, 'embalaje',         'Tipo de embalaje',               'text',   false, 'recommended',  v_ord + 7,  '¿Cómo va embalada la mercancía? (ej. caja, pallet, granel...)', '[]'),
(v_transporte_id, 'almacenaje',       '¿Incluye almacenaje?',           'boolean',false, 'recommended',  v_ord + 8,  '¿La mercancía permanece en bodega antes o después del transporte? (Sí / No)', '[]'),
(v_transporte_id, 'comentarios',      'Comentarios',                    'text',   false, 'optional',     v_ord + 9,  '¿Hay algún detalle adicional de la operación que debamos considerar?', '[]');


-- ============================================================
-- 7. RESPONSABILIDAD CIVIL GENERAL
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
  'Recopila datos del negocio o actividad para cotizar un seguro de Responsabilidad Civil general o profesional.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Responsabilidad Civil de MOVI. Necesito unos datos sobre tu actividad para preparar tu solicitud. ¿Empezamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de RC. {{nombre_responsable}} te enviará las opciones de cobertura.',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Media',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de responsabilidad civil. Recopila los datos del negocio o actividad profesional. No pidas identificación personal. Explica en términos simples qué es la RC si el usuario lo pregunta.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_rc_id, 'tipo_rc',              'Tipo de RC',                      'select', true,  'required',     v_ord + 1,  '¿Qué tipo de responsabilidad civil necesitas?',                 '["RC General (daños a terceros)","RC Profesional (errores y omisiones)","RC Patronal (empleados)","RC Productos (bienes que vendo)","No sé, necesito orientación"]'),
(v_rc_id, 'giro_negocio',         'Giro del negocio / actividad',   'text',   true,  'required',     v_ord + 2,  '¿Cuál es la actividad principal de tu negocio o profesión?',   '[]'),
(v_rc_id, 'ciudad_estado',        'Ciudad y estado de operación',   'text',   true,  'required',     v_ord + 3,  '¿En qué ciudad y estado operas principalmente?',               '[]'),
(v_rc_id, 'suma_asegurada_rc',    'Suma asegurada requerida',        'select', true,  'required',     v_ord + 4,  '¿Qué límite de cobertura necesitas?',                          '["$1,000,000","$2,000,000","$5,000,000","$10,000,000","No sé / necesito orientación"]'),
(v_rc_id, 'numero_empleados',     'Número de empleados',            'number', false, 'recommended',  v_ord + 5,  '¿Cuántos empleados o colaboradores tiene el negocio?',         '[]'),
(v_rc_id, 'ventas_anuales',       'Ventas / facturación anual',     'number', false, 'recommended',  v_ord + 6,  '¿Cuál es la facturación anual aproximada? (en pesos)',          '[]'),
(v_rc_id, 'alcance_geografico',   'Alcance geográfico',             'select', false, 'recommended',  v_ord + 7,  '¿Tus operaciones se realizan solo en México o también en el extranjero?', '["Solo en México","México y Estados Unidos","Internacional"]'),
(v_rc_id, 'tiene_rc_actual',      '¿Tiene RC actualmente?',         'boolean',false, 'recommended',  v_ord + 8,  '¿Cuentas actualmente con algún seguro de Responsabilidad Civil? (Sí / No)', '[]'),
(v_rc_id, 'comentarios',          'Comentarios',                    'text',   false, 'optional',     v_ord + 9,  '¿Hay algún aspecto específico de tu operación que debamos considerar?', '[]');


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
  'Recopila datos de la empresa y plantilla para cotizar un seguro de Gastos Médicos Mayores grupal.',
  'system_seed', true, true,
  'gpt-4o-mini', 'es', 2, true,
  'Hola, soy el asistente de cotización de Gastos Médicos Mayores Empresarial de MOVI. Necesito datos de tu empresa y empleados para preparar tu solicitud. ¿Empezamos?',
  'Para continuar, utilizaremos la información que nos compartas únicamente para preparar tu cotización. ¿Nos das tu autorización? (Sí / No)',
  'Listo, ya registré tu solicitud de GMM Empresarial. {{nombre_responsable}} te enviará las opciones de cobertura grupal.',
  'Voy a transferirte con {{nombre_responsable}} para que continúe con tu atención.',
  true, 'formulario_cotizacion', 'Alta',
  true, true, true, true, 2,
  'Eres un asistente de cotización de seguros de Gastos Médicos Mayores colectivo. Recopila los datos de la empresa de manera profesional. No pidas identificación personal. Si la empresa ya tiene un seguro vigente, indícale al usuario que el agente podrá comparar opciones.'
);

v_ord := 0;
INSERT INTO contact_center_assistant_fields (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, options) VALUES
(v_gmm_col_id, 'nombre_empresa',       'Nombre / Razón social',          'text',   true,  'required',     v_ord + 1,  '¿Cuál es el nombre o razón social de la empresa?',              '[]'),
(v_gmm_col_id, 'giro_negocio',         'Giro del negocio',               'text',   true,  'required',     v_ord + 2,  '¿A qué se dedica la empresa?',                                 '[]'),
(v_gmm_col_id, 'ciudad_estado',        'Ciudad y estado',                'text',   true,  'required',     v_ord + 3,  '¿En qué ciudad y estado opera la empresa?',                    '[]'),
(v_gmm_col_id, 'numero_empleados',     'Total de empleados a asegurar',  'number', true,  'required',     v_ord + 4,  '¿Cuántos empleados deseas incluir en el plan?',                '[]'),
(v_gmm_col_id, 'rango_edades',         'Rango de edades del grupo',      'text',   true,  'required',     v_ord + 5,  '¿Cuál es el rango de edades de los empleados? (ej. 25 a 55 años)', '[]'),
(v_gmm_col_id, 'suma_asegurada',       'Suma asegurada por empleado',    'select', true,  'required',     v_ord + 6,  '¿Qué suma asegurada deseas por empleado?',                     '["$500,000","$1,000,000","$2,000,000","$3,000,000","Sin límite"]'),
(v_gmm_col_id, 'incluye_dependientes', '¿Incluye dependientes?',         'boolean',false, 'recommended',  v_ord + 7,  '¿El plan incluirá también a los familiares (cónyuge e hijos) de los empleados? (Sí / No)', '[]'),
(v_gmm_col_id, 'deducible',            'Tipo de deducible',              'select', false, 'recommended',  v_ord + 8,  '¿Tienen preferencia sobre el tipo de deducible?',              '["Deducible tradicional","Deducible cero","Coaseguro","Sin preferencia"]'),
(v_gmm_col_id, 'tiene_seguro_actual',  '¿Tienen seguro actualmente?',    'boolean',false, 'recommended',  v_ord + 9,  '¿La empresa cuenta actualmente con algún seguro de GMM para sus empleados? (Sí / No)', '[]'),
(v_gmm_col_id, 'aseguradora_actual',   'Aseguradora actual',             'text',   false, 'optional',     v_ord + 10, '¿Con qué aseguradora tienen el seguro actual? (o escribe "no aplica")', '[]'),
(v_gmm_col_id, 'forma_pago',           'Forma de pago',                  'select', false, 'optional',     v_ord + 11, '¿Cómo prefiere pagar la empresa la prima?',                    '["Anual","Semestral","Trimestral","Mensual"]'),
(v_gmm_col_id, 'comentarios',          'Comentarios',                    'text',   false, 'optional',     v_ord + 12, '¿Hay algo más que debamos considerar para la cotización grupal?', '[]');


-- Update field_count on all seeded assistants
UPDATE contact_center_assistants a
SET field_count = (
  SELECT COUNT(*) FROM contact_center_assistant_fields f WHERE f.assistant_id = a.id
)
WHERE a.generation_origin = 'system_seed';

END $$;
