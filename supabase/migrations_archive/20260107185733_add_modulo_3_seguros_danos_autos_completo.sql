/*
  # Módulo 3 - Riesgos Individuales Seguros de Daños (RISD) - Automóviles

  1. Contenido
    - Lección 3.1: Seguro de Automóviles - Objetivo y tipos
    - Lección 3.2: Conceptos Clave en Autos
    - Lección 3.3: Siniestros
    - Lección 3.4: Pérdida Total y Parcial
    - Lección 3.5: Documentación para Indemnización
    - Basado en páginas 46-57 del Manual CNSF oficial
*/

-- Lección 3.1: Seguro de Automóviles
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 3.1 - Seguro de Automóviles',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Seguro de Automóviles'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El seguro de automóviles protege al asegurado contra pérdidas económicas derivadas de daños materiales al vehículo, responsabilidad civil frente a terceros y otros riesgos relacionados con la circulación.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Objetivo del Seguro'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Protección integral que incluye:',
        'items', jsonb_build_array(
          'Daños materiales al vehículo asegurado',
          'Responsabilidad civil hacia terceros',
          'Robo total del vehículo',
          'Gastos médicos a ocupantes',
          'Asistencia vial y legal'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos de Vehículos Asegurables'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Clasificación:',
        'items', jsonb_build_array(
          'Automóviles particulares',
          'Vehículos comerciales (taxis, transporte público)',
          'Motocicletas',
          'Vehículos de carga',
          'Vehículos especiales (ambulancias, grúas)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos de Pólizas'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Póliza de Responsabilidad Civil: Cubre daños a terceros en su persona y bienes. Es la cobertura MÍNIMA OBLIGATORIA en muchos estados. No cubre daños propios del vehículo.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Póliza Limitada: Cubre RC + Robo Total. Protege contra responsabilidad civil y robo completo del vehículo, pero NO daños parciales.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '3. Póliza Amplia: Cobertura más completa. Incluye RC, Daños Materiales, Robo Total, GMM ocupantes y asistencias. Es la más recomendable para vehículos nuevos o financiados.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante: La Responsabilidad Civil es OBLIGATORIA en la mayoría de los estados de México. La póliza amplia es la más completa pero también la más costosa. Para vehículos con varios años, la póliza limitada puede ser suficiente.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 46-47 del Manual CNSF'
      )
    )
  ),
  1,
  30
FROM cedula_a_modulos m WHERE m.orden = 3;

-- Lección 3.2: Conceptos Clave
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 3.2 - Conceptos Clave en Autos',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Conceptos Fundamentales del Seguro de Autos'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Licencia de Conducir'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El conductor debe contar con licencia vigente y apropiada para el tipo de vehículo. Conducir sin licencia o con licencia vencida puede anular la cobertura.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Daños Materiales'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cubre reparación del vehículo por colisión, vuelco, incendio, explosión, daños por fenómenos naturales (granizo, inundación) y vandalismo. Se aplica deducible.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Deducible: Cantidad o porcentaje que el asegurado paga por su cuenta en cada siniestro. Ejemplo: Deducible de 5% significa que en daños de $100,000 el asegurado paga $5,000 y la aseguradora $95,000.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Robo Total'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Requisitos y características:',
        'items', jsonb_build_array(
          'Se considera robo total cuando el vehículo no aparece después de 30-45 días',
          'Se paga el valor comercial del vehículo al momento del robo',
          'Requiere denuncia ante el Ministerio Público',
          'El asegurado debe entregar llaves, tarjeta de circulación y factura',
          'Generalmente NO aplica deducible'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Responsabilidad Civil'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Cubre daños causados a terceros:',
        'items', jsonb_build_array(
          'Daños materiales a vehículos de terceros',
          'Daños a propiedad de terceros (bardas, postes, etc.)',
          'Lesiones o muerte de terceros',
          'Defensa legal del asegurado',
          'Fianzas para libertad provisional'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Suma Asegurada RC: Es el límite máximo que pagará la aseguradora por daños a terceros. Común: $2,000,000 a $5,000,000. Es RECOMENDABLE tener el máximo posible.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Gastos Médicos a Ocupantes'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cubre gastos médicos del conductor y pasajeros del vehículo asegurado en caso de accidente. Límite común: $50,000 a $200,000 por persona.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Recuerda que la RC es OBLIGATORIA y cubre daños A TERCEROS, no al asegurado. El deducible aplica en daños materiales pero generalmente NO en robo total. La suma asegurada de RC debe ser lo más alta posible para protección adecuada.'
      )
    )
  ),
  2,
  30
