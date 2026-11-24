/*
  # Módulo 6 - Lecciones 6.5, 6.6 y 6.7

  Simulador, interpretación de resultados y estrategia
*/

-- Lección 6.5: Simulador Conceptual
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.5 - Simulador de Examen',
  5,
  120,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.5: SIMULADOR DE EXAMEN CÉDULA A'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⏱️ EXAMEN DE PRÁCTICA: Esta lección contiene un simulador completo. Resérvate 2-3 horas sin interrupciones.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'INSTRUCCIONES PARA EL SIMULADOR'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Este simulador está diseñado para replicar las condiciones del examen REAL de la CNSF.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'CÓMO USAR ESTE SIMULADOR:',
        'items', jsonb_build_array(
          '1. Busca un lugar TRANQUILO sin interrupciones',
          '2. Ten lápiz, papel y calculadora',
          '3. Establece un tiempo límite (2-3 horas)',
          '4. NO consultes materiales durante el examen',
          '5. Responde TODAS las preguntas (no dejes en blanco)',
          '6. Al terminar, revisa tus respuestas',
          '7. Analiza tus errores por área'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ IMPORTANTE: Trata este simulador como si fuera el examen REAL. Así identificas tu nivel real de preparación.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ESTRUCTURA DEL SIMULADOR'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El simulador contiene aproximadamente 80-100 preguntas distribuidas en las 4 áreas del examen:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Distribución de preguntas:',
        'items', jsonb_build_array(
          'Área 1 - Marco Legal: 25-30 preguntas',
          'Área 2 - Seguros de Personas: 25-30 preguntas',
          'Área 3 - Seguros de Daños: 20-25 preguntas',
          'Área 4 - Sistema Financiero y Cálculos: 20-25 preguntas'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '📝 NOTA: El simulador completo de preguntas se debe implementar en la interfaz interactiva de la plataforma. Esta lección proporciona la estructura y ejemplos.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'EJEMPLOS DE PREGUNTAS POR ÁREA'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 1: MARCO LEGAL Y OPERATIVO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 1: ¿Qué autoridad supervisa y regula a las instituciones de seguros?\nA) CONDUSEF\nB) CNBV\nC) CNSF\nD) SHCP\n\nRespuesta correcta: C'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 2: ¿Cuál es una obligación del agente de seguros?\nA) Vender solo productos de una aseguradora\nB) Informar veraz y completamente al cliente\nC) Maximizar sus comisiones\nD) Ocultar exclusiones complejas\n\nRespuesta correcta: B'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 3: El contrato de seguro es de naturaleza:\nA) Unilateral\nB) Gratuito\nC) Aleatorio\nD) Verbal\n\nRespuesta correcta: C'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 2: SEGUROS DE PERSONAS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 4: Un asegurado tiene GMM con deducible $12,000 y coaseguro 10%. Gasto: $60,000. ¿Cuánto paga?\nA) $12,000\nB) $16,800\nC) $6,000\nD) $18,000\n\nRespuesta correcta: B\nCálculo: (60,000 - 12,000) × 0.10 + 12,000 = 4,800 + 12,000 = 16,800'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 5: ¿Qué es una preexistencia en GMM?\nA) Enfermedad diagnosticada antes de la contratación\nB) Cualquier enfermedad hereditaria\nC) Accidente previo\nD) Medicamento que ya tomaba\n\nRespuesta correcta: A'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 3: SEGUROS DE DAÑOS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 6: La cobertura de Responsabilidad Civil en autos cubre:\nA) Daños al vehículo propio\nB) Daños a terceros causados por el asegurado\nC) Robo del vehículo\nD) Gastos del asegurado\n\nRespuesta correcta: B'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 7: Se considera pérdida total cuando la reparación excede:\nA) 50% del valor del vehículo\nB) 75% del valor del vehículo\nC) 90% del valor del vehículo\nD) 100% del valor del vehículo\n\nRespuesta correcta: B'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 4: SISTEMA FINANCIERO Y CÁLCULOS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 8: Una póliza con SA $700,000 cuesta $5,600. ¿Cuánto cuesta SA $1,000,000?\nA) $7,000\nB) $8,000\nC) $7,500\nD) $8,500\n\nRespuesta correcta: B\nCálculo: (1,000,000 × 5,600) ÷ 700,000 = 8,000'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Pregunta 9: ¿Qué institución supervisa a las AFORES?\nA) CNSF\nB) CNBV\nC) CONSAR\nD) CONDUSEF\n\nRespuesta correcta: C'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RECOMENDACIONES PARA EL SIMULADOR'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Consejos:',
        'items', jsonb_build_array(
          '✓ Lee CADA pregunta COMPLETA antes de responder',
          '✓ Si no sabes, ELIMINA opciones incorrectas',
          '✓ En cálculos, VERIFICA tu operación',
          '✓ NO te quedes atascado en una pregunta',
          '✓ Marca respuestas dudosas para revisar',
          '✓ Administra tu TIEMPO',
          '✓ Al final, REVISA tus respuestas',
          '✓ Cambia respuesta solo si estás SEGURO'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💡 El objetivo del simulador es IDENTIFICAR tus áreas débiles, NO obtener 100%. Es normal fallar algunas.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'DESPUÉS DEL SIMULADOR'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Al terminar el simulador:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Pasos siguientes:',
        'items', jsonb_build_array(
          '1. Calcula tu porcentaje de aciertos',
          '2. Identifica en qué ÁREA fallaste más',
          '3. Analiza el TIPO de errores (conceptual, cálculo, lectura)',
          '4. Repasa los módulos donde tuviste más errores',
          '5. Vuelve a hacer el simulador después de repasar',
          '6. Objetivo: Alcanzar consistentemente 75-80% o más'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'INTERPRETACIÓN DE RESULTADOS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Si obtuviste:',
        'items', jsonb_build_array(
          '85-100%: EXCELENTE - Estás muy preparado',
          '75-84%: MUY BIEN - Repasa áreas débiles',
          '70-74%: BIEN - Necesitas repasar más',
          '60-69%: REGULAR - Refuerza conocimientos',
          'Menos de 60%: INSUFICIENTE - Estudia más antes del examen'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ META: Antes de presentar el examen real, debes obtener consistentemente 75% o más en el simulador.'
      )
    )
  )
);

