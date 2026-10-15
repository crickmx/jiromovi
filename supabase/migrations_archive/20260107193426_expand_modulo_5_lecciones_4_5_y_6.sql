/*
  # Expansión final Módulo 5 - Lecciones 5.4, 5.5 y crear 5.6

  1. Expandir Lección 5.4: Capitalización e Interés Compuesto
  2. Expandir Lección 5.5: Tasa de Rendimiento  
  3. Crear Lección 5.6: Errores Frecuentes y Cierre del Módulo
*/

-- Lección 5.4: Capitalización
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 5.4: CAPITALIZACIÓN E INTERÉS COMPUESTO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ IMPORTANTE: El examen NO pide fórmulas complejas de interés compuesto. Solo el CONCEPTO y cálculos básicos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.1 CONCEPTO DE CAPITALIZACIÓN'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'CAPITALIZACIÓN es el proceso por el cual los INTERESES generados se REINVIERTEN y, a su vez, generan nuevos intereses.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En otras palabras:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Capitalización significa:',
      'items', jsonb_build_array(
        '✓ Los intereses NO se retiran',
        '✓ Los intereses se SUMAN al capital',
        '✓ El nuevo capital (original + intereses) genera MÁS intereses',
        '✓ Esto se conoce como "interés sobre interés"',
        '✓ Es lo que hace crecer las inversiones a largo plazo'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO VISUAL:\n\nAño 1:\nCapital inicial: $100,000\nInterés al 10%: $10,000\nNuevo capital: $110,000 (se reinvierte)\n\nAño 2:\nCapital: $110,000 (ahora es mayor)\nInterés al 10%: $11,000 (¡más que el año 1!)\nNuevo capital: $121,000\n\nAño 3:\nCapital: $121,000\nInterés al 10%: $12,100\nNuevo capital: $133,100\n\n✓ Cada año ganas MÁS intereses porque el capital crece'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.2 DIFERENCIA: INTERÉS SIMPLE VS INTERÉS COMPUESTO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ PREGUNTA FRECUENTE EN EL EXAMEN: Diferenciar interés simple de interés compuesto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'INTERÉS SIMPLE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'INTERÉS SIMPLE: Los intereses NO se reinvierten. Solo el capital original genera intereses.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO INTERÉS SIMPLE:\n\nCapital: $100,000\nTasa: 10% anual\nTiempo: 3 años\n\nAño 1: Interés = 100,000 × 0.10 = $10,000\nAño 2: Interés = 100,000 × 0.10 = $10,000\nAño 3: Interés = 100,000 × 0.10 = $10,000\n\nTotal intereses: $30,000\nMonto final: $130,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'INTERÉS COMPUESTO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'INTERÉS COMPUESTO: Los intereses SÍ se reinvierten. El capital crece cada periodo.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO INTERÉS COMPUESTO (mismo caso):\n\nCapital: $100,000\nTasa: 10% anual\nTiempo: 3 años\n\nAño 1:\nCapital: 100,000\nInterés: 100,000 × 0.10 = 10,000\nNuevo capital: 110,000\n\nAño 2:\nCapital: 110,000\nInterés: 110,000 × 0.10 = 11,000\nNuevo capital: 121,000\n\nAño 3:\nCapital: 121,000\nInterés: 121,000 × 0.10 = 12,100\nNuevo capital: 133,100\n\nTotal intereses: $33,100\nMonto final: $133,100\n\n✓ Ganaste $3,100 MÁS que con interés simple'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TABLA COMPARATIVA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'INTERÉS SIMPLE:',
      'items', jsonb_build_array(
        'Intereses NO se reinvierten',
        'Solo el capital original genera intereses',
        'Intereses son iguales cada periodo',
        'Crecimiento LINEAL',
        'Menos rentable a largo plazo'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'INTERÉS COMPUESTO:',
      'items', jsonb_build_array(
        'Intereses SÍ se reinvierten',
        'El capital crece cada periodo',
        'Intereses son MAYORES cada periodo',
        'Crecimiento EXPONENCIAL',
        'MÁS rentable a largo plazo'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.3 FÓRMULA DE INTERÉS COMPUESTO (BÁSICA)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ Esta fórmula NO se pide en el examen de Cédula A básica, pero es útil conocerla.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA: M = C × (1 + i)^n\n\nDonde:\nM = Monto final\nC = Capital inicial\ni = Tasa de interés (en decimal)\nn = Número de periodos\n^ = Elevado a la potencia'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO CON FÓRMULA:\n\nCapital: $50,000\nTasa: 8% anual (0.08)\nTiempo: 5 años\n\nAplicando fórmula:\nM = 50,000 × (1 + 0.08)^5\nM = 50,000 × (1.08)^5\nM = 50,000 × 1.4693\nM = 73,466\n\nRespuesta: Monto final = $73,466\nIntereses ganados: 73,466 - 50,000 = $23,466'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.4 MÉTODO ALTERNATIVO: CÁLCULO PERIODO POR PERIODO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Si no recuerdas la fórmula o no tienes calculadora científica, puedes calcular PERIODO POR PERIODO:'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO (mismo caso anterior):\n\nCapital inicial: $50,000\nTasa: 8% anual\n\nAño 1:\n50,000 × 1.08 = 54,000\n\nAño 2:\n54,000 × 1.08 = 58,320\n\nAño 3:\n58,320 × 1.08 = 62,986\n\nAño 4:\n62,986 × 1.08 = 68,025\n\nAño 5:\n68,025 × 1.08 = 73,467\n\nRespuesta: $73,467 (prácticamente igual)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ TRUCO: Multiplicar por (1 + tasa) es más rápido que calcular el interés y sumarlo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.5 APLICACIÓN EN SEGUROS DE AHORRO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En seguros de vida con componente de ahorro (seguros dotales, vida entera con ahorro), las aseguradoras aplican interés COMPUESTO.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO REAL: Seguro Dotal a 20 años\n\nPrima anual: $10,000\nTasa garantizada: 4% anual\n\nLas primas pagadas se van invirtiendo con capitalización.\n\nSi pagas durante 20 años y dejas el dinero invertido, al final recibes MUCHO MÁS que 20 × $10,000 = $200,000.\n\nRecibes aproximadamente $297,000 gracias al interés compuesto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.6 EJERCICIO TIPO CNSF'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Una persona invierte $32,500 a una tasa del 9% anual, reinvirtiendo intereses durante 3 años. ¿Cuál será el monto final aproximado?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN MÉTODO PERIODO POR PERIODO:\n\nCapital inicial: $32,500\nTasa: 9% = 0.09\n\nAño 1:\n32,500 × 1.09 = 35,425\n\nAño 2:\n35,425 × 1.09 = 38,613\n\nAño 3:\n38,613 × 1.09 = 42,088\n\nRespuesta: Monto final = $42,088\n\nIntereses ganados: 42,088 - 32,500 = $9,588'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'COMPARACIÓN CON INTERÉS SIMPLE:\n\nSi fuera interés simple:\nInterés anual: 32,500 × 0.09 = 2,925\nInterés 3 años: 2,925 × 3 = 8,775\nMonto final: 32,500 + 8,775 = 41,275\n\nDiferencia: 42,088 - 41,275 = $813\n\n✓ El interés compuesto te dio $813 más'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.4.7 IDEAS CLAVE PARA EL EXAMEN'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Conceptos que DEBES saber:',
      'items', jsonb_build_array(
        '✓ Capitalización = reinversión de intereses',
        '✓ Interés simple: solo el capital original genera intereses',
        '✓ Interés compuesto: intereses generan más intereses',
        '✓ Interés compuesto SIEMPRE da más rendimiento',
        '✓ A mayor plazo, mayor diferencia entre simple y compuesto',
        '✓ En seguros de ahorro se usa interés compuesto',
        '✓ Método rápido: multiplicar por (1 + tasa) cada periodo'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 5.4'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        '✓ Capitalización = reinversión de intereses',
        '✓ Interés simple vs compuesto: compuesto es más rentable',
        '✓ Fórmula: M = C × (1 + i)^n (no obligatoria para el examen)',
        '✓ Método alternativo: multiplicar periodo por periodo',
        '✓ Seguros de ahorro usan interés compuesto',
        '✓ El tiempo es clave: a más tiempo, más beneficio de la capitalización',
        '✓ Siempre verifica tu resultado'
      )
    )
  )
),
duracion_estimada_minutos = 40,
updated_at = now()
WHERE titulo = 'Lección 5.4 - Capitalización';

