/*
  # Practice Exams for Modules 6-8

  Creates practice exams with questions for:
  - Module 6: Aspectos Técnicos y Actuariales (10 questions)
  - Module 7: Ética Profesional y Conducta (10 questions)
  - Module 8: Casos Prácticos y Situaciones Reales (10 questions)

  Completes all practice exams for the Cédula A course.
*/

DO $$
DECLARE
  v_mod6_id uuid;
  v_mod7_id uuid;
  v_mod8_id uuid;
  v_exam6_id uuid := gen_random_uuid();
  v_exam7_id uuid := gen_random_uuid();
  v_exam8_id uuid := gen_random_uuid();
BEGIN
  -- Get module IDs
  SELECT id INTO v_mod6_id FROM cedula_a_modulos WHERE orden = 6;
  SELECT id INTO v_mod7_id FROM cedula_a_modulos WHERE orden = 7;
  SELECT id INTO v_mod8_id FROM cedula_a_modulos WHERE orden = 8;

  -- Create Exam for Module 6: Aspectos Técnicos y Actuariales
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam6_id,
    'Examen de Práctica - Aspectos Técnicos y Actuariales',
    'Evalúa tu comprensión de conceptos técnicos y actuariales del seguro',
    'practica',
    v_mod6_id,
    20,
    70,
    6,
    'Este examen cubre los aspectos técnicos y actuariales fundamentales de los seguros. Requiere comprensión de conceptos matemáticos y estadísticos.',
    true
  );

  -- Module 6 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam6_id, '¿Qué es la prima pura en seguros?',
   '[{"letra":"A","texto":"Prima total que paga el cliente"},{"letra":"B","texto":"Costo del riesgo sin gastos ni utilidades"},{"letra":"C","texto":"Prima con descuento"},{"letra":"D","texto":"Prima de renovación"}]',
   'B',
   'La prima pura es el costo neto del riesgo, calculado actuarialmente con base en la probabilidad y severidad de los siniestros, sin incluir gastos de operación, comisiones ni utilidad de la aseguradora.',
   v_mod6_id, 'intermedia', 1),

  (gen_random_uuid(), v_exam6_id, '¿Qué es la reserva matemática en seguros de vida?',
   '[{"letra":"A","texto":"Ahorro del asegurado"},{"letra":"B","texto":"Fondo que aseguradora debe mantener para obligaciones futuras"},{"letra":"C","texto":"Comisiones de agentes"},{"letra":"D","texto":"Prima mensual"}]',
   'B',
   'La reserva matemática es el fondo que la aseguradora debe constituir y mantener para hacer frente a sus obligaciones futuras con los asegurados, calculada actuarialmente según las pólizas vigentes.',
   v_mod6_id, 'avanzada', 2),

  (gen_random_uuid(), v_exam6_id, '¿Qué mide la siniestralidad de una cartera?',
   '[{"letra":"A","texto":"Número de pólizas vendidas"},{"letra":"B","texto":"Relación entre siniestros pagados y primas cobradas"},{"letra":"C","texto":"Comisiones de agentes"},{"letra":"D","texto":"Utilidad de la aseguradora"}]',
   'B',
   'La siniestralidad es un indicador que mide la relación porcentual entre los siniestros pagados y las primas cobradas en un período determinado. Una siniestralidad alta puede indicar problemas en la tarificación o selección de riesgos.',
   v_mod6_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam6_id, '¿Qué es el coaseguro?',
   '[{"letra":"A","texto":"Seguro compartido entre varias aseguradoras"},{"letra":"B","texto":"Porcentaje del riesgo que queda a cargo del asegurado"},{"letra":"C","texto":"Descuento en la prima"},{"letra":"D","texto":"Seguro gratis"}]',
   'B',
   'El coaseguro es la participación porcentual del asegurado en cada pérdida. Por ejemplo, con coaseguro 80/20, la aseguradora paga 80% del daño y el asegurado 20% (además del deducible si aplica).',
   v_mod6_id, 'intermedia', 4),

  (gen_random_uuid(), v_exam6_id, '¿Qué es el reaseguro?',
   '[{"letra":"A","texto":"Renovar una póliza"},{"letra":"B","texto":"Seguro que toma una aseguradora para transferir parte de sus riesgos"},{"letra":"C","texto":"Cancelar un seguro"},{"letra":"D","texto":"Seguro más barato"}]',
   'B',
   'El reaseguro es un contrato mediante el cual una aseguradora (cedente) transfiere parte de los riesgos que asume a otra compañía (reaseguradora), permitiendo distribuir y gestionar mejor grandes riesgos.',
   v_mod6_id, 'basica', 5),

  (gen_random_uuid(), v_exam6_id, '¿Qué es la tabla de mortalidad?',
   '[{"letra":"A","texto":"Lista de fallecimientos diarios"},{"letra":"B","texto":"Herramienta actuarial que muestra probabilidad de muerte por edad"},{"letra":"C","texto":"Registro de hospitales"},{"letra":"D","texto":"Directorio de funerarias"}]',
   'B',
   'La tabla de mortalidad es una herramienta actuarial fundamental que muestra la probabilidad estadística de muerte o supervivencia según la edad, utilizada para calcular primas en seguros de vida.',
   v_mod6_id, 'intermedia', 6),

  (gen_random_uuid(), v_exam6_id, '¿Qué es la ley de los grandes números aplicada a seguros?',
   '[{"letra":"A","texto":"Vender muchas pólizas"},{"letra":"B","texto":"A mayor número de riesgos similares, más predecible el resultado"},{"letra":"C","texto":"Aumentar primas"},{"letra":"D","texto":"Tener muchos empleados"}]',
   'B',
   'La ley de los grandes números establece que cuanto mayor sea el número de exposiciones a un riesgo similar, más predecible será el resultado, permitiendo a las aseguradoras calcular primas adecuadas.',
   v_mod6_id, 'avanzada', 7),

  (gen_random_uuid(), v_exam6_id, '¿Qué es el valor actual de una suma asegurada?',
   '[{"letra":"A","texto":"Precio en el mercado"},{"letra":"B","texto":"Valor presente de un pago futuro considerando tasa de interés"},{"letra":"C","texto":"Inflación anual"},{"letra":"D","texto":"Depreciación"}]',
   'B',
   'El valor actual es el valor presente de un pago futuro, calculado aplicando una tasa de interés. Es fundamental en la valuación actuarial de obligaciones futuras de las aseguradoras.',
   v_mod6_id, 'avanzada', 8),

  (gen_random_uuid(), v_exam6_id, 'Una póliza tiene suma asegurada $100,000, deducible $5,000 y coaseguro 80/20. Si hay daño de $50,000, ¿cuánto paga la aseguradora?',
   '[{"letra":"A","texto":"$50,000"},{"letra":"B","texto":"$36,000"},{"letra":"C","texto":"$40,000"},{"letra":"D","texto":"$45,000"}]',
   'B',
   'Cálculo: Daño ($50,000) menos deducible ($5,000) = $45,000. Aplicando coaseguro 80/20: $45,000 × 80% = $36,000 paga aseguradora, $9,000 queda a cargo del asegurado.',
   v_mod6_id, 'trampa', 9),

  (gen_random_uuid(), v_exam6_id, '¿Qué es el período de gracia en seguros?',
   '[{"letra":"A","texto":"Tiempo para arrepentirse"},{"letra":"B","texto":"Plazo adicional para pagar prima vencida sin perder cobertura"},{"letra":"C","texto":"Descuento especial"},{"letra":"D","texto":"Vacaciones del agente"}]',
   'B',
   'El período de gracia es un plazo adicional (generalmente 30 días) que se otorga para pagar una prima vencida sin que se suspenda la cobertura. Si no se paga en este período, la póliza se cancela.',
   v_mod6_id, 'basica', 10);

  -- Create Exam for Module 7: Ética Profesional y Conducta
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam7_id,
    'Examen de Práctica - Ética Profesional y Conducta',
    'Evalúa tu comprensión de principios éticos y conducta profesional',
    'practica',
    v_mod7_id,
    20,
    70,
    7,
    'Este examen evalúa tu conocimiento sobre ética profesional y mejores prácticas en la intermediación de seguros.',
    true
  );

  -- Module 7 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam7_id, '¿Cuál es el principio ético fundamental en la intermediación de seguros?',
   '[{"letra":"A","texto":"Vender la póliza más cara"},{"letra":"B","texto":"Actuar con honestidad y en el mejor interés del cliente"},{"letra":"C","texto":"Maximizar comisiones propias"},{"letra":"D","texto":"Favorecer siempre a la aseguradora"}]',
   'B',
   'El principio fundamental es actuar con honestidad, transparencia y siempre buscando el mejor interés del cliente, ofreciendo productos adecuados a sus necesidades reales y capacidad de pago.',
   v_mod7_id, 'basica', 1),

  (gen_random_uuid(), v_exam7_id, '¿Qué es un conflicto de interés?',
   '[{"letra":"A","texto":"Discusión con el cliente"},{"letra":"B","texto":"Situación donde intereses personales pueden afectar juicio profesional"},{"letra":"C","texto":"Problema legal"},{"letra":"D","texto":"Competencia desleal"}]',
   'B',
   'Un conflicto de interés ocurre cuando los intereses personales, económicos o relaciones del agente pueden comprometer su capacidad de actuar objetivamente en el mejor interés del cliente.',
   v_mod7_id, 'intermedia', 2),

  (gen_random_uuid(), v_exam7_id, '¿Qué debe hacer un agente si detecta que un producto NO es adecuado para su cliente?',
   '[{"letra":"A","texto":"Venderlo igual para cumplir meta"},{"letra":"B","texto":"Informar honestamente y recomendar alternativa adecuada"},{"letra":"C","texto":"Omitir información negativa"},{"letra":"D","texto":"Presionar al cliente"}]',
   'B',
   'La ética profesional exige informar honestamente cuando un producto no es adecuado y recomendar alternativas que sí satisfagan las necesidades del cliente, aunque signifique menor comisión.',
   v_mod7_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam7_id, '¿Qué información debe revelar obligatoriamente un agente al cliente?',
   '[{"letra":"A","texto":"Solo beneficios de la póliza"},{"letra":"B","texto":"Coberturas, exclusiones, limitaciones y condiciones generales"},{"letra":"C","texto":"Sus problemas personales"},{"letra":"D","texto":"Información confidencial de otros clientes"}]',
   'B',
   'El agente debe revelar toda la información material: coberturas incluidas, exclusiones, limitaciones, deducibles, coaseguros, suma asegurada, vigencia y condiciones generales de la póliza.',
   v_mod7_id, 'basica', 4),

  (gen_random_uuid(), v_exam7_id, 'Un cliente solicita información de otro asegurado. ¿Qué debe hacer el agente?',
   '[{"letra":"A","texto":"Compartir la información si paga extra"},{"letra":"B","texto":"Negarse por confidencialidad y protección de datos personales"},{"letra":"C","texto":"Compartirla si son familiares"},{"letra":"D","texto":"Publicarla en redes sociales"}]',
   'B',
   'El agente debe negarse rotundamente. La información de clientes es confidencial y está protegida por la Ley Federal de Protección de Datos Personales. Compartirla es una violación ética y legal.',
   v_mod7_id, 'intermedia', 5),

  (gen_random_uuid(), v_exam7_id, '¿Qué es la capacitación continua para agentes?',
   '[{"letra":"A","texto":"Opción voluntaria sin importancia"},{"letra":"B","texto":"Obligación para mantener conocimientos actualizados y certificación"},{"letra":"C","texto":"Reuniones sociales"},{"letra":"D","texto":"Pérdida de tiempo"}]',
   'B',
   'La capacitación continua es una obligación ética y regulatoria que asegura que los agentes mantengan sus conocimientos actualizados, puedan renovar su certificación y brinden mejor servicio a sus clientes.',
   v_mod7_id, 'basica', 6),

  (gen_random_uuid(), v_exam7_id, '¿Cuándo es ético recibir beneficios o incentivos de una aseguradora?',
   '[{"letra":"A","texto":"Siempre que sean en efectivo"},{"letra":"B","texto":"Cuando son transparentes y no comprometen objetividad hacia el cliente"},{"letra":"C","texto":"Solo si el cliente no se entera"},{"letra":"D","texto":"Nunca, está prohibido"}]',
   'B',
   'Es ético recibir comisiones e incentivos siempre que sean transparentes, estén dentro del marco legal, y no comprometan la capacidad del agente de actuar objetivamente en el mejor interés del cliente.',
   v_mod7_id, 'avanzada', 7),

  (gen_random_uuid(), v_exam7_id, '¿Qué debe hacer un agente ante prácticas desleales de un competidor?',
   '[{"letra":"A","texto":"Imitarlas para competir"},{"letra":"B","texto":"Reportarlas a las autoridades y mantener conducta ética propia"},{"letra":"C","texto":"Ignorarlas"},{"letra":"D","texto":"Difamarlas en redes sociales"}]',
   'B',
   'Ante prácticas desleales, el agente debe reportarlas a las autoridades competentes (CNSF, CONDUSEF) y mantener su propia conducta ética, sin caer en las mismas prácticas indebidas.',
   v_mod7_id, 'intermedia', 8),

  (gen_random_uuid(), v_exam7_id, '¿Qué es el deber de lealtad del agente?',
   '[{"letra":"A","texto":"Lealtad solo a la aseguradora"},{"letra":"B","texto":"Balance entre intereses del cliente y la aseguradora con transparencia"},{"letra":"C","texto":"Lealtad exclusiva al cliente contra la aseguradora"},{"letra":"D","texto":"Lealtad a sus propios intereses"}]',
   'B',
   'El agente debe mantener un balance ético entre los intereses legítimos del cliente y de la aseguradora, actuando con transparencia, honestidad y profesionalismo hacia ambas partes.',
   v_mod7_id, 'avanzada', 9),

  (gen_random_uuid(), v_exam7_id, 'Un agente presiona a un cliente para contratar un seguro innecesario. Esto es:',
   '[{"letra":"A","texto":"Estrategia de ventas agresiva válida"},{"letra":"B","texto":"Conducta no ética y potencialmente sancionable"},{"letra":"C","texto":"Práctica común aceptable"},{"letra":"D","texto":"Muestra de profesionalismo"}]',
   'B',
   'Presionar a un cliente para contratar seguros que no necesita o que no puede pagar es una conducta no ética que puede constituir venta indebida, sancionable por la CNSF y dañina para la profesión.',
   v_mod7_id, 'trampa', 10);

  -- Create Exam for Module 8: Casos Prácticos y Situaciones Reales
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam8_id,
    'Examen de Práctica - Casos Prácticos',
    'Evalúa tu capacidad para resolver situaciones reales',
    'practica',
    v_mod8_id,
    25,
    70,
    8,
    'Este examen presenta casos prácticos que reflejan situaciones reales que enfrentarás como agente de seguros. Analiza cada caso cuidadosamente.',
    true
  );

  -- Module 8 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam8_id, 'Cliente joven, primer empleo, solicita seguro de vida. ¿Qué es más apropiado?',
   '[{"letra":"A","texto":"La póliza más cara con todos los beneficios"},{"letra":"B","texto":"Vida temporal con suma adecuada a su presupuesto y necesidades"},{"letra":"C","texto":"Rechazarlo por falta de experiencia"},{"letra":"D","texto":"Vida entera con prima muy alta"}]',
   'B',
   'Para un cliente joven con presupuesto limitado, lo más apropiado es un seguro de vida temporal con suma asegurada adecuada a sus necesidades de protección familiar y que pueda pagar cómodamente.',
   v_mod8_id, 'intermedia', 1),

  (gen_random_uuid(), v_exam8_id, 'Cliente tiene auto de 15 años, valor $40,000. Solicita seguro amplio. ¿Qué le recomiendas?',
   '[{"letra":"A","texto":"Seguro amplio sin analizar"},{"letra":"B","texto":"Analizar costo-beneficio; posiblemente RC y RT más conveniente"},{"letra":"C","texto":"Rechazar la solicitud"},{"letra":"D","texto":"Solo responsabilidad civil"}]',
   'B',
   'Para un vehículo de 15 años con bajo valor comercial, es importante analizar si el costo anual del seguro amplio justifica el beneficio. Generalmente RC y RT (Robo Total) puede ser más conveniente.',
   v_mod8_id, 'avanzada', 2),

  (gen_random_uuid(), v_exam8_id, 'Propietario de negocio quiere asegurar inventario de $500,000. ¿Qué información adicional necesitas?',
   '[{"letra":"A","texto":"Ninguna, emitir inmediatamente"},{"letra":"B","texto":"Tipo de mercancía, ubicación, medidas de seguridad, rotación"},{"letra":"C","texto":"Solo la dirección"},{"letra":"D","texto":"Únicamente el RFC"}]',
   'B',
   'Para asegurar inventario se necesita: tipo de mercancía (inflamable, perecedera, etc.), ubicación del inmueble, medidas de seguridad (alarmas, vigilancia), rotación de inventario y construcción del edificio.',
   v_mod8_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam8_id, 'Cliente de 55 años con hipertensión controlada solicita seguro de vida. ¿Qué procede?',
   '[{"letra":"A","texto":"Rechazar automáticamente"},{"letra":"B","texto":"Solicitar exámenes médicos y evaluar con declaración completa de salud"},{"letra":"C","texto":"Ocultar la hipertensión"},{"letra":"D","texto":"Cobrar el doble sin evaluación"}]',
   'B',
   'La hipertensión controlada no es causa automática de rechazo. Se deben solicitar exámenes médicos actuales, declaración completa de salud y el suscriptor evaluará si acepta estándar, con recargo o condiciones especiales.',
   v_mod8_id, 'intermedia', 4),

  (gen_random_uuid(), v_exam8_id, 'Durante el llenado de solicitud, cliente menciona problema de salud que no quiere declarar. ¿Qué haces?',
   '[{"letra":"A","texto":"Omitirlo para facilitar la venta"},{"letra":"B","texto":"Explicar importancia de veracidad y riesgos de reticencia; declarar todo"},{"letra":"C","texto":"Llenar falso sin que se entere"},{"letra":"D","texto":"Decirle que firme sin leer"}]',
   'B',
   'Debes explicar la importancia de la veracidad en la solicitud, los riesgos de omitir información (reticencia = pérdida de derechos) y que debe declarar todo. La honestidad protege al cliente y es tu obligación ética.',
   v_mod8_id, 'avanzada', 5),

  (gen_random_uuid(), v_exam8_id, 'Cliente reporta choque de auto el día después de contratar el seguro. ¿Qué consideras?',
   '[{"letra":"A","texto":"Pagarlo inmediatamente sin investigar"},{"letra":"B","texto":"Reportar para investigación; posible antiselección o siniestro previo"},{"letra":"C","texto":"Rechazarlo automáticamente"},{"letra":"D","texto":"Cancelar la póliza"}]',
   'B',
   'Un siniestro reportado al día siguiente de contratar requiere investigación exhaustiva. Puede ser legítimo, pero también podría indicar antiselección (contratar sabiendo del daño) o fraude, lo cual debe determinar el ajustador.',
   v_mod8_id, 'avanzada', 6),

  (gen_random_uuid(), v_exam8_id, 'Familia con niños pequeños solicita seguro de gastos médicos. ¿Qué cobertura priorizas explicar?',
   '[{"letra":"A","texto":"Solo hospitalización"},{"letra":"B","texto":"Cobertura amplia incluyendo maternidad, pediatría y enfermedades comunes"},{"letra":"C","texto":"Solo cirugías mayores"},{"letra":"D","texto":"Dental y oftalmología únicamente"}]',
   'B',
   'Para familias con niños pequeños es crucial cobertura de maternidad (futuros hijos), atención pediátrica amplia, enfermedades comunes de la infancia, vacunas y preferentemente gastos ambulatorios.',
   v_mod8_id, 'intermedia', 7),

  (gen_random_uuid(), v_exam8_id, 'Cliente desea cancelar póliza vigente para contratar con otra aseguradora por precio. ¿Qué le adviertes?',
   '[{"letra":"A","texto":"Cancelar inmediatamente"},{"letra":"B","texto":"Verificar período de espera, preexistencias y continuidad de antigüedad"},{"letra":"C","texto":"No decirle nada"},{"letra":"D","texto":"Que lo haga sin pensar"}]',
   'B',
   'Debes advertirle sobre: nuevo período de espera para enfermedades, posibles exclusiones por preexistencias en nueva póliza, pérdida de antigüedad acumulada. Comparar coberturas reales, no solo precio.',
   v_mod8_id, 'avanzada', 8),

  (gen_random_uuid(), v_exam8_id, 'Médico solicita seguro de responsabilidad civil profesional. ¿Qué suma asegurada recomiendas?',
   '[{"letra":"A","texto":"La mínima posible"},{"letra":"B","texto":"Suficiente para cubrir indemnizaciones potenciales por mala praxis"},{"letra":"C","texto":"$10,000 pesos"},{"letra":"D","texto":"No necesita seguro"}]',
   'B',
   'Para profesionales de la salud, la suma asegurada debe ser robusta (generalmente varios millones de pesos) considerando que las indemnizaciones por mala praxis médica pueden ser muy elevadas.',
   v_mod8_id, 'avanzada', 9),

  (gen_random_uuid(), v_exam8_id, 'Cliente pregunta por qué su prima subió en la renovación. ¿Cuáles son razones válidas?',
   '[{"letra":"A","texto":"Capricho de la aseguradora"},{"letra":"B","texto":"Siniestralidad, inflación, cambios en riesgo, ajuste por edad"},{"letra":"C","texto":"Solo para ganar más"},{"letra":"D","texto":"No hay razón"}]',
   'B',
   'Razones válidas de aumento: historial de siniestralidad del cliente o cartera, inflación en costos de reparación/médicos, agravamiento del riesgo (más conductores, cambio de uso), edad (en seguros de vida/GM).',
   v_mod8_id, 'intermedia', 10);

END $$;