FROM cedula_a_modulos m WHERE m.orden = 3;

-- Lección 3.3: Siniestros
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 3.3 - Siniestros',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Procedimiento en Caso de Siniestro'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Aviso del Siniestro'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Obligaciones del asegurado:',
        'items', jsonb_build_array(
          'Avisar a la aseguradora dentro de las 24 horas siguientes',
          'Proporcionar datos completos y veraces del accidente',
          'Lugar, fecha, hora y circunstancias del siniestro',
          'Datos de terceros involucrados (si los hay)',
          'Placas de vehículos involucrados'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'CRÍTICO: El aviso debe darse dentro de las 24 HORAS. Retrasos pueden causar problemas en la reclamación. Usa el número de emergencia de tu aseguradora.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Aviso a Autoridades'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Cuándo es obligatorio dar parte a autoridades:',
        'items', jsonb_build_array(
          'Lesionados o fallecidos',
          'Daños a propiedad pública (señalamientos, postes)',
          'Cuando terceros lo soliciten',
          'Robo del vehículo (Ministerio Público)',
          'Delitos (conducir en estado de ebriedad)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Cooperación del Asegurado'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'El asegurado DEBE:',
        'items', jsonb_build_array(
          'Permitir inspección del vehículo por ajustadores',
          'Proporcionar documentación solicitada',
          'No reparar el vehículo sin autorización de la aseguradora',
          'Conservar evidencia del siniestro (fotos, piezas dañadas)',
          'Colaborar en investigación del siniestro',
          'Declarar con veracidad las circunstancias'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Asistencias Incluidas'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Servicios de asistencia vial:',
        'items', jsonb_build_array(
          'Grúa para traslado del vehículo',
          'Asesoría legal telefónica',
          'Servicio de ambulancia',
          'Auto sustituto durante reparación',
          'Envío de cerrajero',
          'Paso de corriente',
          'Cambio de llanta'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: El aviso del siniestro es dentro de las 24 horas. NO se debe reparar el vehículo sin autorización. El asegurado debe cooperar plenamente en la investigación. Dar parte a autoridades es obligatorio si hay lesionados.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Página 55 del Manual CNSF'
      )
    )
  ),
  3,
  30
FROM cedula_a_modulos m WHERE m.orden = 3;

-- Lección 3.4: Pérdida Total y Parcial
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 3.4 - Pérdida Total y Parcial',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Criterios de Pérdida Total y Parcial'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Pérdida Total'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Se considera pérdida total cuando el costo de reparación excede un porcentaje del valor comercial del vehículo.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Criterios según póliza:',
        'items', jsonb_build_array(
          'Criterio 50%: Si la reparación cuesta más del 50% del valor comercial',
          'Criterio 75%: Si la reparación cuesta más del 75% del valor comercial (más común)',
          'Robo total del vehículo sin recuperación',
          'Destrucción completa (incendio total, inundación severa)'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Valor Comercial: Precio que tendría el vehículo en el mercado de autos usados al momento del siniestro. NO es el valor factura ni el valor de reposición nuevo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Demérito'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Reducción del valor del vehículo por el paso del tiempo y uso. Se aplica un porcentaje de depreciación anual (generalmente 10-15% por año).'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Vehículo valor factura $300,000. Tiene 3 años. Demérito 15% anual. Valor comercial: $300,000 x (0.85)³ = $184,162. Si el costo de reparación es $150,000 y el criterio es 75%, NO es pérdida total ($184,162 x 0.75 = $138,122). Si el costo fuera $140,000 o más, SÍ sería pérdida total.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Subrogación'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Derecho de la aseguradora de ejercer las acciones legales que correspondan al asegurado contra terceros responsables del daño, una vez pagada la indemnización.'
      ),
      jsonb_build_object(
        'type', 'ejemplo',
        'content', 'Si la aseguradora paga por daños causados por un tercero, puede demandar al tercero responsable para recuperar lo pagado. El asegurado debe cooperar en este proceso.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Salvamentos'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'En caso de pérdida total, la aseguradora paga el valor comercial y se queda con los restos del vehículo (salvamento) para recuperar parte de lo pagado mediante su venta.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Proceso de salvamento:',
        'items', jsonb_build_array(
          'La aseguradora paga el valor comercial menos el deducible',
          'El asegurado entrega factura, tarjeta de circulación y placas',
          'La aseguradora vende el salvamento en subasta',
          'El comprador del salvamento recibe factura para dar de baja y regularizar'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: El criterio más común de pérdida total es 75%. El demérito reduce el valor del vehículo por antigüedad. La subrogación permite a la aseguradora demandar al tercero responsable. En pérdida total, el asegurado entrega el vehículo y la aseguradora paga valor comercial.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 55-56 del Manual CNSF'
      )
    )
  ),
  4,
  35
