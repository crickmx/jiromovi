/*
  # Practice Exams for Modules 3-5

  Creates practice exams with questions for:
  - Module 3: Marco Legal y Regulatorio (10 questions)
  - Module 4: Proceso de Suscripción (10 questions)  
  - Module 5: Siniestros y Reclamaciones (10 questions)

  Each exam includes questions at various difficulty levels covering key module topics.
*/

DO $$
DECLARE
  v_mod3_id uuid;
  v_mod4_id uuid;
  v_mod5_id uuid;
  v_exam3_id uuid := gen_random_uuid();
  v_exam4_id uuid := gen_random_uuid();
  v_exam5_id uuid := gen_random_uuid();
BEGIN
  -- Get module IDs
  SELECT id INTO v_mod3_id FROM cedula_a_modulos WHERE orden = 3;
  SELECT id INTO v_mod4_id FROM cedula_a_modulos WHERE orden = 4;
  SELECT id INTO v_mod5_id FROM cedula_a_modulos WHERE orden = 5;

  -- Create Exam for Module 3: Marco Legal y Regulatorio
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam3_id,
    'Examen de Práctica - Marco Legal y Regulatorio',
    'Evalúa tu comprensión del marco legal y regulatorio del sector asegurador',
    'practica',
    v_mod3_id,
    20,
    70,
    3,
    'Este examen de práctica te ayudará a evaluar tu conocimiento sobre el marco legal y regulatorio. Responde todas las preguntas y al finalizar recibirás retroalimentación detallada.',
    true
  );

  -- Module 3 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam3_id, '¿Cuál es el principal objetivo de la CNSF?',
   '[{"letra":"A","texto":"Regular y supervisar el sector asegurador y afianzador"},{"letra":"B","texto":"Vender seguros directamente"},{"letra":"C","texto":"Competir con aseguradoras privadas"},{"letra":"D","texto":"Fijar precios de seguros"}]',
   'A',
   'La CNSF (Comisión Nacional de Seguros y Fianzas) es el organismo regulador cuyo objetivo principal es regular, supervisar y fiscalizar el correcto funcionamiento del sector asegurador y afianzador en México.',
   v_mod3_id, 'basica', 1),

  (gen_random_uuid(), v_exam3_id, '¿Qué documento legal establece las bases del sistema asegurador mexicano?',
   '[{"letra":"A","texto":"Código Civil"},{"letra":"B","texto":"Ley de Instituciones de Seguros y Fianzas"},{"letra":"C","texto":"Ley Federal del Trabajo"},{"letra":"D","texto":"Código de Comercio"}]',
   'B',
   'La Ley de Instituciones de Seguros y Fianzas (LISF) es el ordenamiento legal que regula la organización, funcionamiento y operación de las instituciones de seguros y fianzas en México.',
   v_mod3_id, 'basica', 2),

  (gen_random_uuid(), v_exam3_id, '¿Qué es el Registro de Agentes de Seguros y Fianzas?',
   '[{"letra":"A","texto":"Un directorio telefónico"},{"letra":"B","texto":"Registro donde la CNSF inscribe a agentes certificados"},{"letra":"C","texto":"Una base de datos de clientes"},{"letra":"D","texto":"Un sistema de comisiones"}]',
   'B',
   'El Registro es el sistema donde la CNSF inscribe a todos los agentes que han cumplido con los requisitos de certificación y están autorizados para ejercer la intermediación de seguros.',
   v_mod3_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam3_id, '¿Cuál es el capital mínimo pagado requerido para constituir una institución de seguros?',
   '[{"letra":"A","texto":"No hay mínimo establecido"},{"letra":"B","texto":"50 millones de pesos"},{"letra":"C","texto":"Variable según ramo y operación"},{"letra":"D","texto":"1 millón de dólares"}]',
   'C',
   'La LISF establece capitales mínimos variables que dependen del tipo de operación (vida, daños) y ramos que desee operar la institución. Este capital es la base del Requerimiento de Capital de Solvencia (RCS).',
   v_mod3_id, 'intermedia', 4),

  (gen_random_uuid(), v_exam3_id, '¿Qué sanciones puede imponer la CNSF a un agente que incumple las disposiciones?',
   '[{"letra":"A","texto":"Solo amonestaciones verbales"},{"letra":"B","texto":"Amonestaciones, multas, suspensión o revocación de autorización"},{"letra":"C","texto":"Únicamente multas económicas"},{"letra":"D","texto":"Prisión directa"}]',
   'B',
   'La CNSF tiene facultad para imponer diversas sanciones graduales: amonestaciones por escrito, multas económicas, suspensión temporal de la autorización, o en casos graves, la revocación definitiva de la autorización para operar.',
   v_mod3_id, 'avanzada', 5),

  (gen_random_uuid(), v_exam3_id, '¿Qué es el Requerimiento de Capital de Solvencia (RCS)?',
   '[{"letra":"A","texto":"El salario mínimo de directivos"},{"letra":"B","texto":"Capital que deben mantener aseguradoras para cubrir riesgos"},{"letra":"C","texto":"Comisiones de agentes"},{"letra":"D","texto":"Impuestos federales"}]',
   'B',
   'El RCS es el capital mínimo que las instituciones de seguros deben mantener disponible en todo momento para hacer frente a sus obligaciones, considerando los riesgos de su operación.',
   v_mod3_id, 'intermedia', 6),

  (gen_random_uuid(), v_exam3_id, '¿Cada cuánto tiempo debe renovarse la certificación de un agente de seguros?',
   '[{"letra":"A","texto":"Anualmente"},{"letra":"B","texto":"Cada 2 años"},{"letra":"C","texto":"Cada 3 años"},{"letra":"D","texto":"No requiere renovación"}]',
   'C',
   'La certificación de los agentes de seguros debe renovarse cada 3 años mediante capacitación continua y cumplimiento de requisitos establecidos por la CNSF.',
   v_mod3_id, 'basica', 7),

  (gen_random_uuid(), v_exam3_id, '¿Qué obligación tiene un agente respecto a la información del contratante?',
   '[{"letra":"A","texto":"Puede compartirla libremente"},{"letra":"B","texto":"Debe mantener confidencialidad según LFPDPPP"},{"letra":"C","texto":"Solo guardarla 1 mes"},{"letra":"D","texto":"Venderla a terceros"}]',
   'B',
   'Los agentes están obligados por la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) a mantener la confidencialidad de toda información personal de sus clientes.',
   v_mod3_id, 'intermedia', 8),

  (gen_random_uuid(), v_exam3_id, 'Un agente ofrece un seguro prometiendo coberturas NO incluidas en la póliza. ¿Esto constituye?',
   '[{"letra":"A","texto":"Estrategia de ventas válida"},{"letra":"B","texto":"Información engañosa sancionable"},{"letra":"C","texto":"Práctica común aceptada"},{"letra":"D","texto":"Marketing creativo"}]',
   'B',
   'Ofrecer coberturas que no están contempladas en la póliza constituye información engañosa, una práctica desleal sancionable por la CNSF que puede derivar en multas, suspensión o revocación de la autorización.',
   v_mod3_id, 'trampa', 9),

  (gen_random_uuid(), v_exam3_id, '¿Qué documento debe entregar obligatoriamente el agente al cliente antes de la contratación?',
   '[{"letra":"A","texto":"Su tarjeta de presentación"},{"letra":"B","texto":"Carta de presentación y resumen de coberturas"},{"letra":"C","texto":"Su currículum vitae"},{"letra":"D","texto":"Referencias personales"}]',
   'B',
   'Antes de la contratación, el agente debe entregar la carta de presentación de la aseguradora y el resumen de coberturas que explique claramente qué cubre y qué no cubre la póliza.',
   v_mod3_id, 'avanzada', 10);

  -- Create Exam for Module 4: Proceso de Suscripción
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam4_id,
    'Examen de Práctica - Proceso de Suscripción',
    'Evalúa tu conocimiento sobre el proceso de suscripción de seguros',
    'practica',
    v_mod4_id,
    20,
    70,
    4,
    'Este examen de práctica cubre los conceptos fundamentales del proceso de suscripción. Lee cada pregunta cuidadosamente.',
    true
  );

  -- Module 4 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam4_id, '¿Qué es la suscripción en seguros?',
   '[{"letra":"A","texto":"Firmar la póliza"},{"letra":"B","texto":"Proceso de evaluación y aceptación de riesgos"},{"letra":"C","texto":"Pagar la prima"},{"letra":"D","texto":"Cancelar el seguro"}]',
   'B',
   'La suscripción es el proceso técnico mediante el cual se evalúa el riesgo presentado por el solicitante, se determina si es asegurable, bajo qué condiciones y a qué prima.',
   v_mod4_id, 'basica', 1),

  (gen_random_uuid(), v_exam4_id, '¿Cuál es el objetivo principal del proceso de selección de riesgos?',
   '[{"letra":"A","texto":"Rechazar la mayoría de solicitudes"},{"letra":"B","texto":"Equilibrar la cartera de riesgos de la aseguradora"},{"letra":"C","texto":"Vender más pólizas"},{"letra":"D","texto":"Complicar la contratación"}]',
   'B',
   'El objetivo principal es mantener un equilibrio adecuado en la cartera de riesgos de la aseguradora, aceptando riesgos que puedan ser técnica y financieramente sustentables.',
   v_mod4_id, 'intermedia', 2),

  (gen_random_uuid(), v_exam4_id, '¿Qué es la antiselección en seguros?',
   '[{"letra":"A","texto":"Rechazar buenos clientes"},{"letra":"B","texto":"Tendencia de personas con mayor riesgo a contratar seguros"},{"letra":"C","texto":"Cancelar pólizas"},{"letra":"D","texto":"Ofrecer descuentos"}]',
   'B',
   'La antiselección o selección adversa es el fenómeno donde las personas que tienen mayor probabilidad de sufrir un siniestro son las más propensas a contratar seguros, lo que puede desequilibrar la cartera de riesgos.',
   v_mod4_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam4_id, '¿Qué documento solicita información detallada sobre el riesgo a asegurar?',
   '[{"letra":"A","texto":"Recibo de pago"},{"letra":"B","texto":"Solicitud de seguro"},{"letra":"C","texto":"Póliza"},{"letra":"D","texto":"Endoso"}]',
   'B',
   'La solicitud de seguro es el documento formal donde el prospectocontestante proporciona toda la información relevante sobre el riesgo que desea asegurar, siendo la base para la evaluación del suscriptor.',
   v_mod4_id, 'basica', 4),

  (gen_random_uuid(), v_exam4_id, '¿Qué es la tarificación en seguros?',
   '[{"letra":"A","texto":"Poner precio a las pólizas"},{"letra":"B","texto":"Proceso de cálculo de la prima adecuada según el riesgo"},{"letra":"C","texto":"Cobrar comisiones"},{"letra":"D","texto":"Fijar descuentos"}]',
   'B',
   'La tarificación es el proceso técnico mediante el cual se calcula la prima adecuada para un riesgo específico, considerando factores de riesgo, estadísticas, siniestralidad y gastos operativos.',
   v_mod4_id, 'intermedia', 5),

  (gen_random_uuid(), v_exam4_id, 'Un solicitante oculta información relevante en su solicitud. ¿Qué puede hacer la aseguradora?',
   '[{"letra":"A","texto":"Nada, debe aceptar siempre"},{"letra":"B","texto":"Rechazar o anular la póliza por reticencia u omisión"},{"letra":"C","texto":"Solo cobrar más caro"},{"letra":"D","texto":"Denunciar penalmente"}]',
   'B',
   'La reticencia u omisión de información importante es causa suficiente para que la aseguradora rechace la solicitud o, si ya se emitió, anule la póliza sin responsabilidad de pagar siniestros.',
   v_mod4_id, 'avanzada', 6),

  (gen_random_uuid(), v_exam4_id, '¿Qué es un agravamiento del riesgo?',
   '[{"letra":"A","texto":"Una mejora del riesgo"},{"letra":"B","texto":"Aumento de la probabilidad de ocurrencia del siniestro"},{"letra":"C","texto":"Reducción de la suma asegurada"},{"letra":"D","texto":"Cancelación de la póliza"}]',
   'B',
   'Un agravamiento del riesgo ocurre cuando aumenta la probabilidad de que ocurra el siniestro cubierto, por cambios en las circunstancias o uso del bien asegurado. El asegurado debe notificarlo.',
   v_mod4_id, 'intermedia', 7),

  (gen_random_uuid(), v_exam4_id, '¿Cuáles son los tres elementos principales que determina el suscriptor?',
   '[{"letra":"A","texto":"Precio, descuento y bonificación"},{"letra":"B","texto":"Aceptación, condiciones y prima"},{"letra":"C","texto":"Cliente, agente y aseguradora"},{"letra":"D","texto":"Cobertura, exclusión y deducible"}]',
   'B',
   'El suscriptor determina: 1) Si acepta o rechaza el riesgo, 2) Las condiciones bajo las cuales lo acepta (coberturas, exclusiones, deducibles), y 3) La prima adecuada.',
   v_mod4_id, 'avanzada', 8),

  (gen_random_uuid(), v_exam4_id, 'En seguros de vida, ¿qué factor NO es relevante para la suscripción?',
   '[{"letra":"A","texto":"Edad del solicitante"},{"letra":"B","texto":"Estado de salud"},{"letra":"C","texto":"Color de ojos"},{"letra":"D","texto":"Ocupación"}]',
   'C',
   'El color de ojos no tiene relevancia actuarial para la suscripción de seguros de vida. Los factores relevantes son edad, salud, ocupación, hábitos y antecedentes médicos familiares.',
   v_mod4_id, 'trampa', 9),

  (gen_random_uuid(), v_exam4_id, '¿Qué implica emitir una póliza con "recargo"?',
   '[{"letra":"A","texto":"Cobrar menos prima"},{"letra":"B","texto":"Prima mayor por riesgo superior al estándar"},{"letra":"C","texto":"Rechazar la solicitud"},{"letra":"D","texto":"Ofrecer descuento"}]',
   'B',
   'Un recargo es un aumento porcentual en la prima estándar que se aplica cuando el riesgo evaluado es mayor al promedio, pero aún es asegurable bajo condiciones especiales.',
   v_mod4_id, 'intermedia', 10);

  -- Create Exam for Module 5: Siniestros y Reclamaciones
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam5_id,
    'Examen de Práctica - Siniestros y Reclamaciones',
    'Evalúa tu comprensión del proceso de manejo de siniestros',
    'practica',
    v_mod5_id,
    20,
    70,
    5,
    'Este examen evalúa tu conocimiento sobre el proceso de atención y resolución de siniestros. Responde todas las preguntas.',
    true
  );

  -- Module 5 Questions
  INSERT INTO cedula_a_preguntas (id, examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (gen_random_uuid(), v_exam5_id, '¿Qué es un siniestro en términos de seguros?',
   '[{"letra":"A","texto":"El pago de la prima"},{"letra":"B","texto":"Ocurrencia del riesgo cubierto que da derecho a indemnización"},{"letra":"C","texto":"La firma de la póliza"},{"letra":"D","texto":"La renovación anual"}]',
   'B',
   'Un siniestro es la materialización del riesgo asegurado que activa la cobertura de la póliza y da derecho al asegurado a recibir la indemnización correspondiente según los términos contratados.',
   v_mod5_id, 'basica', 1),

  (gen_random_uuid(), v_exam5_id, '¿Cuál es el primer paso que debe realizar el asegurado al ocurrir un siniestro?',
   '[{"letra":"A","texto":"Esperar a fin de mes"},{"letra":"B","texto":"Avisar inmediatamente a la aseguradora"},{"letra":"C","texto":"Reparar el daño por su cuenta"},{"letra":"D","texto":"Contratar un abogado"}]',
   'B',
   'El asegurado tiene la obligación de avisar a la aseguradora de manera inmediata sobre la ocurrencia del siniestro, generalmente dentro de las primeras 24 a 48 horas según el tipo de seguro.',
   v_mod5_id, 'basica', 2),

  (gen_random_uuid(), v_exam5_id, '¿Qué documentación básica se requiere para presentar una reclamación?',
   '[{"letra":"A","texto":"Solo la póliza"},{"letra":"B","texto":"Aviso de siniestro, póliza, identificación y documentos probatorios"},{"letra":"C","texto":"Únicamente testigos"},{"letra":"D","texto":"Fotos sin fecha"}]',
   'B',
   'Para una reclamación completa se requiere: aviso de siniestro firmado, copia de la póliza, identificación oficial del asegurado, y todos los documentos que prueben la ocurrencia y magnitud del daño.',
   v_mod5_id, 'intermedia', 3),

  (gen_random_uuid(), v_exam5_id, '¿Qué es el ajustador de seguros?',
   '[{"letra":"A","texto":"El vendedor de pólizas"},{"letra":"B","texto":"Profesional que evalúa daños y determina procedencia de reclamación"},{"letra":"C","texto":"El abogado de la aseguradora"},{"letra":"D","texto":"El contador"}]',
   'B',
   'El ajustador es un profesional certificado que investiga, evalúa y dictamina sobre la procedencia de las reclamaciones, determinando la cuantía de los daños y si están cubiertos por la póliza.',
   v_mod5_id, 'intermedia', 4),

  (gen_random_uuid(), v_exam5_id, '¿Qué es la reserva de siniestros?',
   '[{"letra":"A","texto":"Dinero ahorrado por el cliente"},{"letra":"B","texto":"Monto que la aseguradora aparta para pagar siniestros reportados"},{"letra":"C","texto":"Descuento en la prima"},{"letra":"D","texto":"Comisión del agente"}]',
   'B',
   'La reserva de siniestros es el monto que la aseguradora debe mantener disponible para cumplir con el pago de todos los siniestros reportados pero aún no pagados, según regulación de la CNSF.',
   v_mod5_id, 'avanzada', 5),

  (gen_random_uuid(), v_exam5_id, 'Un asegurado presenta documentación falsa para obtener indemnización. ¿Esto constituye?',
   '[{"letra":"A","texto":"Mala suerte"},{"letra":"B","texto":"Fraude de seguros"},{"letra":"C","texto":"Error administrativo"},{"letra":"D","texto":"Derecho del asegurado"}]',
   'B',
   'Presentar documentación falsa para obtener indemnización es fraude de seguros, un delito penado por la ley que puede resultar en la pérdida total de derechos, acciones legales y responsabilidad penal.',
   v_mod5_id, 'avanzada', 6),

  (gen_random_uuid(), v_exam5_id, '¿Qué debe hacer un agente cuando un cliente le reporta un siniestro?',
   '[{"letra":"A","texto":"Decirle que lo resuelva solo"},{"letra":"B","texto":"Asistir, orientar y reportar inmediatamente a la aseguradora"},{"letra":"C","texto":"Ignorarlo"},{"letra":"D","texto":"Cobrar una comisión extra"}]',
   'B',
   'El agente tiene la obligación ética y profesional de asistir a su cliente, orientarlo en el proceso, ayudarle a reunir documentación y reportar el siniestro de inmediato a la aseguradora.',
   v_mod5_id, 'intermedia', 7),

  (gen_random_uuid(), v_exam5_id, '¿Cuánto tiempo tiene generalmente la aseguradora para resolver una reclamación?',
   '[{"letra":"A","texto":"1 año"},{"letra":"B","texto":"30 días hábiles desde recepción completa de documentos"},{"letra":"C","texto":"No hay plazo"},{"letra":"D","texto":"5 días naturales"}]',
   'B',
   'Según la LISF, las aseguradoras tienen máximo 30 días hábiles para resolver una reclamación una vez que se hayan recibido todos los documentos completos. Pasado este plazo, proceden intereses moratorios.',
   v_mod5_id, 'avanzada', 8),

  (gen_random_uuid(), v_exam5_id, '¿Qué sucede si el asegurado NO avisa oportunamente del siniestro?',
   '[{"letra":"A","texto":"Nada, puede avisar cuando quiera"},{"letra":"B","texto":"La aseguradora puede rechazar o reducir indemnización"},{"letra":"C","texto":"Recibe bonificación"},{"letra":"D","texto":"Se renueva automáticamente"}]',
   'B',
   'El aviso oportuno es una obligación contractual. Si el asegurado no avisa dentro del plazo establecido y esto dificulta la investigación o agrava el daño, la aseguradora puede rechazar o reducir la indemnización.',
   v_mod5_id, 'intermedia', 9),

  (gen_random_uuid(), v_exam5_id, 'El deducible de una póliza es de $5,000 y el daño es de $3,000. ¿Cuánto paga la aseguradora?',
   '[{"letra":"A","texto":"$3,000"},{"letra":"B","texto":"$0 (cero)"},{"letra":"C","texto":"$5,000"},{"letra":"D","texto":"$8,000"}]',
   'B',
   'Si el monto del daño ($3,000) es menor que el deducible ($5,000), la aseguradora no paga nada ya que el deducible es la cantidad que queda a cargo del asegurado en cada siniestro.',
   v_mod5_id, 'trampa', 10);

END $$;