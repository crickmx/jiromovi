/*
  # Expansión Lecciones 5.2 y 5.3 del Módulo 5

  1. Expandir Lección 5.2: Tasas de Interés (conversiones entre periodos)
  2. Expandir Lección 5.3: Regla de Tres (múltiples ejercicios paso a paso)
*/

-- Lección 5.2: Tasas de Interés
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 5.2: TASAS DE INTERÉS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ PREGUNTA FRECUENTE EN EL EXAMEN: Convertir tasas anuales a otros periodos. Debes MEMORIZAR los procedimientos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.2.1 CONCEPTO DE TASA DE INTERÉS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La TASA DE INTERÉS es el porcentaje que se aplica a un capital durante un periodo determinado de tiempo.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La tasa de interés puede expresarse de DOS formas:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Formas de expresión:',
      'items', jsonb_build_array(
        '1. En PORCENTAJE: 12%, 8%, 7.5%',
        '2. En DECIMAL: 0.12, 0.08, 0.075'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ IMPORTANTE: SIEMPRE debe especificarse el PERIODO de la tasa. No es lo mismo 12% anual que 12% mensual.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PERIODOS MÁS COMUNES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Las tasas de interés pueden ser:',
      'items', jsonb_build_array(
        '✓ ANUAL (1 periodo por año) - La más común',
        '✓ SEMESTRAL (2 periodos por año)',
        '✓ CUATRIMESTRAL (3 periodos por año)',
        '✓ TRIMESTRAL (4 periodos por año)',
        '✓ BIMESTRAL (6 periodos por año)',
        '✓ MENSUAL (12 periodos por año)',
        '✓ QUINCENAL (24 periodos por año)',
        '✓ SEMANAL (52 periodos por año)',
        '✓ DIARIA (365 periodos por año)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ MEMORIZA: Cuántos periodos tiene cada uno. Es CLAVE para las conversiones.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.2.2 CONVERSIÓN DE TASA ANUAL A OTRO PERIODO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para convertir una tasa ANUAL a otro periodo, se DIVIDE entre el número de periodos que hay en un año.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA GENERAL:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Tasa del periodo = Tasa anual ÷ Número de periodos en el año',
      'items', jsonb_build_array(
        'Ejemplo: Tasa mensual = Tasa anual ÷ 12'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TABLA DE CONVERSIONES (MEMORIZA)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Para convertir de tasa ANUAL a:',
      'items', jsonb_build_array(
        'MENSUAL: Dividir entre 12',
        'BIMESTRAL: Dividir entre 6',
        'TRIMESTRAL: Dividir entre 4',
        'CUATRIMESTRAL: Dividir entre 3',
        'SEMESTRAL: Dividir entre 2'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLOS RESUELTOS PASO A PASO'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: Convertir 12% anual a tasa mensual\n\nDato: Tasa anual = 12%\n¿Pregunta? Tasa mensual = ?\n\nPaso 1: Identificar número de periodos\nUn año tiene 12 meses\n\nPaso 2: Dividir\n12% ÷ 12 = 1% mensual\n\nPaso 3: Expresar en decimal (si se requiere)\n1% = 0.01\n\nRespuesta: La tasa mensual es 1% o 0.01'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2: Convertir 24% anual a tasa bimestral\n\nDato: Tasa anual = 24%\n¿Pregunta? Tasa bimestral = ?\n\nPaso 1: Identificar número de periodos\nUn año tiene 6 bimestres (12 meses ÷ 2)\n\nPaso 2: Dividir\n24% ÷ 6 = 4% bimestral\n\nPaso 3: Expresar en decimal\n4% = 0.04\n\nRespuesta: La tasa bimestral es 4% o 0.04'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 3 (TIPO EXAMEN CNSF): Calcula la tasa cuatrimestral del 27% anual\n\nDato: Tasa anual = 27%\n¿Pregunta? Tasa cuatrimestral = ?\n\nPaso 1: Identificar número de periodos\nUn año tiene 3 cuatrimestres (12 meses ÷ 4)\n\nPaso 2: Dividir\n27% ÷ 3 = 9% cuatrimestral\n\nPaso 3: Expresar en decimal\n9% = 0.09\n\nRespuesta: La tasa cuatrimestral es 9% o 0.09'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 4: Convertir 18% anual a tasa trimestral\n\nDato: Tasa anual = 18%\n¿Pregunta? Tasa trimestral = ?\n\nPaso 1: Identificar número de periodos\nUn año tiene 4 trimestres (12 meses ÷ 3)\n\nPaso 2: Dividir\n18% ÷ 4 = 4.5% trimestral\n\nPaso 3: Expresar en decimal\n4.5% = 0.045\n\nRespuesta: La tasa trimestral es 4.5% o 0.045'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 5: Convertir 9% anual a tasa semestral\n\nDato: Tasa anual = 9%\n¿Pregunta? Tasa semestral = ?\n\nPaso 1: Identificar número de periodos\nUn año tiene 2 semestres\n\nPaso 2: Dividir\n9% ÷ 2 = 4.5% semestral\n\nPaso 3: Expresar en decimal\n4.5% = 0.045\n\nRespuesta: La tasa semestral es 4.5% o 0.045'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.2.3 CONVERSIÓN DE CUALQUIER PERIODO A TASA ANUAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para convertir una tasa de cualquier periodo a tasa ANUAL, se MULTIPLICA por el número de periodos en el año.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA: Tasa anual = Tasa del periodo × Número de periodos en el año'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: Una inversión ofrece 1.5% mensual. ¿Cuál es la tasa anual?\n\nDato: Tasa mensual = 1.5%\n¿Pregunta? Tasa anual = ?\n\nPaso 1: Identificar periodos\nHay 12 meses en un año\n\nPaso 2: Multiplicar\n1.5% × 12 = 18% anual\n\nRespuesta: La tasa anual es 18%\n\n⚠️ NOTA: Este cálculo es aproximado (interés simple). Para interés compuesto la fórmula es diferente, pero el examen usa este método.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2: Un crédito cobra 5% bimestral. ¿Cuál es la tasa anual?\n\nDato: Tasa bimestral = 5%\n¿Pregunta? Tasa anual = ?\n\nPaso 1: Identificar periodos\nHay 6 bimestres en un año\n\nPaso 2: Multiplicar\n5% × 6 = 30% anual\n\nRespuesta: La tasa anual es 30%'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.2.4 APLICACIÓN EN SEGUROS DE AHORRO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En los seguros de vida con componente de ahorro (dotales, vida entera con ahorro), las aseguradoras invierten las primas y generan rendimientos.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO PRÁCTICO: Un seguro dotal ofrece rendimiento del 6% anual. Si inviertes $50,000 durante 1 año, ¿cuánto interés generarás?\n\nDato: Capital = $50,000\nTasa anual = 6% = 0.06\nTiempo = 1 año\n\nProcedimiento:\nInterés = Capital × Tasa × Tiempo\nInterés = 50,000 × 0.06 × 1\nInterés = 3,000\n\nRespuesta: Generarás $3,000 de interés\nMonto final = 50,000 + 3,000 = $53,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.2.5 TASAS NOMINALES VS TASAS EFECTIVAS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ CONCEPTO IMPORTANTE: En el examen pueden preguntar la diferencia.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Tasa NOMINAL: Es la tasa anual que se anuncia, sin considerar capitalización.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Tasa EFECTIVA: Es la tasa real que se gana considerando la capitalización de intereses.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO: Un banco anuncia 12% anual con capitalización mensual.\n\nTasa NOMINAL = 12% anual\nTasa mensual = 12% ÷ 12 = 1% mensual\n\nPero si los intereses se reinvierten cada mes (capitalización), la tasa EFECTIVA anual será mayor a 12% (aproximadamente 12.68%).\n\nPara el examen básico de Cédula A, se usa principalmente la tasa NOMINAL.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJERCICIOS DE PRÁCTICA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 1: Convierte 36% anual a tasa mensual',
      'items', jsonb_build_array(
        'Respuesta: 36% ÷ 12 = 3% mensual'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 2: Convierte 15% anual a tasa cuatrimestral',
      'items', jsonb_build_array(
        'Respuesta: 15% ÷ 3 = 5% cuatrimestral'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 3: Una tarjeta cobra 4% mensual. ¿Cuál es la tasa anual?',
      'items', jsonb_build_array(
        'Respuesta: 4% × 12 = 48% anual'
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
        '❌ Multiplicar cuando debes dividir (o viceversa)',
        '❌ Confundir el número de periodos (cuatrimestre ≠ trimestre)',
        '❌ Olvidar que un bimestre son 2 meses (año = 6 bimestres)',
        '❌ Usar la tasa anual directamente en cálculos mensuales',
        '❌ No verificar que tu respuesta tenga sentido'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 5.2'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        '✓ Tasa de interés = porcentaje aplicado en un periodo',
        '✓ SIEMPRE especificar el periodo (anual, mensual, etc.)',
        '✓ Anual a otro periodo: DIVIDIR entre número de periodos',
        '✓ Otro periodo a anual: MULTIPLICAR por número de periodos',
        '✓ Año = 12 meses = 6 bimestres = 4 trimestres = 3 cuatrimestres = 2 semestres',
        '✓ En seguros de ahorro: tasas determinan rendimientos',
        '✓ Verifica siempre tu respuesta'
      )
    )
  )
),
duracion_estimada_minutos = 45,
updated_at = now()
WHERE titulo = 'Lección 5.2 - Tasas de Interés';

-- Lección 5.3: Regla de Tres
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 5.3: REGLA DE TRES SIMPLE'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐⭐⭐ MUY IMPORTANTE: La regla de tres es EL EJERCICIO MÁS FRECUENTE del examen. Debes DOMINARLA.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.3.1 CONCEPTO DE REGLA DE TRES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La REGLA DE TRES es un método matemático para encontrar un valor desconocido cuando existe una relación de PROPORCIONALIDAD entre cantidades.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Se utiliza cuando:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Condiciones para usar regla de tres:',
      'items', jsonb_build_array(
        '✓ Existe una relación PROPORCIONAL entre dos magnitudes',
        '✓ Se conocen TRES valores',
        '✓ Se desea encontrar el CUARTO valor',
        '✓ Si una cantidad aumenta, la otra también aumenta (proporción directa)',
        '✓ O si una aumenta, la otra disminuye (proporción inversa, menos común)'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'USO EN SEGUROS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En seguros, la regla de tres se usa CONSTANTEMENTE para:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Aplicaciones:',
      'items', jsonb_build_array(
        '✓ Calcular PRIMAS para diferentes sumas aseguradas',
        '✓ Determinar INDEMNIZACIONES proporcionales',
        '✓ Calcular primas por periodos CORTOS (fracciones de año)',
        '✓ Determinar COASEGUROS y regla proporcional',
        '✓ Ajustar valores por TIEMPO transcurrido'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.3.2 ESTRUCTURA DE LA REGLA DE TRES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La regla de tres tiene esta estructura:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Si A es a B, entonces C es a X',
      'items', jsonb_build_array(
        'A → B',
        'C → X',
        '',
        'Fórmula: X = (C × B) ÷ A'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ REGLA DE ORO: Se multiplica CRUZADO y se divide por el que queda.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.3.3 PROCEDIMIENTO PASO A PASO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Pasos para resolver:',
      'items', jsonb_build_array(
        'Paso 1: IDENTIFICAR las dos magnitudes (ej: suma asegurada y prima)',
        'Paso 2: ORDENAR los datos en tabla (conocidos arriba, lo que buscas abajo)',
        'Paso 3: VERIFICAR que sea proporción directa (si uno sube, el otro sube)',
        'Paso 4: MULTIPLICAR en forma de cruz (diagonal)',
        'Paso 5: DIVIDIR entre el valor que queda',
        'Paso 6: VERIFICAR que el resultado tenga sentido lógico'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 1: CÁLCULO DE PRIMA (TIPO EXAMEN MÁS COMÚN)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ MEMORIZA ESTE EJEMPLO. Es el MÁS FRECUENTE en el examen.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Una póliza de seguro tiene los siguientes datos:\n• Suma asegurada: $850,000\n• Prima anual: $5,200\n\n¿Cuál será la prima para una suma asegurada de $1,200,000?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN PASO A PASO:\n\nPaso 1: Identificar magnitudes\nMagnitud A: Suma asegurada\nMagnitud B: Prima\n\nPaso 2: Ordenar en tabla\n\nSuma Asegurada | Prima\n850,000        | 5,200\n1,200,000      | X (lo que buscamos)\n\nPaso 3: Verificar proporcionalidad\n✓ A mayor suma asegurada → mayor prima\n✓ Es proporción DIRECTA\n\nPaso 4: Plantear la ecuación\n850,000 es a 5,200\ncomo\n1,200,000 es a X\n\nPaso 5: Multiplicar en cruz\n850,000 × X = 1,200,000 × 5,200\n\nPaso 6: Despejar X\nX = (1,200,000 × 5,200) ÷ 850,000\nX = 6,240,000,000 ÷ 850,000\nX = 7,341.176...\n\nPaso 7: Redondear\nX = $7,341.18\n\nRespuesta: La prima será de $7,341.18'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'VERIFICACIÓN LÓGICA:\n\n✓ La suma asegurada AUMENTÓ de $850,000 a $1,200,000\n✓ Por lo tanto, la prima DEBE AUMENTAR también\n✓ Prima original: $5,200\n✓ Prima nueva: $7,341.18\n✓ ✅ CORRECTO: La prima aumentó\n\nSi tu resultado hubiera dado una prima MENOR, estaría MAL.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 2: PRIMA PROPORCIONAL POR TIEMPO'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Una póliza anual cuesta $8,400. ¿Cuánto se debe pagar si solo se contrata por 7 meses?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: Identificar magnitudes\nMagnitud A: Tiempo (meses)\nMagnitud B: Prima\n\nPaso 2: Ordenar datos\n\nTiempo (meses) | Prima\n12             | 8,400\n7              | X\n\nPaso 3: Verificar proporcionalidad\n✓ A mayor tiempo → mayor prima\n✓ Proporción DIRECTA\n\nPaso 4: Multiplicar en cruz\n12 × X = 7 × 8,400\n\nPaso 5: Despejar X\nX = (7 × 8,400) ÷ 12\nX = 58,800 ÷ 12\nX = 4,900\n\nRespuesta: Se debe pagar $4,900 por 7 meses\n\nVerificación: ✓ Es menos que la prima anual completa'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 3: INDEMNIZACIÓN PROPORCIONAL'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Un bien vale $1,500,000 pero solo se aseguró por $900,000. Ocurre un siniestro de $120,000. Según la regla proporcional, ¿cuánto indemniza la aseguradora?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: Identificar magnitudes\nMagnitud A: Valor asegurado vs valor real\nMagnitud B: Indemnización\n\nPaso 2: Ordenar datos\n\nValor Real    | Siniestro que se pagaría\n1,500,000     | 120,000\n\nValor Asegurado | Indemnización real\n900,000         | X\n\nPaso 3: Plantear proporción\nSi el bien estuviera 100% asegurado (1,500,000), se pagarían 120,000\nPero solo está asegurado por 900,000, entonces se paga X\n\nPaso 4: Multiplicar en cruz\n1,500,000 × X = 900,000 × 120,000\n\nPaso 5: Despejar X\nX = (900,000 × 120,000) ÷ 1,500,000\nX = 108,000,000,000 ÷ 1,500,000\nX = 72,000\n\nRespuesta: La aseguradora indemniza $72,000\n\nVerificación:\n✓ El bien está asegurado al 60% de su valor (900,000 ÷ 1,500,000 = 0.6)\n✓ Por lo tanto, se paga el 60% del siniestro: 120,000 × 0.6 = 72,000\n✓ ✅ CORRECTO'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 4: CONVERSIÓN DE SUMA ASEGURADA'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Si 3 kg de café cuestan $285, ¿cuánto costarán 7 kg?\n\n(Este tipo de problema es análogo a los de seguros)'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: Ordenar datos\n\nKilogramos | Precio\n3          | 285\n7          | X\n\nPaso 2: Multiplicar en cruz\n3 × X = 7 × 285\n\nPaso 3: Despejar\nX = (7 × 285) ÷ 3\nX = 1,995 ÷ 3\nX = 665\n\nRespuesta: 7 kg costarán $665'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLO 5: RENDIMIENTO PROPORCIONAL'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'PROBLEMA: Una inversión de $50,000 generó $4,200 de intereses en un año. ¿Cuánto generarían $85,000 a la misma tasa?'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'SOLUCIÓN:\n\nPaso 1: Ordenar datos\n\nCapital | Intereses\n50,000  | 4,200\n85,000  | X\n\nPaso 2: Multiplicar en cruz\n50,000 × X = 85,000 × 4,200\n\nPaso 3: Despejar\nX = (85,000 × 4,200) ÷ 50,000\nX = 357,000,000 ÷ 50,000\nX = 7,140\n\nRespuesta: Generarían $7,140 de intereses'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.3.4 MÉTODO ALTERNATIVO: FACTOR DE PROPORCIONALIDAD'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Existe un método alternativo más rápido una vez que dominas el concepto:'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'MÉTODO DEL FACTOR:\n\n1. Calcula el FACTOR: Divide el nuevo valor entre el original\n2. Multiplica la prima original por ese factor\n\nEjemplo (mismo del Ejemplo 1):\nSuma original: $850,000 → Prima: $5,200\nSuma nueva: $1,200,000 → Prima: ?\n\nPaso 1: Factor = 1,200,000 ÷ 850,000 = 1.4118\n\nPaso 2: Prima nueva = 5,200 × 1.4118 = 7,341.36\n\nRespuesta: $7,341.36 (igual resultado)'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJERCICIOS DE PRÁCTICA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 1: Una póliza con SA de $500,000 cuesta $3,750. ¿Cuánto costará con SA de $750,000?',
      'items', jsonb_build_array(
        'Respuesta: (750,000 × 3,750) ÷ 500,000 = $5,625'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 2: Una prima anual es $6,000. ¿Cuánto se paga por 5 meses?',
      'items', jsonb_build_array(
        'Respuesta: (5 × 6,000) ÷ 12 = $2,500'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 3: Si $100,000 generan $8,000 de interés, ¿cuánto generan $250,000?',
      'items', jsonb_build_array(
        'Respuesta: (250,000 × 8,000) ÷ 100,000 = $20,000'
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
        '❌ Multiplicar o dividir valores incorrectos',
        '❌ Colocar los datos desordenados en la tabla',
        '❌ No verificar si la respuesta tiene sentido lógico',
        '❌ Confundir cuál valor va en el numerador vs denominador',
        '❌ Olvidar redondear a dos decimales (dinero)',
        '❌ Usar calculadora incorrectamente (orden de operaciones)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ CONSEJO: Antes de responder, pregúntate: "¿Mi respuesta tiene sentido lógico?" Si aumentó la suma, ¿aumentó la prima? Si disminuyó el tiempo, ¿disminuyó el costo?'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 5.3'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        '✓ Regla de tres = encontrar valor desconocido por proporcionalidad',
        '✓ Se usa CONSTANTEMENTE en seguros (primas, indemnizaciones, tiempo)',
        '✓ Estructura: Si A es a B, entonces C es a X',
        '✓ Fórmula: X = (C × B) ÷ A (multiplicas cruzado, divides por el que queda)',
        '✓ SIEMPRE ordena datos en tabla antes de resolver',
        '✓ SIEMPRE verifica que tu respuesta tenga sentido lógico',
        '✓ Redondea a 2 decimales cuando sea dinero',
        '✓ Practica MUCHO este tipo de ejercicios'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐⭐⭐ La regla de tres es EL EJERCICIO MÁS IMPORTANTE del examen. Domínala y ganarás muchos puntos.'
    )
  )
),
duracion_estimada_minutos = 55,
updated_at = now()
WHERE titulo = 'Lección 5.3 - Regla de Tres';