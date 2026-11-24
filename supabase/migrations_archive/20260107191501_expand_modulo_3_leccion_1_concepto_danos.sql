/*
  # Expansión Módulo 3 - Lección 3.1

  1. Actualizar Lección 3.1 con concepto completo del seguro de daños
  2. Incluir naturaleza, principios y operación de daños
*/

UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'MÓDULO 3: RIESGOS INDIVIDUALES DEL SEGURO DE DAÑOS (RISD)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Este módulo tiene ALTO PESO en el examen CNSF y es uno de los más importantes en la práctica diaria del agente de seguros. El ramo de Automóviles es el más evaluado dentro de Daños.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO GENERAL DEL MÓDULO 3'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Al finalizar este módulo, el estudiante comprenderá la naturaleza del seguro de daños, su finalidad patrimonial, los principios que lo rigen, el funcionamiento del ramo de automóviles, los tipos de pólizas, las coberturas, el proceso completo de un siniestro, los criterios de pérdida total y parcial, así como la documentación necesaria para la indemnización.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 3.1: CONCEPTO Y NATURALEZA DEL SEGURO DE DAÑOS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El seguro de daños es FUNDAMENTALMENTE DIFERENTE al seguro de personas. Esta diferencia es PREGUNTA OBLIGADA en el examen.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Seguro de Daños es aquel cuyo objetivo principal es proteger el PATRIMONIO del asegurado, indemnizándolo por las pérdidas económicas que sufra como consecuencia de un siniestro cubierto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DIFERENCIAS FUNDAMENTALES CON SEGUROS DE PERSONAS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA estas diferencias. Son la BASE del concepto de seguro de daños.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del Seguro de DAÑOS:',
      'items', jsonb_build_array(
        '✓ Protege el PATRIMONIO (bienes materiales)',
        '✓ SIEMPRE es indemnizatorio',
        '✓ NUNCA debe existir lucro',
        '✓ La indemnización busca RESTITUIR, no enriquecer',
        '✓ Tiene suma asegurada que limita la responsabilidad',
        '✓ Aplica el principio de indemnización'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del Seguro de PERSONAS:',
      'items', jsonb_build_array(
        '✓ Protege VIDA, integridad, salud',
        '✓ Puede ser indemnizatorio O de servicios',
        '✓ La suma asegurada es libremente pactada',
        '✓ NO aplica principio indemnizatorio estricto',
        '✓ Puede haber "ganancia" (ej: AP por tabla)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo DAÑOS: Tu auto vale $300,000. Lo aseguras por $500,000. Hay pérdida total. La aseguradora paga SOLO $300,000 (valor real), NO $500,000. No puede haber enriquecimiento.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo PERSONAS: Tienes seguro de vida por $1,000,000. Falleces. Tus beneficiarios reciben $1,000,000 COMPLETOS, sin importar si gastaron $50,000 en funeral. SÍ puede haber "ganancia".'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EL PRINCIPIO INDEMNIZATORIO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Principio Indemnizatorio establece que el asegurado NO puede recibir MÁS de lo que realmente perdió. Este principio es la ESENCIA del seguro de daños.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: El objetivo del seguro de daños NO es enriquecer al asegurado, sino RESTAURAR su situación patrimonial al estado anterior al siniestro.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Implicaciones del principio indemnizatorio:',
      'items', jsonb_build_array(
        '1. No se paga más que el VALOR REAL del bien',
        '2. Si el bien vale menos que la suma asegurada, se paga el valor real',
        '3. Si hay SOBREASEGURAMIENTO, solo se paga el daño real',
        '4. Si hay INFRAASEGURAMIENTO, se aplica proporción',
        '5. El asegurado NO puede "ganar" con el seguro'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de sobreaseguramiento: Aseguras tu casa por $5,000,000. Su valor real es $3,000,000. Se quema totalmente. La aseguradora paga $3,000,000 (valor real), NO $5,000,000 (suma asegurada). Pagaste prima de más sin beneficio.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de infraaseguramiento: Tu casa vale $3,000,000. La aseguras por $1,500,000 (50% del valor). Hay daños por $600,000. La aseguradora paga proporcionalmente: $600,000 × (1,500,000 / 3,000,000) = $300,000. Solo pagas el 50% porque solo aseguraste el 50%.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'FINALIDAD PATRIMONIAL DEL SEGURO DE DAÑOS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El seguro de daños tiene una finalidad exclusivamente patrimonial. Su objetivo es:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Objetivos patrimoniales:',
      'items', jsonb_build_array(
        'Proteger bienes materiales del asegurado',
        'Evitar pérdidas económicas catastróficas',
        'Restituir el patrimonio afectado',
        'Garantizar la continuidad económica',
        'Transferir el riesgo patrimonial a la aseguradora'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ELEMENTOS ESENCIALES DEL SEGURO DE DAÑOS'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) INTERÉS ASEGURABLE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El asegurado debe tener un interés económico legítimo en el bien asegurado. Si el bien se daña o se pierde, el asegurado debe sufrir una pérdida económica real.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo CON interés: Eres dueño de un auto. Si se destruye, pierdes dinero. Tienes interés asegurable. Ejemplo SIN interés: Quieres asegurar el auto de tu vecino que no te pertenece. NO tienes interés asegurable. No puedes asegurarlo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) SUMA ASEGURADA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es el límite máximo de responsabilidad que la aseguradora tiene en caso de siniestro. Debe representar el valor real del bien asegurado.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: La suma asegurada NO determina lo que se paga, sino el LÍMITE MÁXIMO. Se paga el daño real, hasta el tope de la suma asegurada.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) VALOR REAL DEL BIEN'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es el valor que tiene el bien en el momento del siniestro, considerando su estado, depreciación y valor de mercado.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Factores que determinan el valor real:',
      'items', jsonb_build_array(
        'Valor de mercado actual',
        'Estado de conservación',
        'Depreciación por uso',
        'Edad del bien',
        'Obsolescencia',
        'Valor de reposición menos depreciación'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OPERACIÓN DE DAÑOS Y SUS RAMOS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA los 11 ramos de la Operación de Daños. Es pregunta frecuente del examen.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La Operación de Daños se divide en ONCE RAMOS, autorizados por la Secretaría de Hacienda y Crédito Público (SHCP).'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Los 11 RAMOS de Daños (autorizados por SHCP):',
      'items', jsonb_build_array(
        '1. Responsabilidad Civil y Riesgos Profesionales',
        '2. Marítimo y Transportes',
        '3. Incendio',
        '4. Agrícola y de Animales',
        '5. AUTOMÓVILES (el más importante para el examen)',
        '6. Crédito',
        '7. Caución (Fianzas)',
        '8. Crédito a la Vivienda',
        '9. Garantía Financiera',
        '10. Riesgos Catastróficos',
        '11. Diversos'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN DE CÉDULA A: El ramo de AUTOMÓVILES es el MÁS RELEVANTE y el que más se evalúa. Por eso este módulo se centra principalmente en él.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DESCRIPCIÓN BREVE DE LOS RAMOS'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '1. Responsabilidad Civil y Riesgos Profesionales:',
      'items', jsonb_build_array(
        'Cubre la responsabilidad del asegurado por daños a terceros',
        'Incluye responsabilidad profesional (médicos, abogados, etc.)',
        'Protege contra reclamaciones de terceros'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '2. Marítimo y Transportes:',
      'items', jsonb_build_array(
        'Cubre embarcaciones',
        'Transporte de mercancías',
        'Riesgos del mar'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '3. Incendio:',
      'items', jsonb_build_array(
        'Cubre daños por fuego',
        'Puede incluir rayos, explosión',
        'Generalmente aplicable a inmuebles'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '4. Agrícola y de Animales:',
      'items', jsonb_build_array(
        'Protege cultivos y cosechas',
        'Cubre ganado',
        'Riesgos climáticos'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '5. Automóviles (FOCO DEL MÓDULO):',
      'items', jsonb_build_array(
        'Daños materiales al vehículo',
        'Robo total',
        'Responsabilidad civil',
        'Gastos médicos a ocupantes',
        'Asistencia vial y legal'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '6. Crédito:',
      'items', jsonb_build_array(
        'Cubre insolvencia de deudores',
        'Protege cuentas por cobrar',
        'Riesgo de impago'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', '7. Caución:',
      'items', jsonb_build_array(
        'Garantiza cumplimiento de obligaciones',
        'Similar a fianzas',
        'Protege contra incumplimiento contractual'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'IMPORTANCIA DEL RAMO DE AUTOMÓVILES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El ramo de Automóviles es el MÁS IMPORTANTE para un agente de seguros por las siguientes razones:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Razones de su importancia:',
      'items', jsonb_build_array(
        'Es el seguro MÁS VENDIDO en México',
        'Genera mayor volumen de primas',
        'Es OBLIGATORIO por ley (responsabilidad civil)',
        'Tiene alta rotación (renovación anual)',
        'Es la puerta de entrada para vender otros seguros',
        'Es el más preguntado en el examen de Cédula A'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'DATO CLAVE: Aproximadamente el 40% del examen de Cédula A sobre seguros de daños se enfoca en Automóviles.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 3.1'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave para memorizar:',
      'items', jsonb_build_array(
        'Seguro de daños = protege PATRIMONIO (bienes materiales)',
        'Seguro de personas = protege vida, integridad, salud',
        'Daños SIEMPRE es indemnizatorio (no puede haber lucro)',
        'Principio indemnizatorio: no se paga más del daño real',
        'La Operación de Daños tiene 11 ramos',
        'Automóviles es el ramo más importante para el agente',
        'El asegurado debe tener interés asegurable',
        'Suma asegurada = límite máximo, NO lo que se paga',
        'Se paga el VALOR REAL del bien en el momento del siniestro'
      )
    )
  )
),
duracion_estimada_minutos = 45,
updated_at = now()
WHERE titulo = 'Lección 3.1 - Seguro de Automóviles';