/*
  # Módulo 2 - Riesgos Individuales Seguros de Personas (RISP)

  1. Contenido
    - Lección 2.1: Seguro de Vida
    - Lección 2.2: Accidentes Personales
    - Lección 2.3: Gastos Médicos Mayores
    - Lección 2.4: Seguro de Salud
    - Basado en página 46 del Manual CNSF oficial
*/

-- Lección 2.1: Seguro de Vida
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 2.1 - Seguro de Vida',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Seguro de Vida Individual'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El seguro de vida tiene como objetivo proteger económicamente a los beneficiarios designados en caso de fallecimiento del asegurado, proporcionando una suma asegurada que permita mantener su nivel de vida.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Elementos Principales'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Beneficiarios: Personas designadas para recibir la indemnización. Pueden ser beneficiarios preferentes (cónyuge, concubina/o, hijos y padres), beneficiarios designados (cualquier persona nombrada), indeterminados (se designa categoría como "hijos del asegurado") o modificarse en cualquier momento.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Suma Asegurada: Monto que se pagará en caso de fallecimiento. Se determina según necesidades y capacidad de pago. Puede ser fija o variable e incluye muerte natural y accidental.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Formas de Indemnización:',
        'items', jsonb_build_array(
          'Pago único: Total de la suma asegurada de una sola vez',
          'Renta: Pagos periódicos por tiempo determinado',
          'Mixto: Combinación de ambas formas'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos de Cobertura'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Coberturas principales:',
        'items', jsonb_build_array(
          'Muerte Natural: Fallecimiento por causas naturales o enfermedad',
          'Muerte Accidental: Suma adicional si el fallecimiento es por accidente (doble indemnización)',
          'Invalidez Total y Permanente: Adelanta el pago si el asegurado queda inválido permanentemente'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Periodos Importantes'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Periodo de Gracia: 30 días naturales después del vencimiento de la prima para pagarla sin perder cobertura.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Periodo de Contestabilidad: 2 años durante los cuales la aseguradora puede investigar la veracidad de la información proporcionada.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Cláusula Suicida: Si el suicidio ocurre dentro de los primeros 2 años, no hay cobertura (solo se devuelven reservas).'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Documentos para Indemnización:',
        'items', jsonb_build_array(
          'Acta de defunción',
          'Póliza original',
          'Identificación oficial de beneficiarios',
          'Acta de nacimiento de beneficiarios',
          'Certificado médico de defunción',
          'Según el caso: acta ministerial, autopsia'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Recuerda que el periodo de contestabilidad y la cláusula suicida son de 2 años. El periodo de gracia es de 30 días. Los beneficiarios preferentes tienen prioridad sobre los designados.'
      )
    )
  ),
  1,
  40
FROM cedula_a_modulos m WHERE m.orden = 2;

