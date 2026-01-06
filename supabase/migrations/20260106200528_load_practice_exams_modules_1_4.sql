/*
  # Practice Exams for Modules 1-4
  
  Each module gets a practice exam with 10 questions covering key topics.
  Mix of difficulty levels: basic, intermediate, advanced, and trap questions.
*/

DO $$
DECLARE
  v_mod1_id uuid;
  v_mod2_id uuid;
  v_mod3_id uuid;
  v_mod4_id uuid;
  v_exam1_id uuid := gen_random_uuid();
  v_exam2_id uuid := gen_random_uuid();
  v_exam3_id uuid := gen_random_uuid();
  v_exam4_id uuid := gen_random_uuid();
BEGIN
  -- Get module IDs
  SELECT id INTO v_mod1_id FROM cedula_a_modulos WHERE orden = 1;
  SELECT id INTO v_mod2_id FROM cedula_a_modulos WHERE orden = 2;
  SELECT id INTO v_mod3_id FROM cedula_a_modulos WHERE orden = 3;
  SELECT id INTO v_mod4_id FROM cedula_a_modulos WHERE orden = 4;

  -- ============================================================================
  -- EXAMEN MÓDULO 1: TEORÍA GENERAL
  -- ============================================================================
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam1_id,
    'Examen de Práctica - Teoría General',
    'Evalúa conceptos fundamentales del seguro',
    'practica',
    v_mod1_id,
    25,
    70,
    1,
    'Este examen cubre los conceptos básicos del seguro. Tómate tu tiempo y lee cada pregunta cuidadosamente.',
    true
  );

  INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden) VALUES
  (v_exam1_id, '¿Qué es el seguro según su definición técnica?', '[{"letra":"A","texto":"Un juego de azar regulado"},{"letra":"B","texto":"Un contrato de transferencia de riesgos"},{"letra":"C","texto":"Una inversión de alto rendimiento"},{"letra":"D","texto":"Un ahorro obligatorio"}]', 'B', 'El seguro es un contrato donde el asegurado transfiere riesgos a la aseguradora a cambio de una prima. No es juego de azar (A), inversión (C) ni ahorro forzoso (D).', v_mod1_id, 'basica', 1),
  (v_exam1_id, '¿Cuál es el nombre correcto del pago que realiza el asegurado?', '[{"letra":"A","texto":"Deducible"},{"letra":"B","texto":"Coaseguro"},{"letra":"C","texto":"Prima"},{"letra":"D","texto":"Indemnización"}]', 'C', 'La PRIMA es el precio del seguro. Deducible es lo que paga en siniestro, coaseguro es porcentaje de participación, indemnización es lo que paga la aseguradora.', v_mod1_id, 'basica', 2),
  (v_exam1_id, '¿En qué año ocurrió el Gran Incendio de Londres?', '[{"letra":"A","texto":"1666"},{"letra":"B","texto":"1750"},{"letra":"C","texto":"1762"},{"letra":"D","texto":"1935"}]', 'A', '1666 es correcto. Este evento impulsó el desarrollo del seguro contra incendios moderno.', v_mod1_id, 'intermedia', 3),
  (v_exam1_id, '¿Qué establece el principio indemnizatorio?', '[{"letra":"A","texto":"El asegurado puede obtener ganancias"},{"letra":"B","texto":"La indemnización no puede superar el daño real"},{"letra":"C","texto":"Se puede asegurar lo que sea"},{"letra":"D","texto":"El asegurador siempre debe pagar"}]', 'B', 'El principio indemnizatorio establece que el seguro resarce daños, no enriquece. La indemnización ≤ daño real.', v_mod1_id, 'intermedia', 4),
  (v_exam1_id, '¿Cuáles son elementos esenciales del contrato de seguro?', '[{"letra":"A","texto":"Solo prima y suma asegurada"},{"letra":"B","texto":"Riesgo, prima e interés asegurable"},{"letra":"C","texto":"Solo el riesgo"},{"letra":"D","texto":"Prima y deducible"}]', 'B', 'Los elementos esenciales son: riesgo, prima, suma asegurada e interés asegurable. Todos son necesarios.', v_mod1_id, 'intermedia', 5),
  (v_exam1_id, 'El seguro de vida ¿aplica el principio indemnizatorio?', '[{"letra":"A","texto":"Sí, siempre"},{"letra":"B","texto":"No, se paga la suma asegurada pactada"},{"letra":"C","texto":"Solo si hay pérdida económica comprobada"},{"letra":"D","texto":"Depende del tipo de muerte"}]', 'B', 'Los seguros de personas NO aplican principio indemnizatorio. Se paga la suma asegurada sin importar costo real. Esta es una excepción importante.', v_mod1_id, 'avanzada', 6),
  (v_exam1_id, '¿Qué tipo de contrato es el seguro por su naturaleza?', '[{"letra":"A","texto":"Unilateral y gratuito"},{"letra":"B","texto":"Bilateral, oneroso y aleatorio"},{"letra":"C","texto":"Unilateral y aleatorio"},{"letra":"D","texto":"Gratuito"}]', 'B', 'El seguro es bilateral (obligaciones mutuas), oneroso (contraprestaciones económicas) y aleatorio (depende de evento incierto).', v_mod1_id, 'avanzada', 7),
  (v_exam1_id, '¿Qué significa SUBROGACIÓN?', '[{"letra":"A","texto":"El asegurado sustituye al asegurador"},{"letra":"B","texto":"Al pagar, el asegurador adquiere derechos del asegurado contra terceros"},{"letra":"C","texto":"Cancelar la póliza"},{"letra":"D","texto":"Aumentar la prima"}]', 'B', 'Subrogación: al indemnizar, el asegurador se subroga (sustituye) en los derechos del asegurado para reclamar a terceros responsables.', v_mod1_id, 'avanzada', 8),
  (v_exam1_id, 'Si hay conflicto entre condiciones generales y particulares, ¿cuáles prevalecen?', '[{"letra":"A","texto":"Las generales"},{"letra":"B","texto":"Las particulares"},{"letra":"C","texto":"Ambas por igual"},{"letra":"D","texto":"Ninguna"}]', 'B', 'Las condiciones PARTICULARES prevalecen sobre las generales. Son específicas del contrato y tienen prioridad.', v_mod1_id, 'trampa', 9),
  (v_exam1_id, '¿Puede una persona asegurar la casa de su vecino sin tener interés en ella?', '[{"letra":"A","texto":"Sí, cualquiera puede asegurar cualquier cosa"},{"letra":"B","texto":"Sí, si el vecino lo autoriza"},{"letra":"C","texto":"No, se requiere interés asegurable"},{"letra":"D","texto":"Solo si paga prima más alta"}]', 'C', 'NO. Se requiere INTERÉS ASEGURABLE. Debes tener relación económica lícita con el bien. Sin interés, el contrato es nulo.', v_mod1_id, 'trampa', 10);

  -- ============================================================================
  -- EXAMEN MÓDULO 2: TIPOS DE SEGUROS
  -- ============================================================================
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam2_id,
    'Examen de Práctica - Tipos de Seguros',
    'Evalúa conocimiento sobre clasificación y coberturas',
    'practica',
    v_mod2_id,
    25,
    70,
    2,
    'Examen sobre tipos de seguros y sus características. Lee cuidadosamente cada opción.',
    true
  );

  INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, modulo_referencia_id, dificultad, orden) VALUES
  (v_exam2_id, '¿Cuál es la diferencia fundamental entre seguros de daños y de personas?', '[{"letra":"A","texto":"El precio"},{"letra":"B","texto":"En daños aplica principio indemnizatorio, en personas no"},{"letra":"C","texto":"Los daños son más caros"},{"letra":"D","texto":"No hay diferencia"}]', 'B', 'Diferencia clave: seguros de DAÑOS aplican principio indemnizatorio (indemnización ≤ daño real). Seguros de PERSONAS pagan suma asegurada pactada.', v_mod2_id, 'basica', 1),
  (v_exam2_id, '¿Qué cobertura es OBLIGATORIA en seguros de auto?', '[{"letra":"A","texto":"Daños materiales"},{"letra":"B","texto":"Robo total"},{"letra":"C","texto":"Responsabilidad Civil"},{"letra":"D","texto":"Cristales"}]', 'C', 'RESPONSABILIDAD CIVIL es obligatoria por ley. Cubre daños a terceros. Mínimo $500,000.', v_mod2_id, 'basica', 2),
  (v_exam2_id, '¿Qué es el DEDUCIBLE?', '[{"letra":"A","texto":"Lo que paga la aseguradora"},{"letra":"B","texto":"Cantidad que paga el asegurado antes de que aseguradora cubra resto"},{"letra":"C","texto":"El total de la prima"},{"letra":"D","texto":"Un descuento"}]', 'B', 'DEDUCIBLE: cantidad o porcentaje que paga el asegurado en siniestro ANTES de que la aseguradora cubra el resto.', v_mod2_id, 'intermedia', 3),
  (v_exam2_id, '¿La cobertura de terremoto está incluida en seguro de incendio básico?', '[{"letra":"A","texto":"Sí, siempre"},{"letra":"B","texto":"No, es cobertura adicional"},{"letra":"C","texto":"Solo en zona sísmica"},{"letra":"D","texto":"Depende de la aseguradora"}]', 'B', 'NO. Terremoto NO está en cobertura básica de incendio. Es ADICIONAL. Esta es pregunta frecuente.', v_mod2_id, 'intermedia', 4),
  (v_exam2_id, 'En GMM, ¿qué son las PREEXISTENCIAS?', '[{"letra":"A","texto":"Enfermedades futuras"},{"letra":"B","texto":"Padecimientos existentes antes de contratar"},{"letra":"C","texto":"Medicamentos caros"},{"letra":"D","texto":"Hospitales preferidos"}]', 'B', 'PREEXISTENCIAS: enfermedades o padecimientos que existían ANTES de contratar el seguro. Generalmente están EXCLUIDAS.', v_mod2_id, 'intermedia', 5),
  (v_exam2_id, '¿Qué tipo de seguro de vida tiene componente de ahorro?', '[{"letra":"A","texto":"Vida temporal"},{"letra":"B","texto":"Vida ordinario"},{"letra":"C","texto":"Vida dotal"},{"letra":"D","texto":"Accidentes personales"}]', 'C', 'VIDA DOTAL combina protección (seguro) + ahorro. Si sobrevive al período, recibe suma más ahorro acumulado.', v_mod2_id, 'avanzada', 6),
  (v_exam2_id, 'Auto con valor $200,000, deducible 5%, daños $30,000. ¿Cuánto paga aseguradora?', '[{"letra":"A","texto":"$30,000"},{"letra":"B","texto":"$28,500"},{"letra":"C","texto":"$10,000"},{"letra":"D","texto":"$20,000"}]', 'B', 'Deducible = 5% de $30,000 = $1,500. Asegurado paga $1,500. Aseguradora paga $30,000 - $1,500 = $28,500.', v_mod2_id, 'avanzada', 7),
  (v_exam2_id, '¿Responsabilidad Civil cubre daños intencionales del asegurado?', '[{"letra":"A","texto":"Sí, siempre"},{"letra":"B","texto":"No, solo daños involuntarios"},{"letra":"C","texto":"Solo si paga extra"},{"letra":"D","texto":"Depende del monto"}]', 'B', 'NO. RC solo cubre daños INVOLUNTARIOS a terceros. Actos dolosos o intencionales están EXCLUIDOS. Pregunta trampa común.', v_mod2_id, 'trampa', 8),
  (v_exam2_id, 'Persona con suma asegurada vida $1,000,000 fallece. Gastos funerarios $50,000. ¿Cuánto pagan?', '[{"letra":"A","texto":"$50,000"},{"letra":"B","texto":"$1,000,000"},{"letra":"C","texto":"$950,000"},{"letra":"D","texto":"$1,050,000"}]', 'B', '$1,000,000. En seguros de personas se paga suma asegurada COMPLETA sin considerar gastos reales. NO aplica principio indemnizatorio.', v_mod2_id, 'trampa', 9),
  (v_exam2_id, '¿El período de espera en GMM aplica para accidentes?', '[{"letra":"A","texto":"Sí, siempre"},{"letra":"B","texto":"No, solo para enfermedades"},{"letra":"C","texto":"Solo si es grave"},{"letra":"D","texto":"Sí, 30 días"}]', 'B', 'NO. Período de espera generalmente aplica solo para ENFERMEDADES. Accidentes están cubiertos desde inicio. Esta diferencia es importante.', v_mod2_id, 'trampa', 10);

  -- Continuaré con módulos 3 y 4...

END $$;
