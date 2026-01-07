/*
  # Expansión completa Módulo 5 - Cálculos Financieros Básicos

  1. Expandir Lección 5.1: Porcentajes y Decimales (explicación paso a paso)
  2. Expandir Lección 5.2: Tasas de Interés (conversiones y ejemplos)
  3. Expandir Lección 5.3: Regla de Tres (múltiples ejercicios resueltos)
  4. Expandir Lección 5.4: Capitalización (concepto e interés compuesto)
  5. Expandir Lección 5.5: Tasa de Rendimiento (fórmulas y aplicaciones)
*/

-- Lección 5.1: Porcentajes y Decimales
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'MÓDULO 5: CÁLCULOS FINANCIEROS BÁSICOS PARA EL SEGURO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ TRANQUILIDAD: Este módulo NO requiere matemáticas avanzadas. Solo orden, lógica y práctica. Todo se explica paso a paso.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO GENERAL DEL MÓDULO 5'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Al finalizar este módulo, serás capaz de resolver TODOS los ejercicios matemáticos del examen de Cédula A:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Aprenderás a:',
      'items', jsonb_build_array(
        '✓ Interpretar porcentajes y convertirlos a decimales',
        '✓ Convertir tasas de interés entre distintos periodos',
        '✓ Aplicar la regla de tres (MUY frecuente en el examen)',
        '✓ Calcular primas proporcionales',
        '✓ Resolver ejercicios de capitalización',
        '✓ Determinar tasas de rendimiento',
        '✓ Evitar los errores comunes que reprueba a muchos'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: El examen NO evalúa si eres matemático. Evalúa si entiendes la LÓGICA y puedes aplicar fórmulas SIMPLES correctamente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 5.1: PORCENTAJES Y DECIMALES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ CONCEPTO BASE: Si no dominas esta lección, NO podrás resolver el resto. Es la BASE de todo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.1 CONCEPTO DE PORCENTAJE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Un PORCENTAJE es una forma de expresar una cantidad en relación con 100. El símbolo es %.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Ejemplos para entender:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Interpretación:',
      'items', jsonb_build_array(
        '10% significa "10 de cada 100"',
        '25% significa "25 de cada 100"',
        '50% significa "50 de cada 100" (la mitad)',
        '100% significa "100 de cada 100" (todo)',
        '150% significa "150 de cada 100" (más del total)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo cotidiano: Si un banco ofrece 7% de interés anual, significa que por cada $100 que inviertas, al final del año recibirás $7 de intereses.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'USO DE PORCENTAJES EN SEGUROS'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Los porcentajes se usan para:',
      'items', jsonb_build_array(
        '✓ COASEGUROS (ejemplo: 10% a cargo del asegurado)',
        '✓ TASAS de interés (rendimientos de seguros de ahorro)',
        '✓ INCREMENTOS de prima (ajustes por inflación)',
        '✓ RENDIMIENTOS de inversiones',
        '✓ INDEMNIZACIONES proporcionales',
        '✓ DESCUENTOS y recargos'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.2 CONVERSIÓN DE PORCENTAJE A DECIMAL'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ CRÍTICO: Las fórmulas SIEMPRE usan DECIMALES, NUNCA porcentajes. Debes convertir.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para convertir un PORCENTAJE a DECIMAL, se divide entre 100.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'REGLA PRÁCTICA: Mueves el punto decimal DOS lugares a la IZQUIERDA.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJEMPLOS PASO A PASO'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: Convertir 7.5% a decimal\n\nProcedimiento:\n7.5 ÷ 100 = 0.075\n\nO también (más rápido):\nMueve el punto 2 lugares a la izquierda:\n7.5 → 0.75 → 0.075\n\nRespuesta: 7.5% = 0.075'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2: Convertir 27% a decimal\n\nProcedimiento:\n27 ÷ 100 = 0.27\n\nRespuesta: 27% = 0.27'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 3: Convertir 8% a decimal\n\nProcedimiento:\n8 ÷ 100 = 0.08\n\n⚠️ ¡OJO! El cero antes del 8 es IMPORTANTE.\nNo es 0.8 (que sería 80%)\nEs 0.08 (que es 8%)\n\nRespuesta: 8% = 0.08'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 4: Convertir 0.5% a decimal\n\nProcedimiento:\n0.5 ÷ 100 = 0.005\n\n⚠️ Porcentajes menores a 1% dan decimales muy pequeños.\n\nRespuesta: 0.5% = 0.005'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 5: Convertir 125% a decimal\n\nProcedimiento:\n125 ÷ 100 = 1.25\n\n⚠️ Porcentajes mayores a 100% dan decimales mayores a 1.\n\nRespuesta: 125% = 1.25'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TABLA DE CONVERSIONES COMUNES (MEMORIZA)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Conversiones frecuentes en el examen:',
      'items', jsonb_build_array(
        '1% = 0.01',
        '5% = 0.05',
        '7.5% = 0.075',
        '8% = 0.08',
        '10% = 0.10',
        '12% = 0.12',
        '15% = 0.15',
        '20% = 0.20',
        '25% = 0.25',
        '50% = 0.50',
        '100% = 1.00'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.3 CONVERSIÓN DE DECIMAL A PORCENTAJE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para convertir un DECIMAL a PORCENTAJE, se multiplica por 100.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'REGLA PRÁCTICA: Mueves el punto decimal DOS lugares a la DERECHA.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: Convertir 0.074 a porcentaje\n\nProcedimiento:\n0.074 × 100 = 7.4%\n\nO también:\nMueve el punto 2 lugares a la derecha:\n0.074 → 07.4 → 7.4%\n\nRespuesta: 0.074 = 7.4%'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2: Convertir 0.0093 a porcentaje\n\nProcedimiento:\n0.0093 × 100 = 0.93%\n\nRespuesta: 0.0093 = 0.93%'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 3: Convertir 3.15 a porcentaje\n\nProcedimiento:\n3.15 × 100 = 315%\n\n⚠️ Esto significa "más de 3 veces el valor original"\n\nRespuesta: 3.15 = 315%'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ ERROR MUY COMÚN EN EL EXAMEN: Olvidar multiplicar por 100. Si calculaste 0.074 y respondes "0.074%" estás REPROBADO en esa pregunta. La respuesta correcta es 7.4%.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.4 CÁLCULO DE PORCENTAJE DE UNA CANTIDAD'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para calcular qué cantidad representa un porcentaje de un total, se convierte el porcentaje a decimal y se MULTIPLICA.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA: Cantidad = Total × (Porcentaje en decimal)'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: ¿Cuánto es el 15% de $8,000?\n\nPaso 1: Convertir porcentaje a decimal\n15% = 15 ÷ 100 = 0.15\n\nPaso 2: Multiplicar\n8,000 × 0.15 = 1,200\n\nRespuesta: El 15% de $8,000 es $1,200'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2 (tipo examen): Una póliza tiene prima anual de $12,500. El cliente paga con 10% de descuento. ¿Cuánto es el descuento?\n\nPaso 1: Convertir 10% a decimal\n10% = 0.10\n\nPaso 2: Calcular el descuento\n12,500 × 0.10 = 1,250\n\nRespuesta: El descuento es de $1,250\n\nPago final: 12,500 - 1,250 = $11,250'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 3 (coaseguro): Un gasto médico es de $45,000. La póliza tiene coaseguro del 10% (a cargo del asegurado). ¿Cuánto paga el asegurado?\n\nPaso 1: Convertir 10% a decimal\n10% = 0.10\n\nPaso 2: Calcular el coaseguro\n45,000 × 0.10 = 4,500\n\nRespuesta: El asegurado paga $4,500\nLa aseguradora paga: 45,000 - 4,500 = $40,500'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.5 INCREMENTOS PORCENTUALES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Un incremento porcentual aumenta una cantidad en un cierto porcentaje.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA: Valor Final = Valor Inicial × (1 + Incremento en decimal)'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 1: Una prima de $5,000 se incrementa 8% por inflación. ¿Cuál es la nueva prima?\n\nMétodo 1 (dos pasos):\nPaso 1: Calcular incremento\n5,000 × 0.08 = 400\n\nPaso 2: Sumar al original\n5,000 + 400 = 5,400\n\nMétodo 2 (un paso, más rápido):\n5,000 × (1 + 0.08) = 5,000 × 1.08 = 5,400\n\nRespuesta: Nueva prima = $5,400'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO 2: Una suma asegurada de $850,000 se incrementa 5% por actualización. ¿Cuál es la nueva suma?\n\nAplicando método rápido:\n850,000 × (1 + 0.05) = 850,000 × 1.05 = 892,500\n\nRespuesta: Nueva suma asegurada = $892,500'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5.1.6 DECREMENTOS PORCENTUALES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Un decremento porcentual reduce una cantidad en un cierto porcentaje.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'FÓRMULA: Valor Final = Valor Inicial × (1 - Decremento en decimal)'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'EJEMPLO: Una prima de $8,000 tiene descuento del 12%. ¿Cuánto se paga?\n\nAplicando fórmula:\n8,000 × (1 - 0.12) = 8,000 × 0.88 = 7,040\n\nRespuesta: Se paga $7,040'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EJERCICIOS DE PRÁCTICA (TIPO EXAMEN)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Resuelve mentalmente estos ejercicios para practicar:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 1: Convierte 9.5% a decimal',
      'items', jsonb_build_array(
        'Respuesta: 0.095'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 2: Convierte 0.063 a porcentaje',
      'items', jsonb_build_array(
        'Respuesta: 6.3%'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 3: ¿Cuánto es el 7% de $25,000?',
      'items', jsonb_build_array(
        'Respuesta: 25,000 × 0.07 = $1,750'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejercicio 4: Una prima de $6,500 se incrementa 10%. ¿Cuál es la nueva prima?',
      'items', jsonb_build_array(
        'Respuesta: 6,500 × 1.10 = $7,150'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ERRORES COMUNES (NO COMETAS ESTOS)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Errores que reprueban:',
      'items', jsonb_build_array(
        '❌ Usar el porcentaje directamente sin convertir a decimal',
        '❌ Confundir 0.8 con 0.08 (80% vs 8%)',
        '❌ Olvidar multiplicar por 100 al convertir a porcentaje',
        '❌ Dividir cuando debes multiplicar',
        '❌ No distinguir incremento de decremento'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 5.1'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave para memorizar:',
      'items', jsonb_build_array(
        '✓ Porcentaje a decimal: DIVIDIR entre 100',
        '✓ Decimal a porcentaje: MULTIPLICAR por 100',
        '✓ Calcular porcentaje de cantidad: Cantidad × (% en decimal)',
        '✓ Incremento: Valor × (1 + % en decimal)',
        '✓ Decremento: Valor × (1 - % en decimal)',
        '✓ SIEMPRE convierte el porcentaje a decimal antes de operar',
        '✓ Verifica que tu respuesta tenga sentido lógico'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⭐ DOMINA ESTA LECCIÓN antes de continuar. Es la BASE de todo el módulo.'
    )
  )
),
duracion_estimada_minutos = 50,
updated_at = now()
WHERE titulo = 'Lección 5.1 - Porcentajes y Decimales';