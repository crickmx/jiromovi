/*
  # Expansión Lecciones 1.3 y 1.4 - Marco Legal y Operaciones

  1. Actualizar Lección 1.3 con marco legal completo
  2. Actualizar Lección 1.4 con operaciones y ramos detallados
*/

-- Actualizar Lección 1.3: Marco Legal del Seguro
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.3: MARCO LEGAL DEL SEGURO EN MÉXICO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La actividad aseguradora se rige por un conjunto de leyes específicas y leyes complementarias, que forman el Derecho de Seguros en México.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. LEY DE INSTITUCIONES DE SEGUROS Y FIANZAS (LISF)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La LISF es la LEY PRINCIPAL del sector asegurador.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'La LISF regula:',
      'items', jsonb_build_array(
        'La organización y funcionamiento de las instituciones de seguros',
        'Las operaciones que pueden realizar las aseguradoras',
        'La actividad de los agentes de seguros',
        'La supervisión del sector por parte de la CNSF',
        'La protección al usuario',
        'Las reservas técnicas y capital mínimo',
        'El reaseguro',
        'Las inversiones de las aseguradoras'
      )
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Principio fundamental de la LISF: El seguro es de INTERÉS PÚBLICO. Por lo tanto, solo entidades autorizadas pueden operar y los agentes deben cumplir requisitos técnicos y legales estrictos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. LEY SOBRE EL CONTRATO DE SEGURO (LSCS)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La LSCS regula la relación jurídica entre Aseguradora, Asegurado, Contratante y Beneficiarios.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'La LSCS define:',
      'items', jsonb_build_array(
        'Qué es un contrato de seguro',
        'Elementos esenciales del contrato',
        'Obligaciones de las partes',
        'Pago de primas y formas de pago',
        'Procedimiento de indemnizaciones',
        'Causas de nulidad del contrato',
        'Causas de rescisión',
        'Prescripción (plazo de 2 AÑOS)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO PARA EL EXAMEN: La prescripción de las acciones derivadas del contrato de seguro es de 2 AÑOS. Esta es una pregunta MUY frecuente.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Prescripción: Pérdida del derecho a reclamar por el paso del tiempo. Si el asegurado no reclama su indemnización dentro de 2 años, pierde el derecho. Si la aseguradora no cobra la prima en 2 años, pierde el derecho.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. REGLAMENTO DE AGENTES DE SEGUROS Y DE FIANZAS (RASF)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Este reglamento regula EXCLUSIVAMENTE al agente de seguros. Es uno de los documentos MÁS PREGUNTADOS en el examen.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El RASF incluye:',
      'items', jsonb_build_array(
        'Requisitos para obtener la autorización',
        'Tipos de agentes (vinculado, independiente, persona moral)',
        'Obligaciones del agente',
        'Prohibiciones',
        'Procedimiento sancionador',
        'Causas de suspensión',
        'Causas de revocación de la cédula',
        'Seguro de Responsabilidad Civil profesional'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo práctico: El RASF establece que TODO agente debe tener un seguro de RC profesional. Si no lo renuevas, la CNSF puede suspender tu cédula automáticamente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. LEYES COMPLEMENTARIAS O SUPLETORIAS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Se aplican cuando las leyes específicas (LISF, LSCS, RASF) no contemplan algún supuesto.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Leyes supletorias incluyen:',
      'items', jsonb_build_array(
        'Código Civil Federal',
        'Código de Comercio',
        'Ley de Protección y Defensa al Usuario de Servicios Financieros',
        'Ley de Navegación (para seguros marítimos)',
        'Ley de Vías Generales de Comunicación (para transportes)',
        'Ley Federal del Trabajo (cuando aplique)'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'JERARQUÍA NORMATIVA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En caso de conflicto entre normas, se aplica la de mayor jerarquía:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Orden de prelación:',
      'items', jsonb_build_array(
        '1. Constitución Política de los Estados Unidos Mexicanos',
        '2. Tratados Internacionales',
        '3. Leyes Federales (LISF, LSCS)',
        '4. Reglamentos (RASF)',
        '5. Circulares y Disposiciones Administrativas de la CNSF'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Las leyes ESPECÍFICAS de seguros (LISF, LSCS) tienen prioridad sobre las leyes GENERALES (Código Civil, Código de Comercio) en materia de seguros.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Si el Código Civil dice algo diferente a la Ley sobre el Contrato de Seguro en materia de seguros, prevalece la LSCS por ser ley especial.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Debes saber que la prescripción es de 2 años, que la LISF es la ley principal, que el RASF regula a los agentes, y que las leyes especiales prevalecen sobre las generales.'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.3 - Operaciones y Ramos de Seguros';

-- Actualizar Lección 1.4: Operaciones y Ramos
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.4: OPERACIONES Y RAMOS DE SEGUROS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Las aseguradoras solo pueden operar las operaciones y ramos para los cuales están autorizadas por la SHCP. No pueden ofrecer productos fuera de su autorización.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Esta clasificación es OFICIAL y está en la LISF. Es pregunta frecuente en el examen.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. OPERACIÓN DE VIDA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Protege la vida del asegurado. Esta operación NO tiene ramos, es una operación única.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Incluye seguros de:',
      'items', jsonb_build_array(
        'Vida individual (muerte o supervivencia)',
        'Vida grupo',
        'Seguros dotales',
        'Seguros con ahorro',
        'Pensiones derivadas de seguros de vida',
        'Rentas vitalicias'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Un seguro de vida ordinario que paga $1,000,000 si el asegurado fallece, o le devuelve el ahorro acumulado si llega a los 65 años.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. OPERACIÓN DE ACCIDENTES Y ENFERMEDADES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Esta operación se divide en TRES grandes categorías:'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'A) ACCIDENTES PERSONALES (AP): Cubre muerte accidental, invalidez total o parcial permanente, y gastos médicos por accidente. El evento debe ser súbito, violento, fortuito y externo.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'B) GASTOS MÉDICOS MAYORES (GMM): Cubre hospitalización, cirugía, maternidad, medicamentos y estudios. Opera con deducible (cantidad fija que paga el asegurado) y coaseguro (porcentaje que paga el asegurado después del deducible).'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'C) SEGURO DE SALUD: Opera con red de proveedores médicos, pago directo y sin deducibles ni coaseguros (solo copagos fijos). Requiere autorización previa para ciertos servicios.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Diferencia clave GMM vs Salud: GMM tiene deducible y coaseguro, libre elección de médico. Salud NO tiene deducible, solo copagos fijos, pero red médica cerrada.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. OPERACIÓN DE DAÑOS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La Operación de Daños protege bienes y responsabilidades. Se divide en ONCE (11) ramos oficiales.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'LOS 11 RAMOS OFICIALES DE LA OPERACIÓN DE DAÑOS:',
      'items', jsonb_build_array(
        '1. Responsabilidad Civil y Riesgos Profesionales',
        '2. Marítimo y Transportes',
        '3. Incendio',
        '4. Agrícola y de Animales',
        '5. Automóviles y Camiones',
        '6. Crédito',
        '7. Diversos (incluye múltiples coberturas como robo, cristales, etc.)',
        '8. Terremoto y Riesgos Catastróficos',
        '9. Garantía Financiera',
        '10. Crédito a la Vivienda',
        '11. Daños a Bienes Inmuebles para Crédito a la Vivienda'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡MEMORIZA LOS 11 RAMOS! Esta es pregunta FRECUENTE en el examen. Debes saber que son exactamente 11 ramos.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Un seguro de auto está en el Ramo 5 (Automóviles y Camiones). Un seguro contra incendio de una casa está en el Ramo 3 (Incendio). Un seguro de responsabilidad civil profesional de un médico está en el Ramo 1.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN DE OPERACIONES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Para memorizar:',
      'items', jsonb_build_array(
        'VIDA = 1 operación, SIN ramos',
        'ACCIDENTES Y ENFERMEDADES = 1 operación, 3 grandes categorías (AP, GMM, Salud)',
        'DAÑOS = 1 operación, 11 RAMOS oficiales'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Te pueden preguntar cuántos ramos tiene la operación de daños (11), qué operación NO tiene ramos (Vida), o en qué ramo está el seguro de autos (Ramo 5). ¡Estudia esto!'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.4 - Agentes de Seguros';