/*
  # Insertar Exámenes de Práctica - Módulos 5 y 6

  1. Crear exámenes de práctica para Módulos 5 y 6
  2. Insertar 25 preguntas por cada módulo
  3. Formato: 4 opciones (A, B, C, D)
  4. Nivel CNSF oficial
*/

-- ============================================================================
-- MÓDULO 5: CÁLCULOS FINANCIEROS BÁSICOS
-- ============================================================================

-- Crear examen de práctica Módulo 5
INSERT INTO cedula_a_examenes (
  titulo,
  descripcion,
  tipo,
  modulo_id,
  duracion_referencia_minutos,
  puntaje_minimo_aprobacion,
  orden,
  instrucciones,
  activo
) VALUES (
  'Examen de Práctica - Módulo 5: Cálculos Financieros Básicos',
  'Evalúa tu comprensión de cálculos financieros básicos, porcentajes, tasas de interés y conceptos matemáticos aplicados al seguro.',
  'practica',
  (SELECT id FROM cedula_a_modulos WHERE orden = 5),
  45,
  70,
  5,
  'Lee cuidadosamente cada pregunta. Selecciona la respuesta más correcta entre las opciones disponibles.',
  true
);

-- Insertar preguntas Módulo 5 (101-125)
INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE titulo LIKE '%Módulo 5%'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('Convertir 6% a decimal equivale a:', ARRAY['0.6', '0.06', '0.006', '6.0'], 'B', 'Para convertir un porcentaje a decimal, se divide entre 100. 6% = 6/100 = 0.06', 'basica', 101),
  ('Una tasa anual del 12% equivale a una tasa mensual de:', ARRAY['2%', '12%', '1%', '0.5%'], 'C', 'Se divide la tasa anual entre 12 meses: 12% / 12 = 1% mensual', 'basica', 102),
  ('Si una prima anual es de $9,600, la prima mensual será:', ARRAY['$600', '$700', '$800', '$900'], 'C', 'Se divide la prima anual entre 12: $9,600 / 12 = $800', 'basica', 103),
  ('El porcentaje se obtiene al:', ARRAY['Dividir entre 10', 'Multiplicar por 10', 'Multiplicar por 100', 'Dividir entre 100'], 'C', 'Para convertir un decimal a porcentaje se multiplica por 100', 'basica', 104),
  ('El decimal 0.25 equivale a:', ARRAY['2.5%', '25%', '0.025%', '250%'], 'B', '0.25 × 100 = 25%', 'basica', 105),
  ('Una tasa bimestral se obtiene dividiendo la tasa anual entre:', ARRAY['12', '6', '4', '3'], 'B', 'Un año tiene 6 bimestres (2 meses cada uno), por lo que se divide entre 6', 'intermedia', 106),
  ('La regla de tres se usa cuando existe:', ARRAY['Una relación aleatoria', 'Una relación proporcional', 'Una relación inversa', 'Un promedio'], 'B', 'La regla de tres funciona cuando hay proporcionalidad directa entre valores', 'intermedia', 107),
  ('Si $500 es el 10%, el 100% es:', ARRAY['$5,000', '$50,000', '$500', '$1,000'], 'A', 'Si $500 = 10%, entonces 100% = $500 × 10 = $5,000', 'intermedia', 108),
  ('El interés simple se caracteriza porque:', ARRAY['Se reinvierte', 'Genera interés sobre interés', 'Se calcula solo sobre el capital inicial', 'No genera rendimiento'], 'C', 'El interés simple siempre se calcula sobre el capital original, no se capitaliza', 'intermedia', 109),
  ('La capitalización implica:', ARRAY['Pago único', 'Interés simple', 'Reinversión de intereses', 'Pérdida de capital'], 'C', 'Capitalizar significa añadir los intereses al capital para generar más intereses', 'intermedia', 110),
  ('Una tasa del 18% anual equivale a una tasa trimestral de:', ARRAY['6%', '4.5%', '3%', '9%'], 'B', '18% / 4 trimestres = 4.5% trimestral', 'intermedia', 111),
  ('El interés es:', ARRAY['Un impuesto', 'El precio del dinero', 'Una prima', 'Un riesgo'], 'B', 'El interés representa el costo o precio de usar dinero en el tiempo', 'basica', 112),
  ('La inflación provoca:', ARRAY['Aumento del poder adquisitivo', 'Disminución del valor del dinero', 'Aumento del ahorro', 'Disminución de precios'], 'B', 'La inflación reduce el poder adquisitivo del dinero', 'intermedia', 113),
  ('Una tasa mensual de 2% equivale a una anual de:', ARRAY['12%', '18%', '24%', '36%'], 'C', '2% × 12 meses = 24% anual (tasa simple)', 'intermedia', 114),
  ('El rendimiento se expresa generalmente en:', ARRAY['Pesos', 'Años', 'Porcentaje', 'Días'], 'C', 'El rendimiento se expresa como porcentaje del capital invertido', 'basica', 115),
  ('Si una inversión pasa de $100,000 a $120,000, el rendimiento es:', ARRAY['12%', '15%', '18%', '20%'], 'D', 'Ganancia: $20,000 / $100,000 = 0.20 = 20%', 'intermedia', 116),
  ('El interés compuesto siempre genera un monto:', ARRAY['Menor', 'Igual', 'Mayor', 'Negativo'], 'C', 'El interés compuesto genera más rendimiento que el interés simple', 'intermedia', 117),
  ('El cálculo financiero en el examen CNSF evalúa:', ARRAY['Matemáticas avanzadas', 'Comprensión lógica', 'Fórmulas complejas', 'Contabilidad'], 'B', 'Se evalúa la capacidad de razonamiento lógico y aplicación práctica', 'basica', 118),
  ('El porcentaje de incremento se calcula:', ARRAY['Multiplicando', 'Restando', 'Dividiendo', 'Comparando valores'], 'D', 'Se compara el valor final con el inicial para obtener el incremento porcentual', 'intermedia', 119),
  ('Un error común en cálculos es:', ARRAY['Leer con calma', 'Convertir porcentajes', 'No convertir porcentajes', 'Usar regla de tres'], 'C', 'Olvidar convertir porcentajes a decimales es un error frecuente', 'basica', 120),
  ('El valor final menos el valor inicial representa:', ARRAY['Capital', 'Rendimiento', 'Prima', 'Riesgo'], 'B', 'La diferencia entre valor final e inicial es el rendimiento o ganancia', 'basica', 121),
  ('El 0.075 equivale a:', ARRAY['7.5%', '0.75%', '75%', '0.075%'], 'A', '0.075 × 100 = 7.5%', 'basica', 122),
  ('La prima proporcional se calcula usando:', ARRAY['Capitalización', 'Regla de tres', 'Inflación', 'Interés compuesto'], 'B', 'Se usa regla de tres para calcular primas proporcionales al tiempo', 'intermedia', 123),
  ('El interés se calcula sobre:', ARRAY['El riesgo', 'El capital', 'La prima', 'El deducible'], 'B', 'El interés se calcula aplicando una tasa al capital', 'basica', 124),
  ('El objetivo del módulo de cálculos es:', ARRAY['Hacer contadores', 'Comprender cifras', 'Memorizar fórmulas', 'Calcular impuestos'], 'B', 'Se busca que el agente comprenda y aplique conceptos financieros básicos', 'basica', 125)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);

