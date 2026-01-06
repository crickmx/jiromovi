/*
  # Load Sample Data for Cédula A Course

  ## Sample Content
  - 1 Module: "Introducción a los Seguros"
  - 3 Lessons with structured content
  - 1 Practice exam with 10 questions
  - Glossary terms
  - Mental map structure

  This provides a working example for testing and demonstration.
*/

-- Insert sample module
DO $$
DECLARE
  v_modulo_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_leccion1_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  v_leccion2_id uuid := 'b0000000-0000-0000-0000-000000000002'::uuid;
  v_leccion3_id uuid := 'b0000000-0000-0000-0000-000000000003'::uuid;
  v_examen_id uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Insert sample module
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_modulo_id,
    'Introducción a los Seguros',
    'Conoce los conceptos fundamentales del seguro, su historia y principios básicos que rigen la actividad aseguradora.',
    1,
    'BookOpen',
    'Este módulo te introducirá al fascinante mundo de los seguros. Aprenderás sobre su origen, evolución y los principios fundamentales que lo sustentan.',
    90
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert sample lessons
  INSERT INTO cedula_a_lecciones (id, modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
  VALUES
  (
    v_leccion1_id,
    v_modulo_id,
    '¿Qué es el Seguro?',
    '{"sections":[{"type":"titulo","content":"Concepto de Seguro"},{"type":"parrafo","content":"El seguro es un contrato mediante el cual una persona (asegurado) transfiere a una institución especializada (aseguradora) determinados riesgos, a cambio del pago de una cantidad de dinero llamada prima."},{"type":"definicion","content":"Seguro: Contrato por el cual una parte (asegurador) se obliga, mediante una prima, a resarcir de un daño o a pagar una suma de dinero al verificarse la eventualidad prevista en el contrato."},{"type":"ejemplo","content":"Juan contrata un seguro de auto. Paga $5,000 al año (prima) y si sufre un accidente, la aseguradora cubre los daños hasta $500,000 (suma asegurada)."},{"type":"lista","content":"Elementos esenciales del contrato de seguro:","items":["Riesgo: Evento incierto cuya realización no depende de la voluntad de las partes","Prima: Precio del seguro que paga el asegurado","Suma asegurada: Cantidad máxima que pagará el asegurador","Interés asegurable: Relación económica entre el asegurado y el bien protegido"]},{"type":"alerta","content":"Para el examen: Recuerda que el seguro NO es un juego de azar, sino un mecanismo técnico de protección basado en cálculos actuariales y la ley de los grandes números."}]}',
    1,
    30
  ),
  (
    v_leccion2_id,
    v_modulo_id,
    'Historia del Seguro',
    '{"sections":[{"type":"titulo","content":"Evolución Histórica del Seguro"},{"type":"parrafo","content":"Los seguros tienen una larga historia que se remonta a las antiguas civilizaciones. Los primeros indicios de seguros se encuentran en el Código de Hammurabi (1750 a.C.) donde se establecían normas sobre préstamos marítimos."},{"type":"lista","content":"Hitos importantes en la historia del seguro:","items":["1347: Primera póliza de seguro marítimo en Génova","1666: Gran incendio de Londres impulsa el seguro contra incendios","1762: Se funda la primera compañía de seguros de vida moderna","1935: Se crea la Ley del Contrato de Seguro en México"]},{"type":"caso_practico","content":"El Gran Incendio de Londres de 1666 destruyó más de 13,000 casas. Este evento catastrófico llevó a la creación de las primeras compañías especializadas en seguro contra incendios, dando origen al seguro moderno tal como lo conocemos."}]}',
    2,
    25
  ),
  (
    v_leccion3_id,
    v_modulo_id,
    'Principios Técnicos del Seguro',
    '{"sections":[{"type":"titulo","content":"Principios Fundamentales"},{"type":"parrafo","content":"El seguro se basa en principios técnicos y jurídicos que garantizan su viabilidad y equidad. Estos principios son esenciales para entender cómo funciona el sistema asegurador."},{"type":"definicion","content":"Principio Indemnizatorio: El seguro busca resarcir el daño sufrido, no enriquecer al asegurado. La indemnización no puede ser mayor al daño real."},{"type":"definicion","content":"Buena Fe: Ambas partes deben actuar con honestidad. El asegurado debe declarar todos los hechos relevantes, y el asegurador debe cumplir sus obligaciones."},{"type":"lista","content":"Otros principios importantes:","items":["Interés asegurable: Debe existir una relación económica entre el asegurado y el bien","Subrogación: El asegurador adquiere los derechos del asegurado contra terceros responsables","Contribución: Si hay varios seguros sobre el mismo riesgo, todos contribuyen proporcionalmente","Causa próxima: Se indemniza el daño causado directamente por el riesgo cubierto"]},{"type":"alerta","content":"Importante para el examen: El principio indemnizatorio impide que el asegurado obtenga un beneficio económico del siniestro. Esta es una pregunta frecuente en el examen de Cédula A."}]}',
    3,
    35
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert practice exam
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_examen_id,
    'Examen de Práctica - Módulo 1',
    'Evalúa tus conocimientos sobre los conceptos básicos del seguro',
    'practica',
    v_modulo_id,
    20,
    70,
    1,
    'Este examen de práctica te ayudará a evaluar tu comprensión del módulo. No hay límite de tiempo estricto, tómate el tiempo que necesites. Puedes intentarlo las veces que quieras.',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert sample questions
  INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden)
  VALUES
  (
    v_examen_id,
    '¿Qué es el seguro según la definición técnica?',
    '[{"letra":"A","texto":"Un juego de azar donde se apuesta dinero"},{"letra":"B","texto":"Un contrato mediante el cual se transfieren riesgos a cambio de una prima"},{"letra":"C","texto":"Una inversión financiera de alto rendimiento"},{"letra":"D","texto":"Un ahorro forzoso para el retiro"}]',
    'B',
    'El seguro es un contrato de transferencia de riesgos. La opción B es correcta porque define correctamente el seguro como un mecanismo de protección donde el asegurado transfiere ciertos riesgos a la aseguradora a cambio del pago de una prima.',
    v_modulo_id,
    'basica',
    1
  ),
  (
    v_examen_id,
    '¿Cuál es el nombre del pago que realiza el asegurado a la aseguradora?',
    '[{"letra":"A","texto":"Deducible"},{"letra":"B","texto":"Coaseguro"},{"letra":"C","texto":"Prima"},{"letra":"D","texto":"Indemnización"}]',
    'C',
    'La prima es el precio del seguro, la cantidad que paga el asegurado a la aseguradora por la cobertura. El deducible es la parte que paga el asegurado en caso de siniestro.',
    v_modulo_id,
    'basica',
    2
  ),
  (
    v_examen_id,
    '¿En qué año ocurrió el Gran Incendio de Londres que impulsó el desarrollo del seguro contra incendios?',
    '[{"letra":"A","texto":"1666"},{"letra":"B","texto":"1750"},{"letra":"C","texto":"1762"},{"letra":"D","texto":"1935"}]',
    'A',
    '1666 es el año correcto. El Gran Incendio de Londres fue un evento catastrófico que destruyó gran parte de la ciudad y motivó la creación de las primeras compañías de seguro contra incendios.',
    v_modulo_id,
    'intermedia',
    3
  ),
  (
    v_examen_id,
    '¿Qué establece el principio indemnizatorio?',
    '[{"letra":"A","texto":"El asegurado puede obtener ganancias del siniestro"},{"letra":"B","texto":"La indemnización no puede ser mayor al daño real sufrido"},{"letra":"C","texto":"El asegurador puede negarse a pagar sin causa justificada"},{"letra":"D","texto":"El asegurado debe pagar una prima más alta después de un siniestro"}]',
    'B',
    'El principio indemnizatorio es fundamental en el seguro y establece que el objetivo es resarcir el daño, no enriquecer al asegurado.',
    v_modulo_id,
    'intermedia',
    4
  ),
  (
    v_examen_id,
    '¿Cuál de los siguientes es un elemento esencial del contrato de seguro?',
    '[{"letra":"A","texto":"Riesgo"},{"letra":"B","texto":"Prima"},{"letra":"C","texto":"Interés asegurable"},{"letra":"D","texto":"Todas las anteriores"}]',
    'D',
    'Todos los elementos mencionados son esenciales en un contrato de seguro: el riesgo, la prima, y el interés asegurable.',
    v_modulo_id,
    'intermedia',
    5
  );

  -- Insert glossary terms
  INSERT INTO cedula_a_glosario (termino, definicion, ejemplo, modulo_id)
  VALUES
  ('Prima', 'Cantidad de dinero que el asegurado paga a la aseguradora como contraprestación por la cobertura del riesgo.', 'Si contratas un seguro de auto, la prima anual podría ser de $10,000.', v_modulo_id),
  ('Suma Asegurada', 'Monto máximo que la aseguradora se compromete a pagar en caso de siniestro.', 'En un seguro de vida con suma asegurada de $1,000,000, esa es la cantidad máxima a pagar.', v_modulo_id),
  ('Deducible', 'Cantidad que el asegurado debe pagar de su bolsillo antes de que la aseguradora cubra el resto.', 'Con deducible de $5,000 y daños de $20,000, pagas $5,000 y la aseguradora $15,000.', v_modulo_id),
  ('Siniestro', 'Ocurrencia del evento previsto en la póliza que da lugar a la indemnización.', 'Un choque de auto o un robo son ejemplos de siniestros.', v_modulo_id),
  ('Póliza', 'Documento que contiene las condiciones del contrato de seguro.', 'La póliza detalla coberturas, exclusiones, prima y obligaciones.', v_modulo_id);

  -- Insert mental map
  INSERT INTO cedula_a_mapas_mentales (titulo, modulo_id, contenido_estructura, orden, descripcion)
  VALUES (
    'Conceptos Fundamentales del Seguro',
    v_modulo_id,
    '{"id":"root","texto":"El Seguro","nivel":0,"color":"#0E23E2","hijos":[{"id":"concepto","texto":"Concepto","nivel":1,"color":"#4A5FF0","hijos":[{"id":"definicion","texto":"Contrato de transferencia de riesgos","nivel":2},{"id":"partes","texto":"Asegurador y Asegurado","nivel":2}]},{"id":"elementos","texto":"Elementos Esenciales","nivel":1,"color":"#34C759","hijos":[{"id":"riesgo","texto":"Riesgo","nivel":2},{"id":"prima","texto":"Prima","nivel":2},{"id":"suma","texto":"Suma Asegurada","nivel":2},{"id":"interes","texto":"Interés Asegurable","nivel":2}]},{"id":"principios","texto":"Principios Técnicos","nivel":1,"color":"#FF9500","hijos":[{"id":"indemnizatorio","texto":"Indemnizatorio","nivel":2},{"id":"buenafe","texto":"Buena Fe","nivel":2},{"id":"subrogacion","texto":"Subrogación","nivel":2},{"id":"contribucion","texto":"Contribución","nivel":2}]}]}',
    1,
    'Mapa conceptual de los elementos y principios fundamentales del seguro'
  );
END $$;
