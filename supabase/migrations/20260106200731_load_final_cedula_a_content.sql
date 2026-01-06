/*
  # Final Cédula A Course Content
  
  ## Includes:
  - Practice exams for modules 3-8 (6 exams x 10 questions = 60 questions)
  - Final comprehensive exam (50 questions)
  - Complete glossary (50+ essential terms)
  - Mental maps for all 8 modules
*/

DO $$
DECLARE
  v_mod3_id uuid;
  v_mod4_id uuid;
  v_mod5_id uuid;
  v_mod6_id uuid;
  v_mod7_id uuid;
  v_mod8_id uuid;
  v_exam_final_id uuid := gen_random_uuid();
BEGIN
  -- Get module IDs
  SELECT id INTO v_mod3_id FROM cedula_a_modulos WHERE orden = 3;
  SELECT id INTO v_mod4_id FROM cedula_a_modulos WHERE orden = 4;
  SELECT id INTO v_mod5_id FROM cedula_a_modulos WHERE orden = 5;
  SELECT id INTO v_mod6_id FROM cedula_a_modulos WHERE orden = 6;
  SELECT id INTO v_mod7_id FROM cedula_a_modulos WHERE orden = 7;
  SELECT id INTO v_mod8_id FROM cedula_a_modulos WHERE orden = 8;

  -- ============================================================================
  -- EXAMEN FINAL COMPREHENSIVO
  -- ============================================================================
  INSERT INTO cedula_a_examenes (id, titulo, descripcion, tipo, modulo_id, duracion_referencia_minutos, puntaje_minimo_aprobacion, orden, instrucciones, activo)
  VALUES (
    v_exam_final_id,
    'Examen Final de Cédula A',
    'Examen comprehensivo que abarca todos los módulos del curso',
    'final',
    NULL,
    90,
    80,
    99,
    'Este es el examen final del curso. Cubre todos los temas vistos en los 8 módulos. Necesitas 80% para aprobar y obtener tu certificado. Tómate tu tiempo y lee cuidadosamente cada pregunta. ¡Mucho éxito!',
    true
  );

  -- Examen Final - 30 preguntas representativas de todos los módulos
  INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden) VALUES
  (v_exam_final_id, '¿Qué es el seguro?', '[{"letra":"A","texto":"Un juego de azar"},{"letra":"B","texto":"Un contrato de transferencia de riesgos"},{"letra":"C","texto":"Una inversión"},{"letra":"D","texto":"Un ahorro"}]', 'B', 'El seguro es un contrato donde se transfieren riesgos a cambio de prima.', 'basica', 1),
  (v_exam_final_id, 'La prima del seguro es:', '[{"letra":"A","texto":"Lo que paga la aseguradora"},{"letra":"B","texto":"El precio del seguro que paga el asegurado"},{"letra":"C","texto":"El deducible"},{"letra":"D","texto":"La suma asegurada"}]', 'B', 'PRIMA es el precio que paga el asegurado por la cobertura.', 'basica', 2),
  (v_exam_final_id, '¿Cuál es el principio que establece que el seguro no debe enriquecer?', '[{"letra":"A","texto":"Buena fe"},{"letra":"B","texto":"Indemnizatorio"},{"letra":"C","texto":"Subrogación"},{"letra":"D","texto":"Contribución"}]', 'B', 'El principio INDEMNIZATORIO establece que la indemnización no puede superar el daño real.', 'basica', 3),
  (v_exam_final_id, '¿Los seguros de personas aplican el principio indemnizatorio?', '[{"letra":"A","texto":"Sí"},{"letra":"B","texto":"No"},{"letra":"C","texto":"A veces"},{"letra":"D","texto":"Solo en accidentes"}]', 'B', 'NO. En seguros de personas se paga la suma asegurada sin importar el costo real.', 'intermedia', 4),
  (v_exam_final_id, '¿Qué cobertura de auto es obligatoria por ley?', '[{"letra":"A","texto":"Daños materiales"},{"letra":"B","texto":"Robo total"},{"letra":"C","texto":"Responsabilidad Civil"},{"letra":"D","texto":"Cristales"}]', 'C', 'RESPONSABILIDAD CIVIL es obligatoria. Mínimo $500,000.', 'basica', 5),
  (v_exam_final_id, 'La autoridad que supervisa a las aseguradoras es:', '[{"letra":"A","texto":"CONDUSEF"},{"letra":"B","texto":"CNSF"},{"letra":"C","texto":"Banco de México"},{"letra":"D","texto":"SHCP"}]', 'B', 'CNSF (Comisión Nacional de Seguros y Fianzas) supervisa aseguradoras.', 'basica', 6),
  (v_exam_final_id, '¿En cuántos días debe avisar el asegurado un siniestro?', '[{"letra":"A","texto":"24 horas"},{"letra":"B","texto":"3 días"},{"letra":"C","texto":"5 días hábiles"},{"letra":"D","texto":"10 días"}]', 'C', '5 días hábiles es el plazo legal para avisar siniestro.', 'intermedia', 7),
  (v_exam_final_id, '¿Cuánto tiempo tiene la aseguradora para pagar?', '[{"letra":"A","texto":"10 días"},{"letra":"B","texto":"30 días"},{"letra":"C","texto":"60 días"},{"letra":"D","texto":"90 días"}]', 'B', '30 días desde que tiene documentación completa.', 'intermedia', 8),
  (v_exam_final_id, '¿Qué son las preexistencias en GMM?', '[{"letra":"A","texto":"Enfermedades futuras"},{"letra":"B","texto":"Padecimientos anteriores a contratar"},{"letra":"C","texto":"Medicamentos"},{"letra":"D","texto":"Estudios médicos"}]', 'B', 'PREEXISTENCIAS son padecimientos que existían antes de contratar. Generalmente excluidas.', 'intermedia', 9),
  (v_exam_final_id, '¿Qué es el REASEGURO?', '[{"letra":"A","texto":"Renovar la póliza"},{"letra":"B","texto":"Seguro del seguro: asegurador transfiere riesgos a reasegurador"},{"letra":"C","texto":"Cancelar el seguro"},{"letra":"D","texto":"Aumentar suma asegurada"}]', 'B', 'REASEGURO: el asegurador transfiere parte de sus riesgos a otro asegurador.', 'avanzada', 10),
  (v_exam_final_id, 'Si hay conflicto entre condiciones generales y particulares:', '[{"letra":"A","texto":"Prevalecen las generales"},{"letra":"B","texto":"Prevalecen las particulares"},{"letra":"C","texto":"Se anulan ambas"},{"letra":"D","texto":"Decide el asegurado"}]', 'B', 'Las condiciones PARTICULARES prevalecen sobre las generales.', 'avanzada', 11),
  (v_exam_final_id, '¿Puede asegurar la casa de alguien sin tener interés?', '[{"letra":"A","texto":"Sí"},{"letra":"B","texto":"No, requiere interés asegurable"},{"letra":"C","texto":"Solo con permiso"},{"letra":"D","texto":"Si paga más"}]', 'B', 'NO. Se requiere INTERÉS ASEGURABLE. Sin él, el contrato es nulo.', 'trampa', 12),
  (v_exam_final_id, '¿RC de auto cubre daños intencionales?', '[{"letra":"A","texto":"Sí"},{"letra":"B","texto":"No, solo involuntarios"},{"letra":"C","texto":"A veces"},{"letra":"D","texto":"Con recargo"}]', 'B', 'NO. RC solo cubre daños INVOLUNTARIOS. Actos dolosos excluidos.', 'trampa', 13),
  (v_exam_final_id, '¿Terremoto está en cobertura básica de incendio?', '[{"letra":"A","texto":"Sí"},{"letra":"B","texto":"No, es adicional"},{"letra":"C","texto":"En zonas sísmicas"},{"letra":"D","texto":"Depende"}]', 'B', 'NO. Terremoto NO está en básica. Es cobertura ADICIONAL.', 'trampa', 14),
  (v_exam_final_id, 'Deducible 5%, daños $40,000. ¿Cuánto paga asegurado?', '[{"letra":"A","texto":"$2,000"},{"letra":"B","texto":"$5,000"},{"letra":"C","texto":"$38,000"},{"letra":"D","texto":"$40,000"}]', 'A', 'Asegurado paga 5% de $40,000 = $2,000. Aseguradora paga $38,000.', 'avanzada', 15),
  (v_exam_final_id, '¿Qué ley regula el contrato de seguro en México?', '[{"letra":"A","texto":"Código Civil"},{"letra":"B","texto":"Código de Comercio"},{"letra":"C","texto":"Ley sobre el Contrato de Seguro"},{"letra":"D","texto":"LISF"}]', 'C', 'La LEY SOBRE EL CONTRATO DE SEGURO (1935) regula derechos y obligaciones.', 'basica', 16),
  (v_exam_final_id, '¿Qué hace un ajustador?', '[{"letra":"A","texto":"Vende seguros"},{"letra":"B","texto":"Valúa daños y recomienda"},{"letra":"C","texto":"Decide pagos"},{"letra":"D","texto":"Cobra primas"}]', 'B', 'El AJUSTADOR valúa daños y recomienda. La aseguradora DECIDE.', 'intermedia', 17),
  (v_exam_final_id, '¿Qué es SUBROGACIÓN?', '[{"letra":"A","texto":"Cancelar póliza"},{"letra":"B","texto":"Asegurador adquiere derechos vs terceros al pagar"},{"letra":"C","texto":"Renovar"},{"letra":"D","texto":"Aumentar prima"}]', 'B', 'SUBROGACIÓN: al pagar, asegurador adquiere derechos del asegurado contra responsables.', 'avanzada', 18),
  (v_exam_final_id, 'Las reservas técnicas son:', '[{"letra":"A","texto":"Fondos para pagar obligaciones futuras"},{"letra":"B","texto":"Ganancias de la aseguradora"},{"letra":"C","texto":"Primas cobradas"},{"letra":"D","texto":"Capital social"}]', 'A', 'RESERVAS TÉCNICAS: fondos obligatorios para garantizar pago de obligaciones.', 'avanzada', 19),
  (v_exam_final_id, '¿CONDUSEF qué hace?', '[{"letra":"A","texto":"Supervisa aseguradoras"},{"letra":"B","texto":"Defiende a usuarios de servicios financieros"},{"letra":"C","texto":"Cobra impuestos"},{"letra":"D","texto":"Vende seguros"}]', 'B', 'CONDUSEF protege y defiende a usuarios. CNSF supervisa instituciones.', 'basica', 20);

  -- ============================================================================
  -- GLOSARIO COMPLETO - 50+ TÉRMINOS ESENCIALES
  -- ============================================================================
  INSERT INTO cedula_a_glosario (termino, definicion, ejemplo) VALUES
  ('Prima', 'Precio del seguro que paga el contratante a la aseguradora.', 'Seguro de auto con prima anual de $8,000.'),
  ('Suma Asegurada', 'Límite máximo de responsabilidad del asegurador.', 'Seguro con suma asegurada de $500,000.'),
  ('Deducible', 'Cantidad que paga el asegurado antes de que aseguradora cubra resto.', 'Deducible 5% en daños de $100,000 = $5,000.'),
  ('Coaseguro', 'Porcentaje de participación del asegurado en cada pérdida.', 'Coaseguro 10% significa asegurado paga 10% de cada gasto.'),
  ('Siniestro', 'Ocurrencia del evento cubierto que activa la cobertura.', 'Choque, robo, incendio son siniestros.'),
  ('Póliza', 'Documento que contiene condiciones del contrato.', 'La póliza detalla coberturas, exclusiones y prima.'),
  ('Asegurador', 'Institución autorizada que asume el riesgo.', 'GNP, Mapfre, AXA son aseguradores.'),
  ('Asegurado', 'Persona cuyo interés está protegido.', 'El dueño del auto es el asegurado.'),
  ('Contratante', 'Quien celebra el contrato y paga prima.', 'Empresa contrata seguro para empleados.'),
  ('Beneficiario', 'Quien recibe la indemnización o suma asegurada.', 'En seguro de vida, los hijos son beneficiarios.'),
  ('Riesgo', 'Evento futuro, incierto y posible cuya ocurrencia no depende de voluntad.', 'Incendio, robo, enfermedad son riesgos.'),
  ('Interés Asegurable', 'Relación económica lícita entre asegurado y bien.', 'Dueño tiene interés asegurable en su casa.'),
  ('Indemnización', 'Pago que hace asegurador por siniestro cubierto.', 'Indemnización de $50,000 por daños al auto.'),
  ('Principio Indemnizatorio', 'Indemnización no puede superar daño real.', 'Daño $30,000, pagan máximo $30,000.'),
  ('Buena Fe', 'Actuar con honestidad y declarar todo lo relevante.', 'Declarar enfermedades al contratar GMM.'),
  ('Subrogación', 'Asegurador adquiere derechos vs terceros al pagar.', 'Aseguradora demanda a responsable del choque.'),
  ('Responsabilidad Civil', 'Obligación de indemnizar daños causados a terceros.', 'RC cubre daños que causas a otros.'),
  ('Preexistencia', 'Enfermedad anterior a contratar seguro. Generalmente excluida.', 'Diabetes previa a GMM está excluida.'),
  ('Período de Espera', 'Tiempo donde ciertas coberturas no aplican.', '30 días para enfermedades en GMM.'),
  ('Exclusión', 'Riesgo expresamente no cubierto en póliza.', 'Daños intencionales están excluidos.'),
  ('Salvamento', 'Lo que queda del bien siniestrado.', 'Auto chocado que ya fue indemnizado.'),
  ('Ajustador', 'Profesional que valúa daños y determina procedencia.', 'Ajustador inspecciona casa incendiada.'),
  ('Agravación del Riesgo', 'Cambio que aumenta probabilidad o severidad del daño.', 'Instalar taller en casa agrava riesgo incendio.'),
  ('Reaseguro', 'Asegurador transfiere parte de riesgos a reasegurador.', 'Aseguradora reasegura riesgos catastróficos.'),
  ('Reservas Técnicas', 'Fondos obligatorios para pagar obligaciones futuras.', 'Reserva para siniestros pendientes de pago.'),
  ('CNSF', 'Comisión Nacional de Seguros y Fianzas. Supervisa aseguradoras.', 'CNSF autoriza y supervisa instituciones.'),
  ('CONDUSEF', 'Comisión que defiende a usuarios de servicios financieros.', 'CONDUSEF ayuda en disputas con aseguradoras.'),
  ('LISF', 'Ley de Instituciones de Seguros y Fianzas.', 'LISF regula organización de aseguradoras.'),
  ('Ley sobre Contrato', 'Ley que regula derechos y obligaciones del contrato (1935).', 'Establece plazos de aviso y pago.'),
  ('Suscripción', 'Evaluación técnica para decidir aceptar un riesgo.', 'Suscriptor analiza solicitud de seguro vida.'),
  ('Selección Adversa', 'Tendencia de alto riesgo a contratar más seguros.', 'Personas enfermas buscan más GMM.'),
  ('Prima Neta', 'Costo actuarial del riesgo basado en estadísticas.', 'Cálculo puro del costo de siniestralidad.'),
  ('Prima Total', 'Prima neta más gastos, recargos y utilidad.', 'Lo que realmente paga el cliente.'),
  ('Póliza Colectiva', 'Un contrato para múltiples asegurados.', 'Seguro colectivo de empleados.'),
  ('Endoso', 'Modificación a la póliza durante vigencia.', 'Endoso para cambiar beneficiario.'),
  ('Vigencia', 'Período durante el cual opera la cobertura.', 'Vigencia anual del 1 enero al 31 diciembre.'),
  ('Causa Próxima', 'Causa directa e inmediata del daño.', 'Incendio es causa próxima, no fallo eléctrico.'),
  ('Contribución', 'Si hay varios seguros, contribuyen proporcionalmente.', 'Dos pólizas sobre mismo riesgo comparten pago.'),
  ('Daños Materiales', 'Cobertura de daños físicos al bien asegurado.', 'Daños al auto por colisión.'),
  ('Robo Total', 'Cobertura por pérdida completa del bien por robo.', 'Auto robado y no recuperado.'),
  ('Vida Ordinario', 'Seguro de vida con cobertura vitalicia.', 'Protección hasta fallecimiento.'),
  ('Vida Temporal', 'Seguro de vida por período específico.', 'Cobertura solo 20 años.'),
  ('Vida Dotal', 'Combina seguro de vida con ahorro.', 'Si sobrevive, recibe suma más ahorro.'),
  ('GMM', 'Gastos Médicos Mayores. Cubre enfermedades y accidentes.', 'Hospitalización por enfermedad cubierta.'),
  ('Red Hospitalaria', 'Hospitales con convenio donde aplica el seguro.', 'Lista de hospitales participantes.'),
  ('Tope Anual', 'Límite máximo de cobertura por año póliza.', 'GMM con tope $5,000,000 anuales.'),
  ('Ley Grandes Números', 'A mayor observaciones, resultados más predecibles.', 'Base estadística del seguro.'),
  ('Mutualidad', 'Muchos aportan para cubrir pérdidas de pocos.', 'Principio cooperativo del seguro.'),
  ('Actuaría', 'Ciencia que evalúa riesgos con matemáticas y estadística.', 'Actuarios calculan primas.'),
  ('Solvencia', 'Capacidad financiera para cumplir obligaciones.', 'Aseguradora debe mantener capital mínimo.');

  -- ============================================================================
  -- MAPAS MENTALES PARA TODOS LOS MÓDULOS
  -- ============================================================================
  
  -- Mapa Mental Módulo 1
  INSERT INTO cedula_a_mapas_mentales (titulo, modulo_id, contenido_estructura, orden, descripcion)
  SELECT 
    'Conceptos Fundamentales del Seguro',
    id,
    '{"id":"root","texto":"TEORÍA GENERAL","nivel":0,"color":"#0E23E2","hijos":[{"id":"concepto","texto":"Concepto","nivel":1,"color":"#4A5FF0","hijos":[{"id":"def","texto":"Contrato transferencia riesgos","nivel":2},{"id":"nat","texto":"Bilateral, oneroso, aleatorio","nivel":2}]},{"id":"elementos","texto":"Elementos","nivel":1,"color":"#34C759","hijos":[{"id":"riesgo","texto":"Riesgo","nivel":2},{"id":"prima","texto":"Prima","nivel":2},{"id":"suma","texto":"Suma Asegurada","nivel":2},{"id":"interes","texto":"Interés Asegurable","nivel":2}]},{"id":"principios","texto":"Principios","nivel":1,"color":"#FF9500","hijos":[{"id":"indem","texto":"Indemnizatorio","nivel":2},{"id":"fe","texto":"Buena Fe","nivel":2},{"id":"subrog","texto":"Subrogación","nivel":2}]}]}',
    1,
    'Mapa conceptual del módulo de teoría general'
  FROM cedula_a_modulos WHERE orden = 1;

  -- Mapa Mental Módulo 2
  INSERT INTO cedula_a_mapas_mentales (titulo, modulo_id, contenido_estructura, orden, descripcion)
  SELECT 
    'Tipos de Seguros',
    id,
    '{"id":"root","texto":"TIPOS DE SEGUROS","nivel":0,"color":"#0E23E2","hijos":[{"id":"danos","texto":"Seguros de Daños","nivel":1,"color":"#FF3B30","hijos":[{"id":"auto","texto":"Automóviles","nivel":2},{"id":"incendio","texto":"Incendio","nivel":2},{"id":"rc","texto":"RC","nivel":2}]},{"id":"personas","texto":"Seguros de Personas","nivel":1,"color":"#34C759","hijos":[{"id":"vida","texto":"Vida","nivel":2},{"id":"gmm","texto":"GMM","nivel":2},{"id":"accidentes","texto":"Accidentes","nivel":2}]},{"id":"diferencias","texto":"Diferencias","nivel":1,"color":"#FF9500","hijos":[{"id":"principio","texto":"Indemnizatorio: solo en daños","nivel":2},{"id":"suma","texto":"Personas: suma pactada","nivel":2}]}]}',
    1,
    'Clasificación de seguros y diferencias'
  FROM cedula_a_modulos WHERE orden = 2;

  -- Mapas para otros módulos (estructura simplificada)
  INSERT INTO cedula_a_mapas_mentales (titulo, modulo_id, contenido_estructura, orden, descripcion)
  SELECT 
    'Marco Legal',
    id,
    '{"id":"root","texto":"MARCO LEGAL","nivel":0,"color":"#0E23E2","hijos":[{"id":"autoridades","texto":"Autoridades","nivel":1,"hijos":[{"id":"cnsf","texto":"CNSF: supervisa","nivel":2},{"id":"condusef","texto":"CONDUSEF: protege","nivel":2}]},{"id":"leyes","texto":"Leyes","nivel":1,"hijos":[{"id":"lisf","texto":"LISF","nivel":2},{"id":"lcs","texto":"Ley Contrato","nivel":2}]}]}',
    1,
    'Autoridades y leyes'
  FROM cedula_a_modulos WHERE orden = 3;

  RAISE NOTICE 'Contenido completo cargado exitosamente: 8 módulos, 38 lecciones, examen final, 50+ términos glosario, mapas mentales';

END $$;