-- ============================================================================
-- MÓDULO 6: INTEGRACIÓN Y SIMULADOR
-- ============================================================================

-- Crear examen de práctica Módulo 6
INSERT INTO cedula_a_examenes (
  titulo,
  descripcion,
  tipo,
  modulo_id,
  duracion_referencia_minutos,
  puntaje_minimo_aprobacion,
  orden,
  instrucciones,
  activo
) VALUES (
  'Examen de Práctica - Módulo 6: Integración Final y Simulador',
  'Integración de todos los conceptos aprendidos. Simulador de examen real de Cédula A.',
  'practica',
  (SELECT id FROM cedula_a_modulos WHERE orden = 6),
  45,
  70,
  6,
  'Este examen integra conceptos de todos los módulos. Lee con atención y aplica tu criterio profesional.',
  true
);

-- Insertar preguntas Módulo 6 (126-150)
INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE titulo LIKE '%Módulo 6%'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('El examen de Cédula A evalúa:', ARRAY['Especialización', 'Conocimientos básicos', 'Ventas', 'Marketing'], 'B', 'El examen CNSF evalúa conocimientos fundamentales para ejercer como agente', 'basica', 126),
  ('El ramo más preguntado en daños es:', ARRAY['Incendio', 'Crédito', 'Automóviles', 'Marítimo'], 'C', 'Automóviles es el ramo más común y frecuentemente evaluado', 'basica', 127),
  ('El objetivo del simulador es:', ARRAY['Memorizar', 'Evaluar comprensión', 'Calificar agentes', 'Vender seguros'], 'B', 'El simulador permite evaluar el nivel de comprensión antes del examen real', 'basica', 128),
  ('Una buena estrategia de examen es:', ARRAY['Contestar rápido', 'Leer dos veces', 'Adivinar', 'Saltar preguntas'], 'B', 'Leer cuidadosamente evita errores de interpretación', 'basica', 129),
  ('El error más común es:', ARRAY['Razonar', 'Leer mal', 'Conocer leyes', 'Usar lógica'], 'B', 'La mayoría de errores provienen de lectura apresurada', 'basica', 130),
  ('La respuesta correcta protege principalmente:', ARRAY['Al agente', 'A la aseguradora', 'Al asegurado', 'Al Estado'], 'C', 'El criterio correcto siempre prioriza la protección del asegurado', 'intermedia', 131),
  ('El examen evalúa más:', ARRAY['Memoria', 'Criterio profesional', 'Velocidad', 'Matemáticas'], 'B', 'Se evalúa la capacidad de razonamiento y criterio profesional', 'intermedia', 132),
  ('Si una respuesta viola la ley, es:', ARRAY['Correcta', 'Dudosa', 'Incorrecta', 'Opcional'], 'C', 'Cualquier acción que viole la ley es automáticamente incorrecta', 'intermedia', 133),
  ('El aviso del siniestro debe darse:', ARRAY['Cuando convenga', 'Al final', 'De inmediato', 'Nunca'], 'C', 'El aviso debe darse tan pronto como se tenga conocimiento del siniestro', 'basica', 134),
  ('El agente que aprueba comprende:', ARRAY['Precios', 'Procesos', 'Criterio', 'Publicidad'], 'C', 'Aprobar demuestra comprensión del criterio profesional correcto', 'intermedia', 135),
  ('El simulador debe ser:', ARRAY['Fácil', 'Corto', 'Similar al real', 'Ilimitado'], 'C', 'Un buen simulador replica las condiciones del examen oficial', 'basica', 136),
  ('El resultado del simulador sirve para:', ARRAY['Castigar', 'Ajustar estudio', 'Cancelar curso', 'Emitir póliza'], 'B', 'Los resultados permiten identificar áreas de mejora', 'basica', 137),
  ('Un error conceptual indica:', ARRAY['Falta de memoria', 'Falta de comprensión', 'Falta de tiempo', 'Falta de cálculo'], 'B', 'Los errores conceptuales muestran falta de entendimiento del tema', 'intermedia', 138),
  ('El examen final integra:', ARRAY['Un módulo', 'Dos módulos', 'Todos los módulos', 'Solo cálculos'], 'C', 'El examen final evalúa todos los módulos del curso', 'basica', 139),
  ('La CNSF evalúa principalmente:', ARRAY['Ventas', 'Ética y conocimiento', 'Marketing', 'Imagen'], 'B', 'La certificación busca garantizar ética y conocimiento técnico', 'intermedia', 140),
  ('El agente debe pensar como:', ARRAY['Cliente', 'Aseguradora', 'Profesional', 'Ajustador'], 'C', 'El agente debe actuar como profesional equilibrado', 'intermedia', 141),
  ('Un buen resultado indica:', ARRAY['Suerte', 'Preparación', 'Memoria', 'Rapidez'], 'B', 'Los buenos resultados son consecuencia de preparación adecuada', 'basica', 142),
  ('El simulador no debe dar retroalimentación:', ARRAY['Nunca', 'Antes de terminar', 'Al final', 'Después'], 'B', 'La retroalimentación se da al finalizar para no influir en el proceso', 'basica', 143),
  ('El error de cálculo común es:', ARRAY['Orden', 'Lectura', 'Conversión', 'Suma'], 'C', 'No convertir correctamente porcentajes y decimales es muy común', 'intermedia', 144),
  ('El objetivo final del curso es:', ARRAY['Aprobar', 'Ejercer correctamente', 'Vender más', 'Memorizar'], 'B', 'El objetivo es formar agentes competentes y éticos', 'intermedia', 145),
  ('El agente debe dominar primero:', ARRAY['Ventas', 'Leyes', 'Promoción', 'Marketing'], 'B', 'El fundamento del ejercicio profesional es el conocimiento legal', 'intermedia', 146),
  ('El examen mide:', ARRAY['Habilidad comercial', 'Capacidad técnica', 'Imagen personal', 'Experiencia'], 'B', 'Se evalúa la capacidad técnica para ejercer la profesión', 'basica', 147),
  ('El módulo final integra:', ARRAY['Cálculos', 'Personas', 'Daños', 'Todo'], 'D', 'El módulo 6 integra todos los conceptos aprendidos', 'basica', 148),
  ('El criterio profesional implica:', ARRAY['Improvisar', 'Razonar', 'Memorizar', 'Copiar'], 'B', 'El criterio profesional requiere razonamiento ético y técnico', 'intermedia', 149),
  ('El agente aprobado es aquel que:', ARRAY['Memoriza', 'Comprende', 'Adivina', 'Improvisa'], 'B', 'Aprobar demuestra comprensión genuina, no solo memorización', 'intermedia', 150)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);