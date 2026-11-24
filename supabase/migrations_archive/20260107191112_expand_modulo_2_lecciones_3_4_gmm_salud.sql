/*
  # Expansión Módulo 2 - Lecciones 2.3 y 2.4

  1. Actualizar Lección 2.3 con GMM completo
  2. Actualizar Lección 2.4 con Salud completo
*/

-- Actualizar Lección 2.3: Gastos Médicos Mayores
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 2.3: RAMO DE GASTOS MÉDICOS MAYORES (GMM)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Esta es una de las lecciones MÁS IMPORTANTES del examen. Los conceptos de deducible, coaseguro y tope de coaseguro son PREGUNTA OBLIGADA.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.1 OBJETIVO DEL SEGURO DE GMM'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El seguro de Gastos Médicos Mayores tiene como objetivo proteger el PATRIMONIO del asegurado frente a gastos médicos ELEVADOS derivados de enfermedades o accidentes, cuando dichos gastos superan la capacidad económica normal del asegurado.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Palabra clave: PATRIMONIO. GMM NO es para consultas comunes, es para EVENTOS MAYORES que podrían quebrar económicamente a una familia.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Una cirugía de corazón abierto puede costar $800,000 MXN. Una familia clase media NO tiene ese dinero. El GMM protege su patrimonio pagando la mayor parte de ese gasto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.2 CONCEPTOS FUNDAMENTALES DEL SEGURO DE GMM'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡MEMORIZA PERFECTAMENTE ESTOS CONCEPTOS! Son la base de TODO el examen de GMM.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) SUMA ASEGURADA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es el LÍMITE MÁXIMO que la aseguradora pagará durante la vigencia de la póliza. Puede aplicar por evento, por padecimiento o por año según la póliza contratada.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Tipos de suma asegurada:',
      'items', jsonb_build_array(
        'Por EVENTO: Límite por cada hospitalización',
        'Por PADECIMIENTO: Límite acumulado para una misma enfermedad',
        'ANUAL: Límite durante el año póliza',
        'VITALICIA: Límite durante toda la vida (menos común)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Suma asegurada de $5,000,000 por evento. Si te hospitalizan por apendicitis, puedes usar hasta $5M. Si te hospitalizan nuevamente por otra cosa, tienes otros $5M disponibles.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) DEDUCIBLE'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es la cantidad FIJA que SIEMPRE paga el asegurado ANTES de que la aseguradora participe en el gasto. Es OBLIGATORIO en GMM.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: El deducible se paga CADA VEZ que ocurre un evento asegurado. Si te hospitalizas 3 veces al año, pagas el deducible 3 veces.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del deducible:',
      'items', jsonb_build_array(
        'Es una cantidad FIJA (ejemplo: $15,000 MXN)',
        'Se paga ANTES que nada',
        'A MAYOR deducible → MENOR prima',
        'A MENOR deducible → MAYOR prima',
        'NO se puede eliminar, es obligatorio'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Deducible de $20,000. Gastas $100,000 en hospitalización. Pagas primero tus $20,000 (deducible). Quedan $80,000 que se reparten entre tú y la aseguradora según el coaseguro.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) COASEGURO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es el PORCENTAJE del gasto que el asegurado comparte con la aseguradora, UNA VEZ APLICADO EL DEDUCIBLE. El coaseguro más común es 10% (el asegurado paga 10%, la aseguradora paga 90%).'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Muchos creen que el coaseguro aplica sobre el gasto total. ¡FALSO! Aplica sobre el gasto DESPUÉS de restar el deducible.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo COMPLETO: Gasto total $100,000, deducible $20,000, coaseguro 10%. 
PASO 1: Restas deducible: $100,000 - $20,000 = $80,000
PASO 2: Aplicas coaseguro sobre los $80,000:
- Tú pagas: 10% de $80,000 = $8,000
- Aseguradora paga: 90% de $80,000 = $72,000

TOTAL que pagas: $20,000 (deducible) + $8,000 (coaseguro) = $28,000
TOTAL que paga aseguradora: $72,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'D) TOPE DE COASEGURO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Es el LÍMITE MÁXIMO que el asegurado pagará por concepto de coaseguro. Una vez que alcanzas este tope, la aseguradora paga el 100% del resto.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡IMPORTANTE! El deducible NO cuenta para el tope de coaseguro. El tope es SOLO para el coaseguro.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Tope de coaseguro $50,000. Deducible $20,000. Coaseguro 10%. Gasto REAL: $700,000.

PASO 1: Pagas deducible $20,000
PASO 2: Quedan $680,000 ($700,000 - $20,000)
PASO 3: Tu coaseguro sería 10% de $680,000 = $68,000
PASO 4: PERO tienes tope de $50,000, entonces solo pagas $50,000
PASO 5: La aseguradora paga el resto: $680,000 - $50,000 = $630,000

TOTAL que pagas: $20,000 (deducible) + $50,000 (tope coaseguro) = $70,000
TOTAL aseguradora: $630,000'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'E) COPAGO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡CUIDADO! El copago NO es típico de GMM, es típico del seguro de SALUD. Pero debes saber la diferencia.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Copago es una cantidad FIJA que se paga por cada atención médica. Ejemplo: $300 por consulta, $500 por estudio.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Diferencia Coaseguro vs Copago:',
      'items', jsonb_build_array(
        'COASEGURO = Porcentaje (10%, 20%) - Típico de GMM',
        'COPAGO = Cantidad fija ($300, $500) - Típico de Salud'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.3 FORMAS DE PAGO EN GMM'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) PAGO DIRECTO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La aseguradora paga DIRECTAMENTE al hospital o médico. El asegurado solo cubre su deducible y coaseguro.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del pago directo:',
      'items', jsonb_build_array(
        'Se utiliza dentro de la RED MÉDICA de la aseguradora',
        'Requiere AUTORIZACIÓN PREVIA (carta de garantía)',
        'La aseguradora paga directamente al proveedor',
        'El asegurado solo cubre deducible y coaseguro',
        'Es más CÓMODO para el asegurado',
        'Proceso más RÁPIDO'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Te hospitalizan en un hospital de la red. Llamas a tu aseguradora, autorizan con carta de garantía. El hospital cobra directo a la aseguradora. Tú solo pagas tu parte (deducible + coaseguro) al salir.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) PAGO POR REEMBOLSO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El asegurado paga INICIALMENTE todos los gastos y después solicita el reembolso a la aseguradora.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características del reembolso:',
      'items', jsonb_build_array(
        'El asegurado paga PRIMERO (debe tener liquidez)',
        'Presenta documentos a la aseguradora',
        'La aseguradora analiza y dictamina',
        'Tiene 30 DÍAS NATURALES para pagar (plazo legal)',
        'Se usa cuando NO hay pago directo disponible',
        'Requiere documentación COMPLETA'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos típicos para reembolso:',
      'items', jsonb_build_array(
        'Facturas originales',
        'Recetas médicas',
        'Notas de evolución',
        'Estudios de laboratorio y gabinete',
        'Resumen clínico',
        'Formato de reclamación lleno'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: La aseguradora tiene 30 DÍAS NATURALES (no hábiles) para pagar desde que recibe documentación COMPLETA.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.4 HONORARIOS MÉDICOS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La aseguradora solo cubre honorarios de profesionales legalmente autorizados:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Profesionales cubiertos:',
      'items', jsonb_build_array(
        '✓ Médicos TITULADOS y con cédula profesional',
        '✓ Enfermeras TITULADAS',
        '✓ Especialistas certificados',
        '✓ Instituciones hospitalarias autorizadas'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO cubre:',
      'items', jsonb_build_array(
        '❌ Donativos',
        '❌ Cuotas de recuperación',
        '❌ Caridad',
        '❌ Instituciones de beneficencia',
        '❌ Profesionales sin cédula'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.5 OBLIGACIONES DEL ASEGURADO EN GMM'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El INCUMPLIMIENTO de estas obligaciones puede resultar en RECHAZO del siniestro o REDUCCIÓN de la indemnización.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El asegurado DEBE:',
      'items', jsonb_build_array(
        '1. Avisar OPORTUNAMENTE a la aseguradora',
        '2. Seguir los PROCEDIMIENTOS establecidos',
        '3. Presentar documentación COMPLETA y VERAZ',
        '4. Apegarse a la red médica autorizada (cuando aplique)',
        '5. Solicitar autorización PREVIA para cirugías',
        '6. Informar cambios en su estado de salud',
        '7. Pagar primas PUNTUALMENTE'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de incumplimiento: Roberto necesita cirugía programada. NO avisa a la aseguradora antes. Se opera. Presenta reclamación. La aseguradora RECHAZA por falta de autorización previa.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.6 COBERTURAS COMUNES EN GMM'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Las pólizas de GMM típicamente cubren:',
      'items', jsonb_build_array(
        '✓ Hospitalización',
        '✓ Honorarios médicos',
        '✓ Cirugía',
        '✓ Medicamentos durante hospitalización',
        '✓ Estudios de laboratorio y gabinete',
        '✓ Terapias (con límites)',
        '✓ Ambulancia',
        '✓ Maternidad (con periodo de espera)',
        '✓ Urgencias en el extranjero'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.3.7 EXCLUSIONES COMUNES EN GMM'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO están cubiertas típicamente:',
      'items', jsonb_build_array(
        '❌ Padecimientos PREEXISTENTES (declarados o no)',
        '❌ Tratamientos ESTÉTICOS o cosméticos',
        '❌ Tratamientos EXPERIMENTALES',
        '❌ Cirugías de cambio de sexo',
        '❌ Lesiones AUTOINFLIGIDAS',
        '❌ Consecuencias de ALCOHOLISMO o DROGADICCIÓN',
        '❌ Tratamientos de INFERTILIDAD (salvo cobertura específica)',
        '❌ Anteojos y lentes de contacto',
        '❌ SIDA (en algunas pólizas)',
        '❌ Guerra y actos terroristas'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PREEXISTENCIA: Cualquier padecimiento que el asegurado tenía ANTES de contratar la póliza, aunque no lo supiera. Es exclusión permanente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 2.3'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave para el examen:',
      'items', jsonb_build_array(
        'GMM cubre ACCIDENTES Y ENFERMEDADES',
        'Tiene DEDUCIBLE (cantidad fija que pagas primero)',
        'Tiene COASEGURO (porcentaje después del deducible)',
        'Tope de coaseguro limita lo que pagas de coaseguro',
        'Pago directo = aseguradora paga al hospital',
        'Reembolso = tú pagas y luego te devuelven',
        '30 días para pagar reembolso',
        'Solo cubre profesionales titulados'
      )
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 2.3 - Gastos Médicos Mayores';

-- Actualizar Lección 2.4: Seguro de Salud
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 2.4: RAMO DE SALUD'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El seguro de Salud es DIFERENTE a GMM. Esta diferencia es PREGUNTA FRECUENTE en el examen. Muchos reprobados confunden estos dos seguros.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.1 NATURALEZA DEL SEGURO DE SALUD'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El seguro de salud NO es indemnizatorio, sino un seguro de PRESTACIÓN DE SERVICIOS. En lugar de pagar dinero, la aseguradora PROPORCIONA SERVICIOS MÉDICOS.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Diferencia fundamental: GMM = te dan dinero (indemnizatorio). SALUD = te dan servicios (no indemnizatorio).'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Objetivos del seguro de Salud:',
      'items', jsonb_build_array(
        'Facilitar ACCESO a atención médica',
        'Fomentar la PREVENCIÓN de enfermedades',
        'Controlar COSTOS médicos',
        'Promover USO FRECUENTE y preventivo',
        'Simplificar procedimientos administrativos'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo GMM: Te enfermas, vas a cualquier hospital, pagas tú, luego la aseguradora te reembolsa dinero. Ejemplo SALUD: Te enfermas, vas a un hospital de la RED, recibes atención, pagas solo un copago fijo de $300.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.2 CARACTERÍSTICAS DEL SEGURO DE SALUD'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) USO FRECUENTE'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'A diferencia de GMM (que se usa para eventos ESPORÁDICOS mayores), el seguro de Salud está diseñado para uso FRECUENTE:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Usos típicos:',
      'items', jsonb_build_array(
        'Consultas médicas regulares',
        'Chequeos preventivos',
        'Vacunas',
        'Medicamentos recurrentes',
        'Atención de enfermedades crónicas',
        'Estudios de rutina'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) RED MÉDICA CERRADA'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: En Salud, DEBES usar la red médica. Si vas fuera de red, NO hay cobertura o es muy limitada.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de la red médica:',
      'items', jsonb_build_array(
        'Lista ESPECÍFICA de médicos y hospitales',
        'Convenios pre-negociados con tarifas controladas',
        'OBLIGATORIO usar la red para tener cobertura',
        'Fuera de red = sin cobertura o cobertura mínima',
        'La red puede variar por región'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Tu seguro de Salud tiene convenio con Hospital ABC. Vas ahí, tienes cobertura. Decides ir a Hospital XYZ que NO está en red → NO hay cobertura, pagas todo tú.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) COPAGOS (NO deducible ni coaseguro)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El seguro de Salud utiliza COPAGOS: cantidades FIJAS que pagas por cada servicio.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejemplos de copagos:',
      'items', jsonb_build_array(
        'Consulta médico general: $200',
        'Consulta especialista: $400',
        'Estudio de laboratorio: $150',
        'Rayos X: $300',
        'Medicamentos: $100 por receta',
        'Urgencias: $500'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'DIFERENCIA CLAVE: COPAGO = cantidad fija. COASEGURO = porcentaje. Salud usa COPAGO. GMM usa COASEGURO.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'D) PROCEDIMIENTOS ESPECÍFICOS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El seguro de Salud tiene procedimientos más estrictos y específicos que GMM:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Procedimientos típicos:',
      'items', jsonb_build_array(
        'Autorización PREVIA obligatoria para muchos servicios',
        'Referencia del médico general a especialista',
        'Límites de consultas por año',
        'Periodos de espera para ciertas coberturas',
        'Formularios específicos para medicamentos'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'E) ATENCIÓN PREVENTIVA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Una gran ventaja del seguro de Salud es que fomenta y cubre medicina PREVENTIVA:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Servicios preventivos típicamente incluidos:',
      'items', jsonb_build_array(
        '✓ Chequeos anuales SIN COSTO',
        '✓ Vacunas',
        '✓ Detección oportuna de enfermedades',
        '✓ Campañas de salud',
        '✓ Orientación nutricional',
        '✓ Programas de control de enfermedades crónicas'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.3 PROCEDIMIENTO DE ATENCIÓN EN SALUD'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Este procedimiento es MUY diferente al de GMM. Debes conocerlo para el examen.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Pasos típicos:',
      'items', jsonb_build_array(
        '1. SOLICITUD: El asegurado solicita atención',
        '2. VERIFICACIÓN: Se verifica cobertura y vigencia',
        '3. AUTORIZACIÓN: Se autoriza el servicio (cuando aplique)',
        '4. PRESTACIÓN: Se presta el servicio médico',
        '5. COPAGO: El asegurado paga su copago correspondiente',
        '6. LIQUIDACIÓN: La aseguradora paga al proveedor'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo paso a paso: 1) Te sientes mal, llamas a tu aseguradora. 2) Te dan cita en hospital de red. 3) Llegas, presentas tu tarjeta. 4) Te atiende el médico. 5) Pagas copago de $250. 6) Sales. La aseguradora ya pagó al hospital el resto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.4 VENTAJAS Y DESVENTAJAS DEL SEGURO DE SALUD'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'VENTAJAS:',
      'items', jsonb_build_array(
        '✓ Costos PREDECIBLES (solo copagos)',
        '✓ Sin deducible ni coaseguro',
        '✓ Acceso frecuente y preventivo',
        '✓ Trámites MÁS SIMPLES',
        '✓ Medicina preventiva incluida',
        '✓ No necesitas dinero inicial (solo copago)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'DESVENTAJAS:',
      'items', jsonb_build_array(
        '✗ Red médica LIMITADA',
        '✗ Sin libertad de elección de médico',
        '✗ Procedimientos más restrictivos',
        '✗ Autorizaciones obligatorias',
        '✗ Límites en algunos servicios',
        '✗ NO reembolsa si vas fuera de red'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.5 DIFERENCIAS CLAVE: GMM vs SALUD'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA ESTA TABLA. Es PREGUNTA OBLIGADA en el examen.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'TIPO DE SEGURO:',
      'items', jsonb_build_array(
        'GMM = Indemnizatorio (paga dinero)',
        'SALUD = Servicios (proporciona atención)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'DEDUCIBLE:',
      'items', jsonb_build_array(
        'GMM = SÍ tiene deducible',
        'SALUD = NO tiene deducible'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'COASEGURO:',
      'items', jsonb_build_array(
        'GMM = SÍ tiene coaseguro (porcentaje)',
        'SALUD = NO tiene coaseguro'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'COPAGO:',
      'items', jsonb_build_array(
        'GMM = NO tiene copago',
        'SALUD = SÍ tiene copago (cantidad fija)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'USO:',
      'items', jsonb_build_array(
        'GMM = Esporádico, eventos mayores',
        'SALUD = Frecuente, preventivo'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'RED MÉDICA:',
      'items', jsonb_build_array(
        'GMM = Libre elección (puedes ir a cualquier hospital)',
        'SALUD = Red cerrada (solo hospitales autorizados)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'FORMA DE PAGO:',
      'items', jsonb_build_array(
        'GMM = Reembolso o pago directo',
        'SALUD = Solo pago directo (copago)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo comparativo: Juan necesita cirugía de $200,000. Con GMM: Paga deducible $20,000 + coaseguro 10% de $180,000 = $18,000. TOTAL: $38,000. Con SALUD: Paga copago de cirugía = $3,000. TOTAL: $3,000. PERO con Salud SOLO puede ir a hospitales de red, con GMM va donde quiera.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.6 COBERTURAS COMUNES EN SALUD'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Típicamente incluye:',
      'items', jsonb_build_array(
        '✓ Consultas médicas (con copago)',
        '✓ Estudios de laboratorio y gabinete',
        '✓ Medicamentos (con formulario)',
        '✓ Hospitalización',
        '✓ Cirugías',
        '✓ Urgencias',
        '✓ Maternidad',
        '✓ Medicina preventiva'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.7 EXCLUSIONES COMUNES EN SALUD'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO cubre típicamente:',
      'items', jsonb_build_array(
        '❌ Servicios FUERA de red',
        '❌ Tratamientos experimentales',
        '❌ Cirugías estéticas',
        '❌ Padecimientos preexistentes no declarados',
        '❌ Medicamentos fuera de formulario',
        '❌ Servicios sin autorización previa'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2.4.8 ¿CUÁL CONVIENE MÁS: GMM O SALUD?'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Depende del perfil del cliente:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CONVIENE GMM si:',
      'items', jsonb_build_array(
        'Quieres LIBERTAD de elegir médico y hospital',
        'Puedes pagar deducible y coaseguro',
        'No usarás el seguro frecuentemente',
        'Quieres cobertura AMPLIA',
        'Viajas al extranjero frecuentemente'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CONVIENE SALUD si:',
      'items', jsonb_build_array(
        'Prefieres costos PREDECIBLES (copagos)',
        'No tienes liquidez para deducibles altos',
        'Usarás el seguro FRECUENTEMENTE',
        'Te interesa medicina preventiva',
        'No te importa la red médica limitada'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Te pueden dar un perfil de cliente y preguntar qué seguro le conviene. Usa estos criterios para decidir.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 2.4'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Salud = prestación de SERVICIOS (no indemnizatorio)',
        'NO tiene deducible ni coaseguro',
        'SÍ tiene COPAGOS (cantidades fijas)',
        'Red médica CERRADA (obligatorio usar la red)',
        'Uso FRECUENTE y medicina preventiva',
        'Procedimientos más restrictivos',
        'Diferente a GMM en casi todo'
      )
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 2.4 - Seguro de Salud';