FROM cedula_a_modulos m WHERE m.orden = 3;

-- Lección 3.5: Documentación para Indemnización
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 3.5 - Documentación para Indemnización',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Documentos Requeridos según Tipo de Siniestro'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Daños Materiales (Colisión, Vuelco, etc.)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Documentación necesaria:',
        'items', jsonb_build_array(
          'Póliza vigente y último recibo de pago',
          'Licencia de conducir vigente del conductor',
          'Tarjeta de circulación',
          'Parte de accidente (si intervino autoridad)',
          'Fotos del siniestro y daños',
          'Presupuesto de reparación autorizado',
          'Croquis del accidente',
          'Datos de terceros involucrados (si los hay)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Robo Total'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Documentación requerida:',
        'items', jsonb_build_array(
          'Póliza vigente y último recibo de pago',
          'Acta del Ministerio Público (denuncia de robo)',
          'Original de factura del vehículo',
          'Tarjeta de circulación original',
          'Juego de llaves del vehículo',
          'Baja de placas ante autoridad de tránsito',
          'Carta de no adeudo (si está financiado)',
          'Identificación oficial del asegurado'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'IMPORTANTE: En robo total, si el vehículo aparece ANTES de que la aseguradora pague, el asegurado debe decidir si lo acepta o prefiere la indemnización (si ya tiene daños considerables).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Responsabilidad Civil (Daños a Terceros)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Documentación para RC:',
        'items', jsonb_build_array(
          'Póliza vigente',
          'Licencia de conducir del asegurado',
          'Parte de accidente (muy importante)',
          'Datos completos del tercero afectado',
          'Fotos de ambos vehículos',
          'Presupuesto de reparación del vehículo del tercero',
          'Facturas de reparación del tercero',
          'Comprobantes de gastos médicos (si hay lesionados)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'GMM Ocupantes (Gastos Médicos)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para reclamación de gastos médicos:',
        'items', jsonb_build_array(
          'Póliza vigente',
          'Parte de accidente',
          'Certificado médico inicial',
          'Facturas de hospitalización',
          'Recetas y facturas de medicamentos',
          'Estudios de laboratorio y gabinete',
          'Comprobantes de terapias y rehabilitación',
          'Identificación del ocupante lesionado'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tiempos de Respuesta'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Plazos legales de la aseguradora:',
        'items', jsonb_build_array(
          'Daños materiales: 30 días para resolver (desde entrega completa de documentos)',
          'Robo total: 30-45 días (según póliza)',
          'Si falta documentación: 5 días para solicitarla',
          'Rechazo de reclamación: Debe ser por escrito y fundado'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Memoriza los documentos principales para cada tipo de siniestro. En robo total se requiere FACTURA ORIGINAL, LLAVES y ACTA del MP. Para daños materiales es fundamental la LICENCIA VIGENTE. La aseguradora tiene 30 días para resolver desde que recibe TODA la documentación completa.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 56-57 del Manual CNSF'
      )
    )
  ),
  5,
  35
FROM cedula_a_modulos m WHERE m.orden = 3;