-- Lección 5.5: Tasa de Rendimiento
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 5.5: TASA DE RENDIMIENTO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ PREGUNTA COMÚN: Calcular qué porcentaje ganaste o perdiste en una inversión.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.5.1 CONCEPTO DE TASA DE RENDIMIENTO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La TASA DE RENDIMIENTO mide qué tanto creció (o decreció) una inversión, expresado en PORCENTAJE.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'También se conoce como:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Otros nombres:',
      'items', jsonb_build_array(
        '✓ Tasa de retorno',
        '✓ Rendimiento porcentual',
        '✓ Ganancia porcentual',
        '✓ ROI (Return on Investment)',
        '✓ Variación porcentual'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.5.2 FÓRMULA DE TASA DE RENDIMIENTO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ MEMORIZA ESTA FÓRMULA. Es pregunta frecuente.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Tasa de Rendimiento = [(Valor Final ÷ Valor Inicial) - 1] × 100',
      'items', jsonb_build_array(
        '',
        'O también:',
        'Tasa de Rendimiento = [(Valor Final - Valor Inicial) ÷ Valor Inicial] × 100'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ IMPORTANTE: NO olvides multiplicar por 100 al final para expresarlo en PORCENTAJE.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.5.3 PROCEDIMIENTO PASO A PASO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Pasos para calcular:',
      'items', jsonb_build_array(
        'Paso 1: Identificar Valor Inicial (inversión original)',
        'Paso 2: Identificar Valor Final (valor actual o de venta)',
        'Paso 3: Dividir: Valor Final ÷ Valor Inicial',
        'Paso 4: Restar 1 al resultado',
        'Paso 5: Multiplicar por 100 (para convertir a porcentaje)',
        'Paso 6: Interpretar: positivo = ganancia, negativo = pérdida'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 1: INVERSIÓN EN BIENES RAÍCES (TIPO EXAMEN)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ Este es el ejemplo EXACTO del contenido que proporcionaste. Muy común en el examen.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Una persona compra una casa en $1,230,000 y la vende en $1,950,000. ¿Cuál fue su tasa de rendimiento?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN PASO A PASO:\n\nDatos:\nValor Inicial (compra) = $1,230,000\nValor Final (venta) = $1,950,000\n\nPaso 1: Dividir Valor Final entre Valor Inicial\n1,950,000 ÷ 1,230,000 = 1.5854\n\nPaso 2: Restar 1\n1.5854 - 1 = 0.5854\n\nPaso 3: Multiplicar por 100\n0.5854 × 100 = 58.54%\n\nRespuesta: La tasa de rendimiento es 58.54%'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'INTERPRETACIÓN:\n\n✓ La persona GANÓ 58.54% sobre su inversión inicial\n✓ Es un rendimiento POSITIVO (ganancia)\n✓ Por cada $100 invertidos, ganó $58.54\n✓ En términos absolutos, ganó: 1,950,000 - 1,230,000 = $720,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 2: INVERSIÓN EN ACCIONES'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Compras acciones por $50,000 y las vendes en $62,500. ¿Cuál es tu rendimiento?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: División\n62,500 ÷ 50,000 = 1.25\n\nPaso 2: Restar 1\n1.25 - 1 = 0.25\n\nPaso 3: Multiplicar por 100\n0.25 × 100 = 25%\n\nRespuesta: Rendimiento = 25%\n\nInterpretación: Ganaste el 25% de tu inversión'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 3: PÉRDIDA EN INVERSIÓN'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Compraste un auto en $350,000 y lo vendiste en $280,000. ¿Cuál fue tu rendimiento?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: División\n280,000 ÷ 350,000 = 0.80\n\nPaso 2: Restar 1\n0.80 - 1 = -0.20\n\nPaso 3: Multiplicar por 100\n-0.20 × 100 = -20%\n\nRespuesta: Rendimiento = -20%\n\nInterpretación:\n✓ Rendimiento NEGATIVO = PERDISTE\n✓ Perdiste el 20% de tu inversión\n✓ Pérdida absoluta: 350,000 - 280,000 = $70,000'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ Si el rendimiento es NEGATIVO, significa PÉRDIDA, no ganancia.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 4: SEGUROS DE AHORRO'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: En un seguro dotal pagaste primas por total de $180,000 durante 15 años. Al vencimiento recibes $285,000. ¿Cuál fue tu rendimiento total?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nValor Inicial (lo que pagaste): $180,000\nValor Final (lo que recibiste): $285,000\n\nPaso 1: División\n285,000 ÷ 180,000 = 1.5833\n\nPaso 2: Restar 1\n1.5833 - 1 = 0.5833\n\nPaso 3: Multiplicar por 100\n0.5833 × 100 = 58.33%\n\nRespuesta: Rendimiento total = 58.33%\n\nInterpretación:\n✓ Tu dinero creció 58.33% en 15 años\n✓ Ganancia absoluta: 285,000 - 180,000 = $105,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.5.4 MÉTODO ALTERNATIVO (DIRECTO)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'También puedes calcular directamente la ganancia y dividirla entre el valor inicial:'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'FÓRMULA ALTERNATIVA:\n\nTasa = (Ganancia ÷ Valor Inicial) × 100\n\nEjemplo (mismo caso 1):\nValor Inicial: 1,230,000\nValor Final: 1,950,000\nGanancia: 1,950,000 - 1,230,000 = 720,000\n\nTasa = (720,000 ÷ 1,230,000) × 100\nTasa = 0.5854 × 100\nTasa = 58.54%\n\n✓ Mismo resultado'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ Usa el método que te sea más fácil. Ambos dan el mismo resultado.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.5.5 RENDIMIENTO ANUALIZADO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Si la inversión duró varios años, puedes calcular el rendimiento PROMEDIO anual (aproximado):'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'FÓRMULA SIMPLE (aproximada):\n\nRendimiento Anual = Rendimiento Total ÷ Número de años\n\nEjemplo:\nRendimiento total: 58.33% en 15 años\nRendimiento anual aproximado: 58.33 ÷ 15 = 3.89% anual\n\n⚠️ NOTA: Esta es una aproximación. El cálculo exacto usa fórmulas más complejas.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJERCICIOS DE PRÁCTICA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 1: Compraste en $80,000, vendiste en $104,000. ¿Rendimiento?',
      'items', jsonb_build_array(
        'Respuesta: (104,000 ÷ 80,000 - 1) × 100 = 30%'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 2: Invertiste $25,000, ahora vale $19,500. ¿Rendimiento?',
      'items', jsonb_build_array(
        'Respuesta: (19,500 ÷ 25,000 - 1) × 100 = -22% (pérdida)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 3: Pagaste $150,000 en primas, recibiste $225,000. ¿Rendimiento?',
      'items', jsonb_build_array(
        'Respuesta: (225,000 ÷ 150,000 - 1) × 100 = 50%'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ERRORES COMUNES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO cometas estos errores:',
      'items', jsonb_build_array(
        '❌ Dividir Valor Inicial entre Valor Final (es al revés)',
        '❌ Olvidar restar 1 antes de multiplicar por 100',
        '❌ No multiplicar por 100 al final',
        '❌ Confundir ganancia absoluta ($) con rendimiento porcentual (%)',
        '❌ No interpretar correctamente rendimientos negativos'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 5.5'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        '✓ Tasa de rendimiento = qué tanto creció la inversión (%)',
        '✓ Fórmula: [(Valor Final ÷ Valor Inicial) - 1] × 100',
        '✓ Rendimiento positivo = ganancia',
        '✓ Rendimiento negativo = pérdida',
        '✓ NO olvides multiplicar por 100 al final',
        '✓ Se aplica en seguros de ahorro, inversiones, bienes',
        '✓ Verifica siempre tu resultado'
      )
    )
  )
),
duracion_estimada_minutos = 40,
updated_at = now()
WHERE titulo = 'Lección 5.5 - Tasa de Rendimiento';

-- Crear Lección 5.6: Errores Frecuentes y Cierre
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  '19955a7a-9767-4cef-b648-0c66a11e4dc9',
  'Lección 5.6 - Errores Comunes y Cierre',
  6,
  30,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 5.6: ERRORES FRECUENTES EN CÁLCULOS FINANCIEROS'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️⚠️⚠️ LECCIÓN CRÍTICA: Estos son los errores que REPRUEBAN a la mayoría. Léelos con ATENCIÓN.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Esta lección recopila TODOS los errores comunes del examen de Cédula A en la parte de cálculos financieros.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #1: NO CONVERTIR PORCENTAJE A DECIMAL'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '❌ ERROR MÁS COMÚN: Usar 8% directamente en la calculadora en lugar de 0.08'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DEL ERROR:\n\nProblema: Calcular el 8% de $50,000\n\n❌ MAL: 50,000 × 8 = 400,000 (absurdo)\n✅ BIEN: 50,000 × 0.08 = 4,000\n\nREGLA: SIEMPRE convierte el porcentaje a decimal ANTES de operar.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #2: CONFUNDIR 0.8 CON 0.08'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '0.8 = 80%\n0.08 = 8%\n\nSON MUY DIFERENTES.\n\n⚠️ El CERO antes del punto decimal es CRÍTICO.\n\nEjemplo:\n100,000 × 0.8 = 80,000\n100,000 × 0.08 = 8,000\n\n¡Diferencia de $72,000!'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #3: USAR TASA ANUAL SIN CONVERTIR'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR: Usar 12% anual para calcular interés mensual\n\n✅ CORRECTO:\n1. Convertir a mensual: 12% ÷ 12 = 1%\n2. Luego calcular\n\nREGLA: La tasa y el periodo DEBEN COINCIDIR.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #4: OLVIDAR MULTIPLICAR POR 100 EN CONVERSIÓN'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Problema: Convertir 0.074 a porcentaje\n\n❌ MAL: Responder "0.074%"\n✅ BIEN: 0.074 × 100 = 7.4%\n\nSi respondes el decimal en lugar del porcentaje, está MAL.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #5: REGLA DE TRES AL REVÉS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR: Multiplicar y dividir los valores incorrectos\n\nEjemplo:\nSi 850,000 → 5,200\nEntonces 1,200,000 → X\n\n❌ MAL: X = (850,000 × 5,200) ÷ 1,200,000 = 3,677\n✅ BIEN: X = (1,200,000 × 5,200) ÷ 850,000 = 7,341\n\nREGLA: Multiplica EN CRUZ, divide por el que queda solo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #6: NO VERIFICAR LÓGICA DEL RESULTADO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\nSuma asegurada AUMENTÓ de $500,000 a $800,000\nSi tu prima DISMINUYÓ, algo está MAL.\n\nREGLA: Siempre pregúntate: "¿Este resultado tiene sentido lógico?"'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #7: CONFUNDIR DEDUCIBLE CON COASEGURO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Siniestro: $50,000\n\nDEDUCIBLE $5,000:\nAsegurado paga: $5,000\nAseguradora paga: $45,000\n\nCOASEGURO 10%:\nAsegurado paga: $5,000 (10% de 50,000)\nAseguradora paga: $45,000\n\n⚠️ Mismo resultado pero CONCEPTO diferente.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #8: ORDEN DE OPERACIONES EN CALCULADORA'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Al calcular: (1,200,000 × 5,200) ÷ 850,000\n\n❌ MAL: Dividir antes de terminar la multiplicación\n✅ BIEN:\n1. Primero: 1,200,000 × 5,200 = 6,240,000,000\n2. Después: 6,240,000,000 ÷ 850,000 = 7,341.18\n\nO usar paréntesis en calculadora científica.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #9: REDONDEO INCORRECTO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Para DINERO: siempre 2 decimales\n\nEjemplo:\n7,341.176 → $7,341.18 (redondeado)\nNO dejar: $7,341.176 ❌\nNO dejar: $7,341 ❌\nNO dejar: $7,341.2 ❌'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #10: CONFUNDIR INCREMENTO CON DECREMENTO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'INCREMENTO 10%:\nValor × (1 + 0.10) = Valor × 1.10 ✅\n\nDECREMENTO 10%:\nValor × (1 - 0.10) = Valor × 0.90 ✅\n\n❌ ERROR: Usar 1.10 para ambos casos'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CHECKLIST ANTES DE RESPONDER'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Antes de marcar tu respuesta, verifica:',
        'items', jsonb_build_array(
          '✓ ¿Convertí el porcentaje a decimal?',
          '✓ ¿La tasa y el periodo coinciden?',
          '✓ ¿Multipliqué por 100 al convertir a porcentaje?',
          '✓ ¿Apliqué correctamente la regla de tres?',
          '✓ ¿Mi resultado tiene sentido lógico?',
          '✓ ¿Redondeé correctamente (2 decimales para dinero)?',
          '✓ ¿Usé incremento o decremento según corresponda?',
          '✓ ¿Verifiqué el orden de operaciones en mi calculadora?'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CONSEJOS FINALES PARA EL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Tips que te ayudarán:',
        'items', jsonb_build_array(
          '1. PRACTICA con calculadora similar a la del examen',
          '2. Escribe los pasos en tu borrador (no solo el resultado)',
          '3. Si un resultado parece absurdo, recalcula',
          '4. Lee bien el problema: ¿qué te están preguntando?',
          '5. Verifica las unidades (pesos, porcentajes, etc.)',
          '6. Si te trabas, pasa a la siguiente y regresa después',
          '7. Revisa tus respuestas si te sobra tiempo',
          '8. Confía en tu preparación'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CIERRE DEL MÓDULO 5'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 FELICIDADES: Has completado el módulo de Cálculos Financieros Básicos.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Este módulo te ha proporcionado TODAS las herramientas matemáticas necesarias para resolver correctamente los ejercicios del examen de Cédula A.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Has aprendido a:',
        'items', jsonb_build_array(
          '✅ Convertir porcentajes a decimales y viceversa',
          '✅ Calcular porcentajes de cantidades',
          '✅ Aplicar incrementos y decrementos',
          '✅ Convertir tasas entre diferentes periodos',
          '✅ Resolver ejercicios de regla de tres (el más frecuente)',
          '✅ Entender capitalización e interés compuesto',
          '✅ Calcular tasas de rendimiento',
          '✅ Evitar los errores más comunes'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ RECUERDA: No se requieren matemáticas avanzadas. Solo ORDEN, LÓGICA y PRÁCTICA.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Los cálculos del examen están diseñados para ser resueltos con:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Lo que necesitas:',
        'items', jsonb_build_array(
          '✓ Una calculadora básica',
          '✓ Conocimiento de las fórmulas de este módulo',
          '✓ Lógica y sentido común',
          '✓ Verificación de resultados'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'PRÓXIMOS PASOS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Después de dominar este módulo:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para aprobar el examen:',
        'items', jsonb_build_array(
          '1. PRACTICA los ejercicios de este módulo varias veces',
          '2. Resuelve ejercicios de muestra del examen CNSF',
          '3. Simula condiciones de examen (tiempo limitado)',
          '4. Identifica tus áreas débiles y refuerza',
          '5. Revisa la lección de errores comunes antes del examen'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 TÚ PUEDES: Con la preparación adecuada, estos ejercicios son RESOLUBLES y te darán puntos SEGUROS en el examen.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN COMPLETO MÓDULO 5'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Conceptos clave del módulo:',
        'items', jsonb_build_array(
          'Lección 5.1: Porcentajes y decimales (base de todo)',
          'Lección 5.2: Tasas de interés y conversiones entre periodos',
          'Lección 5.3: Regla de tres (pregunta más frecuente)',
          'Lección 5.4: Capitalización e interés compuesto',
          'Lección 5.5: Tasa de rendimiento',
          'Lección 5.6: Errores comunes (evítalos para aprobar)',
          '',
          '✅ Estás preparado para la sección de cálculos del examen'
        )
      )
    )
  )
);