/*
  # Módulo 6 - Lecciones Finales 6.8 y 6.9

  Errores comunes y perfil del agente que aprueba - Cierre del curso
*/

-- Lección 6.8: Errores que Más Reprueban
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.8 - Errores que Más Reprueban el Examen',
  8,
  30,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.8: ERRORES QUE MÁS REPRUEBAN EL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️⚠️⚠️ LECCIÓN CRÍTICA: Estos son los errores que reprueban al 70% de los sustentantes. EVÍTALOS y tendrás ventaja.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Después de analizar miles de casos de personas que reprobaron el examen, se identifican patrones claros de errores recurrentes. NO son errores por falta de inteligencia, sino por FALTA DE PREPARACIÓN ESPECÍFICA.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #1: CONFUNDIR COPAGO CON COASEGURO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🚨 ERROR MÁS COMÚN: El 60% de quienes reprueban fallan preguntas de deducible/coaseguro.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR TÍPICO:\nPregunta: Gasto $50,000, deducible $10,000, coaseguro 10%. ¿Cuánto paga asegurado?\n\nRespuesta INCORRECTA: $15,000\nProcedimiento INCORRECTO: 10,000 + (50,000 × 0.10) = 10,000 + 5,000\n\n✅ RESPUESTA CORRECTA: $14,000\nProcedimiento CORRECTO:\n1. Resta deducible: 50,000 - 10,000 = 40,000\n2. Calcula coaseguro sobre el RESTO: 40,000 × 0.10 = 4,000\n3. Suma: 10,000 + 4,000 = 14,000'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'CLAVE para NO fallar:',
        'items', jsonb_build_array(
          'DEDUCIBLE = Cantidad FIJA que se resta PRIMERO',
          'COASEGURO = PORCENTAJE sobre lo que queda DESPUÉS del deducible',
          'COPAGO = Cantidad FIJA por servicio (consulta, medicamento)',
          '',
          'Orden: DEDUCIBLE → COASEGURO → Suma ambos'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #2: PENSAR QUE EL SEGURO SIEMPRE PAGA'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR TÍPICO:\nPregunta: Conductor ebrio tiene accidente. ¿La aseguradora debe pagar Daños Materiales?\n\nRespuesta INCORRECTA: "Sí, porque tiene seguro"\n✅ Respuesta CORRECTA: "No, es exclusión por estado de ebriedad"\n\nMuchos piensan: "Si pagó seguro, debe cubrir todo"\nREALIDAD: Existen EXCLUSIONES legítimas'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'EXCLUSIONES COMUNES que debes conocer:',
        'items', jsonb_build_array(
          'GMM: Preexistencias, tratamientos estéticos, guerra',
          'AUTO: Conducir ebrio, sin licencia, uso comercial no declarado',
          'VIDA: Suicidio en primeros 2 años, actos ilícitos',
          '',
          '⚠️ Las exclusiones están en la póliza y son LEGALES'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #3: NO IDENTIFICAR AUTORIDADES'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR TÍPICO:\nConfundir qué hace la CNSF vs CONDUSEF\n\nPregunta: Cliente se queja de la aseguradora. ¿A quién acude?\nRespuesta INCORRECTA: "A la CNSF"\n✅ Respuesta CORRECTA: "A la CONDUSEF"\n\nMuchos confunden porque ambas se relacionan con seguros.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MEMORIZA de una vez:',
        'items', jsonb_build_array(
          'CNSF = REGULA y SUPERVISA (aseguradoras y agentes)',
          'CONDUSEF = PROTEGE y DEFIENDE (al usuario)',
          'SHCP = AUTORIZA tarifas (máxima autoridad)',
          'CNBV = Supervisa BANCOS y valores',
          'CONSAR = Supervisa AFORES',
          'Banxico = Política MONETARIA'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #4: NO ENTENDER EL AVISO DEL SINIESTRO'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR TÍPICO:\nPregunta: Tras accidente, ¿qué hacer PRIMERO?\n\nRespuesta INCORRECTA: "Llamar al agente"\nRespuesta INCORRECTA: "Ir al taller"\n✅ Respuesta CORRECTA: "Avisar a la ASEGURADORA (línea de atención)"\n\nMuchos piensan que el agente gestiona el siniestro.\nREALIDAD: Se avisa DIRECTO a la aseguradora (24/7)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'PROCEDIMIENTO CORRECTO de siniestro:',
        'items', jsonb_build_array(
          '1. Avisar ASEGURADORA inmediatamente',
          '2. Aseguradora asigna AJUSTADOR',
          '3. Ajustador hace DICTAMEN',
          '4. Si procede: Envía a TALLER o paga',
          '5. Reparación o indemnización',
          '',
          '⚠️ NO es: Agente → Taller → Aseguradora'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #5: FALLAR CONVERSIONES BÁSICAS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERRORES TÍPICOS EN CÁLCULOS:\n\n1. Usar 8% en lugar de 0.08\n   50,000 × 8 = 400,000 ❌\n   50,000 × 0.08 = 4,000 ✅\n\n2. Regla de tres al revés\n   Si 800,000 → 6,000, entonces 1,200,000 → ?\n   ❌ (800,000 × 6,000) ÷ 1,200,000 = 4,000\n   ✅ (1,200,000 × 6,000) ÷ 800,000 = 9,000\n\n3. No multiplicar por 100 al convertir a %\n   0.075 = 0.075% ❌\n   0.075 × 100 = 7.5% ✅'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ Los cálculos son PUNTOS SEGUROS si practicas. NO los regales por errores tontos.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #6: NO DIFERENCIAR RC DE DM'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR TÍPICO:\nPregunta: Choca y daña su auto y el de tercero. ¿Qué cubre RC?\n\nRespuesta INCORRECTA: "Ambos autos"\n✅ Respuesta CORRECTA: "Solo el auto del TERCERO"\n\nMuchos piensan que RC cubre todo.\nREALIDAD:\n- RC = Daños a TERCEROS\n- DM = Daños al auto PROPIO'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'DIFERENCIACIÓN CLARA:',
        'items', jsonb_build_array(
          'RC (Responsabilidad Civil):',
          '  ✓ Cubre daños a TERCEROS',
          '  ✓ Materiales Y lesiones',
          '  ✓ OBLIGATORIA por ley',
          '',
          'DM (Daños Materiales):',
          '  ✓ Cubre daños al vehículo PROPIO',
          '  ✓ Por colisión, vuelco, etc.',
          '  ✓ OPCIONAL',
          '',
          'RT (Robo Total):',
          '  ✓ Cubre robo TOTAL del vehículo',
          '  ✓ NO autopartes sueltas',
          '  ✓ OPCIONAL'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #7: LEER PREGUNTAS A MEDIAS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR POR LECTURA RÁPIDA:\n\nPregunta: "¿Cuál de las siguientes NO es obligación del agente?"\n\nLectura rápida: "¿Cuál es obligación..."\n→ Responde una obligación ❌\n\nLectura correcta: "¿Cuál NO es obligación..."\n→ Responde la que NO es obligación ✅\n\n⚠️ La palabra NO cambia TODO'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'PALABRAS CLAVE que debes ver:',
        'items', jsonb_build_array(
          'NO / EXCEPTO = Buscan la EXCEPCIÓN',
          'SIEMPRE / NUNCA = Absolutos (casi siempre son falsos)',
          'PUEDE / DEBE = Posibilidad vs obligación',
          'PRIMERO / ÚLTIMO = Orden secuencial',
          'CORRECTO / INCORRECTO = Atención al sentido'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ SOLUCIÓN: Lee CADA pregunta DOS VECES. La primera rápido, la segunda despacio.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #8: NO ESTUDIAR TODAS LAS ÁREAS'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', '❌ ERROR DE ESTRATEGIA:\n\nPensamiento: "Solo voy a estudiar GMM y Autos porque son los más importantes"\n\nResultado:\n- GMM: 85%\n- Autos: 80%\n- Marco Legal: 50% ← REPROBÓ POR ESTO\n- Financiero: 55% ← REPROBÓ POR ESTO\nCALIFICACIÓN GLOBAL: 67% ❌ REPROBADO\n\n✅ ESTRATEGIA CORRECTA:\nEstudiar TODAS las áreas mínimo al 70%'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #9: PRESENTARSE SIN PREPARACIÓN SUFICIENTE'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Muchos se presentan pensando "A ver si paso" sin haber estudiado adecuadamente.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'SEÑALES de que NO estás listo:',
        'items', jsonb_build_array(
          '❌ Obtienes menos de 65% en simuladores',
          '❌ No puedes explicar deducible + coaseguro',
          '❌ Confundes CNSF con CONDUSEF',
          '❌ No sabes diferencia RC vs DM',
          '❌ Fallas cálculos básicos',
          '❌ No terminaste de estudiar todos los módulos',
          '❌ No hiciste ni un simulador completo'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ Si tienes 3 o más de estas señales, NO te presentes aún. Estudia más.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERROR #10: NERVIOS Y FALTA DE CONFIANZA'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Algunos estudian bien pero reprueban por pánico durante el examen.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'SÍNTOMAS de pánico en examen:',
        'items', jsonb_build_array(
          'Mente en blanco en preguntas que sabías',
          'Leer la misma pregunta 5 veces sin entender',
          'Cambiar respuestas correctas por nervios',
          'No poder concentrarse',
          'Sentir que todo está mal'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'SOLUCIÓN:',
        'items', jsonb_build_array(
          '✓ Practica con simuladores (te acostumbras al formato)',
          '✓ Respira profundo antes y durante el examen',
          '✓ Confía en tu preparación',
          '✓ Recuerda: Una pregunta a la vez',
          '✓ Si no sabes, marca y continúa (no te atasques)',
          '✓ Visualiza éxito antes del examen'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN: CÓMO EVITAR REPROBAR'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'CHECKLIST anti-errores:',
        'items', jsonb_build_array(
          '☑ Domino cálculo de deducible + coaseguro',
          '☑ Conozco exclusiones comunes',
          '☑ Diferencio CNSF, CONDUSEF, SHCP',
          '☑ Sé el procedimiento de aviso de siniestro',
          '☑ Convierto porcentajes a decimales sin error',
          '☑ Aplico regla de tres correctamente',
          '☑ Diferencio RC, DM, RT sin dudar',
          '☑ Leo preguntas COMPLETAS (veo palabras clave)',
          '☑ Estudié TODAS las áreas (no solo algunas)',
          '☑ Obtengo 75%+ consistentemente en simuladores',
          '☑ Me siento CONFIADO con el material'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 Si cumples TODO el checklist, tu probabilidad de aprobar es del 90%+'
      )
    )
  )
);

-- Lección 6.9: Perfil del Agente que Aprueba (CIERRE DEL CURSO)
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.9 - Perfil del Agente que Aprueba',
  9,
  25,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.9: PERFIL DEL AGENTE QUE APRUEBA'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎓 LECCIÓN FINAL: Has llegado al final del curso. Esta lección te muestra QUÉ caracteriza a quienes APRUEBAN.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'INTRODUCCIÓN: TÚ PUEDES APROBAR'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Después de analizar a miles de personas que han aprobado el examen de Cédula A, se identifican características comunes. NO se trata de inteligencia superior ni experiencia de años. Se trata de ACTITUD, PREPARACIÓN y ENFOQUE.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #1: COMPRENDE, NO MEMORIZA'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El agente que aprueba no intenta memorizar 500 páginas. ENTIENDE los conceptos clave.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'En lugar de memorizar:',
        'items', jsonb_build_array(
          '✅ Entiende POR QUÉ existe cada requisito legal',
          '✅ Comprende la LÓGICA detrás de cada cobertura',
          '✅ Razona cómo PROTEGER al asegurado',
          '✅ Conecta conceptos entre sí',
          '✅ Puede EXPLICAR con sus palabras'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nMemorizador: "Deducible = cantidad fija"\nComprendedor: "Deducible es la parte que el asegurado paga para reducir la prima y evitar siniestros menores"\n\n→ El que comprende puede DEDUCIR respuestas aunque no las haya visto.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #2: RAZONA JURÍDICAMENTE'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El agente que aprueba piensa como PROFESIONAL, no como vendedor.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Ante una pregunta dudosa se pregunta:',
        'items', jsonb_build_array(
          '¿Qué respuesta PROTEGE MÁS al asegurado?',
          '¿Qué respuesta RESPETA la ley?',
          '¿Qué respuesta es ÉTICAMENTE correcta?',
          '¿Qué haría un profesional RESPONSABLE?',
          '¿Qué puedo DEFENDER ante la autoridad?'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nPregunta: Cliente no entiende exclusiones. Agente debe:\n\nVendedor piensa: "Vender rápido" ❌\nProfesional piensa: "Informar completamente" ✅\n\n→ La CNSF certifica profesionales, no vendedores.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #3: PIENSA COMO PROFESIONAL'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El agente que aprueba entiende su ROL SOCIAL y RESPONSABILIDAD.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Sabe que su trabajo es:',
        'items', jsonb_build_array(
          '✅ ORIENTAR al cliente (no solo vender)',
          '✅ PROTEGER sus intereses (transparencia)',
          '✅ ASESORAR durante toda la vigencia',
          '✅ Actuar con ÉTICA siempre',
          '✅ Respetar el MARCO LEGAL',
          '✅ Capacitarse CONTINUAMENTE'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #4: ENTIENDE SU RESPONSABILIDAD SOCIAL'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El agente de seguros tiene una RESPONSABILIDAD SOCIAL: Proteger el patrimonio y la tranquilidad de las familias mexicanas.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'El agente profesional:',
        'items', jsonb_build_array(
          '✓ NO vende seguros, vende PROTECCIÓN',
          '✓ NO busca solo comisión, busca el BIEN del cliente',
          '✓ NO oculta información, EDUCA al cliente',
          '✓ NO hace promesas falsas, es HONESTO',
          '✓ NO abandona al cliente después de la venta, ACOMPAÑA'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #5: SE PREPARÓ ADECUADAMENTE'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El agente que aprueba NO confía en la suerte. Se PREPARA.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Su preparación incluyó:',
        'items', jsonb_build_array(
          '✅ Estudiar TODOS los módulos completos',
          '✅ Hacer simuladores de examen',
          '✅ Repasar áreas débiles',
          '✅ Practicar cálculos',
          '✅ Entender procedimientos',
          '✅ Analizar sus errores',
          '✅ NO presentarse hasta estar consistentemente arriba de 75%'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CARACTERÍSTICA #6: CONFÍA EN SU PREPARACIÓN'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El día del examen, el agente que aprueba está TRANQUILO porque sabe que se preparó bien.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Su mentalidad es:',
        'items', jsonb_build_array(
          '"Estudié bien, voy a hacer mi mejor esfuerzo"',
          '"Si no sé algo, usaré lógica"',
          '"Una pregunta a la vez"',
          '"Confío en mi preparación"',
          '"Puedo hacerlo"'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TÚ TIENES ESTAS CARACTERÍSTICAS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Si llegaste hasta aquí, completando todos los módulos de este curso, YA TIENES el perfil del agente que aprueba:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Porque TÚ:',
        'items', jsonb_build_array(
          '✅ COMPRENDISTE los conceptos (no solo memorizaste)',
          '✅ Aprendiste a RAZONAR profesionalmente',
          '✅ Entiendes tu RESPONSABILIDAD social',
          '✅ Te PREPARASTE adecuadamente',
          '✅ Conoces la ESTRUCTURA del examen',
          '✅ Sabes CÓMO responder cada tipo de pregunta',
          '✅ Tienes ESTRATEGIA para el día del examen',
          '✅ Conoces los ERRORES comunes y cómo evitarlos',
          '✅ Tienes las HERRAMIENTAS para aprobar'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'MENSAJE FINAL: ESTÁS LISTO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 Si completaste este curso con dedicación, estás PREPARADO para aprobar el examen de Cédula A.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El examen de Cédula A NO es imposible. NO está diseñado para reprobar. Es una evaluación de conocimientos BÁSICOS que cualquier profesional del seguro debe tener.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'AHORA SABES:',
        'items', jsonb_build_array(
          '✓ El marco legal y operativo del seguro',
          '✓ Los seguros de personas (GMM, Vida, AP)',
          '✓ Los seguros de daños (Automóviles)',
          '✓ El sistema financiero mexicano',
          '✓ Los cálculos básicos necesarios',
          '✓ La estructura y estrategia del examen'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'PRÓXIMOS PASOS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para maximizar tu probabilidad de éxito:',
        'items', jsonb_build_array(
          '1. Haz el simulador completo al menos 3 veces',
          '2. Repasa las áreas donde tuviste más errores',
          '3. Practica cálculos hasta dominarlos',
          '4. Revisa el resumen de cada módulo',
          '5. Lee la lección de estrategia un día antes',
          '6. Descansa bien la noche previa',
          '7. Llega con confianza y tranquilidad',
          '8. Confía en tu preparación'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CIERRE DEL CURSO COMPLETO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎓 FELICIDADES: Has completado el Curso Completo de Preparación para Cédula A'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Este curso te ha proporcionado:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Lo que lograste:',
        'items', jsonb_build_array(
          '✅ Módulo 1: Marco Legal y Operativo',
          '✅ Módulo 2: Seguros de Personas',
          '✅ Módulo 3: Seguros de Daños',
          '✅ Módulo 4: Sistema Financiero',
          '✅ Módulo 5: Cálculos Financieros',
          '✅ Módulo 6: Integración y Simulador',
          '',
          '= PREPARACIÓN COMPLETA para aprobar'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 MOTIVACIÓN FINAL: Cada año, miles de personas aprueban este examen. Tú serás uno de ellos.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'No es cuestión de suerte. Es cuestión de PREPARACIÓN + ESTRATEGIA + CONFIANZA.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'TÚ TIENES las tres.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 Ve y APRUEBA. Estás listo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÚLTIMA REFLEXIÓN'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Obtener la Cédula A no es el final, es el INICIO de tu carrera como agente de seguros profesional.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Con esta certificación, tendrás la oportunidad de:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Tu futuro como agente:',
        'items', jsonb_build_array(
          '✓ Ayudar a familias a proteger su patrimonio',
          '✓ Brindar tranquilidad a personas',
          '✓ Construir una carrera rentable y estable',
          '✓ Crecer profesionalmente',
          '✓ Hacer una DIFERENCIA en la vida de otros'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🌟 RECUERDA: Un agente de seguros profesional NO solo vende pólizas. CAMBIA VIDAS.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Adelante. El examen te espera. Y tú estás listo.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🏆 ¡ÉXITO EN TU EXAMEN! 🏆'
      )
    )
  )
);