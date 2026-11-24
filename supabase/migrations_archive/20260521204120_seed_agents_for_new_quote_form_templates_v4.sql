/*
  # Seed Intelligent Agents for 25 New Quote Form Templates (v4)

  ## Summary
  Creates contact_center_assistants and contact_center_assistant_fields for each
  new quote form template. Uses correct field_type values per DB constraint:
  allowed: text, number, date, select, multiselect, file, phone, email, boolean.
  Currency fields use 'number' type.
*/

CREATE OR REPLACE FUNCTION _tmp_create_agent_from_form(
  p_form_type text,
  p_title text
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_template_id uuid;
  v_agent_id uuid;
BEGIN
  SELECT id INTO v_template_id FROM quote_form_templates WHERE form_type = p_form_type;
  IF v_template_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_agent_id FROM contact_center_assistants WHERE form_type_slug = p_form_type;
  IF v_agent_id IS NOT NULL THEN RETURN v_agent_id; END IF;

  INSERT INTO contact_center_assistants (
    nombre, descripcion, source, generation_origin, generated_from_form,
    quote_form_template_id, form_type_slug, form_type_cache, form_title,
    is_active, is_global, model, language,
    system_prompt, welcome_message, consent_message, completion_message, transfer_message,
    auto_create_tramite, tramite_tipo, tramite_prioridad,
    skip_contact_fields, use_ai_extraction, allow_incomplete_submission,
    question_block_size, max_retries_per_field
  ) VALUES (
    'Cotizacion — ' || p_title,
    'Agente de cotizacion de ' || p_title || '. Recopila datos del cliente de forma conversacional.',
    'form','generated_from_quote_form',true,
    v_template_id,p_form_type,p_form_type,p_title,
    true,true,'gpt-4o-mini','es',
    'Eres MOVI IA, asistente especializado en cotizacion de ' || p_title || '. '
      'Tu objetivo es recopilar los datos necesarios para preparar una cotizacion. '
      'Se amable, profesional y conciso. Solicita los datos uno o dos a la vez. '
      'Confirma la informacion al finalizar. No solicites telefono ni correo como campos obligatorios.',
    '¡Hola! Soy MOVI IA y voy a ayudarte con tu cotizacion de ' || p_title || '. '
      'Es un proceso rapido, solo necesito algunos datos. ¿Empezamos?',
    'Para continuar, necesito tu consentimiento para procesar tus datos con fines de cotizacion. ¿Aceptas?',
    'Listo, ya tengo toda la informacion necesaria para tu cotizacion de ' || p_title || '. Tu solicitud ha sido registrada y un asesor te contactara pronto.',
    'En un momento te comunico con un asesor especializado que podra brindarte mas informacion.',
    true,'formulario_cotizacion','Media',
    true,true,true,2,3
  ) RETURNING id INTO v_agent_id;
  RETURN v_agent_id;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('auto_individual','Auto Individual');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'marca_modelo','Marca y modelo del vehiculo','text','required',true,1,'¿Cual es la marca y modelo del vehiculo?','Toyota Corolla 2022','["carro","auto","vehiculo"]',true),
    (v_id,'anio','Anio del vehiculo','number','required',true,2,'¿De que anio es el vehiculo?','2022','["modelo","year","anio"]',true),
    (v_id,'uso','Uso del vehiculo','select','required',true,3,'¿Cual es el uso del vehiculo? (particular, comercial)','Particular','["para que lo usa","uso"]',true),
    (v_id,'tipo_cobertura','Tipo de cobertura','select','required',true,4,'¿Que tipo de cobertura necesitas? (Amplia, Limitada, RC)','Amplia','["plan","cobertura"]',true),
    (v_id,'valor_factura','Valor de factura (pesos)','number','recommended',false,5,'¿Cuanto costo el vehiculo nuevo? (monto en pesos)','350000','["precio","costo","valor"]',true),
    (v_id,'nombre_conductor','Nombre del conductor principal','text','recommended',false,6,'¿Nombre completo del conductor principal?','Juan Perez','["conductor","chofer"]',true),
    (v_id,'edad_conductor','Edad del conductor','number','recommended',false,7,'¿Que edad tiene el conductor principal?','35','["anos","edad"]',true),
    (v_id,'numero_serie','Numero de serie (VIN)','text','optional',false,8,'¿Tienes el numero de serie del vehiculo (VIN)?','3VWFE21C04M000001','["VIN","serie","NIV"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('auto_residente','Auto Residente / Fronterizo');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'marca_modelo','Marca y modelo','text','required',true,1,'¿Cual es la marca y modelo del vehiculo?','Ford F-150 2021','["carro","auto"]',true),
    (v_id,'anio','Anio del vehiculo','number','required',true,2,'¿De que anio es el vehiculo?','2021','["model year","year"]',true),
    (v_id,'placas','Estado de las placas','text','required',true,3,'¿El vehiculo tiene placas mexicanas o extranjeras?','Texas','["registro","placas"]',true),
    (v_id,'tipo_cobertura','Tipo de cobertura','select','required',true,4,'¿Que cobertura necesitas? (Amplia, Limitada, Solo RC)','Amplia','["plan","cobertura"]',true),
    (v_id,'zona_circulacion','Zona de circulacion','text','required',true,5,'¿En que ciudad o municipio circula principalmente?','Tijuana, BC','["donde circula","ciudad"]',true),
    (v_id,'valor_vehiculo','Valor del vehiculo','number','recommended',false,6,'¿Cual es el valor aproximado del vehiculo?','25000','["precio","valor"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('flotilla_autos','Flotilla de Autos');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social de la empresa','text','required',true,1,'¿Cual es la razon social o nombre de la empresa?','Transportes XYZ S.A. de C.V.','["empresa","compania"]',true),
    (v_id,'numero_unidades','Numero de unidades','number','required',true,2,'¿Cuantos vehiculos tiene la flota?','15','["cuantos carros","flotilla"]',true),
    (v_id,'tipos_vehiculos','Tipos de vehiculos','text','required',true,3,'¿Que tipos de vehiculos componen la flota?','Sedanes y pick-ups','["modelos","tipos"]',true),
    (v_id,'uso_flota','Uso de la flota','text','required',true,4,'¿Para que usa la empresa los vehiculos?','Visitas a clientes','["uso","actividad"]',true),
    (v_id,'tipo_cobertura','Tipo de cobertura','select','required',true,5,'¿Que cobertura requieren? (Amplia, Limitada, RC)','Amplia','["plan","cobertura"]',true),
    (v_id,'anio_promedio','Anio promedio de la flota','number','recommended',false,6,'¿Cual es el anio promedio de los vehiculos?','2020','["antiguedad","modelo promedio"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('vida_individual','Vida Individual');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'fecha_nacimiento','Fecha de nacimiento del asegurado','date','required',true,1,'¿Cual es la fecha de nacimiento del asegurado?','1985-06-15','["edad","nacimiento"]',true),
    (v_id,'suma_asegurada','Suma asegurada (pesos)','number','required',true,2,'¿Que suma asegurada desea? (monto que recibirian los beneficiarios)','2000000','["monto","capital"]',true),
    (v_id,'plazo','Plazo del seguro','select','required',true,3,'¿Por cuantos anos desea contratar el seguro?','20 anos','["duracion","vigencia"]',true),
    (v_id,'coberturas_adicionales','Coberturas adicionales','text','recommended',false,4,'¿Le interesa incluir cobertura de invalidez o enfermedades graves?','Invalidez total y permanente','["coberturas extra","adicionales"]',true),
    (v_id,'ocupacion','Ocupacion del asegurado','text','recommended',false,5,'¿Cual es la ocupacion o profesion del asegurado?','Ejecutivo de ventas','["trabajo","profesion"]',true),
    (v_id,'fumador','El asegurado fuma','boolean','recommended',false,6,'¿El asegurado es fumador?','No','["fuma","tabaco"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('vida_grupo','Vida Grupo / Colectivo');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Cual es el nombre o razon social del contratante?','Empresa ABC S.A.','["empresa","organizacion"]',true),
    (v_id,'numero_asegurados','Numero de asegurados','number','required',true,2,'¿Cuantas personas integraran el grupo asegurado?','50','["cuantos empleados","grupo"]',true),
    (v_id,'edad_promedio','Edad promedio del grupo','number','required',true,3,'¿Cual es la edad promedio del grupo?','38','["promedio de edad","edades"]',true),
    (v_id,'suma_asegurada','Suma asegurada por persona (pesos)','number','required',true,4,'¿Que suma asegurada desea por persona?','500000','["monto","capital por persona"]',true),
    (v_id,'coberturas','Coberturas requeridas','text','recommended',false,5,'¿Que coberturas adicionales desea incluir?','Muerte accidental e invalidez','["coberturas","adicionales"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('accidentes_personales_individual','Accidentes Personales Individual');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'fecha_nacimiento','Fecha de nacimiento','date','required',true,1,'¿Cual es la fecha de nacimiento del asegurado?','1990-03-20','["edad","nacimiento"]',true),
    (v_id,'actividad','Actividad o profesion','text','required',true,2,'¿Cual es la actividad principal del asegurado?','Contador','["trabajo","profesion","oficio"]',true),
    (v_id,'suma_muerte_accidental','Suma por muerte accidental (pesos)','number','required',true,3,'¿Que suma asegurada para muerte accidental?','500000','["monto muerte","capital"]',true),
    (v_id,'gastos_medicos','Limite de gastos medicos (pesos)','number','recommended',false,4,'¿Desea incluir gastos medicos por accidente? Indique el limite.','100000','["gastos medicos","atencion medica"]',true),
    (v_id,'practica_deportes','Practica deportes de riesgo','boolean','recommended',false,5,'¿El asegurado practica deportes de alto riesgo?','No','["deporte riesgoso","actividad peligrosa"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('accidentes_personales_colectivo','Accidentes Personales Colectivo');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social del contratante?','Constructora DEF','["empresa","nombre"]',true),
    (v_id,'numero_asegurados','Numero de asegurados','number','required',true,2,'¿Cuantas personas incluira en el grupo?','100','["cuantos empleados","grupo"]',true),
    (v_id,'actividad_empresa','Actividad de la empresa','text','required',true,3,'¿Cual es la actividad o giro de la empresa?','Construccion','["giro","actividad","ramo"]',true),
    (v_id,'suma_muerte_accidental','Suma por muerte accidental (pesos)','number','required',true,4,'¿Que suma asegurada por muerte accidental por persona?','300000','["monto","capital"]',true),
    (v_id,'incluye_gastos_medicos','Incluye gastos medicos','boolean','recommended',false,5,'¿Desea incluir gastos medicos por accidente?','Si','["gastos medicos","atencion"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('gmm_colectivo','GMM Colectivo / Empresarial');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','Empresa XYZ S.A. de C.V.','["empresa","compania"]',true),
    (v_id,'numero_asegurados','Numero de asegurados','number','required',true,2,'¿Cuantos empleados se incluiran en el seguro?','30','["cuantos empleados","grupo"]',true),
    (v_id,'edad_promedio','Edad promedio','number','required',true,3,'¿Cual es la edad promedio del grupo?','35','["promedio edad","edades"]',true),
    (v_id,'nivel_hospitalario','Nivel hospitalario','select','required',true,4,'¿Que nivel hospitalario requieren? (Popular, Intermedio, Alto, Premier)','Intermedio','["hospital","nivel"]',true),
    (v_id,'suma_asegurada','Suma asegurada por persona (pesos)','number','required',true,5,'¿Que suma asegurada por persona desean?','3000000','["monto","suma"]',true),
    (v_id,'deducible','Tipo de deducible','select','recommended',false,6,'¿Prefieren deducible fijo o porcentual?','Fijo','["deducible","coseguro"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('salud_gastos_menores','Salud / Gastos Medicos Menores');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'numero_asegurados','Numero de asegurados','number','required',true,1,'¿Cuantas personas se incluiran en el plan?','4','["cuantos","personas"]',true),
    (v_id,'edades','Edades de los asegurados','text','required',true,2,'¿Cuales son las edades de las personas a asegurar?','35, 33, 8, 5','["edades","anos"]',true),
    (v_id,'coberturas_deseadas','Coberturas deseadas','text','required',true,3,'¿Que servicios son mas importantes? (consultas, laboratorio, farmacias, urgencias)','Consultas y laboratorio','["coberturas","servicios"]',true),
    (v_id,'red_medica','Red medica preferida','text','recommended',false,4,'¿Tiene preferencia por alguna aseguradora o red medica?','GNP o Salud Digna','["aseguradora","red","medicos"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('dental_vision','Dental / Vision');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_cobertura','Tipo de cobertura','select','required',true,1,'¿Desea cobertura dental, vision o ambas?','Ambas','["cobertura","tipo"]',true),
    (v_id,'numero_asegurados','Numero de asegurados','number','required',true,2,'¿Cuantas personas se incluiran?','3','["cuantos","personas"]',true),
    (v_id,'edades','Edades','text','required',true,3,'¿Cuales son las edades de los asegurados?','38, 35, 10','["edades","anos"]',true),
    (v_id,'servicios_dentales','Servicios dentales de interes','text','recommended',false,4,'¿Que tratamientos dentales le interesan cubrir?','Limpiezas, resinas y ortodoncia','["tratamientos","servicios"]',true),
    (v_id,'cirugia_refractiva','Cirugia refractiva','boolean','optional',false,5,'¿Le interesa cubrir cirugia refractiva (laser ocular)?','Si','["laser ocular","vision"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('fianza','Fianzas');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_fianza','Tipo de fianza','select','required',true,1,'¿Que tipo de fianza necesita? (Cumplimiento, Fidelidad, Judicial, Arrendamiento)','Cumplimiento de contrato','["tipo","modalidad"]',true),
    (v_id,'nombre_afianzado','Nombre del afianzado','text','required',true,2,'¿Nombre completo o razon social del afianzado?','Constructora ABC S.A.','["afianzado","quien da la fianza"]',true),
    (v_id,'nombre_beneficiario','Nombre del beneficiario','text','required',true,3,'¿Quien es el beneficiario de la fianza?','Gobierno del Estado','["beneficiario","acreedor"]',true),
    (v_id,'monto_fianza','Monto de la fianza (pesos)','number','required',true,4,'¿Cual es el monto garantizado por la fianza?','500000','["monto","importe","valor"]',true),
    (v_id,'plazo','Plazo de la fianza','text','required',true,5,'¿Cual es el plazo o vigencia requerida?','12 meses','["plazo","vigencia","duracion"]',true),
    (v_id,'descripcion_obligacion','Descripcion de la obligacion','text','recommended',false,6,'¿En que consiste la obligacion garantizada?','Construccion de obra civil','["descripcion","objeto","contrato"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_caucion','Seguro de Caucion');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_caucion','Tipo de caucion','text','required',true,1,'¿Que tipo de caucion requiere? (contractual, administrativa, judicial)','Caucion contractual','["tipo","modalidad"]',true),
    (v_id,'nombre_tomador','Nombre del tomador','text','required',true,2,'¿Nombre o razon social del tomador del seguro?','Proveedor XYZ S.A. de C.V.','["tomador","contratante"]',true),
    (v_id,'nombre_beneficiario','Nombre del beneficiario','text','required',true,3,'¿Quien es el beneficiario o acreedor?','Pemex','["beneficiario","cliente"]',true),
    (v_id,'monto_garantizado','Monto garantizado (pesos)','number','required',true,4,'¿Cual es el monto que se debe garantizar?','2000000','["monto","importe"]',true),
    (v_id,'objeto_contrato','Objeto del contrato','text','required',true,5,'¿En que consiste el contrato u obligacion?','Suministro de equipo industrial','["objeto","descripcion","servicio"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_credito','Seguro de Credito');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social del asegurado','text','required',true,1,'¿Nombre o razon social de la empresa?','Distribuidora ABC S.A.','["empresa","nombre"]',true),
    (v_id,'actividad','Actividad o giro','text','required',true,2,'¿Cual es el giro o actividad de la empresa?','Distribucion de alimentos','["giro","sector","actividad"]',true),
    (v_id,'ventas_credito_anuales','Ventas a credito anuales (pesos)','number','required',true,3,'¿Cual es el monto de ventas a credito en el ultimo ano?','5000000','["ventas a credito","cartera"]',true),
    (v_id,'numero_deudores','Numero de deudores','number','required',true,4,'¿Cuantos clientes o deudores tiene en cartera?','80','["cuantos clientes","deudores"]',true),
    (v_id,'plazo_credito','Plazo de credito promedio','text','recommended',false,5,'¿Cual es el plazo promedio de credito que otorga?','30 dias','["plazo","dias credito"]',true),
    (v_id,'siniestralidad_anterior','Siniestralidad en ultimos 3 anos','boolean','recommended',false,6,'¿Ha tenido impagos importantes en los ultimos 3 anos?','No','["impagos","morosidad","siniestros"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_agricola','Seguro Agricola');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_cultivo','Tipo de cultivo','text','required',true,1,'¿Que cultivo(s) desea asegurar?','Maiz y sorgo','["cultivo","siembra","producto agricola"]',true),
    (v_id,'superficie_hectareas','Superficie en hectareas','number','required',true,2,'¿Cuantas hectareas desea asegurar?','100','["hectareas","superficie","terreno"]',true),
    (v_id,'municipio_estado','Municipio y estado','text','required',true,3,'¿En que municipio y estado estan las parcelas?','Culiacan, Sinaloa','["ubicacion","lugar","estado"]',true),
    (v_id,'tipo_riego','Tipo de riego','select','required',true,4,'¿Las parcelas son de riego o de temporal?','Riego','["riego","temporal","agua"]',true),
    (v_id,'valor_produccion','Valor de la produccion por hectarea (pesos)','number','required',true,5,'¿Cual es el valor estimado de la produccion por hectarea?','15000','["valor","produccion","rendimiento"]',true),
    (v_id,'riesgos_cubiertos','Riesgos a cubrir','text','recommended',false,6,'¿Que riesgos le preocupan? (granizo, helada, sequia, inundacion)','Granizo e inundacion','["riesgos","fenomenos","peligros"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_ganadero','Seguro Ganadero');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_ganado','Tipo de ganado','text','required',true,1,'¿Que tipo de ganado desea asegurar? (bovino, porcino, ovino, caprino)','Bovino','["ganado","especie","animales"]',true),
    (v_id,'numero_cabezas','Numero de cabezas','number','required',true,2,'¿Cuantas cabezas desea asegurar?','200','["cuantos animales","cabezas","numero"]',true),
    (v_id,'municipio_estado','Municipio y estado','text','required',true,3,'¿En que municipio y estado se ubica el rancho?','Hermosillo, Sonora','["ubicacion","rancho","estado"]',true),
    (v_id,'valor_por_cabeza','Valor por cabeza (pesos)','number','required',true,4,'¿Cual es el valor promedio por cabeza de ganado?','25000','["precio","costo","valor animal"]',true),
    (v_id,'riesgos_cubiertos','Riesgos a cubrir','text','recommended',false,5,'¿Que coberturas le interesan? (muerte, hurto, accidente, enfermedades)','Muerte y hurto','["coberturas","riesgos"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('maquinaria_agricola','Maquinaria Agricola');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_maquinaria','Tipo de maquinaria','text','required',true,1,'¿Que tipo de maquinaria desea asegurar?','Tractores y cosechadoras','["maquinaria","equipo","tractor"]',true),
    (v_id,'numero_unidades','Numero de unidades','number','required',true,2,'¿Cuantas unidades de maquinaria desea asegurar?','5','["cuantas","unidades","numero"]',true),
    (v_id,'valor_total','Valor total de la maquinaria (pesos)','number','required',true,3,'¿Cual es el valor total de toda la maquinaria?','1500000','["valor","precio","costo total"]',true),
    (v_id,'uso','Uso y actividad','text','recommended',false,4,'¿Para que actividades agricolas se utiliza la maquinaria?','Siembra y cosecha de maiz','["uso","actividad","para que"]',true),
    (v_id,'coberturas','Coberturas requeridas','text','recommended',false,5,'¿Que coberturas necesita? (robo, accidente, incendio, RC)','Robo y accidente','["coberturas","proteccion"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('cyber_riesgos','Cyber / Riesgos Ciberneticos');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','TechCorp S.A. de C.V.','["empresa","nombre"]',true),
    (v_id,'sector','Sector o industria','text','required',true,2,'¿A que sector pertenece la empresa?','Servicios financieros','["industria","giro","sector"]',true),
    (v_id,'numero_empleados','Numero de empleados','number','required',true,3,'¿Cuantos empleados tiene la empresa?','150','["empleados","trabajadores"]',true),
    (v_id,'ingresos_anuales','Ingresos anuales (pesos)','number','required',true,4,'¿Cuales son los ingresos anuales aproximados?','50000000','["ventas","ingresos","facturacion"]',true),
    (v_id,'datos_sensibles','Tipo de datos que maneja','text','required',true,5,'¿Que tipo de datos sensibles maneja la empresa?','Datos financieros y personales de clientes','["datos","informacion sensible"]',true),
    (v_id,'incidentes_previos','Incidentes ciberneticos previos','boolean','recommended',false,6,'¿Ha sufrido algun incidente cibernetico en los ultimos 3 anos?','No','["ataques previos","incidentes","hackeos"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('do_consejeros','D&O / Responsabilidad de Consejeros');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','Grupo Empresarial XYZ','["empresa","nombre"]',true),
    (v_id,'tipo_empresa','Tipo de empresa','select','required',true,2,'¿Es empresa publica, privada o listada en bolsa?','Privada','["tipo","estructura"]',true),
    (v_id,'numero_directivos','Numero de directivos asegurados','number','required',true,3,'¿Cuantos directivos o consejeros se aseguraran?','10','["directivos","consejeros","ejecutivos"]',true),
    (v_id,'ingresos_anuales','Ingresos anuales (pesos)','number','required',true,4,'¿Cuales son los ingresos anuales de la empresa?','200000000','["ventas","ingresos","facturacion"]',true),
    (v_id,'limite_responsabilidad','Limite de responsabilidad (pesos)','number','recommended',false,5,'¿Que limite de responsabilidad desea contratar?','10000000','["suma asegurada","limite","monto"]',true),
    (v_id,'reclamaciones_previas','Reclamaciones previas','boolean','recommended',false,6,'¿Ha habido reclamaciones contra directivos en los ultimos 5 anos?','No','["demandas","reclamaciones","litigios"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('responsabilidad_laboral','Responsabilidad por Practicas Laborales');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','Empresa Laboral S.A.','["empresa","compania"]',true),
    (v_id,'numero_empleados','Numero de empleados','number','required',true,2,'¿Cuantos empleados tiene la empresa?','200','["plantilla","empleados","trabajadores"]',true),
    (v_id,'sector','Sector de la empresa','text','required',true,3,'¿A que sector pertenece?','Manufactura','["industria","sector","giro"]',true),
    (v_id,'limite_responsabilidad','Limite de responsabilidad (pesos)','number','required',true,4,'¿Que limite de responsabilidad desea?','5000000','["suma asegurada","limite"]',true),
    (v_id,'reclamaciones_previas','Reclamaciones laborales previas','boolean','recommended',false,5,'¿Ha tenido demandas laborales en los ultimos 3 anos?','No','["demandas","reclamaciones","juicios"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('fidelidad_empleados','Fidelidad / Infidelidad de Empleados');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','Empresa Confianza S.A.','["empresa","nombre"]',true),
    (v_id,'numero_empleados','Numero de empleados asegurados','number','required',true,2,'¿Cuantos empleados se incluiran en la poliza?','50','["cuantos empleados","personal"]',true),
    (v_id,'puestos_riesgo','Puestos de mayor riesgo','text','required',true,3,'¿Cuales son los puestos con acceso a efectivo, activos o informacion sensible?','Cajeros, contadores, almacenistas','["puestos","cargos","posiciones"]',true),
    (v_id,'suma_asegurada','Suma asegurada (pesos)','number','required',true,4,'¿Que suma asegurada por empleado o total desea?','500000','["monto","suma","cobertura"]',true),
    (v_id,'perdidas_previas','Perdidas previas por deshonestidad','boolean','recommended',false,5,'¿Han tenido perdidas por actos deshonestos de empleados antes?','No','["fraude","robo interno","perdidas"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('crime_empresarial','Crime Empresarial');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'razon_social','Razon social','text','required',true,1,'¿Nombre o razon social de la empresa?','Corporativo Seguro S.A.','["empresa","nombre"]',true),
    (v_id,'sector','Sector de la empresa','text','required',true,2,'¿A que sector pertenece la empresa?','Servicios financieros','["industria","giro","sector"]',true),
    (v_id,'ingresos_anuales','Ingresos anuales (pesos)','number','required',true,3,'¿Cuales son los ingresos anuales de la empresa?','100000000','["ventas","facturacion","ingresos"]',true),
    (v_id,'suma_asegurada','Suma asegurada total (pesos)','number','required',true,4,'¿Que suma asegurada total desea contratar?','5000000','["monto","limite","suma"]',true),
    (v_id,'coberturas_deseadas','Coberturas deseadas','text','recommended',false,5,'¿Que coberturas incluir? (fraude, robo, falsificacion, cibercrimen, extorsion)','Fraude y cibercrimen','["coberturas","proteccion","riesgos"]',true),
    (v_id,'incidentes_previos','Incidentes o perdidas previas','boolean','recommended',false,6,'¿Han sufrido incidentes de fraude en los ultimos 5 anos?','No','["fraude previo","incidentes","perdidas"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_eventos','Seguro para Eventos');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_evento','Tipo de evento','text','required',true,1,'¿Que tipo de evento desea asegurar? (boda, congreso, concierto, graduacion)','Boda','["evento","tipo","celebracion"]',true),
    (v_id,'fecha_evento','Fecha del evento','date','required',true,2,'¿En que fecha se realizara el evento?','2026-12-15','["cuando","fecha","dia"]',true),
    (v_id,'numero_asistentes','Numero de asistentes','number','required',true,3,'¿Cuantas personas asistiran al evento?','200','["invitados","asistentes","personas"]',true),
    (v_id,'lugar','Lugar del evento','text','required',true,4,'¿En que lugar o venue se realizara el evento?','Salon Jardin, Guadalajara','["salon","lugar","venue"]',true),
    (v_id,'valor_evento','Valor total del evento (pesos)','number','required',true,5,'¿Cual es el costo total del evento?','500000','["costo","valor","presupuesto"]',true),
    (v_id,'coberturas','Coberturas requeridas','text','recommended',false,6,'¿Que coberturas necesita? (cancelacion, RC, accidentes, equipo)','Cancelacion y responsabilidad civil','["coberturas","proteccion"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_mascotas','Seguro de Mascotas');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_mascota','Tipo de mascota','select','required',true,1,'¿Que tipo de mascota desea asegurar? (perro, gato, otra)','Perro','["mascota","animal","especie"]',true),
    (v_id,'raza','Raza de la mascota','text','required',true,2,'¿Cual es la raza de la mascota?','Labrador Retriever','["raza","tipo de perro","tipo de gato"]',true),
    (v_id,'edad_mascota','Edad de la mascota (anos)','number','required',true,3,'¿Cuantos anos tiene la mascota?','3','["edad","anos","cuantos anos"]',true),
    (v_id,'tipo_cobertura','Tipo de cobertura','select','required',true,4,'¿Que tipo de cobertura desea? (veterinaria, accidentes, RC, todo incluido)','Todo incluido','["cobertura","plan","seguro"]',true),
    (v_id,'microchip','Tiene microchip','boolean','recommended',false,5,'¿La mascota tiene microchip de identificacion?','Si','["microchip","chip","identificacion"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('proteccion_arrendamiento','Proteccion de Renta / Arrendamiento');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_inmueble','Tipo de inmueble','select','required',true,1,'¿Que tipo de inmueble es? (casa, departamento, local comercial)','Departamento','["inmueble","propiedad","tipo"]',true),
    (v_id,'renta_mensual','Renta mensual (pesos)','number','required',true,2,'¿Cual es el monto de la renta mensual?','15000','["renta","mensualidad","pago mensual"]',true),
    (v_id,'ubicacion_inmueble','Ubicacion del inmueble','text','required',true,3,'¿En que ciudad o colonia esta ubicado el inmueble?','Col. Polanco, CDMX','["ubicacion","direccion","donde"]',true),
    (v_id,'coberturas','Coberturas requeridas','text','required',true,4,'¿Que coberturas necesita? (impago de renta, danos al inmueble, desalojo)','Impago de renta y danos','["coberturas","proteccion"]',true),
    (v_id,'plazo','Plazo del arrendamiento','text','recommended',false,5,'¿Cual es el plazo del contrato de arrendamiento?','12 meses','["plazo","duracion","vigencia"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('seguro_condominal','Seguro Condominal');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'nombre_condominio','Nombre del condominio','text','required',true,1,'¿Cual es el nombre o descripcion del condominio o edificio?','Torres del Parque Residencial','["condominio","edificio","nombre"]',true),
    (v_id,'numero_unidades','Numero de unidades privativas','number','required',true,2,'¿Cuantas unidades privativas tiene el condominio?','60','["departamentos","unidades","condominios"]',true),
    (v_id,'valor_areas_comunes','Valor de areas comunes (pesos)','number','required',true,3,'¿Cual es el valor aproximado de las areas comunes e instalaciones?','5000000','["valor areas comunes","instalaciones","valor"]',true),
    (v_id,'tipo_construccion','Tipo de construccion','select','required',true,4,'¿Que tipo de construccion es? (concreto, acero, mixto)','Concreto armado','["construccion","estructura","material"]',true),
    (v_id,'coberturas','Coberturas requeridas','text','recommended',false,5,'¿Que coberturas incluir? (incendio, RC, robo, responsabilidad de administracion)','Incendio, RC y administracion','["coberturas","proteccion"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DO $$ DECLARE v_id uuid; BEGIN
  v_id := _tmp_create_agent_from_form('obras_arte','Obras de Arte y Objetos de Valor');
  IF v_id IS NOT NULL THEN
    INSERT INTO contact_center_assistant_fields (assistant_id,field_key,label,field_type,priority,is_required,capture_order,prompt_text,example_value,synonyms,is_synced_from_form) VALUES
    (v_id,'tipo_bienes','Tipo de bienes','text','required',true,1,'¿Que tipo de bienes desea asegurar? (pinturas, esculturas, joyas, antiguedades)','Pinturas y esculturas','["bienes","objetos","arte","coleccion"]',true),
    (v_id,'numero_piezas','Numero de piezas','number','required',true,2,'¿Cuantas piezas conforman la coleccion a asegurar?','25','["piezas","objetos","cuantos"]',true),
    (v_id,'valor_total','Valor total de la coleccion (pesos)','number','required',true,3,'¿Cual es el valor total estimado o de avaluo de la coleccion?','10000000','["valor","precio","avaluo","costo"]',true),
    (v_id,'lugar_resguardo','Lugar de resguardo','text','required',true,4,'¿Donde se resguarda habitualmente la coleccion?','Residencia privada y bodega climatizada','["donde esta","ubicacion","resguardo"]',true),
    (v_id,'avaluo_reciente','Cuenta con avaluo reciente','boolean','recommended',false,5,'¿Cuenta con avaluo o certificado de autenticidad de las piezas?','Si','["avaluo","certificado","valoracion"]',true),
    (v_id,'exhibicion_publica','Se exhibe publicamente','boolean','optional',false,6,'¿Se exhibe alguna pieza en museos o galerias?','No','["exhibicion","museo","galeria"]',true);
    UPDATE contact_center_assistants SET field_count=(SELECT COUNT(*) FROM contact_center_assistant_fields WHERE assistant_id=v_id) WHERE id=v_id;
  END IF;
END $$;

DROP FUNCTION IF EXISTS _tmp_create_agent_from_form(text, text);
