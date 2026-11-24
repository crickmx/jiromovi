/*
  # Módulo 1 - Lecciones 1.4, 1.5, 1.6: Agentes de Seguros

  1. Contenido
    - Lección 1.4: Tipos de agentes y requisitos
    - Lección 1.5: Obligaciones y prohibiciones
    - Lección 1.6: Sanciones y cancelación de cédula
    - Basado en páginas 11-14 del Manual CNSF oficial
*/

-- Lección 1.4: Agentes de Seguros
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.4 - Agentes de Seguros',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos y Características de los Agentes'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos de Agentes de Seguros'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Agente Vinculado: Trabaja exclusivamente para una institución de seguros. Tiene relación laboral o de prestación de servicios y representa únicamente los productos de su institución.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Agente Independiente (Persona Física): Puede trabajar con múltiples instituciones. Tiene mayor libertad para ofrecer diferentes opciones al cliente y debe mantener cédula vigente.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '3. Agente Persona Moral: Empresa legalmente constituida que opera como agente. Debe contar con apoderados autorizados y tiene responsabilidad corporativa.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Requisitos para Obtener la Cédula'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para obtener la autorización como agente de seguros se requiere:',
        'items', jsonb_build_array(
          'Ser mayor de 18 años',
          'Título profesional o certificado de bachillerato',
          'Aprobar el examen de la CNSF (Cédula A)',
          'No tener antecedentes penales',
          'Completar curso de capacitación (mínimo 40 horas)',
          'Pago de derechos correspondiente',
          'Contratar seguro de RC profesional (mínimo $2,000,000 MXN)'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Agentes Mandatarios: Tienen facultades limitadas otorgadas por la institución para realizar ciertos actos específicos en su nombre.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Agentes Apoderados: Cuentan con poder más amplio para representar legalmente a la institución en diversos actos jurídicos.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante: La cédula tiene vigencia indefinida pero debe actualizarse cada 3 años mediante capacitación continua. El seguro de RC profesional debe mantenerse vigente en todo momento.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 11-12 del Manual CNSF'
      )
    )
  ),
  4,
  30
FROM cedula_a_modulos m WHERE m.orden = 1;

-- Lección 1.5: Obligaciones y Prohibiciones
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.5 - Obligaciones y Prohibiciones del Agente',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Deberes y Restricciones del Agente de Seguros'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Obligaciones Principales'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '1. Cobro de Primas:',
        'items', jsonb_build_array(
          'Entregar recibo oficial por cada prima cobrada',
          'Remitir las primas a la institución en tiempo y forma',
          'No retener indebidamente las primas',
          'Mantener registro de todas las operaciones'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '2. Información del Riesgo:',
        'items', jsonb_build_array(
          'Obtener información completa y veraz del riesgo',
          'Informar fielmente a la institución sobre el riesgo',
          'Verificar la documentación del asegurado',
          'Asegurar declaración de salud completa cuando aplique'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '3. Apego a Tarifas y Pólizas:',
        'items', jsonb_build_array(
          'Respetar tarifas autorizadas por la institución',
          'No modificar condiciones de las pólizas',
          'Entregar documentación contractual completa',
          'Explicar coberturas y exclusiones claramente'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '4. Responsabilidad Civil Profesional: Mantener vigente un seguro de RC profesional con suma asegurada mínima de $2,000,000 MXN. La renovación es anual y obligatoria.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '5. Capacitación Continua: Actualización cada 3 años con mínimo 40 horas de capacitación en cursos autorizados por CNSF.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Prohibiciones'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Está estrictamente prohibido:',
        'items', jsonb_build_array(
          'Operar sin cédula vigente',
          'Inducir al asegurado a dar información falsa',
          'Cobrar primas sin autorización de la institución',
          'Ofrecer beneficios no autorizados en la póliza',
          'Retener primas o documentación del asegurado',
          'Actuar en conflicto de intereses',
          'Realizar competencia desleal',
          'Divulgar información confidencial de clientes'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Deber de Información al Cliente (el agente debe explicar):',
        'items', jsonb_build_array(
          'Coberturas incluidas y excluidas en la póliza',
          'Deducibles y coaseguros aplicables',
          'Procedimiento de reclamación en caso de siniestro',
          'Periodos de espera si los hay',
          'Proceso de renovación y cancelación'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Atención: El incumplimiento de estas obligaciones puede resultar en sanciones que van desde amonestación hasta revocación de la cédula. La transparencia y honestidad son fundamentales en la profesión.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Página 13 del Manual CNSF'
      )
    )
  ),
  5,
  30
FROM cedula_a_modulos m WHERE m.orden = 1;

-- Lección 1.6: Sanciones y Cancelación
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.6 - Sanciones y Cancelación de la Cédula',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Régimen Sancionatorio para Agentes de Seguros'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tipos de Sanciones'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Amonestación: Llamado de atención por escrito por infracciones menores como falta de actualización de datos, retraso en entrega de documentación o incumplimiento administrativo leve.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Multas: Sanción económica por infracciones de diversa gravedad. El monto va de 200 a 2,000 días de salario mínimo según la gravedad de la falta. No exime de otras sanciones.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '3. Suspensión Temporal: Inhabilitación temporal para ejercer por periodo de 30 días a 2 años. Durante la suspensión no se puede operar y debe regularizar la situación para reactivación.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '4. Revocación: Cancelación definitiva de la cédula por faltas graves como fraude o engaño al asegurado, apropiación de primas, falsificación de documentos o reincidencia en faltas graves.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Causas de Cancelación Administrativa'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Cancelación por Solicitud del Agente:',
        'items', jsonb_build_array(
          'Renuncia voluntaria',
          'Cambio de actividad profesional',
          'Retiro del mercado'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Cancelación por la Autoridad:',
        'items', jsonb_build_array(
          'No renovar el seguro de RC profesional',
          'No actualizar cédula en tiempo (cada 3 años)',
          'Fallecimiento del titular',
          'Sentencia penal firme',
          'Inhabilitación por autoridad competente'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Procedimiento Sancionador'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Etapas del procedimiento:',
        'items', jsonb_build_array(
          '1. Inicio: Por queja, denuncia o detección de oficio',
          '2. Notificación: Se informa al agente de los hechos imputados',
          '3. Defensa: Periodo para presentar pruebas y alegatos',
          '4. Resolución: CNSF emite resolución fundada y motivada',
          '5. Recurso: Posibilidad de impugnar la sanción'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Consecuencias de la Revocación:',
        'items', jsonb_build_array(
          'Imposibilidad de obtener nueva cédula',
          'Registro en padrón de sancionados',
          'Responsabilidad civil y penal según el caso',
          'Publicación en medios oficiales'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Buenas Prácticas para Evitar Sanciones:',
        'items', jsonb_build_array(
          'Mantener cédula y seguro de RC vigentes',
          'Capacitación continua y actualización',
          'Documentar todas las operaciones',
          'Actuar con transparencia y ética profesional',
          'Conocer y aplicar la normativa vigente',
          'Atender oportunamente requerimientos de autoridades'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante: La ignorancia de la ley no exime su cumplimiento. Todo agente debe conocer perfectamente sus obligaciones y restricciones. La prevención es la mejor estrategia.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 13-14 del Manual CNSF'
      )
    )
  ),
  6,
  30
FROM cedula_a_modulos m WHERE m.orden = 1;