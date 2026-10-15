/*
  # Expansión completa Módulo 4 - Sistema Financiero Mexicano

  1. Actualizar Lección 4.1 con concepto completo del sistema financiero
  2. Actualizar Lección 4.2 con autoridades y sectores completos
  3. Crear Lección 4.3 con estructura detallada del sistema
  4. Crear Lección 4.4 con conceptos financieros básicos
*/

-- Lección 4.1: Concepto de Sistema Financiero Mexicano
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'MÓDULO 4: SISTEMAS Y MERCADOS FINANCIEROS (SMF)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Este módulo es FUNDAMENTAL para entender el contexto en el que opera el seguro. Aunque parece teórico, tiene preguntas directas en el examen sobre autoridades y funciones.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO GENERAL DEL MÓDULO 4'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Al finalizar este módulo, el estudiante comprenderá cómo está estructurado el Sistema Financiero Mexicano, cuál es el papel de cada una de sus instituciones, cómo se relaciona el sector asegurador con los demás sectores financieros y cuáles son los conceptos financieros básicos que la CNSF evalúa en el examen de Cédula A.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Este módulo permite que el futuro agente:',
      'items', jsonb_build_array(
        '✓ Entienda el entorno económico y financiero donde opera el seguro',
        '✓ Interprete correctamente conceptos financieros básicos',
        '✓ No confunda funciones entre instituciones',
        '✓ Responda correctamente preguntas conceptuales del examen',
        '✓ Conozca las autoridades que lo regulan y supervisan'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 4.1: CONCEPTO DE SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La definición del sistema financiero es pregunta frecuente. Debes entender NO solo qué es, sino PARA QUÉ sirve.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Sistema Financiero es el conjunto de instituciones, mercados, instrumentos y autoridades que permiten la captación, administración y canalización del ahorro hacia la inversión y el financiamiento de la economía.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'FUNCIÓN PRINCIPAL DEL SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'En términos simples, el sistema financiero tiene tres funciones básicas:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones del sistema financiero:',
      'items', jsonb_build_array(
        '1. RECIBE recursos de quienes tienen excedentes de dinero (ahorradores)',
        '2. CANALIZA esos recursos hacia quienes necesitan financiamiento (empresas, personas, gobierno)',
        '3. REGULA Y SUPERVISA estas operaciones para dar estabilidad y confianza al sistema'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de flujo financiero: Juan deposita $100,000 en el banco (excedente). El banco presta ese dinero a María para comprar una casa. María paga intereses. El banco paga intereses a Juan. Todos ganan. El sistema financiero CONECTÓ el ahorro de Juan con la necesidad de María.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'COMPONENTES DEL SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El sistema financiero está compuesto por cuatro elementos principales:'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. INSTITUCIONES FINANCIERAS'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejemplos de instituciones:',
      'items', jsonb_build_array(
        '✓ BANCOS (captan depósitos, otorgan créditos)',
        '✓ ASEGURADORAS (administran riesgos, invierten primas)',
        '✓ AFORES (administran ahorro para el retiro)',
        '✓ CASAS DE BOLSA (facilitan inversiones en valores)',
        '✓ SOFOMES (otorgan créditos especializados)',
        '✓ AFIANZADORAS (garantizan cumplimiento de obligaciones)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Cada institución tiene funciones ESPECÍFICAS. Un banco NO puede vender seguros directamente (necesita subsidiaria). Una aseguradora NO puede captar depósitos del público.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. MERCADOS FINANCIEROS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Los mercados financieros son espacios (físicos o virtuales) donde se compran y venden instrumentos financieros.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Principales mercados en México:',
      'items', jsonb_build_array(
        '✓ Mercado de DINERO (corto plazo, liquidez)',
        '✓ Mercado de CAPITALES (largo plazo, inversión)',
        '✓ Mercado de DERIVADOS (cobertura de riesgos)',
        '✓ Mercado de DIVISAS (compra-venta de monedas extranjeras)',
        '✓ Bolsa Mexicana de Valores (BMV)',
        '✓ Mercado de deuda gubernamental'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Una aseguradora invierte las primas que cobra en la Bolsa Mexicana de Valores (mercado de capitales) comprando bonos gubernamentales. Así genera rendimientos mientras espera pagar siniestros.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. INSTRUMENTOS FINANCIEROS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Son los productos o documentos que representan derechos u obligaciones financieras.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ejemplos de instrumentos:',
      'items', jsonb_build_array(
        '✓ PÓLIZAS DE SEGURO',
        '✓ Bonos y obligaciones',
        '✓ Acciones',
        '✓ CETES (Certificados de la Tesorería)',
        '✓ Pagarés',
        '✓ Contratos de crédito',
        '✓ Certificados bursátiles',
        '✓ Fondos de inversión'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Una PÓLIZA DE SEGURO es un instrumento financiero porque representa un contrato con derechos y obligaciones económicas.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. AUTORIDADES FINANCIERAS'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Son las instituciones del gobierno que regulan, supervisan y sancionan a los participantes del sistema financiero.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Principales autoridades (se profundiza en Lección 4.2):',
      'items', jsonb_build_array(
        '✓ Secretaría de Hacienda y Crédito Público (SHCP) - Máxima autoridad',
        '✓ Banco de México (BANXICO) - Banco central',
        '✓ Comisión Nacional de Seguros y Fianzas (CNSF) - Supervisa seguros',
        '✓ Comisión Nacional Bancaria y de Valores (CNBV) - Supervisa bancos',
        '✓ Comisión Nacional del Ahorro para el Retiro (CONSAR) - Supervisa AFORES'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'POR QUÉ EL SEGURO FORMA PARTE DEL SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Esta es pregunta frecuente del examen: ¿Por qué las aseguradoras son parte del sistema financiero?'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El seguro forma parte del sistema financiero porque:',
      'items', jsonb_build_array(
        '1. ADMINISTRA grandes volúmenes de recursos (primas)',
        '2. INVIERTE esos recursos en mercados financieros',
        '3. GESTIONA riesgos financieros de personas y empresas',
        '4. PROTEGE la estabilidad económica (sin seguros, todo sería más riesgoso)',
        '5. Está REGULADO por autoridades financieras (SHCP, CNSF)',
        '6. COMPLEMENTA otros servicios financieros (créditos requieren seguros)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de conexión: Un banco otorga un crédito hipotecario. EXIGE seguro de vida y seguro de daños a la casa. Sin esos seguros, el banco no presta. El seguro hace POSIBLE el crédito. Por eso son interdependientes.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'IMPORTANCIA DEL SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Un sistema financiero sano permite:',
      'items', jsonb_build_array(
        '✓ Crecimiento ECONÓMICO (financiamiento a empresas)',
        '✓ AHORRO protegido y productivo',
        '✓ INVERSIÓN en proyectos productivos',
        '✓ Acceso a CRÉDITO para familias y empresas',
        '✓ Gestión de RIESGOS (seguros)',
        '✓ Estabilidad de PRECIOS (control de inflación)',
        '✓ Confianza en las instituciones'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Sin sistema financiero: Imagina que no hay bancos, ni seguros, ni bolsa. Solo puedes guardar tu dinero debajo del colchón. No ganas intereses. Si necesitas un crédito, no hay quién te preste. Si te enfermas o chocas, pagas todo de tu bolsa. La economía NO crecería.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RELACIÓN ENTRE LOS COMPONENTES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Los cuatro componentes están interrelacionados:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Flujo completo:',
      'items', jsonb_build_array(
        '1. Las AUTORIDADES establecen las reglas',
        '2. Las INSTITUCIONES operan bajo esas reglas',
        '3. Las instituciones ofrecen INSTRUMENTOS financieros',
        '4. Esos instrumentos se negocian en MERCADOS',
        '5. Los AHORRADORES invierten en esos instrumentos',
        '6. Los recursos van a los DEMANDANTES de crédito',
        '7. Las AUTORIDADES supervisan todo el proceso'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DIFERENCIA ENTRE SISTEMA FINANCIERO Y SISTEMA BANCARIO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Pensar que sistema financiero = bancos. ¡FALSO! Los bancos son SOLO UNA PARTE del sistema financiero.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Sistema FINANCIERO (amplio):',
      'items', jsonb_build_array(
        '✓ Bancos',
        '✓ Aseguradoras',
        '✓ Casas de bolsa',
        '✓ AFORES',
        '✓ SOFOMES',
        '✓ Afianzadoras',
        '✓ Y muchos más...'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Sistema BANCARIO (parte del financiero):',
      'items', jsonb_build_array(
        '✓ Solo bancos',
        '✓ Banca múltiple',
        '✓ Banca de desarrollo'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ESTABILIDAD DEL SISTEMA FINANCIERO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'La estabilidad del sistema financiero es CRÍTICA para la economía.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Factores que dan estabilidad:',
      'items', jsonb_build_array(
        '✓ Supervisión ESTRICTA de autoridades',
        '✓ Requisitos de SOLVENCIA (capital suficiente)',
        '✓ Regulación PRUDENTE',
        '✓ TRANSPARENCIA en operaciones',
        '✓ Protección al USUARIO (CONDUSEF)',
        '✓ Fondos de GARANTÍA (protección de depósitos)',
        '✓ Auditorías EXTERNAS'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de inestabilidad: Crisis financiera 2008 en USA. Bancos quebraron. Aseguradoras colapsaron. Millones perdieron sus ahorros. Por eso la regulación es tan estricta en México: para PREVENIR crisis.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'EL AGENTE DE SEGUROS DENTRO DEL SISTEMA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Como agente de seguros, eres parte del sistema financiero porque:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Tu rol:',
      'items', jsonb_build_array(
        '✓ INTERMEDIAS entre aseguradoras y clientes',
        '✓ Facilitas la TRANSFERENCIA de riesgos',
        '✓ Contribuyes a la ESTABILIDAD económica',
        '✓ Estás REGULADO por la CNSF',
        '✓ Debes cumplir normas de CONDUCTA',
        '✓ Proteges el PATRIMONIO de las personas'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Por eso el examen de Cédula A es obligatorio. No cualquiera puede participar en el sistema financiero. Se requiere conocimiento y ética.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 4.1'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Sistema financiero = instituciones + mercados + instrumentos + autoridades',
        'Función: captar ahorro y canalizarlo a inversión',
        'Componentes: instituciones, mercados, instrumentos, autoridades',
        'El seguro ES PARTE del sistema financiero',
        'Aseguradoras administran recursos e invierten',
        'Sistema financiero ≠ sistema bancario (bancario es parte del financiero)',
        'Estabilidad es clave para la economía',
        'El agente forma parte del sistema y está regulado'
      )
    )
  )
),
duracion_estimada_minutos = 45,
updated_at = now()
WHERE titulo = 'Lección 4.1 - Sistema Financiero Mexicano';

-- Lección 4.2: Autoridades del Sistema Financiero
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 4.2: AUTORIDADES DEL SISTEMA FINANCIERO MEXICANO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'LAS AUTORIDADES Y SUS FUNCIONES son PREGUNTA OBLIGADA en el examen. Debes MEMORIZAR cuál autoridad hace qué. NO confundir funciones.'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El sistema financiero mexicano está regulado por diversas autoridades, cada una con funciones ESPECÍFICAS y delimitadas por ley.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. SECRETARÍA DE HACIENDA Y CRÉDITO PÚBLICO (SHCP)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La SHCP es la MÁXIMA AUTORIDAD del sistema financiero mexicano.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: La SHCP está por ENCIMA de todas las demás comisiones. Es quien define la política financiera del país.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de la SHCP:',
      'items', jsonb_build_array(
        '✓ Diseña la POLÍTICA FINANCIERA del país',
        '✓ AUTORIZA la operación de instituciones financieras',
        '✓ Otorga y REVOCA autorizaciones',
        '✓ COORDINA a los órganos supervisores (CNSF, CNBV, CONSAR)',
        '✓ Establece REGLAS generales del sistema',
        '✓ Decide sobre FUSIONES y adquisiciones',
        '✓ Interpreta las LEYES financieras'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Una empresa quiere crear una NUEVA aseguradora. Debe solicitar AUTORIZACIÓN a la SHCP. La SHCP evalúa capital, plan de negocios, directivos. Si cumple requisitos, la SHCP autoriza. Solo entonces puede operar.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Pensar que la CNSF autoriza aseguradoras. ¡FALSO! La SHCP autoriza. La CNSF supervisa.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. BANCO DE MÉXICO (BANXICO)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Banco de México es el BANCO CENTRAL del país. Es AUTÓNOMO (independiente del gobierno en sus decisiones técnicas).'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'BANXICO es el ÚNICO autorizado para emitir billetes y monedas en México. Nadie más puede hacerlo.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de BANXICO:',
      'items', jsonb_build_array(
        '✓ EMITIR la moneda nacional (billetes y monedas)',
        '✓ Regular la CIRCULACIÓN del dinero',
        '✓ Controlar la INFLACIÓN (objetivo principal)',
        '✓ Administrar las RESERVAS INTERNACIONALES',
        '✓ Procurar la ESTABILIDAD del poder adquisitivo',
        '✓ Promover el sano desarrollo del SISTEMA FINANCIERO',
        '✓ Actuar como banco del GOBIERNO',
        '✓ Actuar como prestamista de ÚLTIMA INSTANCIA para bancos'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: BANXICO NO presta dinero al público. NO vende seguros. NO atiende personas. Solo trabaja con bancos y gobierno.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de inflación: Si la inflación sube mucho, BANXICO AUMENTA las tasas de interés para enfriar la economía. Esto hace que los créditos sean más caros, la gente consume menos, y la inflación baja.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Lo que BANXICO NO hace:',
      'items', jsonb_build_array(
        '❌ No presta a personas',
        '❌ No abre cuentas al público',
        '❌ No cambia dólares al público',
        '❌ No vende seguros',
        '❌ No regula aseguradoras directamente'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. COMISIÓN NACIONAL DE SEGUROS Y FIANZAS (CNSF)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', '¡ESTA ES TU AUTORIDAD! Como agente de seguros, la CNSF es quien te regula, supervisa y puede sancionarte.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La CNSF es el órgano desconcentrado de la SHCP encargado de supervisar y regular el sector ASEGURADOR y AFIANZADOR.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de la CNSF:',
      'items', jsonb_build_array(
        '✓ SUPERVISAR a aseguradoras y afianzadoras',
        '✓ Vigilar la SOLVENCIA de las instituciones',
        '✓ AUTORIZAR pólizas y tarifas (en algunos casos)',
        '✓ Regular y supervisar a AGENTES DE SEGUROS',
        '✓ Aplicar SANCIONES por incumplimiento',
        '✓ Proteger los intereses del PÚBLICO ASEGURADO',
        '✓ Promover el desarrollo del sector',
        '✓ CERTIFICAR agentes (examen de Cédula)',
        '✓ Llevar el REGISTRO de agentes',
        '✓ Supervisar PRÁCTICAS de mercado'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: La CNSF NO autoriza la creación de aseguradoras (eso es SHCP). La CNSF SUPERVISA las que ya están autorizadas.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Un agente vende seguros SIN cédula vigente. La CNSF lo detecta. Lo SANCIONA con multa y puede SUSPENDER o CANCELAR su registro. Además, la aseguradora también puede ser multada por permitirlo.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Qué supervisa la CNSF en aseguradoras:',
      'items', jsonb_build_array(
        '✓ Reservas TÉCNICAS (dinero para pagar siniestros)',
        '✓ Requerimiento de CAPITAL (solvencia)',
        '✓ INVERSIONES (dónde invierten las primas)',
        '✓ REASEGURO (cómo distribuyen riesgos grandes)',
        '✓ Estados FINANCIEROS',
        '✓ Políticas de SUSCRIPCIÓN',
        '✓ Atención a RECLAMACIONES'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Qué supervisa la CNSF en agentes:',
      'items', jsonb_build_array(
        '✓ Tengan CÉDULA vigente',
        '✓ Cumplan normas de CONDUCTA',
        '✓ No cometan FRAUDES',
        '✓ Informen correctamente a CLIENTES',
        '✓ Entreguen PÓLIZAS a tiempo',
        '✓ Actúen con ÉTICA profesional'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. COMISIÓN NACIONAL BANCARIA Y DE VALORES (CNBV)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La CNBV supervisa a BANCOS, CASAS DE BOLSA y otros intermediarios financieros NO aseguradores.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de la CNBV:',
      'items', jsonb_build_array(
        '✓ Supervisar BANCOS (múltiples y desarrollo)',
        '✓ Supervisar CASAS DE BOLSA',
        '✓ Supervisar SOCIEDADES DE INVERSIÓN',
        '✓ Supervisar SOFOMES, SOFIPOS',
        '✓ Supervisar entidades BURSÁTILES',
        '✓ Vigilar MERCADO DE VALORES',
        '✓ Proteger inversionistas y ahorradores',
        '✓ Promover TRANSPARENCIA'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La CNBV NO regula aseguradoras ni agentes de seguros. Eso es responsabilidad de la CNSF.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Si tienes una cuenta de ahorro en Banamex, quien supervisa a Banamex es la CNBV (no la CNSF). Si tienes un seguro de vida con Metlife, quien supervisa a Metlife es la CNSF (no la CNBV).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5. COMISIÓN NACIONAL DEL SISTEMA DE AHORRO PARA EL RETIRO (CONSAR)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La CONSAR supervisa el sistema de PENSIONES (AFORES y SIEFORES).'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de la CONSAR:',
      'items', jsonb_build_array(
        '✓ Supervisar AFORES',
        '✓ Supervisar SIEFORES',
        '✓ Regular el sistema de AHORRO PARA EL RETIRO',
        '✓ Proteger los recursos de los TRABAJADORES',
        '✓ Promover COMPETENCIA entre AFORES',
        '✓ Vigilar COMISIONES que cobran',
        '✓ Supervisar RENDIMIENTOS'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Diferencia clave: AFORE administra tu cuenta. SIEFORE es el fondo donde se INVIERTE tu dinero.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Juan está registrado en AFORE XXA. Su dinero se invierte en SIEFORE Básica. La CONSAR supervisa que la AFORE cobre comisiones justas y que la SIEFORE invierta prudentemente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '6. COMISIÓN NACIONAL PARA LA PROTECCIÓN Y DEFENSA DE LOS USUARIOS DE SERVICIOS FINANCIEROS (CONDUSEF)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'CONDUSEF es el OMBUDSMAN financiero. Protege y defiende a los USUARIOS de servicios financieros.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Funciones de CONDUSEF:',
      'items', jsonb_build_array(
        '✓ ATENDER quejas de usuarios contra instituciones',
        '✓ ARBITRAR conflictos entre usuarios e instituciones',
        '✓ Promover EDUCACIÓN FINANCIERA',
        '✓ Supervisar TRANSPARENCIA en contratos',
        '✓ Vigilar PUBLICIDAD de productos financieros',
        '✓ Emitir RECOMENDACIONES',
        '✓ Publicar información para usuarios'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CONDUSEF NO supervisa solvencia ni operaciones técnicas. Solo protege al usuario. Si hay conflicto, CONDUSEF intenta CONCILIAR.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: María tuvo un choque. La aseguradora rechazó el siniestro sin justificación clara. María presenta queja en CONDUSEF. CONDUSEF revisa el caso, cita a la aseguradora, busca conciliación. Si no hay arreglo, María puede ir a juicio con dictamen técnico de CONDUSEF.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TABLA COMPARATIVA DE AUTORIDADES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA esta tabla. Es la forma más fácil de recordar quién hace qué.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'SHCP:',
      'items', jsonb_build_array(
        'Supervisa: TODO el sistema financiero (máxima autoridad)',
        'Función principal: Autorizar instituciones, política financiera',
        'Ejemplo: Autoriza nueva aseguradora'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'BANXICO:',
      'items', jsonb_build_array(
        'Supervisa: Política monetaria',
        'Función principal: Emitir moneda, controlar inflación',
        'Ejemplo: Sube tasas de interés para controlar inflación'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CNSF:',
      'items', jsonb_build_array(
        'Supervisa: Aseguradoras, afianzadoras, agentes',
        'Función principal: Vigilar solvencia, certificar agentes',
        'Ejemplo: Aplica examen de Cédula A'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CNBV:',
      'items', jsonb_build_array(
        'Supervisa: Bancos, casas de bolsa, mercado de valores',
        'Función principal: Vigilar solvencia bancaria y bursátil',
        'Ejemplo: Supervisa que bancos tengan capital suficiente'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CONSAR:',
      'items', jsonb_build_array(
        'Supervisa: AFORES y SIEFORES',
        'Función principal: Proteger ahorro para el retiro',
        'Ejemplo: Vigila comisiones de AFORES'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'CONDUSEF:',
      'items', jsonb_build_array(
        'Supervisa: Relación usuarios-instituciones',
        'Función principal: Proteger usuarios, atender quejas',
        'Ejemplo: Concilia queja de asegurado'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ERRORES COMUNES EN EL EXAMEN'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO CONFUNDIR:',
      'items', jsonb_build_array(
        '❌ Pensar que CNSF autoriza aseguradoras (es SHCP)',
        '❌ Pensar que BANXICO supervisa bancos (es CNBV)',
        '❌ Pensar que CNSF supervisa bancos (es CNBV)',
        '❌ Confundir CNBV con CNSF',
        '❌ Pensar que CONDUSEF puede cerrar instituciones (solo defiende usuarios)',
        '❌ Confundir AFORE con SIEFORE'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 4.2'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave para memorizar:',
      'items', jsonb_build_array(
        'SHCP = máxima autoridad, AUTORIZA instituciones',
        'BANXICO = banco central, EMITE moneda, controla inflación',
        'CNSF = supervisa aseguradoras y AGENTES DE SEGUROS',
        'CNBV = supervisa BANCOS y casas de bolsa',
        'CONSAR = supervisa AFORES (pensiones)',
        'CONDUSEF = protege USUARIOS, atiende quejas',
        'CNSF NO autoriza aseguradoras, solo supervisa',
        'BANXICO NO presta al público',
        'Como agente, tu autoridad directa es la CNSF'
      )
    )
  )
),
duracion_estimada_minutos = 50,
updated_at = now()
WHERE titulo = 'Lección 4.2 - Sectores del Sistema Financiero';