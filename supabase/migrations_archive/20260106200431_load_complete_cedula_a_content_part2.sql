/*
  # Complete Cédula A Course Content - Part 2
  
  ## Modules 5-8 with All Lessons
  This migration loads the second half of the complete course content.
*/

DO $$
DECLARE
  v_mod5_id uuid := gen_random_uuid();
  v_mod6_id uuid := gen_random_uuid();
  v_mod7_id uuid := gen_random_uuid();
  v_mod8_id uuid := gen_random_uuid();
BEGIN

  -- ============================================================================
  -- MÓDULO 5: SINIESTROS Y RECLAMACIONES
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod5_id,
    'Siniestros y Reclamaciones',
    'Procedimiento de reclamación, ajuste de pérdidas, documentación requerida y pago de indemnizaciones.',
    5,
    'AlertTriangle',
    'Entiende el proceso completo: desde la ocurrencia del siniestro hasta el pago de la indemnización.',
    120
  );

  -- Módulo 5 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod5_id, 'Aviso y Documentación', '{"sections":[{"type":"titulo","content":"Reporte del Siniestro"},{"type":"lista","content":"Pasos del asegurado:","items":["Avisar a aseguradora (máx 5 días hábiles)","Tomar medidas para evitar/disminuir daño","Presentar documentación requerida","Cooperar con ajustador","No admitir responsabilidad (RC)"]},{"type":"lista","content":"Documentos comunes:","items":["Formato de aviso","Póliza vigente","Identificación","Fotos del daño","Facturas, comprobantes","Parte policial (si aplica)"]},{"type":"alerta","content":"5 días hábiles para avisar. Después puede perder derecho a indemnización."}]}', 1, 25),
  (v_mod5_id, 'Ajuste de Pérdidas', '{"sections":[{"type":"titulo","content":"Valuación del Daño"},{"type":"parrafo","content":"El ajustador investiga, valúa daños y determina procedencia de la reclamación."},{"type":"definicion","content":"AJUSTADOR: Profesional que evalúa causas, extensión y monto de daños. Puede ser de la aseguradora o independiente."},{"type":"lista","content":"Proceso de ajuste:","items":["Inspección del daño","Entrevistas con involucrados","Revisión de documentos","Determinación de causa","Cálculo de indemnización","Emisión de dictamen"]},{"type":"alerta","content":"El ajustador NO decide si se paga, solo recomienda. La aseguradora decide."}]}', 2, 30),
  (v_mod5_id, 'Pago de Indemnización', '{"sections":[{"type":"titulo","content":"Liquidación del Siniestro"},{"type":"parrafo","content":"Una vez aceptada la reclamación, la aseguradora tiene 30 días para pagar desde que recibe documentación completa."},{"type":"lista","content":"Formas de indemnización:","items":["Efectivo: pago directo al asegurado","Reposición: reparación del bien","Reposición en especie: bien equivalente"]},{"type":"definicion","content":"SALVAMENTO: Lo que queda del bien siniestrado. Puede descontarse de indemnización o pasar a asegurador."},{"type":"alerta","content":"30 días para pagar. Después genera intereses moratorios."}]}', 3, 30),
  (v_mod5_id, 'Causas de Rechazo', '{"sections":[{"type":"titulo","content":"Motivos de Negación"},{"type":"lista","content":"Causas comunes de rechazo:","items":["Riesgo no cubierto o excluido","Omisión o falsedad en declaración","Falta de interés asegurable","Prima no pagada","Aviso extemporáneo sin justificación","Dolo o mala fe del asegurado"]},{"type":"definicion","content":"EXCLUSIÓN: Riesgo o circunstancia expresamente no cubierta en póliza."},{"type":"alerta","content":"Diferencia entre exclusión y falta de cobertura es pregunta frecuente."}]}', 4, 35);

  -- ============================================================================
  -- MÓDULO 6: ASPECTOS TÉCNICOS Y ACTUARIALES
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod6_id,
    'Aspectos Técnicos y Actuariales',
    'Principios actuariales, reservas técnicas, reaseguro y solvencia de las instituciones.',
    6,
    'Calculator',
    'Conceptos técnicos fundamentales: actuaría, reservas, reaseguro y requisitos de solvencia.',
    150
  );

  -- Módulo 6 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod6_id, 'Principios Actuariales', '{"sections":[{"type":"titulo","content":"Ciencia Actuarial"},{"type":"parrafo","content":"La actuaría aplica matemáticas, estadística y probabilidad para evaluar riesgos financieros."},{"type":"lista","content":"Conceptos clave:","items":["Ley de los grandes números","Probabilidad de ocurrencia","Frecuencia de siniestros","Severidad promedio","Distribuciones estadísticas"]},{"type":"definicion","content":"LEY DE LOS GRANDES NÚMEROS: A mayor número de observaciones, los resultados reales se aproximan más a los esperados."},{"type":"alerta","content":"El seguro funciona por mutualidad y ley de grandes números."}]}', 1, 30),
  (v_mod6_id, 'Reservas Técnicas', '{"sections":[{"type":"titulo","content":"Reservas Obligatorias"},{"type":"parrafo","content":"Fondos que las aseguradoras deben mantener para garantizar el pago de obligaciones futuras."},{"type":"lista","content":"Tipos principales:","items":["Reserva de Riesgos en Curso: para siniestros de pólizas vigentes","Reserva de Obligaciones Pendientes: para siniestros ocurridos no pagados","Reserva Matemática: seguros de vida","Reserva de Previsión: contingencias"]},{"type":"alerta","content":"Son obligatorias por ley. La CNSF supervisa su constitución."}]}', 2, 35),
  (v_mod6_id, 'Reaseguro', '{"sections":[{"type":"titulo","content":"El Seguro del Seguro"},{"type":"definicion","content":"REASEGURO: Operación donde el asegurador (cedente) transfiere parte de sus riesgos a otra aseguradora (reasegurador)."},{"type":"lista","content":"Funciones:","items":["Aumentar capacidad de suscripción","Estabilizar resultados","Proteger patrimonio","Dispersar riesgos catastróficos"]},{"type":"lista","content":"Tipos:","items":["Proporcional: cedente y reasegurador comparten en %","No proporcional: reasegurador cubre exceso de monto"]},{"type":"alerta","content":"El reaseguro NO libera al asegurador original frente al asegurado."}]}', 3, 35),
  (v_mod6_id, 'Solvencia y Capital', '{"sections":[{"type":"titulo","content":"Requisitos de Capital"},{"type":"parrafo","content":"Las aseguradoras deben mantener capital mínimo según operaciones que realicen."},{"type":"definicion","content":"REQUERIMIENTO DE CAPITAL DE SOLVENCIA (RCS): Monto mínimo para garantizar operación sana."},{"type":"lista","content":"Factores considerados:","items":["Volumen de operaciones","Riesgos suscritos","Inversiones realizadas","Reaseguro contratado"]},{"type":"alerta","content":"La CNSF puede intervenir si capital es insuficiente."}]}', 4, 25),
  (v_mod6_id, 'Inversiones', '{"sections":[{"type":"titulo","content":"Régimen de Inversión"},{"type":"parrafo","content":"Las reservas técnicas deben invertirse en activos autorizados para garantizar liquidez y seguridad."},{"type":"lista","content":"Inversiones permitidas:","items":["Valores gubernamentales","Valores bancarios","Acciones de empresas calificadas","Inmuebles (límites)","Préstamos hipotecarios"]},{"type":"alerta","content":"No pueden invertir libremente. Régimen estricto de LISF y Circular Única."}]}', 5, 25);

  -- ============================================================================
  -- MÓDULO 7: ÉTICA PROFESIONAL Y CONDUCTA
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod7_id,
    'Ética Profesional y Conducta',
    'Principios éticos, prevención de fraude, conflicto de intereses y protección al consumidor.',
    7,
    'Shield',
    'Normas éticas y conducta profesional que debe observar todo agente de seguros.',
    100
  );

  -- Módulo 7 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod7_id, 'Código de Ética', '{"sections":[{"type":"titulo","content":"Principios Éticos"},{"type":"lista","content":"Valores fundamentales:","items":["Honestidad: actuar con verdad","Integridad: coherencia entre dichos y hechos","Confidencialidad: proteger información del cliente","Profesionalismo: capacitación continua","Lealtad: a cliente y a la institución"]},{"type":"alerta","content":"El agente representa a la aseguradora. Sus actos la obligan."}]}', 1, 20),
  (v_mod7_id, 'Conflicto de Intereses', '{"sections":[{"type":"titulo","content":"Situaciones de Conflicto"},{"type":"definicion","content":"CONFLICTO DE INTERESES: Situación donde intereses personales pueden afectar juicio profesional."},{"type":"lista","content":"Ejemplos:","items":["Vender seguro a familiar sin revelar parentesco","Recibir comisión de reasegurador sin informar","Ocultar información que afecte decisión del cliente"]},{"type":"alerta","content":"Debe revelarse cualquier conflicto potencial al cliente."}]}', 2, 25),
  (v_mod7_id, 'Prevención de Fraude', '{"sections":[{"type":"titulo","content":"Combate al Fraude"},{"type":"parrafo","content":"El fraude en seguros perjudica a todos: aumenta primas, daña confianza y es delito."},{"type":"lista","content":"Tipos de fraude:","items":["Declaración falsa en solicitud","Siniestro inventado o exagerado","Colusión asegurado-tercero","Documentación apócrifa"]},{"type":"alerta","content":"El agente debe reportar indicios de fraude. Es obligación legal."}]}', 3, 25),
  (v_mod7_id, 'Protección al Consumidor', '{"sections":[{"type":"titulo","content":"Derechos del Asegurado"},{"type":"lista","content":"Derechos básicos:","items":["Información clara y veraz","Póliza con cláusulas comprensibles","Atención de quejas","Indemnización justa y oportuna","Privacidad de datos personales"]},{"type":"parrafo","content":"CONDUSEF es la autoridad que protege estos derechos."},{"type":"alerta","content":"El agente debe asegurar que el cliente entienda el producto que contrata."}]}', 4, 30);

  -- ============================================================================
  -- MÓDULO 8: CASOS PRÁCTICOS Y SITUACIONES REALES
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod8_id,
    'Casos Prácticos y Situaciones Reales',
    'Análisis de casos reales, resolución de situaciones complejas y aplicación práctica de conocimientos.',
    8,
    'Briefcase',
    'Aplica todo lo aprendido resolviendo casos prácticos y situaciones que enfrentarás en la práctica profesional.',
    150
  );

  -- Módulo 8 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod8_id, 'Caso: Suscripción de Vida', '{"sections":[{"type":"titulo","content":"Caso Práctico 1"},{"type":"caso_practico","content":"Cliente de 45 años, fumador, sobrepeso, solicita seguro de vida por $5,000,000. Análisis: evaluar riesgo incrementado, posibles exclusiones, recargos en prima. Decisión: aceptar con recargo del 50% o rechazar según manual de suscripción."},{"type":"lista","content":"Factores analizados:","items":["Edad: riesgo moderado","Tabaquismo: incrementa mortalidad","Sobrepeso: factor agravante","Monto alto: inspección médica necesaria"]},{"type":"alerta","content":"La suma de factores puede llevar a rechazo o recargo significativo."}]}', 1, 30),
  (v_mod8_id, 'Caso: Siniestro de Auto', '{"sections":[{"type":"titulo","content":"Caso Práctico 2"},{"type":"caso_practico","content":"Asegurado choca su auto asegurado en RC y Daños Materiales. Deducible 5%, suma asegurada $300,000. Daños propios $50,000, daños a tercero $80,000. Análisis: RC cubre daños a tercero totalmente. Daños propios: asegurado paga $2,500 (5% de 50k), aseguradora $47,500."},{"type":"lista","content":"Cálculo:","items":["Daños a tercero: $80,000 (cubiertos por RC)","Daños propios: $50,000","Deducible: $2,500 (5% de $50,000)","Aseguradora paga: $47,500 propios + $80,000 tercero = $127,500"]},{"type":"alerta","content":"El deducible solo aplica a daños propios, no a RC."}]}', 2, 35),
  (v_mod8_id, 'Caso: Rechazo por Agravación', '{"sections":[{"type":"titulo","content":"Caso Práctico 3"},{"type":"caso_practico","content":"Casa asegurada contra incendio. Dueño instala taller de soldadura sin avisar a aseguradora. Ocurre incendio. Análisis: instalación de taller es agravación del riesgo que debió notificarse. Aseguradora puede rechazar o reducir indemnización proporcionalmente."},{"type":"alerta","content":"Cambios que agravan riesgo DEBEN notificarse. Silencio puede anular cobertura."}]}', 3, 30),
  (v_mod8_id, 'Caso: Preexistencia en GMM', '{"sections":[{"type":"titulo","content":"Caso Práctico 4"},{"type":"caso_practico","content":"Asegurado contrata GMM. 3 meses después presenta diabetes que requiere hospitalización. Investigación revela tenía diabetes antes de contratar. Análisis: diabetes es preexistencia. Generalmente excluida. Aseguradora puede rechazar reclamación y anular contrato por omisión dolosa."},{"type":"alerta","content":"Omitir preexistencias conocidas es causa de nulidad del contrato."}]}', 4, 30),
  (v_mod8_id, 'Caso: Reaseguro Catastrófico', '{"sections":[{"type":"titulo","content":"Caso Práctico 5"},{"type":"caso_practico","content":"Terremoto causa $500 millones en daños. Aseguradora tiene capacidad de $100 millones. Tiene reaseguro catastrófico por exceso de $100 millones. Análisis: Aseguradora paga primeros $100M, reaseguradores pagan $400M restantes. Sin reaseguro, quebraría."},{"type":"alerta","content":"El reaseguro es esencial para eventos catastróficos. Protege solvencia."}]}', 5, 25);

END $$;
