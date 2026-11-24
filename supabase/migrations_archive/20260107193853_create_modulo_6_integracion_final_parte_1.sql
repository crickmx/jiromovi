/*
  # Creación Módulo 6 - Integración Final y Simulador (Parte 1)

  1. Actualizar título del Módulo 6
  2. Crear Lección 6.1: Estructura del Examen de Cédula A
  3. Crear Lección 6.2: Tipos de Preguntas del Examen
  4. Crear Lección 6.3: Cómo Razona la CNSF las Preguntas
*/

-- Actualizar título del Módulo 6
UPDATE cedula_a_modulos
SET 
  titulo = 'Módulo 6: Integración Final y Simulador de Examen Cédula A',
  descripcion = 'Módulo integrador que consolida todo el conocimiento adquirido y prepara al estudiante mental, técnica y estratégicamente para aprobar el examen CNSF.',
  updated_at = now()
WHERE orden = 6;

-- Lección 6.1: Estructura del Examen
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.1 - Estructura del Examen de Cédula A',
  1,
  40,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'MÓDULO 6: INTEGRACIÓN FINAL Y SIMULADOR DE EXAMEN CÉDULA A'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🎯 ESTE ES EL MÓDULO MÁS IMPORTANTE: Aquí consolidas TODO lo aprendido y te preparas estratégicamente para APROBAR el examen.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'OBJETIVO GENERAL DEL MÓDULO 6'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Este módulo NO introduce contenido nuevo. Su objetivo es INTEGRAR, CONSOLIDAR y APLICAR todo el conocimiento de los módulos 1 al 5.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Al finalizar este módulo serás capaz de:',
        'items', jsonb_build_array(
          '✓ Comprender cómo está ESTRUCTURADO el examen de Cédula A',
          '✓ Identificar qué temas tienen MAYOR PESO',
          '✓ Entender cómo RAZONA la CNSF las preguntas',
          '✓ AUTO-EVALUAR tu nivel de preparación',
          '✓ Tener una ESTRATEGIA CLARA para presentar el examen',
          '✓ Conocer los ERRORES más comunes que reprueban',
          '✓ MAXIMIZAR tu probabilidad de aprobación'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ IMPORTANTE: Este módulo te prepara MENTAL, TÉCNICA y ESTRATÉGICAMENTE. No es solo un simulador, es tu preparación final.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.1: ESTRUCTURA DEL EXAMEN DE CÉDULA A'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ Conocer la estructura del examen te da VENTAJA ESTRATÉGICA. Sabes dónde enfocarte.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.1 ¿QUÉ ES EL EXAMEN DE CÉDULA A?'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El examen de Cédula A (también conocido como Cédula de Aspectos Básicos) es la evaluación que aplica la CNSF para certificar que un agente de seguros posee los CONOCIMIENTOS MÍNIMOS necesarios para ejercer la profesión de manera ética y competente.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Características del examen:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Formato del examen:',
        'items', jsonb_build_array(
          '✓ Examen de opción múltiple',
          '✓ Reactivos con 4 opciones de respuesta (A, B, C, D)',
          '✓ Solo UNA respuesta correcta por pregunta',
          '✓ Se aplica en computadora en centros autorizados',
          '✓ Tiempo limitado (aproximadamente 2-3 horas)',
          '✓ NO se puede regresar a preguntas anteriores',
          '✓ Los resultados se entregan inmediatamente'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ CRÍTICO: Este es un examen de COMPRENSIÓN, no de memorización. Evalúa tu capacidad de RAZONAR y APLICAR conocimientos.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.2 ÁREAS DE CONOCIMIENTO EVALUADAS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El examen de Cédula A evalúa CUATRO grandes áreas:'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 1: ASPECTOS GENERALES DEL SEGURO'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Corresponde al Módulo 1 - Marco Legal y Operativo:',
        'items', jsonb_build_array(
          '✓ Marco jurídico del seguro (LISF)',
          '✓ Autoridades del sector (CNSF, CONDUSEF, SHCP)',
          '✓ Tipos de agentes y sus obligaciones',
          '✓ Contrato de seguro (elementos, derechos, obligaciones)',
          '✓ Sanciones y responsabilidades',
          '✓ Ética profesional'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PESO APROXIMADO: 25-30% del examen\n\n⚠️ Esta área es FUNDAMENTAL. Si fallas aquí, es difícil compensar.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 2: SEGUROS DE PERSONAS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Corresponde al Módulo 2:',
        'items', jsonb_build_array(
          '✓ Seguros de Vida (tipos y coberturas)',
          '✓ Gastos Médicos Mayores (GMM)',
          '✓ Seguros de Salud',
          '✓ Accidentes Personales',
          '✓ Deducibles, coaseguros y copagos',
          '✓ Procedimientos de atención',
          '✓ Exclusiones comunes'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PESO APROXIMADO: 25-30% del examen\n\n⚠️ GMM es el tema MÁS preguntado de esta área.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 3: SEGUROS DE DAÑOS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Corresponde al Módulo 3:',
        'items', jsonb_build_array(
          '✓ Seguro de Automóviles (el más importante)',
          '✓ Coberturas básicas (RC, DM, RT, etc.)',
          '✓ Procedimiento de siniestros',
          '✓ Pérdida total vs parcial',
          '✓ Subrogación y salvamentos',
          '✓ Otros seguros de daños (incendio, diversos)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PESO APROXIMADO: 20-25% del examen\n\n⚠️ Automóviles es el ramo MÁS FRECUENTE en preguntas.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 4: SISTEMA FINANCIERO Y CÁLCULOS'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Corresponde a Módulos 4 y 5:',
        'items', jsonb_build_array(
          '✓ Sistema Financiero Mexicano',
          '✓ Autoridades financieras (Banxico, CNBV, CONSAR)',
          '✓ Instituciones financieras',
          '✓ Cálculos básicos (porcentajes, tasas)',
          '✓ Regla de tres',
          '✓ Rendimientos y capitalizaciones'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PESO APROXIMADO: 20-25% del examen\n\n⚠️ Los cálculos son PUNTOS SEGUROS si te preparaste bien.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.3 DISTRIBUCIÓN DE PREGUNTAS (APROXIMADA)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Aunque la CNSF no publica la distribución exacta, la experiencia de miles de sustentantes permite estimar:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Distribución típica (examen de 100 preguntas):',
        'items', jsonb_build_array(
          'Marco Legal y Operativo: 25-30 preguntas',
          'Seguros de Personas: 25-30 preguntas',
          'Seguros de Daños: 20-25 preguntas',
          'Sistema Financiero y Cálculos: 20-25 preguntas'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ ESTRATEGIA: NO puedes darte el lujo de ignorar ninguna área. Todas son importantes.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.4 CALIFICACIÓN APROBATORIA'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Para APROBAR el examen de Cédula A, generalmente se requiere obtener al menos 70% de aciertos.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE CÁLCULO:\n\nSi el examen tiene 100 preguntas:\n✓ Necesitas acertar mínimo 70 preguntas\n✓ Puedes fallar máximo 30 preguntas\n\nSi el examen tiene 80 preguntas:\n✓ Necesitas acertar mínimo 56 preguntas\n✓ Puedes fallar máximo 24 preguntas'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ IMPORTANTE: NO hay calificación mínima por área. Tu calificación final es el TOTAL de aciertos.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO PRÁCTICO:\n\nPuedes aprobar aunque:\n✓ Falles TODAS las preguntas de cálculos (20 preguntas)\n✓ Siempre que aciertes 70 del resto (de las otras 80)\n\nPero NO es recomendable. Mejor estrategia:\n✓ Dominar TODAS las áreas\n✓ Asegurar puntos en cada tema\n✓ No dejar áreas débiles'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.5 DURACIÓN DEL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El tiempo asignado varía según el centro aplicador, pero típicamente es de 2 a 3 horas.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'CÁLCULO DE TIEMPO:\n\nSi tienes 120 minutos para 100 preguntas:\n✓ Tiempo promedio: 1.2 minutos por pregunta\n✓ 72 segundos por pregunta\n\nEsto es SUFICIENTE si:\n✓ Estudiaste bien\n✓ No te trabas en una pregunta\n✓ Administras tu tiempo'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ CONSEJO: NO te quedes atascado en una pregunta. Si no sabes, marca una opción y continúa. Al final podrás revisar (si el sistema lo permite).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.6 FORMATO DE APLICACIÓN'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Cómo se aplica el examen:',
        'items', jsonb_build_array(
          '✓ En COMPUTADORA en centros autorizados',
          '✓ Sistema de cómputo de la CNSF',
          '✓ Una pregunta a la vez en pantalla',
          '✓ Seleccionas la respuesta con el mouse',
          '✓ Confirmas y pasas a la siguiente',
          '✓ Algunos sistemas permiten marcar para revisar después',
          '✓ Al terminar, el sistema calcula tu resultado',
          '✓ Resultado INMEDIATO (aprobado/reprobado)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.7 ¿QUÉ PASA SI REPRUEBAS?'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Si no apruebas el examen:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Consecuencias y opciones:',
        'items', jsonb_build_array(
          '✓ Recibes un reporte con tu calificación',
          '✓ NO recibes desglose por área (política de CNSF)',
          '✓ Puedes VOLVER A PRESENTAR el examen',
          '✓ Debes esperar un periodo (consultar con CNSF)',
          '✓ Debes pagar nuevamente el derecho de examen',
          '✓ NO hay límite de intentos (puedes volver las veces necesarias)'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ REALIDAD: La mayoría de quienes reprueban es por FALTA DE PREPARACIÓN, no por dificultad del examen.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.1.8 MITOS Y REALIDADES DEL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MITO #1: "El examen está diseñado para reprobar"',
        'items', jsonb_build_array(
          '❌ FALSO',
          '✅ REALIDAD: El examen evalúa conocimientos básicos. Si estudias, apruebas.'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MITO #2: "Hay preguntas trampa"',
        'items', jsonb_build_array(
          '❌ FALSO',
          '✅ REALIDAD: Las preguntas son claras. Lo que pasa es que algunas personas leen rápido y no entienden bien.'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MITO #3: "Se necesita experiencia de años"',
        'items', jsonb_build_array(
          '❌ FALSO',
          '✅ REALIDAD: El examen es de conocimientos TEÓRICOS. Puedes aprobar sin experiencia si estudias bien.'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MITO #4: "Los cálculos son muy difíciles"',
        'items', jsonb_build_array(
          '❌ FALSO',
          '✅ REALIDAD: Son cálculos BÁSICOS (regla de tres, porcentajes). Con práctica son puntos seguros.'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'MITO #5: "Puedo aprobar solo memorizando"',
        'items', jsonb_build_array(
          '❌ FALSO',
          '✅ REALIDAD: El examen evalúa COMPRENSIÓN. Debes entender conceptos, no solo memorizar.'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.1'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave sobre la estructura del examen:',
        'items', jsonb_build_array(
          '✓ Examen de opción múltiple en computadora',
          '✓ 4 áreas principales: Legal, Personas, Daños, Financiero',
          '✓ Todas las áreas son importantes (25-30% cada una)',
          '✓ Calificación aprobatoria: 70% de aciertos',
          '✓ Duración: 2-3 horas (tiempo suficiente)',
          '✓ Resultado inmediato',
          '✓ Puedes volver a presentar si repruebas',
          '✓ NO hay preguntas trampa, solo requiere preparación',
          '✓ Evalúa COMPRENSIÓN, no memorización',
          '✓ Con estudio adecuado, es APROBABLE'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 MOTIVACIÓN: Miles de personas aprueban cada año. Con este curso y dedicación, TÚ TAMBIÉN PUEDES.'
      )
    )
  )
);