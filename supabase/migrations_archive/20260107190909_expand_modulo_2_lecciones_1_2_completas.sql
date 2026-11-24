/*
  # Expansión Módulo 2 - Lecciones 2.1 y 2.2

  1. Actualizar Lección 2.1 con concepto completo de Seguros de Personas
  2. Actualizar Lección 2.2 con Accidentes Personales detallado
*/

-- Actualizar Lección 2.1: Concepto y Naturaleza del Seguro de Personas
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'MÓDULO 2: RIESGOS INDIVIDUALES DEL SEGURO DE PERSONAS (RISP)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Este módulo es fundamental en el examen CNSF, ya que evalúa la comprensión real del funcionamiento del seguro de personas y no solo la memorización de conceptos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO GENERAL DEL MÓDULO 2'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Al finalizar este módulo, el estudiante comprenderá qué son los seguros de personas, cómo se estructuran, cuáles son sus ramos, coberturas, exclusiones, procedimientos de atención, formas de indemnización, así como las obligaciones del asegurado y del agente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 2.1: CONCEPTO Y NATURALEZA DEL SEGURO DE PERSONAS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Seguro de Personas es aquel que tiene como finalidad proteger a la persona física, ya sea en su vida, su integridad corporal o su salud, así como las consecuencias económicas derivadas de un evento que afecte cualquiera de estos elementos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DIFERENCIAS CON EL SEGURO DE DAÑOS'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'A diferencia del seguro de daños, el seguro de personas tiene características únicas que debes conocer perfectamente para el examen.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El Seguro de Personas:',
      'items', jsonb_build_array(
        '✗ NO protege bienes materiales',
        '✗ NO se basa en la reparación de un objeto',
        '✓ SÍ protege intereses personales y familiares',
        '✓ SÍ protege la vida, integridad y salud',
        '✓ SÍ cubre consecuencias económicas de eventos que afecten a la persona'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CARACTERÍSTICAS FUNDAMENTALES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En los seguros de personas, el riesgo recae directamente sobre el individuo. La indemnización puede adoptar diferentes formas:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Formas de indemnización:',
      'items', jsonb_build_array(
        'Indemnización ECONÓMICA (pago en dinero)',
        'Prestación de SERVICIOS (atención médica directa)',
        'Suma PREVIAMENTE DETERMINADA (independiente del gasto real)',
        'Reembolso BASADO EN GASTOS (según documentación)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo 1: Juan tiene un seguro de vida por $1,000,000. Si fallece, sus beneficiarios reciben esa cantidad COMPLETA, sin importar cuánto costó el funeral. Esta es una suma previamente determinada.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo 2: María tiene un seguro de salud. Cuando va al hospital, recibe SERVICIOS MÉDICOS directamente, no dinero. La aseguradora paga al hospital, ella solo cubre un copago.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo 3: Pedro tiene Gastos Médicos Mayores. Se opera del corazón y gasta $500,000. Presenta facturas y la aseguradora le REEMBOLSA según el gasto real comprobado (menos deducible y coaseguro).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OPERACIÓN DE ACCIDENTES Y ENFERMEDADES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Dentro del sistema asegurador mexicano, la Operación de Accidentes y Enfermedades está diseñada para proteger a las personas contra accidentes, enfermedades y consecuencias médicas y económicas derivadas.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO PARA EL EXAMEN: Esta operación se divide en TRES ramos claramente diferenciados. Cada ramo tiene reglas propias. Confundirlos es uno de los errores más frecuentes.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Los TRES RAMOS de Accidentes y Enfermedades:',
      'items', jsonb_build_array(
        '1. ACCIDENTES PERSONALES (AP)',
        '2. GASTOS MÉDICOS MAYORES (GMM)',
        '3. SALUD'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DIFERENCIAS CLAVE ENTRE LOS TRES RAMOS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Memoriza esta tabla, es PREGUNTA FRECUENTE en el examen:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'ACCIDENTES PERSONALES (AP):',
      'items', jsonb_build_array(
        'Solo cubre ACCIDENTES (no enfermedades)',
        'Pago por TABLA predeterminada',
        'NO tiene deducible ni coaseguro',
        'Ejemplo: Pérdida de un dedo = 10% de suma asegurada'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'GASTOS MÉDICOS MAYORES (GMM):',
      'items', jsonb_build_array(
        'Cubre ACCIDENTES Y ENFERMEDADES',
        'SÍ tiene DEDUCIBLE',
        'SÍ tiene COASEGURO',
        'Reembolso basado en gastos reales',
        'Para eventos ESPORÁDICOS de alto costo'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'SALUD:',
      'items', jsonb_build_array(
        'Cubre ACCIDENTES Y ENFERMEDADES',
        'NO tiene deducible ni coaseguro',
        'SÍ tiene COPAGOS (cantidad fija por consulta)',
        'Red médica CERRADA',
        'Para uso FRECUENTE'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Te van a preguntar qué seguro tiene deducible (GMM), cuál tiene copago (Salud), cuál solo cubre accidentes (AP). ¡Memoriza estas diferencias!'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CONCEPTO DE BENEFICIARIOS EN SEGUROS DE PERSONAS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Beneficiarios son las personas designadas por el contratante para recibir la indemnización en caso de que ocurra el evento asegurado (generalmente el fallecimiento del asegurado).'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características importantes:',
      'items', jsonb_build_array(
        'Son designados LIBREMENTE por el contratante',
        'Pueden modificarse en CUALQUIER MOMENTO',
        'NO requieren aceptación del beneficiario',
        'Reciben la indemnización en caso de fallecimiento',
        'En vida, el asegurado es el beneficiario natural'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Roberto contrata un seguro de vida y designa como beneficiaria a su esposa. Después se divorcia y se casa con otra persona. Debe CAMBIAR la designación de beneficiarios, o la indemnización se pagará a la ex-esposa.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Muchas personas creen que al divorciarse automáticamente cambia el beneficiario. ¡FALSO! Debe hacerse mediante SOLICITUD EXPRESA a la aseguradora.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN DE LA LECCIÓN 2.1'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave para memorizar:',
      'items', jsonb_build_array(
        'El seguro de personas protege VIDA, INTEGRIDAD y SALUD',
        'NO protege bienes materiales',
        'La Operación de A&E tiene 3 RAMOS: AP, GMM y Salud',
        'AP = solo accidentes, sin deducible',
        'GMM = accidentes y enfermedades, CON deducible y coaseguro',
        'Salud = accidentes y enfermedades, CON copago',
        'Los beneficiarios se designan libremente'
      )
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 2.1 - Seguro de Vida';

-- Actualizar Lección 2.2: Accidentes Personales
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 2.2: RAMO DE ACCIDENTES PERSONALES (AP)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Esta lección contiene uno de los conceptos MÁS PREGUNTADOS en el examen: la definición técnica de accidente. Debes memorizar PERFECTAMENTE las 5 características.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.2.1 DEFINICIÓN TÉCNICA DE ACCIDENTE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Para efectos del seguro de Accidentes Personales, un ACCIDENTE es un acontecimiento que cumple SIMULTÁNEAMENTE con las siguientes 5 características. Si falta UNA SOLA, NO se considera accidente asegurado.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Las 5 características obligatorias de un accidente:',
      'items', jsonb_build_array(
        '1. EXTERNO: Proviene del EXTERIOR del cuerpo humano',
        '2. VIOLENTO: Produce una lesión corporal',
        '3. SÚBITO: Ocurre de manera REPENTINA',
        '4. FORTUITO: Es IMPREVISIBLE',
        '5. NO INTENCIONAL: No es provocado voluntariamente'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '⚠️ PREGUNTA FRECUENTE: ¿Un infarto es accidente? NO, porque NO es externo. ¿Una fractura por osteoporosis? NO, porque NO es violenta ni súbita. ¿Un suicidio? NO, porque es intencional.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso 1 - SÍ es accidente: Juan va caminando y un auto lo atropella. Se rompe la pierna. ✓ Externo (el auto vino de afuera) ✓ Violento (fractura) ✓ Súbito (repentino) ✓ Fortuito (no lo esperaba) ✓ No intencional (no se dejó atropellar a propósito)'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso 2 - NO es accidente: María sufre un infarto mientras duerme. ✗ NO es externo (viene del interior del cuerpo) ✗ NO es violento (es un proceso interno) → Por lo tanto, NO cubre el seguro de AP.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso 3 - NO es accidente: Pedro se avienta de un edificio (suicidio). Aunque tiene las otras 4 características, ✗ ES INTENCIONAL → NO está cubierto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.2.2 OBJETO DEL SEGURO DE ACCIDENTES PERSONALES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El seguro de Accidentes Personales tiene como finalidad indemnizar al asegurado o a sus beneficiarios cuando, como consecuencia DIRECTA de un accidente, se produce:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Eventos cubiertos:',
      'items', jsonb_build_array(
        'MUERTE ACCIDENTAL',
        'PÉRDIDA ORGÁNICA (pérdida de un miembro u órgano)',
        'INCAPACIDAD TOTAL o PARCIAL (temporal o permanente)',
        'GASTOS MÉDICOS derivados exclusivamente del accidente'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Palabra clave: CONSECUENCIA DIRECTA. Si la persona murió de un infarto 6 meses después del accidente, ya NO es consecuencia directa del accidente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.2.3 COBERTURAS COMUNES EN ACCIDENTES PERSONALES'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) MUERTE ACCIDENTAL'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Se paga el 100% de la suma asegurada a los beneficiarios designados cuando el asegurado fallece como consecuencia directa de un accidente.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Suma asegurada $500,000. El asegurado muere en accidente de auto. Los beneficiarios reciben $500,000 completos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) PÉRDIDAS ORGÁNICAS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Indemnización conforme a una TABLA DE VALUACIÓN cuando se pierde un miembro u órgano como consecuencia del accidente.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejemplos comunes de tabla (porcentajes varían por póliza):',
      'items', jsonb_build_array(
        'Pérdida de ambos ojos = 100% de suma asegurada',
        'Pérdida de un ojo = 50%',
        'Pérdida de una mano = 60%',
        'Pérdida de un dedo pulgar = 20%',
        'Pérdida de otro dedo = 10%',
        'Pérdida de ambas piernas = 100%',
        'Pérdida de una pierna = 60%'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Los porcentajes exactos dependen de la póliza contratada. Lo importante es entender que se paga por TABLA, NO por gasto real.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) INCAPACIDAD TOTAL O PARCIAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Incapacidad Total Permanente (ITP): Cuando el asegurado queda imposibilitado PERMANENTEMENTE para trabajar en CUALQUIER ocupación.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Incapacidad Parcial Permanente (IPP): Cuando el asegurado queda con una limitación permanente pero aún puede trabajar en alguna ocupación.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Incapacidad Temporal: Cuando el asegurado está temporalmente impedido para trabajar pero se espera recuperación total.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'ITP: Un cirujano pierde ambas manos en un accidente. No puede ejercer su profesión ni ninguna otra. → 100% de suma asegurada.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'IPP: Un pianista pierde dos dedos de la mano derecha. Ya no puede tocar piano profesionalmente, pero puede hacer otras actividades. → Porcentaje según tabla.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'D) GASTOS MÉDICOS POR ACCIDENTE'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Reembolso de gastos médicos hasta el límite contratado, exclusivamente derivados del accidente cubierto.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Gastos cubiertos típicamente:',
      'items', jsonb_build_array(
        'Hospitalización',
        'Honorarios médicos',
        'Cirugía',
        'Medicamentos',
        'Estudios de laboratorio',
        'Ambulancia',
        'Prótesis (cuando aplique)'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.2.4 EXCLUSIONES COMUNES EN ACCIDENTES PERSONALES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'LAS EXCLUSIONES SON CRÍTICAS. En el examen te darán un caso y debes identificar si está cubierto o excluido.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO están cubiertos (exclusiones típicas):',
      'items', jsonb_build_array(
        '❌ ENFERMEDADES de cualquier tipo (incluso si derivan en accidente)',
        '❌ Accidentes provocados INTENCIONALMENTE',
        '❌ Lesiones bajo influencia de ALCOHOL o DROGAS',
        '❌ RIÑAS (peleas), salvo legítima defensa',
        '❌ ACTOS DELICTIVOS cometidos por el asegurado',
        '❌ DEPORTES EXTREMOS (si no están expresamente cubiertos)',
        '❌ GUERRA, invasión, actos terroristas',
        '❌ SUICIDIO o intento de suicidio',
        '❌ Accidentes en AVIACIÓN (salvo pasajero de línea comercial)',
        '❌ PREEXISTENCIAS'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Exclusión - Caso 1: Roberto sale de una fiesta borracho, choca y se fractura el brazo. ❌ NO cubierto porque estaba bajo influencia del alcohol.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Exclusión - Caso 2: Sandra practica paracaidismo y se lesiona. Si su póliza NO cubre deportes extremos → ❌ NO cubierto.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Exclusión - Caso 3: Miguel participa en una riña callejera y lo golpean. ❌ NO cubierto porque participó en una riña.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.2.5 FORMA DE INDEMNIZACIÓN EN ACCIDENTES PERSONALES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PREGUNTA FRECUENTE: ¿Cómo se paga en AP? Respuesta: Por TABLA, NO por gasto real.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El seguro de AP es INDEMNIZATORIO POR TABLA, lo que significa que NO se paga con base en el gasto real, sino con base en PORCENTAJES PREDEFINIDOS en la póliza.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del pago por tabla:',
      'items', jsonb_build_array(
        'NO importa cuánto gastaste realmente',
        'Se paga según porcentaje ESTABLECIDO en la tabla',
        'La indemnización puede ser PARCIAL o TOTAL',
        'Es independiente de los gastos médicos',
        'Es más RÁPIDA que el reembolso'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo comparativo: Juan tiene suma asegurada de $1,000,000. Pierde un dedo (10% según tabla). Recibe $100,000, aunque los gastos médicos hayan sido solo $30,000. En este caso, GANA porque recibe más de lo que gastó.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo 2: María tiene la misma suma. Pierde el dedo pero gastó $150,000 en tratamiento. Recibe solo $100,000 (el 10%). En este caso, la tabla limita el pago aunque gastó más.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DIFERENCIA CLAVE: AP vs GMM'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'AP (Accidentes Personales):',
      'items', jsonb_build_array(
        'Solo ACCIDENTES',
        'Pago por TABLA',
        'NO deducible',
        'NO coaseguro',
        'Rápido'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'GMM (Gastos Médicos Mayores):',
      'items', jsonb_build_array(
        'Accidentes Y ENFERMEDADES',
        'Pago por GASTO REAL',
        'SÍ deducible',
        'SÍ coaseguro',
        'Requiere documentación completa'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Memoriza las 5 características del accidente (externo, violento, súbito, fortuito, no intencional). Te van a dar casos para identificar si es accidente o no. También memoriza que AP paga por TABLA, no por gasto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 2.2'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Accidente = 5 características simultáneas',
        'AP solo cubre ACCIDENTES (no enfermedades)',
        'Coberturas: muerte, pérdidas orgánicas, incapacidad, gastos médicos',
        'Indemnización por TABLA (no por gasto real)',
        'Exclusiones: alcohol, drogas, riñas, deportes extremos no cubiertos',
        'NO tiene deducible ni coaseguro'
      )
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 2.2 - Accidentes Personales';