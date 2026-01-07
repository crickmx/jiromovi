/*
  # Expansión Completa del Módulo 1: Aspectos Generales

  1. Cambios
    - Actualizar contenido de las 6 lecciones del Módulo 1
    - Agregar contenido detallado y pedagógico
    - Incluir objetivos, definiciones, ejemplos prácticos
    - Basado en el material oficial proporcionado
*/

-- Actualizar Lección 1.1 con contenido expandido
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'MÓDULO 1: ASPECTOS GENERALES DEL SEGURO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Marco Jurídico, Técnico y Operativo de la Actividad Aseguradora'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO GENERAL DEL MÓDULO 1'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Al finalizar este módulo, el estudiante comprenderá qué es la actividad aseguradora en México, por qué está regulada, qué autoridades la supervisan, qué leyes la rigen, qué operaciones y ramos existen, y cuál es el papel legal, ético y operativo del agente de seguros. Este módulo es la base legal del examen de Cédula A y uno de los más importantes, ya que define los límites, responsabilidades y consecuencias del ejercicio profesional del agente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.1: LA ACTIVIDAD ASEGURADORA EN MÉXICO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La actividad aseguradora en México es considerada una actividad de INTERÉS PÚBLICO, lo que significa que no es una actividad comercial ordinaria, sino una actividad que impacta directamente en la estabilidad económica, patrimonial y social de la población.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '¿Para qué existe el seguro?'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El seguro existe para proteger a las personas y a su patrimonio frente a riesgos que pueden afectar:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Áreas de protección del seguro:',
      'items', jsonb_build_array(
        'La vida',
        'La salud',
        'La integridad física',
        'Los bienes materiales',
        'La responsabilidad frente a terceros'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '¿Por qué está regulada la actividad aseguradora?'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Debido a esta función social, el Estado mexicano regula, supervisa y controla la actividad aseguradora, con el fin de:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Objetivos de la regulación:',
      'items', jsonb_build_array(
        'Proteger a los usuarios de seguros',
        'Evitar fraudes y malas prácticas',
        'Garantizar la solvencia de las aseguradoras',
        'Asegurar que los agentes actúen con profesionalismo y ética',
        'Mantener la estabilidad del sistema financiero',
        'Promover la cultura del seguro'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'Consecuencias de ser actividad de interés público'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Por su naturaleza de interés público:',
      'items', jsonb_build_array(
        'No cualquier persona puede vender seguros',
        'No cualquier empresa puede operar como aseguradora',
        'Toda la actividad está sujeta a autorización y vigilancia oficial',
        'Se requiere capacitación técnica certificada',
        'El incumplimiento tiene consecuencias legales severas',
        'Los agentes son responsables de sus actos profesionales'
      )
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Actividad de Interés Público: Actividad que, por su impacto social y económico, requiere supervisión especial del Estado para proteger a la población. En el caso del seguro, millones de personas confían sus recursos y su protección patrimonial a este sistema, por lo que debe estar estrictamente regulado.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo Real: Si una aseguradora quebrara sin regulación, miles de personas perderían su protección. Por eso la CNSF supervisa constantemente la solvencia financiera de todas las instituciones, requiere reservas técnicas y capital mínimo, para garantizar que siempre puedan pagar las indemnizaciones.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE PARA EL EXAMEN: La actividad aseguradora es de INTERÉS PÚBLICO. Esta es una pregunta recurrente. Debes poder explicar por qué está regulada y cuáles son las consecuencias de esta naturaleza jurídica.'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.1 - Introducción al Sistema Asegurador Mexicano';

-- Actualizar Lección 1.2 con contenido expandido de autoridades
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.2: AUTORIDADES QUE REGULAN EL SECTOR ASEGURADOR'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El sistema asegurador mexicano está regulado por diversas autoridades, cada una con funciones específicas. Comprenderlas es clave para el examen y para el ejercicio profesional.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. SECRETARÍA DE HACIENDA Y CRÉDITO PÚBLICO (SHCP)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La Secretaría de Hacienda y Crédito Público (SHCP) es la MÁXIMA AUTORIDAD del sistema financiero mexicano. Su función principal es dirigir la política financiera del país, lo que incluye al sector asegurador.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'En materia de seguros, la SHCP:',
      'items', jsonb_build_array(
        'Autoriza la organización y funcionamiento de las instituciones de seguros',
        'Define qué operaciones y ramos pueden ofrecer las aseguradoras',
        'Emite disposiciones de carácter general para el sector',
        'Supervisa indirectamente el sistema financiero',
        'Coordina la política económica relacionada con seguros',
        'Aprueba reformas y cambios normativos importantes'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Nota importante: Aunque la SHCP no trata directamente con los agentes de seguros, todas las reglas bajo las cuales opera el seguro emanan de esta autoridad. Es la cabeza del sistema.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. COMISIÓN NACIONAL DE SEGUROS Y FIANZAS (CNSF)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡ESTA ES LA AUTORIDAD MÁS IMPORTANTE PARA EL AGENTE DE SEGUROS!'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La Comisión Nacional de Seguros y Fianzas (CNSF) es la autoridad rectora directa del sector asegurador. Es un órgano desconcentrado de la SHCP con autonomía técnica.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones principales de la CNSF:',
      'items', jsonb_build_array(
        '✓ Autorizar a los agentes de seguros',
        '✓ Aplicar los exámenes de certificación (Cédula A)',
        '✓ Vigilar el cumplimiento de las leyes por parte de aseguradoras y agentes',
        '✓ Supervisar la solvencia financiera de las aseguradoras',
        '✓ Imponer sanciones administrativas',
        '✓ Suspender, cancelar o revocar cédulas de agentes',
        '✓ Emitir circulares y disposiciones técnicas',
        '✓ Autorizar productos y tarifas',
        '✓ Proteger los intereses del público usuario'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Todo agente de seguros depende legalmente de la CNSF y debe cumplir con sus disposiciones. La CNSF tiene el poder de quitar tu cédula si incumples la normativa.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. COMISIÓN NACIONAL PARA LA PROTECCIÓN Y DEFENSA DE LOS USUARIOS DE SERVICIOS FINANCIEROS (CONDUSEF)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La CONDUSEF es una autoridad creada EXCLUSIVAMENTE para proteger al usuario de servicios financieros, incluyendo seguros.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: La CONDUSEF NO protege a las aseguradoras. NO protege a los agentes. SOLO protege al asegurado.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Sus funciones incluyen:',
      'items', jsonb_build_array(
        'Asesorar a los usuarios sobre sus derechos',
        'Conciliar conflictos entre asegurado y aseguradora',
        'Fungir como árbitro en controversias',
        'Promover la educación financiera',
        'Defender los derechos del usuario',
        'Recibir y tramitar quejas',
        'Emitir recomendaciones a las instituciones financieras'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'La CONDUSEF interviene cuando existen conflictos relacionados con:',
      'items', jsonb_build_array(
        'Indemnizaciones no pagadas o mal calculadas',
        'Cobros indebidos de primas',
        'Interpretación de pólizas',
        'Mala práctica del agente',
        'Servicios inadecuados de la aseguradora',
        'Falta de información al contratar'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Un cliente contrata un seguro de auto amplio pero al momento del siniestro la aseguradora solo quiere pagar como si fuera limitado. El cliente acude a CONDUSEF para que intervenga y resuelva el conflicto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. COMISIÓN NACIONAL DE ARBITRAJE MÉDICO (CONAMED)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La CONAMED interviene en controversias relacionadas con servicios médicos, especialmente relevantes en Gastos Médicos Mayores y Seguro de Salud.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Actúa cuando el conflicto NO es financiero, sino MÉDICO:',
      'items', jsonb_build_array(
        'Mala atención médica durante hospitalización',
        'Discrepancias en diagnósticos o tratamientos',
        'Negligencia médica',
        'Servicios hospitalarios deficientes',
        'Conflictos sobre procedimientos médicos realizados'
      )
    ),
    jsonb_build_object(
      'type', 'ejemplo',
      'content', 'Diferencia clave: Si la aseguradora NO PAGA la indemnización → CONDUSEF. Si el HOSPITAL dio mala atención médica → CONAMED.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN COMPARATIVO DE AUTORIDADES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Para memorizar:',
      'items', jsonb_build_array(
        'SHCP = Máxima autoridad, define política financiera',
        'CNSF = Autoriza y supervisa agentes y aseguradoras',
        'CONDUSEF = Protege al usuario en conflictos financieros',
        'CONAMED = Arbitraje en controversias médicas'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Es MUY COMÚN que pregunten quién autoriza a los agentes (CNSF), quién protege al usuario (CONDUSEF), quién arbitra conflictos médicos (CONAMED) y quién es la máxima autoridad (SHCP). ¡Memoriza esto!'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.2 - Leyes y Reglamentos del Seguro';