/*
  # Examen Final - Parte 4 (Final)
  
  Insertar preguntas 81-100 (Módulos 5 y 6: Cálculos Financieros + Integración)
*/

-- ============================================================================
-- MÓDULOS 5 & 6: CÁLCULOS + INTEGRACIÓN (Preguntas 81-100)
-- ============================================================================

INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE tipo = 'final'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('6% en decimal es:', ARRAY['0.6', '0.06', '0.006', '6'], 'B', 'Para convertir porcentaje a decimal se divide entre 100: 6/100 = 0.06', 'basica', 81),
  ('12% anual equivale mensual a:', ARRAY['2%', '1%', '0.5%', '12%'], 'B', 'Tasa mensual = anual / 12: 12% / 12 = 1%', 'basica', 82),
  ('Prima anual $12,000 → mensual:', ARRAY['$800', '$900', '$1,000', '$1,200'], 'C', 'Prima mensual = anual / 12: $12,000 / 12 = $1,000', 'basica', 83),
  ('Para convertir a porcentaje se:', ARRAY['Divide 100', 'Multiplica 100', 'Resta 1', 'Suma 1'], 'B', 'Para convertir decimal a porcentaje se multiplica por 100', 'basica', 84),
  ('0.25 equivale a:', ARRAY['2.5%', '25%', '0.025%', '250%'], 'B', '0.25 × 100 = 25%', 'basica', 85),
  ('Tasa bimestral = anual ÷:', ARRAY['12', '6', '4', '3'], 'B', 'Hay 6 bimestres en un año: anual / 6', 'intermedia', 86),
  ('Regla de tres se usa con relación:', ARRAY['Aleatoria', 'Proporcional', 'Inversa', 'Promedio'], 'B', 'La regla de tres se usa con relaciones proporcionales', 'basica', 87),
  ('Interés simple se calcula sobre:', ARRAY['Capital inicial', 'Interés', 'Prima', 'Deducible'], 'A', 'El interés simple siempre se calcula sobre el capital inicial', 'basica', 88),
  ('Capitalización implica:', ARRAY['Pago único', 'Reinversión', 'Pérdida', 'Multa'], 'B', 'La capitalización implica reinvertir los intereses generados', 'intermedia', 89),
  ('18% anual trimestral es:', ARRAY['6%', '4.5%', '3%', '9%'], 'B', 'Tasa trimestral = anual / 4: 18% / 4 = 4.5%', 'intermedia', 90),
  ('Inflación provoca:', ARRAY['Más poder adquisitivo', 'Menor valor del dinero', 'Menos precios', 'Más ahorro'], 'B', 'La inflación reduce el valor del dinero y el poder adquisitivo', 'basica', 91),
  ('2% mensual anual es:', ARRAY['12%', '18%', '24%', '36%'], 'C', 'Tasa anual simple = mensual × 12: 2% × 12 = 24%', 'intermedia', 92),
  ('Rendimiento se expresa en:', ARRAY['Pesos', 'Años', 'Porcentaje', 'Días'], 'C', 'El rendimiento se expresa en porcentaje', 'basica', 93),
  ('$100,000 → $120,000 rendimiento:', ARRAY['12%', '15%', '18%', '20%'], 'D', 'Rendimiento = (120,000 - 100,000) / 100,000 = 20,000 / 100,000 = 20%', 'intermedia', 94),
  ('El examen CNSF evalúa:', ARRAY['Memoria', 'Criterio profesional', 'Ventas', 'Marketing'], 'B', 'El examen evalúa el criterio profesional y conocimientos técnicos', 'basica', 95),
  ('Respuesta correcta protege al:', ARRAY['Agente', 'Aseguradora', 'Asegurado', 'Estado'], 'C', 'El conocimiento correcto del agente protege al asegurado', 'basica', 96),
  ('Si viola la ley, la respuesta es:', ARRAY['Correcta', 'Dudosa', 'Incorrecta', 'Opcional'], 'C', 'Cualquier acción que viole la ley es incorrecta', 'basica', 97),
  ('Estrategia correcta en examen:', ARRAY['Contestar rápido', 'Leer dos veces', 'Adivinar', 'Saltar'], 'B', 'Es recomendable leer cada pregunta cuidadosamente dos veces', 'basica', 98),
  ('El simulador sirve para:', ARRAY['Memorizar', 'Ajustar estudio', 'Castigar', 'Cancelar'], 'B', 'El simulador permite identificar áreas de mejora en el estudio', 'basica', 99),
  ('Objetivo final del curso:', ARRAY['Aprobar', 'Ejercer correctamente', 'Vender más', 'Memorizar'], 'B', 'El objetivo es ejercer correctamente la profesión con ética', 'basica', 100)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);