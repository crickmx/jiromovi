/*
  # Deprecate old manual assistants and generate new ones from quote form templates

  ## Changes
  1. Mark old system_seed assistants as deprecated (preserves history)
  2. Generate new assistants for all 24 active quote form templates
  3. Insert comprehensive field definitions per insurance type

  ## Notes
  - synonyms column is jsonb, using json arrays
  - Old sessions remain intact
  - New assistants: generated_from_form = true, source = 'form'
*/

-- ── Step 1: Deprecate old system-seeded manual assistants ────────────────────

UPDATE contact_center_assistants
SET
  is_active     = false,
  deprecated_at = now(),
  deprecated_reason = 'Reemplazado por asistente generado desde formulario de cotización'
WHERE generation_origin = 'system_seed'
  AND deprecated_at IS NULL;

-- ── Step 2: Generate new assistants from quote_form_templates ────────────────

DO $$
DECLARE
  tmpl RECORD;
  asst_id uuid;
BEGIN
  FOR tmpl IN
    SELECT id, form_type, title, category, description
    FROM quote_form_templates
    WHERE is_active = true
    ORDER BY category, title
  LOOP
    INSERT INTO contact_center_assistants (
      nombre, descripcion, source, generation_origin,
      quote_form_template_id, form_title, form_type_cache, form_type_slug,
      is_active, is_global, generated_from_form,
      auto_create_tramite, tramite_tipo, tramite_prioridad,
      handoff_after_creation, use_ai_extraction, allow_incomplete_submission,
      max_retries_per_field, question_block_size,
      welcome_message, consent_message, completion_message, transfer_message,
      system_prompt, model, language
    )
    SELECT
      'Cotización — ' || tmpl.title,
      'Asistente automático para cotización de ' || tmpl.title || '. Generado desde el formulario oficial.',
      'form', 'generated_from_quote_form',
      tmpl.id, tmpl.title, tmpl.form_type, tmpl.form_type,
      true, true, true,
      true, 'formulario_cotizacion', 'Media',
      true, true, true, 2, 3,
      'Hola, soy MOVI IA. Voy a ayudarte con tu cotización de ' || tmpl.title || '. Puedo asistirte de dos formas: 1️⃣ Enviarte el formulario en línea, o 2️⃣ Ir solicitando los datos aquí por WhatsApp. ¿Qué prefieres?',
      '¿Aceptas compartir la información necesaria para tu cotización de ' || tmpl.title || '? Esto nos permitirá preparar una propuesta personalizada.',
      'Listo, recibí toda la información. Se generó el trámite de cotización. Un ejecutivo revisará los datos y te dará seguimiento.',
      'Un agente continuará con tu cotización. ¡Gracias!',
      'Eres MOVI IA, asistente de cotización de ' || tmpl.title || '. Solicita datos de forma conversacional y natural. Pide primero nombre y contacto, luego datos del riesgo. Para campos opcionales, explica que ayudan a obtener mejor cotización. Firma todos tus mensajes con: - 🤖 MOVI IA',
      'gpt-4o-mini', 'es'
    WHERE NOT EXISTS (
      SELECT 1 FROM contact_center_assistants
      WHERE form_type_cache = tmpl.form_type AND generated_from_form = true
    );

    SELECT id INTO asst_id
    FROM contact_center_assistants
    WHERE form_type_cache = tmpl.form_type AND generated_from_form = true
    LIMIT 1;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM contact_center_assistant_fields WHERE assistant_id = asst_id
    );

    -- Common required fields (all types)
    INSERT INTO contact_center_assistant_fields
      (assistant_id, field_key, label, field_type, is_required, priority, capture_order, prompt_text, synonyms, example_value)
    VALUES
      (asst_id, 'nombre_cliente', 'Nombre o razón social del cliente', 'text', true, 'required', 1,
       '¿Cuál es el nombre completo o razón social del cliente?',
       '["nombre","razon social","como se llama","nombre del cliente"]'::jsonb, 'Juan García / Empresa XYZ SA de CV'),
      (asst_id, 'contacto', 'Medio de contacto (teléfono, WhatsApp o correo)', 'text', true, 'required', 2,
       '¿Cuál es el teléfono, WhatsApp o correo electrónico de contacto?',
       '["telefono","whatsapp","correo","email","celular"]'::jsonb, '55 1234 5678 / juan@correo.com');

    -- Insurance-specific fields
    IF tmpl.form_type = 'hogar_casa_habitacion' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del inmueble','text',true,'required',3,'¿Cuál es la ubicación o dirección del inmueble?','["direccion","ubicacion","domicilio"]'::jsonb,'Calle Juárez 10, Col. Centro, Querétaro'),
        (asst_id,'tipo_vivienda','Tipo de vivienda','text',true,'required',4,'¿Es casa, departamento, condominio u otro tipo?','["tipo de casa","tipo inmueble"]'::jsonb,'Casa sola de 2 plantas'),
        (asst_id,'uso_inmueble','Uso del inmueble','text',true,'required',5,'¿Es para uso habitacional propio, arrendamiento u otro?','["uso","para que"]'::jsonb,'Habitacional propio'),
        (asst_id,'valor_inmueble','Valor aproximado del inmueble','text',true,'required',6,'¿Cuál es el valor aproximado o suma asegurada?','["valor","suma asegurada","cuanto vale"]'::jsonb,'$3,000,000 MXN'),
        (asst_id,'coberturas_deseadas','Coberturas deseadas','text',true,'required',7,'¿Qué coberturas desea incluir?','["coberturas","proteccion"]'::jsonb,'Incendio, robo, responsabilidad civil'),
        (asst_id,'propietario_arrendatario','Propietario o arrendatario','text',false,'recommended',8,'¿El asegurado es propietario del inmueble o arrendatario?','["propietario","dueno","renta"]'::jsonb,'Propietario'),
        (asst_id,'anno_construccion','Año de construcción','text',false,'recommended',9,'¿Cuál es el año aproximado de construcción?','["anno","año de construccion"]'::jsonb,'1995'),
        (asst_id,'tipo_construccion','Tipo de construcción (muros y techos)','text',false,'recommended',10,'¿De qué material son los muros y el techo?','["muros","techos","material"]'::jsonb,'Muros de tabique, techo de losa'),
        (asst_id,'suma_contenidos','Suma asegurada de contenidos','text',false,'recommended',11,'¿Desea cubrir contenidos del hogar? ¿Valor aproximado?','["contenidos","muebles"]'::jsonb,'$500,000 MXN'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',12,'¿Alarma, CCTV, vigilancia, extintores?','["alarma","cctv","seguridad"]'::jsonb,'Alarma y CCTV'),
        (asst_id,'zona_riesgo','Zona de riesgo especial','text',false,'recommended',13,'¿Cerca de costa, río, lago o zona inundable?','["inundable","costa","rio"]'::jsonb,'No aplica');

    ELSIF tmpl.form_type = 'casa_con_negocio' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del inmueble','text',true,'required',3,'¿Cuál es la dirección del inmueble?','["direccion","ubicacion"]'::jsonb,'Av. Principal 50, Guadalajara'),
        (asst_id,'giro_negocio','Giro del negocio','text',true,'required',4,'¿Cuál es el giro principal del negocio en la casa?','["giro","actividad","tipo de negocio"]'::jsonb,'Tienda de abarrotes'),
        (asst_id,'porcentaje_negocio','% del inmueble usado para negocio','text',true,'required',5,'¿Qué porcentaje del inmueble se usa para el negocio?','["porcentaje","area negocio"]'::jsonb,'30%'),
        (asst_id,'valores_asegurar','Valores a asegurar','text',true,'required',6,'¿Cuáles son los valores aproximados del edificio, hogar y negocio?','["valores","suma asegurada"]'::jsonb,'Edificio $2M, hogar $300K, negocio $200K'),
        (asst_id,'coberturas_deseadas','Coberturas deseadas','text',true,'required',7,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Incendio, robo, RC'),
        (asst_id,'anno_construccion','Año de construcción','text',false,'recommended',8,'¿Año aproximado de construcción?','["anno"]'::jsonb,'2000'),
        (asst_id,'horario_negocio','Horario de operación','text',false,'recommended',9,'¿Cuál es el horario del negocio?','["horario"]'::jsonb,'Lun-Sáb 8am-8pm'),
        (asst_id,'num_empleados','Número de empleados','text',false,'recommended',10,'¿Cuántos empleados trabajan en el negocio?','["empleados","personal"]'::jsonb,'2 empleados'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',11,'¿Alarma, CCTV, caja fuerte?','["alarma","seguridad"]'::jsonb,'Alarma y caja fuerte');

    ELSIF tmpl.form_type = 'pyme_comercio' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_negocio','Ubicación del negocio','text',true,'required',3,'¿Cuál es la dirección del negocio?','["direccion","ubicacion"]'::jsonb,'Blvd. Diaz Ordaz 100, León'),
        (asst_id,'giro_actividad','Giro o actividad','text',true,'required',4,'¿Cuál es el giro o actividad principal?','["giro","actividad","tipo de negocio"]'::jsonb,'Ferretería'),
        (asst_id,'valores_asegurar','Valores a asegurar','text',true,'required',5,'¿Cuáles son los valores aproximados del edificio, contenidos y mercancías?','["valores","suma asegurada"]'::jsonb,'Edificio $1.5M, contenidos $800K, mercancía $500K'),
        (asst_id,'coberturas_deseadas','Coberturas deseadas','text',true,'required',6,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Incendio, robo, RC, equipo electrónico'),
        (asst_id,'propietario_arrendatario','Propietario o arrendatario','text',false,'recommended',7,'¿Es propietario del local o lo renta?','["propietario","renta"]'::jsonb,'Propietario'),
        (asst_id,'num_empleados','Número de empleados','text',false,'recommended',8,'¿Cuántos empleados hay?','["empleados","trabajadores"]'::jsonb,'5 empleados'),
        (asst_id,'horario_operacion','Horario de operación','text',false,'recommended',9,'¿Cuál es el horario?','["horario"]'::jsonb,'L-V 9am-7pm'),
        (asst_id,'ingresos_mensuales','Ingresos promedio mensuales','text',false,'recommended',10,'¿Cuál es el promedio de ingresos mensuales?','["ingresos","ventas"]'::jsonb,'$150,000 MXN/mes'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',11,'¿Alarma, CCTV, caja fuerte, extintores?','["alarma","seguridad"]'::jsonb,'Alarma, CCTV y extintor');

    ELSIF tmpl.form_type = 'empresa_paquete' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del riesgo principal','text',true,'required',3,'¿Cuál es la dirección del riesgo principal?','["ubicacion","direccion"]'::jsonb,'Zona Industrial Norte, Monterrey'),
        (asst_id,'actividad_giro','Actividad o giro','text',true,'required',4,'¿Cuál es la actividad o giro de la empresa?','["actividad","giro"]'::jsonb,'Manufactura de autopartes'),
        (asst_id,'ramos_coberturas','Ramos o coberturas a cotizar','text',true,'required',5,'¿Qué ramos desea cotizar?','["ramos","coberturas"]'::jsonb,'Incendio, RC, equipo electrónico, rotura de maquinaria'),
        (asst_id,'valores_asegurar','Valores o sumas aseguradas','text',true,'required',6,'¿Cuáles son los valores aproximados por ramo?','["valores","sumas"]'::jsonb,'Edificio $10M, maquinaria $5M, mercancía $2M'),
        (asst_id,'tipo_construccion','Tipo de construcción','text',false,'recommended',7,'¿Tipo de construcción, muros y techos?','["construccion","muros","techos"]'::jsonb,'Nave industrial, estructura de acero'),
        (asst_id,'ingresos_ventas','Ingresos o ventas anuales','text',false,'recommended',8,'¿Cuáles son los ingresos o ventas anuales?','["ingresos","ventas"]'::jsonb,'$30 millones anuales'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',9,'¿Extintores, hidrantes, CCTV, alarmas, vigilancia?','["seguridad","extintores"]'::jsonb,'Extintores, CCTV y vigilancia 24/7'),
        (asst_id,'siniestralidad','Siniestralidad últimos 5 años','text',false,'recommended',10,'¿Ha tenido siniestros en los últimos 5 años?','["siniestros","reclamaciones"]'::jsonb,'Sin siniestros');

    ELSIF tmpl.form_type = 'incendio' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del riesgo','text',true,'required',3,'¿Cuál es la dirección del inmueble a asegurar?','["ubicacion","direccion"]'::jsonb,'Calle 5 de Mayo 200, CDMX'),
        (asst_id,'valor_suma_asegurada','Valor o suma asegurada','text',true,'required',4,'¿Cuál es el valor aproximado a asegurar?','["valor","suma"]'::jsonb,'$5,000,000 MXN'),
        (asst_id,'coberturas_solicitadas','Coberturas solicitadas','text',true,'required',5,'¿Qué coberturas necesita?','["coberturas","extensiones"]'::jsonb,'Incendio, explosión, terremoto'),
        (asst_id,'anno_construccion','Año de construcción','text',false,'recommended',6,'¿Año de construcción?','["anno"]'::jsonb,'1980'),
        (asst_id,'tipo_construccion','Tipo de construcción','text',false,'recommended',7,'¿Materiales de muros y techo?','["construccion","muros","techos"]'::jsonb,'Muros de tabique, losa de concreto'),
        (asst_id,'medidas_proteccion','Medidas de protección contra incendio','text',false,'recommended',8,'¿Extintores, hidrantes, detectores de humo?','["extintores","detectores"]'::jsonb,'Extintores y detectores de humo');

    ELSIF tmpl.form_type = 'gasolinera' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_gasolinera','Ubicación de la gasolinera','text',true,'required',3,'¿Cuál es la dirección de la gasolinera?','["ubicacion","direccion"]'::jsonb,'Carretera Panamericana Km 5, Irapuato'),
        (asst_id,'num_islas','Número de islas','number',true,'required',4,'¿Cuántas islas tiene la gasolinera?','["islas"]'::jsonb,'4'),
        (asst_id,'num_dispensarios','Número de dispensarios','number',true,'required',5,'¿Cuántos dispensarios/pistolas tiene?','["dispensarios","pistolas"]'::jsonb,'16'),
        (asst_id,'num_tanques','Número y capacidad de tanques','text',true,'required',6,'¿Cuántos tanques y de qué capacidad?','["tanques","capacidad"]'::jsonb,'3 tanques de 20,000 litros'),
        (asst_id,'coberturas_deseadas','Coberturas deseadas','text',true,'required',7,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Incendio, RC, maquinaria, contaminación'),
        (asst_id,'negocios_complementarios','Negocios complementarios','text',false,'recommended',8,'¿Tiene tienda, autolavado u otros negocios?','["tienda","complementario"]'::jsonb,'Tienda de conveniencia'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',9,'¿CCTV, extintores, detector de fugas?','["seguridad","extintores","cctv"]'::jsonb,'CCTV y extintores'),
        (asst_id,'siniestralidad','Siniestralidad','text',false,'recommended',10,'¿Siniestros en los últimos 5 años?','["siniestros"]'::jsonb,'Sin siniestros');

    ELSIF tmpl.form_type = 'rc_general' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'actividad_giro','Actividad o giro','text',true,'required',3,'¿Cuál es la actividad o giro?','["actividad","giro"]'::jsonb,'Empresa de construcción'),
        (asst_id,'descripcion_operaciones','Descripción de operaciones','text',true,'required',4,'¿Puede describir brevemente cómo opera?','["descripcion","operaciones"]'::jsonb,'Construcción y remodelación de inmuebles'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',5,'¿Cuál es la suma asegurada que necesita?','["suma","limite"]'::jsonb,'$5,000,000 MXN'),
        (asst_id,'ingresos_ventas','Ingresos o ventas anuales','text',false,'recommended',6,'¿Cuáles son los ingresos anuales?','["ingresos","ventas"]'::jsonb,'$8 millones anuales'),
        (asst_id,'num_empleados','Número de empleados','text',false,'recommended',7,'¿Cuántos empleados tiene?','["empleados"]'::jsonb,'25 empleados'),
        (asst_id,'trabajos_externos','Trabajos fuera de instalaciones','text',false,'recommended',8,'¿Realiza trabajos fuera de sus instalaciones?','["trabajos externos","a domicilio"]'::jsonb,'Sí, en predios de clientes'),
        (asst_id,'siniestralidad','Siniestralidad','text',false,'recommended',9,'¿Ha tenido reclamaciones de RC?','["siniestros","reclamaciones"]'::jsonb,'Sin reclamaciones');

    ELSIF tmpl.form_type = 'rc_profesional' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'actividad_profesional','Actividad profesional','text',true,'required',3,'¿Cuál es la actividad o profesión?','["actividad","profesion"]'::jsonb,'Ingeniero civil independiente'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',4,'¿Cuál es el límite o suma asegurada?','["suma","limite"]'::jsonb,'$3,000,000 MXN'),
        (asst_id,'anos_experiencia','Años de experiencia','text',false,'recommended',5,'¿Cuántos años lleva ejerciendo?','["experiencia","anos"]'::jsonb,'10 años'),
        (asst_id,'num_personal','Personal profesional y no profesional','text',false,'recommended',6,'¿Cuántas personas trabajan con usted?','["personal","empleados"]'::jsonb,'2 profesionales, 1 administrativo'),
        (asst_id,'honorarios_anuales','Honorarios del año anterior','text',false,'recommended',7,'¿Cuáles fueron los honorarios o ingresos del año anterior?','["honorarios","ingresos"]'::jsonb,'$1,200,000 MXN'),
        (asst_id,'reclamaciones','Reclamaciones en últimos 3 años','text',false,'recommended',8,'¿Ha tenido reclamaciones por errores profesionales?','["reclamaciones","demandas"]'::jsonb,'Sin reclamaciones');

    ELSIF tmpl.form_type = 'rc_agentes_seguros' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'tipo_cedula','Tipo de cédula','text',true,'required',3,'¿Cuál es el tipo de cédula?','["cedula","tipo"]'::jsonb,'Cédula A - Ambos ramos'),
        (asst_id,'ramos_autorizados','Ramos autorizados','text',true,'required',4,'¿Cuáles son los ramos autorizados?','["ramos"]'::jsonb,'Vida y Daños'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',5,'¿Cuál es la suma asegurada que necesita?','["suma","limite"]'::jsonb,'$2,000,000 MXN'),
        (asst_id,'volumen_primas','Volumen de primas intermediadas','text',false,'recommended',6,'¿Cuál es el volumen de primas que intermedia?','["primas","volumen"]'::jsonb,'$5 millones anuales'),
        (asst_id,'principales_companias','Compañías con las que trabaja','text',false,'recommended',7,'¿Con qué compañías trabaja principalmente?','["companias","aseguradoras"]'::jsonb,'GNP, Chubb, Allianz'),
        (asst_id,'reclamaciones','Reclamaciones últimos 5 años','text',false,'recommended',8,'¿Ha tenido reclamaciones?','["reclamaciones"]'::jsonb,'Sin reclamaciones');

    ELSIF tmpl.form_type = 'rc_estancias_infantiles' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'nombre_estancia','Nombre de la estancia','text',true,'required',3,'¿Cuál es el nombre de la estancia?','["nombre","estancia"]'::jsonb,'Estancia Infantil Arcoíris'),
        (asst_id,'ubicacion_estancia','Ubicación de la estancia','text',true,'required',4,'¿Cuál es la dirección?','["ubicacion","direccion"]'::jsonb,'Calle Pino 15, Puebla'),
        (asst_id,'capacidad_infantes','Capacidad máxima de infantes','number',true,'required',5,'¿Cuántos menores puede atender como máximo?','["capacidad","ninos"]'::jsonb,'30'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',6,'¿Cuál es el límite de RC que necesita?','["suma","limite"]'::jsonb,'$3,000,000 MXN'),
        (asst_id,'edades_menores','Rango de edades de los menores','text',false,'recommended',7,'¿Cuál es el rango de edades?','["edades","rango"]'::jsonb,'43 días a 5 años 11 meses'),
        (asst_id,'num_empleados','Personal de la estancia','text',false,'recommended',8,'¿Cuántos empleados hay?','["personal","empleados"]'::jsonb,'2 puericultistas, 1 educadora'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',9,'¿Salidas de emergencia, extintores, botiquín?','["seguridad","emergencia"]'::jsonb,'Salidas de emergencia y botiquín');

    ELSIF tmpl.form_type = 'rc_ambiental' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del riesgo','text',true,'required',3,'¿Cuál es la dirección o ubicación?','["ubicacion","direccion"]'::jsonb,'Blvd. Industrial 500, Salamanca'),
        (asst_id,'giro_actividad','Giro o actividad','text',true,'required',4,'¿Cuál es la actividad y qué impacto ambiental puede tener?','["giro","actividad"]'::jsonb,'Almacenamiento y distribución de combustible'),
        (asst_id,'descripcion_riesgo','Descripción del riesgo ambiental','text',true,'required',5,'¿Puede describir el riesgo ambiental principal?','["descripcion","riesgo"]'::jsonb,'Gasolinera con 3 tanques subterráneos'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',6,'¿Cuál es la suma asegurada?','["suma","limite"]'::jsonb,'$5,000,000 MXN'),
        (asst_id,'tanques_almacenamiento','Tanques de almacenamiento','text',false,'recommended',7,'¿Tiene tanques? ¿Cuántos, capacidad y antigüedad?','["tanques"]'::jsonb,'3 tanques subterráneos de 20,000 litros, año 2010'),
        (asst_id,'ultima_auditoria','Última auditoría ambiental','text',false,'recommended',8,'¿Cuándo fue la última auditoría?','["auditoria","inspeccion"]'::jsonb,'Enero 2024');

    ELSIF tmpl.form_type = 'rc_viajero' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'tipo_transporte','Tipo de transporte','text',true,'required',3,'¿Qué tipo de transporte opera?','["tipo","transporte"]'::jsonb,'Transporte terrestre de turistas'),
        (asst_id,'num_pasajeros','Número de pasajeros','number',true,'required',4,'¿Cuántos pasajeros transporta?','["pasajeros","capacidad"]'::jsonb,'40'),
        (asst_id,'rutas_operacion','Rutas de operación','text',true,'required',5,'¿Cuáles son las rutas principales?','["rutas","destinos"]'::jsonb,'CDMX - Querétaro'),
        (asst_id,'suma_asegurada','Suma asegurada deseada','text',true,'required',6,'¿Cuál es el límite de RC por pasajero?','["suma","limite"]'::jsonb,'$1,000,000 MXN por pasajero'),
        (asst_id,'descripcion_vehiculo','Descripción del vehículo','text',false,'recommended',7,'¿Marca, modelo, año y placas?','["vehiculo","autobus","placas"]'::jsonb,'Mercedes-Benz 2020, 40 asientos, ABC123'),
        (asst_id,'ultimo_servicio','Último servicio mecánico','text',false,'recommended',8,'¿Cuándo fue el último servicio?','["servicio","mantenimiento"]'::jsonb,'Hace 3 meses');

    ELSIF tmpl.form_type = 'transporte_carga' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'tipo_poliza','Tipo de póliza','text',true,'required',3,'¿Es una póliza por viaje, anual o flotilla?','["tipo","poliza"]'::jsonb,'Póliza anual'),
        (asst_id,'tipo_mercancia','Tipo de mercancía','text',true,'required',4,'¿Qué tipo de mercancía se transporta?','["mercancia","carga","productos"]'::jsonb,'Maquinaria industrial nueva'),
        (asst_id,'origen_destino','Origen y destino','text',true,'required',5,'¿Cuál es el origen y destino?','["origen","destino","ruta"]'::jsonb,'Monterrey a CDMX'),
        (asst_id,'medio_transporte','Medio de transporte','text',true,'required',6,'¿Cuál es el medio? (terrestre, aéreo, marítimo)','["medio","transporte"]'::jsonb,'Terrestre en camión'),
        (asst_id,'limite_embarque','Límite máximo por embarque','text',true,'required',7,'¿Cuál es el límite máximo por embarque?','["limite","suma","embarque"]'::jsonb,'$500,000 MXN'),
        (asst_id,'actividad_giro','Actividad o giro del asegurado','text',false,'recommended',8,'¿Cuál es la actividad o giro?','["actividad","giro"]'::jsonb,'Distribuidor de maquinaria'),
        (asst_id,'num_embarques_anuales','Embarques anuales','text',false,'recommended',9,'¿Cuántos embarques aproximados al año?','["embarques","viajes"]'::jsonb,'50 embarques anuales'),
        (asst_id,'empaque_medidas','Empaque y medidas de seguridad','text',false,'recommended',10,'¿Cómo se empaca y qué medidas de seguridad aplica?','["empaque","seguridad"]'::jsonb,'Embalaje industrial con flejes');

    ELSIF tmpl.form_type = 'aviacion' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'uso_aeronave','Uso de la aeronave','text',true,'required',3,'¿Cuál es el uso principal?','["uso"]'::jsonb,'Privado ejecutivo'),
        (asst_id,'marca_modelo','Marca y modelo','text',true,'required',4,'¿Cuál es la marca y modelo?','["marca","modelo"]'::jsonb,'Cessna Citation CJ3'),
        (asst_id,'matricula_serie','Matrícula o número de serie','text',true,'required',5,'¿Cuál es la matrícula o serie?','["matricula","serie"]'::jsonb,'XA-ABC'),
        (asst_id,'valor_casco','Valor del casco','text',true,'required',6,'¿Cuál es el valor de la aeronave?','["valor","casco"]'::jsonb,'$5,000,000 USD'),
        (asst_id,'suma_rc','Suma de RC deseada','text',true,'required',7,'¿Qué límite de RC necesita?','["rc","responsabilidad civil"]'::jsonb,'$10,000,000 USD'),
        (asst_id,'piloto','Datos del piloto','text',false,'recommended',8,'¿Nombre, tipo de licencia y horas de vuelo?','["piloto","licencia","horas"]'::jsonb,'Juan Pérez, ATPL, 3,500 horas'),
        (asst_id,'limites_geograficos','Límites de operación','text',false,'recommended',9,'¿Cuáles son los límites geográficos?','["limites","geograficos"]'::jsonb,'México y Estados Unidos');

    ELSIF tmpl.form_type = 'buques' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'nombre_embarcacion','Nombre de la embarcación','text',true,'required',3,'¿Cuál es el nombre?','["nombre","barco"]'::jsonb,'MN Esperanza'),
        (asst_id,'tipo_embarcacion','Tipo de embarcación','text',true,'required',4,'¿Qué tipo es? (yate, carguero, pesca)','["tipo","clase"]'::jsonb,'Yate de recreo'),
        (asst_id,'uso_embarcacion','Uso','text',true,'required',5,'¿Cuál es el uso principal?','["uso"]'::jsonb,'Recreo privado'),
        (asst_id,'anno_construccion','Año de construcción','text',true,'required',6,'¿Año aproximado?','["anno"]'::jsonb,'2015'),
        (asst_id,'material_casco','Material del casco','text',true,'required',7,'¿De qué material es el casco?','["material","casco"]'::jsonb,'Fibra de vidrio'),
        (asst_id,'area_navegacion','Área de navegación','text',true,'required',8,'¿Cuál es el área de navegación?','["area","navegacion"]'::jsonb,'Aguas interiores del Golfo'),
        (asst_id,'valor_suma','Valor aproximado','text',true,'required',9,'¿Cuál es el valor de la embarcación?','["valor","suma"]'::jsonb,'$2,000,000 MXN'),
        (asst_id,'coberturas_deseadas','Coberturas','text',true,'required',10,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Casco y RC'),
        (asst_id,'equipo_seguridad','Equipo de seguridad','text',false,'recommended',11,'¿Chalecos, extintores, bengalas?','["equipo","seguridad"]'::jsonb,'Chalecos, extintores y bengalas');

    ELSIF tmpl.form_type = 'todo_riesgo_construccion' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_obra','Ubicación de la obra','text',true,'required',3,'¿Cuál es la ubicación de la obra?','["ubicacion","obra"]'::jsonb,'Blvd. Torres Landa 800, León'),
        (asst_id,'nombre_proyecto','Nombre del proyecto','text',true,'required',4,'¿Cuál es el nombre del proyecto?','["nombre","proyecto"]'::jsonb,'Torre Residencial Jardín'),
        (asst_id,'valor_contrato','Valor del contrato','text',true,'required',5,'¿Cuál es el valor del contrato de obra?','["valor","contrato","presupuesto"]'::jsonb,'$25,000,000 MXN'),
        (asst_id,'descripcion_obra','Descripción de la obra','text',true,'required',6,'¿Puede describir el tipo y características de la obra?','["descripcion","obra"]'::jsonb,'Torre residencial de 12 niveles, concreto'),
        (asst_id,'duracion_obra','Duración de la obra','text',true,'required',7,'¿Cuál es la duración estimada?','["duracion","tiempo"]'::jsonb,'18 meses'),
        (asst_id,'coberturas_deseadas','Coberturas deseadas','text',true,'required',8,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Todo riesgo construcción y RC'),
        (asst_id,'contratista','Contratista principal','text',false,'recommended',9,'¿Nombre y experiencia del contratista?','["contratista"]'::jsonb,'Constructora Vega, 20 años de experiencia'),
        (asst_id,'periodo_mantenimiento','Período de mantenimiento','text',false,'recommended',10,'¿Requiere período de mantenimiento?','["mantenimiento","periodo"]'::jsonb,'12 meses');

    ELSIF tmpl.form_type = 'montaje_maquinaria' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_montaje','Ubicación del montaje','text',true,'required',3,'¿Dónde se realizará el montaje?','["ubicacion","donde"]'::jsonb,'Planta industrial, Silao'),
        (asst_id,'nombre_proyecto','Nombre del proyecto','text',true,'required',4,'¿Cuál es el nombre del proyecto?','["proyecto","nombre"]'::jsonb,'Montaje de línea de producción'),
        (asst_id,'descripcion_montaje','Descripción del montaje','text',true,'required',5,'¿Qué maquinaria o equipos se montarán?','["descripcion","maquinaria"]'::jsonb,'3 robots de soldadura'),
        (asst_id,'duracion_montaje','Duración del montaje','text',true,'required',6,'¿Cuánto tiempo durará?','["duracion","tiempo"]'::jsonb,'4 meses'),
        (asst_id,'bienes_montar','Bienes y valor total','text',true,'required',7,'¿Cuáles son los bienes y su valor total?','["bienes","valor"]'::jsonb,'Robots industriales $15M MXN'),
        (asst_id,'suma_asegurada','Suma asegurada total','text',true,'required',8,'¿Cuál es la suma asegurada total?','["suma","total"]'::jsonb,'$18,000,000 MXN'),
        (asst_id,'contratista','Contratista del montaje','text',false,'recommended',9,'¿Quién realizará el montaje?','["contratista"]'::jsonb,'Técnicos del fabricante'),
        (asst_id,'coberturas_adicionales','Coberturas adicionales','text',false,'recommended',10,'¿RC, terremoto, error de diseño?','["coberturas"]'::jsonb,'RC daños a terceros');

    ELSIF tmpl.form_type = 'equipo_contratista' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'actividad_giro','Actividad o giro','text',true,'required',3,'¿Cuál es la actividad del contratista?','["actividad","giro"]'::jsonb,'Construcción de infraestructura vial'),
        (asst_id,'lugar_trabajo','Lugar de trabajo habitual','text',true,'required',4,'¿Dónde opera el equipo habitualmente?','["lugar","donde opera"]'::jsonb,'Obras en carreteras, Guanajuato'),
        (asst_id,'relacion_equipo','Relación de equipo','text',true,'required',5,'¿Relación del equipo? (tipo, marca, modelo, año, serie)','["relacion","equipo","maquinaria"]'::jsonb,'Retroexcavadora CAT 320 2018'),
        (asst_id,'suma_asegurada_total','Suma asegurada total','text',true,'required',6,'¿Cuál es la suma asegurada total?','["suma","valor","total"]'::jsonb,'$12,000,000 MXN'),
        (asst_id,'ultimo_mantenimiento','Último mantenimiento','text',false,'recommended',7,'¿Cuándo fue el último mantenimiento?','["mantenimiento"]'::jsonb,'Hace 2 meses'),
        (asst_id,'localizador','Localizador satelital','text',false,'recommended',8,'¿Los equipos tienen GPS o localizador?','["gps","localizador"]'::jsonb,'Todos con GPS activo'),
        (asst_id,'coberturas_adicionales','Coberturas adicionales','text',false,'recommended',9,'¿Huelga, traslado por carretera?','["coberturas"]'::jsonb,'Huelga y traslado por carretera');

    ELSIF tmpl.form_type = 'rotura_maquinaria' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'relacion_maquinaria','Relación o descripción de maquinaria','text',true,'required',3,'¿Puede describir la maquinaria? (marca, modelo, serie)','["maquinaria","equipo","relacion"]'::jsonb,'Compresor Atlas Copco, Prensa Schuler'),
        (asst_id,'suma_asegurada','Suma asegurada','text',true,'required',4,'¿Cuál es la suma asegurada total?','["suma","valor"]'::jsonb,'$8,000,000 MXN'),
        (asst_id,'coberturas_requeridas','Coberturas requeridas','text',true,'required',5,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Rotura de maquinaria y flete aéreo'),
        (asst_id,'ubicacion_maquinaria','Ubicación','text',false,'recommended',6,'¿Dónde está instalada?','["ubicacion","donde"]'::jsonb,'Planta en Apodaca, NL'),
        (asst_id,'ultimo_mantenimiento','Último mantenimiento','text',false,'recommended',7,'¿Cuándo fue el último mantenimiento?','["mantenimiento"]'::jsonb,'Hace 1 mes'),
        (asst_id,'siniestralidad','Siniestralidad','text',false,'recommended',8,'¿Fallas o siniestros en últimos 3 años?','["siniestros","fallas"]'::jsonb,'Sin siniestros');

    ELSIF tmpl.form_type = 'calderas_presion' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del riesgo','text',true,'required',3,'¿Cuál es la dirección o ubicación?','["ubicacion","donde"]'::jsonb,'Planta Celanese, Tlaxcala'),
        (asst_id,'bienes_cubrir','Bienes a cubrir','text',true,'required',4,'¿Qué bienes desea asegurar?','["bienes","equipos"]'::jsonb,'2 calderas de vapor marca Cleaver Brooks'),
        (asst_id,'suma_asegurada','Suma asegurada','text',true,'required',5,'¿Cuál es el valor o suma asegurada?','["suma","valor"]'::jsonb,'$3,000,000 MXN'),
        (asst_id,'coberturas_requeridas','Coberturas requeridas','text',true,'required',6,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Explosión, implosión, gastos extraordinarios'),
        (asst_id,'marca_modelo_serie','Marca, modelo y serie','text',false,'recommended',7,'¿Marca, modelo, tipo y serie?','["marca","modelo","serie"]'::jsonb,'Cleaver Brooks CB200, serie 12345'),
        (asst_id,'ultimo_mantenimiento','Último mantenimiento','text',false,'recommended',8,'¿Cuándo fue el último mantenimiento?','["mantenimiento","dictamen"]'::jsonb,'Revisión hace 6 meses'),
        (asst_id,'combustible','Combustible','text',false,'recommended',9,'¿Qué combustible utilizan?','["combustible","gas","diesel"]'::jsonb,'Gas natural');

    ELSIF tmpl.form_type = 'equipo_electronico' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'ubicacion_riesgo','Ubicación del equipo','text',true,'required',3,'¿Cuál es la ubicación del equipo?','["ubicacion","donde"]'::jsonb,'Centro de datos, Torre Mayor, CDMX'),
        (asst_id,'relacion_equipo','Relación o descripción del equipo','text',true,'required',4,'¿Puede describir el equipo?','["equipo","relacion","descripcion"]'::jsonb,'Servidor Dell PowerEdge R740'),
        (asst_id,'suma_asegurada','Suma asegurada','text',true,'required',5,'¿Cuál es el valor total a asegurar?','["suma","valor"]'::jsonb,'$5,000,000 MXN'),
        (asst_id,'coberturas_deseadas','Coberturas solicitadas','text',true,'required',6,'¿Qué coberturas necesita?','["coberturas"]'::jsonb,'Todo riesgo, portadores externos, flete aéreo'),
        (asst_id,'contrato_mantenimiento','Contrato de mantenimiento','text',false,'recommended',7,'¿Tiene contrato de mantenimiento?','["mantenimiento","contrato"]'::jsonb,'Mantenimiento con Dell Technologies'),
        (asst_id,'proteccion_electrica','Protección eléctrica','text',false,'recommended',8,'¿No Break, regulador, pararrayos?','["no break","regulador","pararrayos"]'::jsonb,'UPS APC, regulador y tierras físicas'),
        (asst_id,'climatizacion','Climatización','text',false,'recommended',9,'¿Sistema de climatización adecuado?','["aire acondicionado","climatizacion"]'::jsonb,'Aire acondicionado de precisión');

    ELSIF tmpl.form_type = 'auto_alta_gama' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'marca','Marca del vehículo','text',true,'required',3,'¿Cuál es la marca?','["marca","coche"]'::jsonb,'Mercedes-Benz'),
        (asst_id,'version_descripcion','Versión del vehículo','text',true,'required',4,'¿Cuál es la versión completa?','["version","descripcion"]'::jsonb,'GLE 350 AMG 4MATIC'),
        (asst_id,'modelo_anno','Año modelo','text',true,'required',5,'¿Cuál es el año modelo?','["anno","año","modelo"]'::jsonb,'2024'),
        (asst_id,'valor_factura','Valor o factura','text',true,'required',6,'¿Cuál es el valor o precio de factura?','["valor","precio","factura"]'::jsonb,'$1,500,000 MXN'),
        (asst_id,'uso_vehiculo','Uso del vehículo','text',true,'required',7,'¿Cuál es el uso?','["uso"]'::jsonb,'Uso particular ejecutivo'),
        (asst_id,'conductor_habitual','Datos del conductor','text',false,'recommended',8,'¿Nombre, edad, sexo y estado civil del conductor habitual?','["conductor","chofer"]'::jsonb,'Carlos Gómez, 38 años, masculino'),
        (asst_id,'estacionamiento','Estacionamiento','text',false,'recommended',9,'¿Tiene estacionamiento propio?','["estacionamiento","garage"]'::jsonb,'Garaje privado en domicilio'),
        (asst_id,'medidas_seguridad','Medidas de seguridad','text',false,'recommended',10,'¿GPS, alarma, escolta?','["gps","alarma","escolta"]'::jsonb,'GPS y alarma premium'),
        (asst_id,'importado','Vehículo importado','text',false,'recommended',11,'¿Es importado? ¿País de origen?','["importado","origen"]'::jsonb,'Importado de Alemania');

    ELSIF tmpl.form_type = 'gmm_individual' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'tipo_solicitud','Tipo de solicitud','text',true,'required',3,'¿Es cotización nueva, renovación o inclusión?','["tipo","solicitud"]'::jsonb,'Cotización nueva'),
        (asst_id,'fecha_inicio','Fecha tentativa de inicio','text',true,'required',4,'¿Cuál es la fecha tentativa de inicio?','["fecha","inicio","vigencia"]'::jsonb,'01 de agosto 2026'),
        (asst_id,'nombre_titular','Nombre del asegurado titular','text',true,'required',5,'¿Nombre completo del asegurado titular?','["titular","nombre titular"]'::jsonb,'María López García'),
        (asst_id,'fecha_nacimiento','Fecha de nacimiento del titular','text',true,'required',6,'¿Fecha de nacimiento?','["fecha de nacimiento","edad"]'::jsonb,'15 de marzo de 1985'),
        (asst_id,'sexo','Sexo del titular','text',true,'required',7,'¿Sexo del titular? (Masculino / Femenino)','["sexo","genero"]'::jsonb,'Femenino'),
        (asst_id,'estatura_peso','Estatura y peso','text',true,'required',8,'¿Cuál es la estatura y peso?','["estatura","peso","talla"]'::jsonb,'1.65m, 62kg'),
        (asst_id,'dependientes','Dependientes a incluir','text',false,'recommended',9,'¿Desea incluir cónyuge u otros dependientes?','["dependientes","familia","conyugue"]'::jsonb,'Cónyuge: Pedro, 20/05/1983'),
        (asst_id,'plan_suma','Plan y suma asegurada','text',false,'recommended',10,'¿Plan específico o suma asegurada en mente?','["plan","suma","cobertura"]'::jsonb,'Plan Premium, $5,000,000 MXN'),
        (asst_id,'antecedentes_medicos','Antecedentes médicos','text',false,'recommended',11,'¿Enfermedades, cirugías o tratamientos relevantes?','["enfermedades","antecedentes","historial"]'::jsonb,'Hipertensión controlada'),
        (asst_id,'seguro_anterior','Seguro anterior o actual','text',false,'recommended',12,'¿Cuenta con seguro actual? ¿De qué compañía?','["seguro anterior","poliza anterior"]'::jsonb,'GNP Plan Óptima vigente');

    ELSIF tmpl.form_type = 'accidentes_escolares' THEN
      INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,is_required,priority,capture_order,prompt_text,synonyms,example_value) VALUES
        (asst_id,'nombre_escuela','Nombre de la escuela','text',true,'required',3,'¿Cuál es el nombre de la escuela?','["escuela","colegio","institucion"]'::jsonb,'Colegio Bilingüe San Francisco'),
        (asst_id,'nivel_educativo','Nivel educativo','text',true,'required',4,'¿Qué niveles educativos tiene?','["nivel","grado"]'::jsonb,'Preescolar, primaria y secundaria'),
        (asst_id,'colectividad','Colectividad asegurable','text',true,'required',5,'¿Quiénes son los asegurados?','["colectividad","quienes"]'::jsonb,'Alumnos y personal docente'),
        (asst_id,'num_participantes','Número total de participantes','number',true,'required',6,'¿Cuántos participantes se asegurarán?','["numero","participantes","alumnos","total"]'::jsonb,'485'),
        (asst_id,'coberturas_deseadas','Coberturas y sumas aseguradas','text',true,'required',7,'¿Qué coberturas necesita?','["coberturas","sumas"]'::jsonb,'Muerte accidental $200K, gastos médicos $50K'),
        (asst_id,'ciclo_vigencia','Ciclo escolar y vigencia','text',false,'recommended',8,'¿Ciclo escolar y vigencia deseada?','["ciclo","vigencia","periodo"]'::jsonb,'Ciclo 2026-2027, agosto a julio'),
        (asst_id,'ubicacion_escuela','Ubicación de la escuela','text',false,'recommended',9,'¿Dirección o ubicación?','["ubicacion","direccion"]'::jsonb,'Av. del Valle 300, San Luis Potosí'),
        (asst_id,'actividades_especiales','Actividades especiales','text',false,'recommended',10,'¿Actividades deportivas, excursiones u otras?','["actividades","deportes","excursiones"]'::jsonb,'Natación y excursiones mensuales');

    END IF;

  END LOOP;
END $$;
