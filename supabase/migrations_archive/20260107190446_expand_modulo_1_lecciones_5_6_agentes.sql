/*
  # Expansión Lecciones 1.5 y 1.6 - El Agente y sus Obligaciones

  1. Actualizar Lección 1.5 con contenido completo sobre agentes
  2. Actualizar Lección 1.6 con obligaciones, prohibiciones y sanciones
*/

-- Actualizar Lección 1.5: El Agente de Seguros
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.5: EL AGENTE DE SEGUROS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El agente de seguros es la persona física o moral autorizada por la CNSF para intermediar, asesorar, comercializar seguros y dar seguimiento a pólizas.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: El agente NO es la aseguradora, pero actúa como su representante ante el cliente. Legalmente, el agente representa los intereses del CLIENTE, no de la aseguradora.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1.5.1 REQUISITOS PARA SER AGENTE PERSONA FÍSICA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Para obtener la autorización de la CNSF, se deben cumplir los siguientes requisitos:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Requisitos obligatorios:',
      'items', jsonb_build_array(
        '✓ Ser mayor de edad (18 años cumplidos)',
        '✓ Tener preparatoria concluida (o equivalente)',
        '✓ No ser servidor público del sector financiero',
        '✓ No tener antecedentes penales',
        '✓ Acreditar capacidad técnica mediante examen de la CNSF (Cédula A)',
        '✓ Tomar curso de capacitación autorizado (mínimo 40 horas)',
        '✓ Contratar seguro de Responsabilidad Civil profesional',
        '✓ Pagar los derechos correspondientes'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El examen que estás preparando (Cédula A) es OBLIGATORIO para ser agente. Sin aprobarlo, NO puedes obtener tu autorización.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1.5.2 TIPOS DE AGENTES'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) AGENTE VINCULADO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Relación LABORAL con la aseguradora',
        'Trabaja exclusivamente para UNA institución',
        'Autorización PROVISIONAL',
        'Vigencia limitada mientras dure la relación laboral',
        'La aseguradora lo capacita',
        'Recibe salario o comisiones'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Juan trabaja como empleado de GNP Seguros en una oficina. Es agente vinculado. Solo puede vender productos de GNP.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) AGENTE INDEPENDIENTE (Persona Física)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Contrato MERCANTIL (no laboral)',
        'Puede trabajar con MÚLTIPLES aseguradoras',
        'Autorización DEFINITIVA',
        'Vigencia de 3 AÑOS (renovable)',
        'Mayor libertad para ofrecer opciones',
        'Responsable de sus propios gastos',
        'Recibe solo comisiones'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: María tiene su propia oficina y vende seguros de Qualitas, AXA, Zurich y Metlife. Es agente independiente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) AGENTE PERSONA MORAL'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Es una EMPRESA legalmente constituida (S.A., S.C.)',
        'Debe contar con acta constitutiva',
        'Requiere oficio de autorización de la CNSF',
        'Debe tener apoderados autorizados',
        'Los apoderados deben tener cédula vigente',
        'Responsabilidad CORPORATIVA',
        'Puede tener múltiples agentes trabajando'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: "Asesores de Seguros del Norte, S.A. de C.V." es una empresa que tiene 10 agentes trabajando. La empresa es agente persona moral.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1.5.3 MANDATARIOS vs APODERADOS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'MANDATARIOS: Tienen facultades LIMITADAS otorgadas por la institución para realizar ciertos actos específicos en su nombre. Por ejemplo: cobrar primas, entregar pólizas, recibir avisos de siniestro.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'APODERADOS: Cuentan con poder más AMPLIO para representar legalmente a la institución en diversos actos jurídicos. Pueden firmar contratos, representar en juicios, etc.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Diferencia clave: El mandatario tiene facultades LIMITADAS. El apoderado tiene facultades MÁS AMPLIAS.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'VIGENCIA DE LA CÉDULA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Aspectos importantes:',
      'items', jsonb_build_array(
        'La cédula de agente independiente tiene vigencia de 3 AÑOS',
        'Debe renovarse mediante capacitación continua (40 horas mínimo)',
        'El seguro de RC profesional debe mantenerse VIGENTE en todo momento',
        'Si no renuevas, la CNSF puede suspender tu cédula',
        'La renovación NO requiere volver a presentar examen'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Debes saber que hay 3 tipos de agentes (vinculado, independiente, persona moral), que la vigencia es de 3 años, y que el independiente puede trabajar con múltiples aseguradoras.'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.5 - Obligaciones y Prohibiciones del Agente';

-- Actualizar Lección 1.6: Obligaciones, Prohibiciones y Sanciones
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 1.6: OBLIGACIONES Y PROHIBICIONES DEL AGENTE'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ESTA ES UNA DE LAS LECCIONES MÁS IMPORTANTES DEL MÓDULO. El incumplimiento de estas obligaciones puede resultar en SANCIONES GRAVES, incluyendo la pérdida de tu cédula.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBLIGACIONES PRINCIPALES DEL AGENTE'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. COBRO DE PRIMAS'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El agente DEBE:',
      'items', jsonb_build_array(
        'Entregar recibo OFICIAL por cada prima cobrada',
        'Remitir las primas a la institución en tiempo y forma',
        'NO retener indebidamente las primas',
        'Mantener registro de todas las operaciones',
        'No cobrar cantidades distintas a las autorizadas'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'GRAVE: Retener primas es una de las faltas MÁS GRAVES. Puede resultar en revocación de cédula e incluso responsabilidad PENAL.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. INFORMACIÓN DEL RIESGO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El agente DEBE:',
      'items', jsonb_build_array(
        'Obtener información COMPLETA y VERAZ del riesgo',
        'Informar FIELMENTE a la institución sobre el riesgo',
        'Verificar la documentación del asegurado',
        'Asegurar declaración de salud completa cuando aplique',
        'No ocultar información relevante',
        'No inducir al cliente a mentir'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de mala práctica: El cliente dice que fuma 2 cajetillas diarias, pero el agente le dice "mejor pon que no fumas para que salga más barata la prima". ¡Esto es FRAUDE y puede anular el seguro!'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. APEGO A TARIFAS Y PÓLIZAS'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El agente DEBE:',
      'items', jsonb_build_array(
        'Respetar tarifas autorizadas por la institución',
        'NO modificar condiciones de las pólizas',
        'Entregar documentación contractual COMPLETA',
        'Explicar coberturas Y exclusiones claramente',
        'No ofrecer descuentos no autorizados',
        'No prometer coberturas que no existen'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'NO puedes decir "te doy 20% de descuento" si la aseguradora no lo autorizó. NO puedes decir "esto cubre TODO" si hay exclusiones.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. RESPONSABILIDAD CIVIL PROFESIONAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'TODO agente debe mantener vigente un seguro de Responsabilidad Civil Profesional con suma asegurada mínima de $2,000,000 MXN. La renovación es ANUAL y OBLIGATORIA.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Este seguro protege al agente y al cliente en caso de errores profesionales, como: olvidar renovar una póliza, dar información incorrecta, no entregar la póliza a tiempo.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Si NO renuevas tu RC profesional, la CNSF SUSPENDE automáticamente tu cédula.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5. CAPACITACIÓN CONTINUA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Requisitos:',
      'items', jsonb_build_array(
        'Actualización cada 3 AÑOS',
        'Mínimo 40 horas de capacitación',
        'Cursos autorizados por la CNSF',
        'Certificado de capacitación vigente'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PROHIBICIONES (LO QUE NUNCA DEBES HACER)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Está ESTRICTAMENTE PROHIBIDO:',
      'items', jsonb_build_array(
        '❌ Operar sin cédula vigente',
        '❌ Inducir al asegurado a dar información falsa',
        '❌ Cobrar primas sin autorización de la institución',
        '❌ Ofrecer beneficios no autorizados en la póliza',
        '❌ Retener primas o documentación del asegurado',
        '❌ Actuar en conflicto de intereses',
        '❌ Realizar competencia desleal',
        '❌ Divulgar información confidencial de clientes',
        '❌ Trabajar con aseguradoras no autorizadas',
        '❌ Alterar documentos o pólizas'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RÉGIMEN SANCIONATORIO'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. AMONESTACIÓN'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Llamado de atención por escrito por infracciones MENORES como: falta de actualización de datos, retraso en entrega de documentación, incumplimiento administrativo leve.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. MULTA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Sanción económica por infracciones de diversa gravedad. El monto va de 200 a 2,000 días de salario mínimo según la gravedad de la falta. NO exime de otras sanciones.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. SUSPENSIÓN TEMPORAL'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Inhabilitación temporal para ejercer por periodo de 30 días a 2 AÑOS. Durante la suspensión NO puedes operar. Debes regularizar tu situación para reactivación.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. REVOCACIÓN'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'SANCIÓN MÁS GRAVE: Cancelación DEFINITIVA de la cédula.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Causas de revocación:',
      'items', jsonb_build_array(
        'Fraude o engaño al asegurado',
        'Apropiación de primas',
        'Falsificación de documentos',
        'Reincidencia en faltas graves',
        'Actuar sin autorización',
        'Condena penal firme'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Consecuencias de la revocación:',
      'items', jsonb_build_array(
        'Imposibilidad de obtener nueva cédula',
        'Registro en padrón de sancionados',
        'Responsabilidad civil y penal según el caso',
        'Publicación en medios oficiales',
        'Daño irreparable a reputación profesional'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CAUSAS DE CANCELACIÓN ADMINISTRATIVA'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Tu cédula se cancela automáticamente si:',
      'items', jsonb_build_array(
        'No renuevas el seguro de RC profesional',
        'No actualizas tu cédula cada 3 años',
        'Fallecimiento del titular',
        'Sentencia penal firme',
        'Inhabilitación por autoridad competente',
        'Renuncia voluntaria'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'BUENAS PRÁCTICAS PARA EVITAR SANCIONES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Recomendaciones:',
      'items', jsonb_build_array(
        '✓ Mantener cédula y seguro de RC vigentes SIEMPRE',
        '✓ Capacitación continua y actualización',
        '✓ Documentar TODAS las operaciones',
        '✓ Actuar con transparencia y ética profesional',
        '✓ Conocer y aplicar la normativa vigente',
        '✓ Atender oportunamente requerimientos de autoridades',
        '✓ Nunca ofrecer lo que no puedes cumplir',
        '✓ Siempre actuar en beneficio del cliente'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA EL EXAMEN: Memoriza las 4 sanciones (amonestación, multa, suspensión, revocación), las obligaciones principales (cobro de primas, información del riesgo, RC profesional) y las causas de revocación. Son preguntas MUY frecuentes.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CIERRE DEL MÓDULO 1'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Este módulo proporciona la base legal COMPLETA para entender el seguro y el rol del agente. Sin este conocimiento, NO es posible ejercer ni aprobar el examen. Repasa cada lección hasta dominarla completamente.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'RECUERDA: El seguro es de INTERÉS PÚBLICO. Eres responsable de actuar siempre con ÉTICA, HONESTIDAD y PROFESIONALISMO. Tu cédula es un privilegio que debes cuidar.'
    )
  )
),
updated_at = now()
WHERE titulo = 'Lección 1.6 - Sanciones y Cancelación de la Cédula';