-- Lección 2.2: Accidentes Personales
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 2.2 - Accidentes Personales',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Seguro de Accidentes Personales (AP)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Protege al asegurado contra las consecuencias económicas de accidentes que causen muerte, invalidez o incapacidad temporal.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Coberturas Básicas'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Muerte Accidental: Pago de suma asegurada por fallecimiento a causa de accidente. Debe ocurrir dentro de los 90 días siguientes al accidente con relación directa entre accidente y muerte.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Invalidez Total y Permanente: Pérdida definitiva de capacidad para trabajar. Se paga 100% de la suma asegurada con evaluación médica obligatoria.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Invalidez Parcial Permanente (según tabla de valuación)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Porcentajes de indemnización:',
        'items', jsonb_build_array(
          'Pérdida total de la vista de ambos ojos: 100%',
          'Pérdida de un ojo: 50%',
          'Pérdida de ambas manos o ambos pies: 100%',
          'Pérdida de una mano o un pie: 50%',
          'Pérdida del pulgar: 25%',
          'Pérdida de cualquier otro dedo: 10%'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '4. Gastos Funerarios: Reembolso de gastos por funeral hasta límite según póliza. Requiere facturas y comprobantes.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Coberturas Adicionales:',
        'items', jsonb_build_array(
          'Gastos médicos por accidente (hasta límite específico)',
          'Renta hospitalaria (pago diario durante hospitalización)',
          'Indemnización por quemaduras (según grado y extensión)',
          'Transporte en ambulancia (reembolso de gastos)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Definición de Accidente'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Evento súbito, violento, fortuito y externo que causa lesión corporal.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Características del accidente:',
        'items', jsonb_build_array(
          'Súbito: Ocurre de manera repentina',
          'Violento: Causa trauma físico',
          'Fortuito: Imprevisto e involuntario',
          'Externo: Causa ajena al organismo'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Exclusiones Comunes:',
        'items', jsonb_build_array(
          'Intento de suicidio o lesiones autoinfligidas',
          'Guerra o actos de terrorismo',
          'Deportes extremos sin cobertura adicional',
          'Conducir en estado de ebriedad',
          'Participación en riñas o delitos',
          'Uso de drogas o sustancias tóxicas',
          'Enfermedades o padecimientos preexistentes'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante: El aviso del siniestro debe darse dentro de los 5 días hábiles siguientes al accidente. Memoriza la tabla de valuación de invalidez parcial para el examen.'
      )
    )
  ),
  2,
  35
FROM cedula_a_modulos m WHERE m.orden = 2;

-- Lección 2.3: Gastos Médicos Mayores
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 2.3 - Gastos Médicos Mayores',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Seguro de Gastos Médicos Mayores (GMM)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cubre los gastos médicos, quirúrgicos, hospitalarios y demás relacionados con la atención de enfermedades y accidentes del asegurado.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Conceptos Fundamentales'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Deducible: Cantidad fija que el asegurado debe pagar antes de que la aseguradora comience a cubrir gastos. Se aplica por evento o por año según póliza. Entre más alto, menor es la prima. Ejemplos: $10,000, $25,000, $50,000.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Coaseguro: Porcentaje de los gastos que el asegurado paga después del deducible. Generalmente 10% o 20%. Aplica hasta alcanzar el tope de coaseguro. Ejemplo: Con 10% de coaseguro, el asegurado paga 10% y la aseguradora 90%.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '3. Tope de Coaseguro: Límite máximo que el asegurado pagará en coaseguro. Una vez alcanzado, la aseguradora cubre 100%. Protege contra gastos catastróficos.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '4. Suma Asegurada: Límite máximo de responsabilidad de la aseguradora. Puede ser por evento o vitalicia. Común: $10 millones, $20 millones, ilimitada.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '5. Copago: Cantidad fija que el asegurado paga por ciertos servicios como consultas o estudios.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Modalidades de Pago'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Pago Directo:',
        'items', jsonb_build_array(
          'La aseguradora paga directamente al hospital',
          'Requiere red de hospitales afiliados',
          'El asegurado solo cubre deducible y coaseguro',
          'Proceso más rápido y sin desembolso mayor'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Reembolso:',
        'items', jsonb_build_array(
          'El asegurado paga todos los gastos',
          'Presenta facturas para reembolso posterior',
          'Libertad para elegir hospital y médico',
          'Proceso puede tardar más tiempo'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Coberturas Principales:',
        'items', jsonb_build_array(
          'Hospitalización: Cuarto, alimentos, enfermería',
          'Honorarios médicos: Cirujano, anestesiólogo, ayudantes',
          'Medicamentos durante hospitalización',
          'Estudios de laboratorio y gabinete',
          'Terapias: Rehabilitación postoperatoria',
          'Ambulancia',
          'Maternidad si está incluida (con periodo de espera)'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Periodos de Espera:',
        'items', jsonb_build_array(
          'Enfermedades generales: 30 días',
          'Padecimientos preexistentes: 2 años',
          'Maternidad: 10 meses',
          'Hernias y amígdalas: 6 meses a 1 año'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Hospitalización con costo de $200,000. Deducible: $20,000. Coaseguro: 10%. Tope de coaseguro: $50,000. Cálculo: Total $200,000 menos deducible $20,000 = $180,000. Coaseguro 10% de $180,000 = $18,000. Asegurado paga: $20,000 + $18,000 = $38,000. Aseguradora paga: $162,000.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Practica cálculos de deducible y coaseguro. Memoriza los periodos de espera. Recuerda que el tope de coaseguro protege al asegurado de gastos catastróficos.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Página 46 del Manual CNSF'
      )
    )
  ),
  3,
  45
FROM cedula_a_modulos m WHERE m.orden = 2;

-- Lección 2.4: Seguro de Salud
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 2.4 - Seguro de Salud',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Seguro de Salud'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El seguro de salud opera de manera diferente al GMM tradicional, enfocándose en una red médica cerrada con copagos fijos en lugar de deducibles y coaseguros.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Diferencias con GMM'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Comparativa GMM vs Seguro de Salud:',
        'items', jsonb_build_array(
          'Deducible: GMM sí tiene, Salud NO tiene',
          'Coaseguro: GMM sí tiene, Salud NO tiene',
          'Copago: GMM opcional, Salud sí (fijo)',
          'Red médica: GMM opcional, Salud obligatoria',
          'Libre elección: GMM sí (con reembolso), Salud limitada'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Procedimiento de Atención'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Proceso de atención médica:',
        'items', jsonb_build_array(
          '1. Afiliación: Registro, asignación de médico familiar, entrega de tarjeta',
          '2. Consulta: Llamada al centro, cita con médico de red, presentación de tarjeta, pago de copago',
          '3. Estudios y Tratamientos: Orden médica necesaria, laboratorios de la red, autorización previa si requiere',
          '4. Hospitalización: Pre-autorización obligatoria, hospital dentro de la red, seguimiento del caso'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Obligaciones del Asegurado:',
        'items', jsonb_build_array(
          'Utilizar la red de proveedores designada',
          'Obtener autorizaciones previas cuando se requieran',
          'Pagar copagos aplicables',
          'Seguir indicaciones médicas',
          'Proporcionar información veraz sobre su estado de salud',
          'Notificar cambios en su situación'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Ventajas:',
        'items', jsonb_build_array(
          'Sin deducibles ni coaseguros',
          'Costo predecible (copagos fijos)',
          'Atención coordinada',
          'Prevención y seguimiento',
          'Prima generalmente menor que GMM'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Desventajas:',
        'items', jsonb_build_array(
          'Red médica limitada',
          'Menor flexibilidad en elección de médicos',
          'Requiere autorizaciones previas',
          'Copagos por cada servicio'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Coberturas Típicas:',
        'items', jsonb_build_array(
          'Consultas médicas generales y especializadas',
          'Medicamentos según cuadro básico',
          'Estudios de diagnóstico',
          'Cirugías programadas',
          'Urgencias médicas',
          'Maternidad con periodo de espera',
          'Hospitalización',
          'Programas preventivos'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: La principal diferencia es que el seguro de salud NO tiene deducible ni coaseguro, solo copagos fijos. Requiere usar la red médica obligatoriamente. Es ideal para atención frecuente sin grandes desembolsos.'
      )
    )
  ),
  4,
  30
FROM cedula_a_modulos m WHERE m.orden = 2;