-- Lección 6.6: Interpretación de Resultados
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.6 - Interpretación de Resultados',
  6,
  30,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.6: INTERPRETACIÓN DE RESULTADOS DEL SIMULADOR'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '📊 ANÁLISIS ESTRATÉGICO: No basta con saber tu calificación. Debes ANALIZAR tus errores para mejorar.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.1 ANÁLISIS POR PORCENTAJE GLOBAL'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Tu porcentaje total te dice tu nivel GENERAL de preparación, pero no es suficiente.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nResultado: 72% de aciertos (58 de 80 preguntas)\n\n✅ Análisis inicial:\n- Estás CERCA del 70% requerido\n- Necesitas mejorar en 3-5% más\n- NO estás listo aún, pero vas bien\n\nPero esto NO te dice QUÉ estudiar más.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.2 ANÁLISIS POR ÁREA'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ CLAVE: Debes analizar tu resultado POR ÁREA, no solo global.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE ANÁLISIS DETALLADO:\n\nResultado global: 72% (58/80)\n\nDesglose por área:\n✓ Marco Legal: 21/25 (84%) - MUY BIEN\n✓ Personas: 18/25 (72%) - REGULAR\n❌ Daños: 12/20 (60%) - INSUFICIENTE\n✓ Financiero: 7/10 (70%) - APENAS BIEN\n\n📊 DIAGNÓSTICO:\n- Tu área DÉBIL es Daños (60%)\n- Personas necesita refuerzo (72%)\n- Marco Legal está bien (84%)\n- Financiero está justo (70%)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'PLAN DE ACCIÓN basado en este análisis:',
        'items', jsonb_build_array(
          '1. PRIORIDAD ALTA: Repasar Módulo 3 (Daños/Autos) completo',
          '2. PRIORIDAD MEDIA: Reforzar Módulo 2 (GMM y cálculos)',
          '3. PRIORIDAD BAJA: Repasar rápido Módulo 5 (Cálculos)',
          '4. MANTENER: Módulo 1 está dominado'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.3 ANÁLISIS POR TIPO DE ERROR'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'No todos los errores son iguales. Identifica QUÉ TIPO de error cometes más:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'TIPO 1: Errores CONCEPTUALES',
        'items', jsonb_build_array(
          '❌ No entendiste el concepto',
          '❌ Confundiste términos similares',
          '❌ Memorizaste mal',
          '',
          '🔧 SOLUCIÓN: Repasar el tema en el módulo correspondiente'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'TIPO 2: Errores de CÁLCULO',
        'items', jsonb_build_array(
          '❌ Error aritmético',
          '❌ Usaste fórmula incorrecta',
          '❌ No convertiste porcentaje a decimal',
          '',
          '🔧 SOLUCIÓN: Practicar más ejercicios del Módulo 5'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'TIPO 3: Errores de LECTURA',
        'items', jsonb_build_array(
          '❌ No leíste completa la pregunta',
          '❌ No viste palabra clave (NO, EXCEPTO)',
          '❌ Leíste rápido y malinterpretaste',
          '',
          '🔧 SOLUCIÓN: Leer MÁS DESPACIO, dos veces cada pregunta'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'TIPO 4: Errores de PROCEDIMIENTO',
        'items', jsonb_build_array(
          '❌ No sabías el procedimiento correcto',
          '❌ Confundiste orden de pasos',
          '',
          '🔧 SOLUCIÓN: Repasar procedimientos específicos'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE ANÁLISIS POR TIPO:\n\nDe tus 22 errores:\n- 12 fueron CONCEPTUALES (55%) ← Principal problema\n- 5 fueron de CÁLCULO (23%)\n- 3 fueron de LECTURA (14%)\n- 2 fueron de PROCEDIMIENTO (8%)\n\n📊 DIAGNÓSTICO:\nTu problema principal es CONCEPTUAL, no de técnica.\nNecesitas COMPRENDER mejor los temas, no solo memorizarlos.\n\n🔧 ACCIÓN:\nRepasa los módulos ENTENDIENDO, no solo leyendo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.4 ERRORES RECURRENTES'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Identifica si cometes el MISMO tipo de error en diferentes preguntas:'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PATRÓN DETECTADO:\n\nErrores en 5 preguntas:\n- Todas preguntan por DIFERENCIAS entre conceptos\n- Todas tienen respuestas que PARECEN correctas\n- Todas requieren PRECISIÓN en la definición\n\n📊 DIAGNÓSTICO:\nTienes dificultad para DIFERENCIAR conceptos similares.\n\n🔧 ACCIÓN:\nHaz tabla comparativa de conceptos similares:\n- Deducible vs Coaseguro vs Copago\n- RC vs DM vs RT\n- GMM vs Salud\n- CNSF vs CONDUSEF'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.5 PROGRESO ENTRE INTENTOS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Si haces el simulador MÚLTIPLES VECES, compara resultados:'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE PROGRESO:\n\nIntento 1: 65%\nIntento 2: 72% (+7%)\nIntento 3: 78% (+6%)\nIntento 4: 81% (+3%)\n\n📊 ANÁLISIS:\n✅ Progreso CONSTANTE y POSITIVO\n✅ Cada vez mejoras menos (normal, te acercas al límite)\n✅ Ya estás en nivel APROBATORIO (>70%)\n✅ Con 81% consistente, estás LISTO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ Si tu resultado BAJA entre intentos, algo está mal. Puede ser cansancio o falta de repaso.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.6.6 CUÁNDO ESTÁS LISTO PARA EL EXAMEN REAL'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Estás listo cuando cumples TODOS estos criterios:',
        'items', jsonb_build_array(
          '✅ Obtienes CONSISTENTEMENTE 75% o más (3 intentos seguidos)',
          '✅ NINGUNA área está por debajo de 65%',
          '✅ Entiendes POR QUÉ cada respuesta correcta es correcta',
          '✅ Entiendes POR QUÉ fallaste cada error',
          '✅ Tus errores son cada vez MENOS y más ALEATORIOS',
          '✅ Ya NO cometes el mismo tipo de error repetido',
          '✅ Te sientes CONFIADO (no nervioso) con el material'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ NO te presentes al examen real si obtienes menos de 70% consistentemente en el simulador. Estudia más.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.6'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave sobre interpretación de resultados:',
        'items', jsonb_build_array(
          '✓ No basta con el porcentaje global, analiza POR ÁREA',
          '✓ Identifica tu área MÁS DÉBIL y refuérzala',
          '✓ Clasifica errores: conceptual, cálculo, lectura, procedimiento',
          '✓ Detecta PATRONES en tus errores',
          '✓ Haz múltiples intentos y compara progreso',
          '✓ Meta: 75% o más CONSISTENTE en todas las áreas',
          '✓ Entiende POR QUÉ errores y aciertos',
          '✓ Solo preséntate al examen real cuando estés consistentemente arriba de 75%'
        )
      )
    )
  )
);

-- Lección 6.7: Estrategia para Presentar el Examen
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.7 - Estrategia para Presentar el Examen',
  7,
  35,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.7: ESTRATEGIA PARA PRESENTAR EL EXAMEN CNSF'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 PREPARACIÓN ESTRATÉGICA: El examen no solo evalúa conocimiento, también evalúa tu capacidad de APLICARLO bajo presión.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'FASE 1: ANTES DEL EXAMEN (1-2 DÍAS PREVIOS)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'QUÉ HACER:',
        'items', jsonb_build_array(
          '✓ Repasa DEFINICIONES CLAVE (no todo el material)',
          '✓ Revisa tu lista de conceptos confusos',
          '✓ Practica 5-10 cálculos simples',
          '✓ Repasa autoridades y sus funciones',
          '✓ Lee resúmenes de cada módulo',
          '✓ Descansa bien (dormir 7-8 horas)',
          '✓ Prepara documentos necesarios (identificación, comprobante)'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'QUÉ NO HACER:',
        'items', jsonb_build_array(
          '❌ NO intentes aprender temas nuevos',
          '❌ NO estudies hasta la madrugada',
          '❌ NO te estreses con material que no entendiste',
          '❌ NO tomes alcohol o trasnoches',
          '❌ NO cambies tu rutina drásticamente'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ REGLA DE ORO: 2 días antes, solo REPASA. No aprendas cosas nuevas.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'FASE 2: EL DÍA DEL EXAMEN (MAÑANA)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'PREPARACIÓN PERSONAL:',
        'items', jsonb_build_array(
          '✓ Despierta con tiempo suficiente (sin prisas)',
          '✓ Desayuna bien (proteína + carbohidratos)',
          '✓ Lleva agua y snack (por si demoran)',
          '✓ Viste cómodo (temperatura del lugar puede variar)',
          '✓ Llega 30 minutos ANTES de la hora',
          '✓ Ve al baño antes de entrar',
          '✓ Respira profundo, confía en tu preparación'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'QUÉ LLEVAR:',
        'items', jsonb_build_array(
          '✓ Identificación oficial',
          '✓ Comprobante de registro/pago',
          '✓ Calculadora básica (si está permitido)',
          '✓ Lápiz y goma (papel lo dan ahí)',
          '✓ Agua',
          '✓ Snack ligero'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'FASE 3: DURANTE EL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ CRÍTICO: Tu ESTRATEGIA durante el examen es TAN importante como tu conocimiento.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ESTRATEGIA GENERAL:',
        'items', jsonb_build_array(
          '1. Escucha TODAS las instrucciones del aplicador',
          '2. Verifica que la computadora funcione bien',
          '3. Revisa cuántas preguntas son y cuánto tiempo tienes',
          '4. Calcula tiempo promedio por pregunta',
          '5. Respira profundo antes de comenzar'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TÉCNICA DE RESPUESTA (MUY IMPORTANTE)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para CADA pregunta:',
        'items', jsonb_build_array(
          'Paso 1: LEE la pregunta COMPLETA (no a medias)',
          'Paso 2: Identifica QUÉ te están preguntando',
          'Paso 3: Identifica palabras clave (NO, EXCEPTO, SIEMPRE)',
          'Paso 4: Lee TODAS las opciones',
          'Paso 5: Elimina opciones CLARAMENTE incorrectas',
          'Paso 6: Entre las restantes, elige la MÁS completa',
          'Paso 7: Verifica que tu respuesta tenga sentido',
          'Paso 8: Marca y CONTINÚA (no te quedes atascado)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE APLICACIÓN:\n\nPregunta: "¿Cuál de las siguientes NO es función de la CNSF?"\n\nPaso 1: Leí completa ✅\nPaso 2: Me preguntan qué NO hace la CNSF ✅\nPaso 3: Palabra clave: NO ✅\nPaso 4: Leo opciones:\n  A) Regular seguros\n  B) Proteger al usuario\n  C) Supervisar aseguradoras\n  D) Autorizar tarifas\n\nPaso 5: Elimino:\n  A) Sí es función ❌\n  B) Esto lo hace CONDUSEF ✅ (posible)\n  C) Sí es función ❌\n  D) Esto lo hace SHCP ✅ (posible)\n\nPaso 6: Entre B y D, la más CLARA es B (CONDUSEF protege, no CNSF)\nPaso 7: Tiene sentido ✅\nPaso 8: Marco B y continúo ✅'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'MANEJO DE PREGUNTAS DIFÍCILES'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Si NO sabes una respuesta:',
        'items', jsonb_build_array(
          '1. NO entres en pánico',
          '2. Lee de nuevo MÁS DESPACIO',
          '3. Elimina opciones absurdas',
          '4. Usa lógica: "¿Cuál protege más al asegurado?"',
          '5. Si de plano no sabes, elige la opción MÁS completa',
          '6. MARCA algo (no dejes en blanco)',
          '7. Si el sistema permite, marca para revisar después',
          '8. CONTINÚA (no pierdas tiempo)'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ NO dejes preguntas en blanco. Incluso adivinando tienes 25% de probabilidad (1 de 4).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'MANEJO DEL TIEMPO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE ESTRATEGIA DE TIEMPO:\n\nExamen: 100 preguntas en 120 minutos\nTiempo por pregunta: 1.2 minutos (72 segundos)\n\nESTRATEGIA:\n✓ Primeras 50 preguntas: 50 minutos (1 min c/u)\n✓ Checkpoint: ¿Voy bien de tiempo?\n✓ Siguientes 50: 50 minutos\n✓ Últimos 20 minutos: REVISAR\n\nSi una pregunta toma >2 minutos:\n→ Marca respuesta provisional\n→ Marca para revisar\n→ CONTINÚA'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'FASE DE REVISIÓN (SI HAY TIEMPO)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Si te sobran 10-20 minutos:',
        'items', jsonb_build_array(
          '1. Revisa preguntas que marcaste como dudosas',
          '2. Revisa cálculos (errores aritméticos)',
          '3. Verifica que no dejaste preguntas sin responder',
          '4. NO cambies respuestas por nervios',
          '5. Solo cambia si estás SEGURO del error'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ REGLA: Tu PRIMERA respuesta suele ser la correcta. NO cambies por nervios.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'MANEJO DE LA PRESIÓN Y NERVIOS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Técnicas para controlar nervios:',
        'items', jsonb_build_array(
          '✓ RESPIRA profundo 3 veces antes de empezar',
          '✓ Recuerda que te PREPARASTE bien',
          '✓ Si sientes ansiedad, PAUSA 10 segundos y respira',
          '✓ Visualiza que ya aprobaste',
          '✓ Concéntrate en UNA pregunta a la vez',
          '✓ NO pienses en "¿Voy a reprobar?"',
          '✓ Piensa: "Voy a hacer mi mejor esfuerzo"'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'DESPUÉS DE TERMINAR'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Al finalizar el examen:',
        'items', jsonb_build_array(
          '✓ Verifica que enviaste todas las respuestas',
          '✓ Sigue instrucciones del aplicador',
          '✓ Espera tu resultado con calma',
          '✓ Si aprobaste: ¡FELICIDADES!',
          '✓ Si reprobaste: Analiza qué falló y vuelve a intentar'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 Recuerda: Reprobar NO es el fin. Es feedback para saber qué reforzar.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'REGLA DE ORO PARA RESPONDER'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Si una respuesta VIOLA LA LEY o PERJUDICA AL ASEGURADO, es INCORRECTA. Si protege al asegurado y respeta la ley, es CORRECTA.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'APLICACIÓN DE LA REGLA:\n\nPregunta: Cliente pide acelerar dictamen. Agente debe:\nA) Presionar al ajustador\nB) Saltarse el procedimiento\nC) Seguir el procedimiento completo\nD) Prometer pago inmediato\n\nAnálisis:\nA) Presión indebida ❌\nB) Viola procedimiento ❌\nC) Protege al cliente con proceso correcto ✅\nD) Promesa incumplible ❌\n\nRespuesta: C'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.7'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Estrategia completa:',
        'items', jsonb_build_array(
          '✓ ANTES: Repasa definiciones, descansa bien, llega temprano',
          '✓ DURANTE: Lee completo, elimina incorrectas, administra tiempo',
          '✓ Pregunta difícil: Lógica + protección al asegurado',
          '✓ No te atasques: Marca y continúa',
          '✓ Maneja el tiempo: 1-1.5 min por pregunta',
          '✓ Revisa al final si hay tiempo',
          '✓ NO cambies respuestas por nervios',
          '✓ Respira y confía en tu preparación',
          '✓ Si viola ley o perjudica, es incorrecta',
          '✓ Tu mejor esfuerzo es suficiente'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 Con preparación adecuada + estrategia correcta = APROBADO'
      )
    )
  )
);