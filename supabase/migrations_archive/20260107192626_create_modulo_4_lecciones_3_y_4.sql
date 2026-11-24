/*
  # Crear Lecciones 4.3 y 4.4 del Módulo 4

  1. Crear Lección 4.3: Estructura y Sectores del Sistema Financiero
  2. Crear Lección 4.4: Conceptos Financieros Básicos
*/

-- Lección 4.3: Estructura y Sectores
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  '1df32bdc-501a-4a4c-ac03-49ae563ab079',
  'Lección 4.3 - Estructura y Sectores Financieros',
  3,
  50,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 4.3: ESTRUCTURA Y SECTORES DEL SISTEMA FINANCIERO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'La estructura del sistema financiero en SECTORES es pregunta frecuente. Debes saber QUÉ instituciones pertenecen a CADA sector.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El Sistema Financiero Mexicano se divide en CUATRO GRANDES SECTORES según el tipo de operaciones que realizan.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LOS 4 SECTORES DEL SISTEMA FINANCIERO MEXICANO'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Estructura general:',
        'items', jsonb_build_array(
          '1. SECTOR BANCARIO',
          '2. SECTOR NO BANCARIO (aquí están las ASEGURADORAS)',
          '3. SECTOR DE ORGANIZACIONES Y ACTIVIDADES AUXILIARES DE CRÉDITO',
          '4. SECTOR BURSÁTIL'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'MEMORIZA: Las ASEGURADORAS pertenecen al Sector NO BANCARIO. No son bancos.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'SECTOR 1: SECTOR BANCARIO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El sector bancario incluye a las INSTITUCIONES DE CRÉDITO, es decir, los BANCOS.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'A) BANCA MÚLTIPLE'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Son los bancos COMERCIALES que conocemos. Operan con fines de LUCRO.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Características de banca múltiple:',
        'items', jsonb_build_array(
          '✓ Captan DEPÓSITOS del público (cuentas de ahorro, cheques)',
          '✓ Otorgan CRÉDITOS (hipotecarios, personales, empresariales)',
          '✓ Operan con FINES DE LUCRO',
          '✓ Capital PRIVADO (aunque puede haber participación estatal minoritaria)',
          '✓ Compiten entre sí',
          '✓ Supervisados por CNBV'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Ejemplos de banca múltiple:',
        'items', jsonb_build_array(
          '✓ BBVA México',
          '✓ Santander',
          '✓ Banamex (Citibanamex)',
          '✓ Banorte',
          '✓ HSBC',
          '✓ Scotiabank',
          '✓ Inbursa',
          '✓ Banco Azteca'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Juan abre cuenta de ahorro en Banorte (capta depósito). María pide crédito hipotecario en Banorte (otorga crédito). Banorte gana intereses. Es banca múltiple.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'B) BANCA DE DESARROLLO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Son bancos del ESTADO mexicano creados para impulsar sectores ESTRATÉGICOS.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Características de banca de desarrollo:',
        'items', jsonb_build_array(
          '✓ Propiedad del GOBIERNO Federal',
          '✓ NO tienen fines de lucro (objetivo social)',
          '✓ Impulsan sectores estratégicos',
          '✓ Otorgan créditos con condiciones preferenciales',
          '✓ NO compiten con banca comercial',
          '✓ Complementan a la banca múltiple'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Principales bancos de desarrollo:',
        'items', jsonb_build_array(
          '✓ BANCOMEXT (Banco de Comercio Exterior) - Promueve exportaciones',
          '✓ BANOBRAS (Banco de Obras y Servicios Públicos) - Infraestructura',
          '✓ NAFIN (Nacional Financiera) - Apoya PYMES',
          '✓ Sociedad Hipotecaria Federal - Vivienda',
          '✓ BANSEFI (ahora BANJÉRCITO) - Inclusión financiera',
          '✓ Banco del Bienestar - Programas sociales'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Una empresa mexicana quiere exportar a USA pero no tiene capital. BANCOMEXT le otorga un crédito con tasa preferencial para que pueda producir y exportar. Banca de desarrollo impulsando sector exportador.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Diferencia clave: Banca MÚLTIPLE = fines de lucro, privada. Banca de DESARROLLO = sin fines de lucro, pública, estratégica.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'SECTOR 2: SECTOR NO BANCARIO'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'CRÍTICO: Este es TU sector como agente de seguros. Las ASEGURADORAS están aquí.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El sector NO bancario incluye instituciones que NO son bancos pero realizan actividades financieras importantes.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Instituciones del sector NO bancario:',
        'items', jsonb_build_array(
          '✓ ASEGURADORAS (seguros de vida, daños, salud)',
          '✓ AFIANZADORAS (garantizan cumplimiento de obligaciones)',
          '✓ INSTITUCIONES MUTUALISTAS (seguros sin fines de lucro)',
          '✓ AFORES (administran ahorro para el retiro)',
          '✓ SIEFORES (fondos de inversión de AFORES)',
          '✓ Sociedades de Inversión Especializadas de Fondos para el Retiro'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Las aseguradoras NO captan depósitos del público como los bancos. Captan PRIMAS a cambio de PROTECCIÓN.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'A) ASEGURADORAS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Ya conoces su función. Operan seguros de vida, daños, salud, pensiones.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Características:',
        'items', jsonb_build_array(
          '✓ Asumen RIESGOS a cambio de primas',
          '✓ Invierten primas en mercados financieros',
          '✓ Pagan INDEMNIZACIONES cuando ocurre siniestro',
          '✓ Supervisadas por CNSF',
          '✓ Deben mantener reservas técnicas'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'B) AFIANZADORAS'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Las afianzadoras otorgan FIANZAS, que son garantías de cumplimiento de obligaciones.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Diferencia aseguradora vs afianzadora:',
        'items', jsonb_build_array(
          'ASEGURADORA: Cubre riesgos fortuitos (accidente, enfermedad, muerte)',
          'AFIANZADORA: Garantiza cumplimiento de obligaciones (contractuales, legales)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo de fianza: Una empresa gana licitación de gobierno para construir una carretera. El gobierno exige FIANZA de cumplimiento. La afianzadora garantiza: "Si la empresa NO cumple, YO pago". La empresa paga prima a la afianzadora por esa garantía.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'IMPORTANTE: Las afianzadoras también están supervisadas por la CNSF.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'C) AFORES Y SIEFORES'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'AFORE = Administradora de Fondos para el Retiro. SIEFORE = Sociedad de Inversión Especializada de Fondos para el Retiro.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Diferencia:',
        'items', jsonb_build_array(
          'AFORE: Es la empresa que ADMINISTRA tu cuenta de retiro',
          'SIEFORE: Es el FONDO donde se INVIERTE tu dinero'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Juan trabaja en empresa formal. Está registrado en AFORE XXA (la administradora). Su dinero se invierte en SIEFORE Básica 90-94 (el fondo de inversión según su edad). La AFORE administra, la SIEFORE invierte.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'SECTOR 3: ORGANIZACIONES Y ACTIVIDADES AUXILIARES DE CRÉDITO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Son entidades que APOYAN el financiamiento pero NO son bancos ni aseguradoras.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Instituciones de este sector:',
        'items', jsonb_build_array(
          '✓ SOFOMES (Sociedades Financieras de Objeto Múltiple)',
          '✓ SOFOLES (Sociedades Financieras de Objeto Limitado) - prácticamente desaparecieron',
          '✓ Arrendadoras FINANCIERAS (leasing)',
          '✓ Empresas de FACTORAJE',
          '✓ Casas de CAMBIO',
          '✓ Uniones de CRÉDITO',
          '✓ Almacenes generales de DEPÓSITO',
          '✓ Sociedades Cooperativas de AHORRO Y PRÉSTAMO'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'A) SOFOMES'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Sociedades Financieras de Objeto Múltiple. Otorgan créditos especializados.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Características:',
        'items', jsonb_build_array(
          '✓ Otorgan CRÉDITOS especializados',
          '✓ Pueden ser reguladas (ENR) o NO reguladas',
          '✓ No captan depósitos del público',
          '✓ Se especializan en nichos (autos, nómina, etc.)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Mercedes-Benz Financial es una SOFOME. Otorga créditos para comprar autos Mercedes. No es banco, pero financia.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'B) ARRENDADORAS FINANCIERAS'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Otorgan arrendamiento financiero (leasing). La empresa usa el bien y al final puede comprarlo.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Una empresa necesita maquinaria de $5,000,000 pero no tiene efectivo. Arrendadora la compra y se la "renta" por 5 años. Al final, la empresa puede comprarla por un valor residual.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'C) EMPRESAS DE FACTORAJE'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Compran cuentas por cobrar de empresas con descuento, dándoles liquidez inmediata.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Una empresa vendió $1,000,000 a un cliente que pagará en 90 días. Necesita efectivo HOY. Una empresa de factoraje le compra esa cuenta por cobrar en $950,000. La empresa recibe dinero inmediato, el factoraje cobra los $1M en 90 días.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'D) CASAS DE CAMBIO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Compran y venden moneda extranjera al público.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Vas de viaje a USA. Llevas pesos a una casa de cambio y compras dólares.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'SECTOR 4: SECTOR BURSÁTIL'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Incluye instituciones y mercados donde se negocian VALORES (acciones, bonos, instrumentos de inversión).'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Instituciones del sector bursátil:',
        'items', jsonb_build_array(
          '✓ CASAS DE BOLSA (intermedian compra-venta de valores)',
          '✓ SOCIEDADES DE INVERSIÓN (fondos de inversión)',
          '✓ OPERADORAS de fondos',
          '✓ DISTRIBUIDORAS de valores',
          '✓ Bolsa Mexicana de Valores (BMV)',
          '✓ Bolsa Institucional de Valores (BIVA)',
          '✓ Mercado Mexicano de Derivados (MexDer)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'A) CASAS DE BOLSA'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Intermedian la compra-venta de valores entre inversionistas.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Quieres comprar acciones de América Móvil. No puedes ir directo a la Bolsa. Debes hacerlo a través de una CASA DE BOLSA que actúa como intermediario.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'B) SOCIEDADES DE INVERSIÓN'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Son fondos de inversión donde muchas personas aportan dinero y un experto lo invierte diversificadamente.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Juan tiene $50,000. No sabe invertir. Mete su dinero en una Sociedad de Inversión junto con 1,000 personas más. El fondo tiene $50,000,000. Un experto invierte en acciones, bonos, etc. Juan recibe rendimientos según el desempeño del fondo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RELACIÓN ENTRE SECTORES'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Los cuatro sectores están interconectados:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Conexiones:',
        'items', jsonb_build_array(
          '✓ Bancos venden seguros a través de subsidiarias (bancaseguros)',
          '✓ Aseguradoras INVIERTEN en el sector bursátil',
          '✓ SOFOMES financian autos que tienen SEGURO obligatorio',
          '✓ Trabajadores tienen AFORE y pueden tener seguro de vida',
          '✓ Todos están supervisados por SHCP (directa o indirectamente)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 4.3'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave:',
        'items', jsonb_build_array(
          'Sistema financiero = 4 sectores',
          'SECTOR 1: BANCARIO (banca múltiple + desarrollo)',
          'SECTOR 2: NO BANCARIO (aseguradoras, afianzadoras, AFORES)',
          'SECTOR 3: AUXILIARES DE CRÉDITO (SOFOMES, factoraje, arrendadoras)',
          'SECTOR 4: BURSÁTIL (casas de bolsa, sociedades de inversión)',
          'Aseguradoras = sector NO bancario',
          'Banca múltiple = fines de lucro, privada',
          'Banca desarrollo = sin fines de lucro, pública',
          'AFORE administra, SIEFORE invierte',
          'Todos los sectores están interconectados'
        )
      )
    )
  )
);

-- Lección 4.4: Conceptos Financieros Básicos
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  '1df32bdc-501a-4a4c-ac03-49ae563ab079',
  'Lección 4.4 - Conceptos Financieros Básicos',
  4,
  40,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 4.4: CONCEPTOS FINANCIEROS BÁSICOS'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Esta lección es la BASE para el Módulo 5 (Cálculos Financieros). Aquí aprendes los CONCEPTOS. En el Módulo 5, los CÁLCULOS.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Como agente de seguros, debes entender conceptos financieros básicos porque:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Importancia:',
        'items', jsonb_build_array(
          '✓ El seguro es un producto FINANCIERO',
          '✓ Debes explicar primas, rendimientos, valores futuros',
          '✓ Los seguros de ahorro tienen componente de INVERSIÓN',
          '✓ La inflación AFECTA valores asegurados',
          '✓ El examen pregunta conceptos y cálculos básicos'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '1. INTERÉS'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El INTERÉS es el precio del dinero en el tiempo. Es lo que se paga por usar dinero ajeno, o lo que se gana por prestar el propio.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El interés existe porque:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Razones del interés:',
        'items', jsonb_build_array(
          '✓ El dinero tiene un COSTO DE OPORTUNIDAD',
          '✓ Existe RIESGO de no recuperarlo',
          '✓ La INFLACIÓN reduce el poder adquisitivo',
          '✓ El prestamista renuncia a usar ese dinero HOY'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Prestas $10,000 a un amigo por 1 año. Le cobras 10% de interés. Al año recibes $11,000. Los $1,000 extra son el INTERÉS: tu ganancia por prestar el dinero y esperar un año.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '2. TASA DE INTERÉS'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'La tasa de interés es el PORCENTAJE que se aplica al capital durante un periodo determinado.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'La tasa siempre debe especificar el PERIODO:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Tipos de tasas por periodo:',
        'items', jsonb_build_array(
          '✓ Tasa ANUAL (la más común)',
          '✓ Tasa MENSUAL',
          '✓ Tasa BIMESTRAL',
          '✓ Tasa TRIMESTRAL',
          '✓ Tasa SEMESTRAL'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'IMPORTANTE: 12% anual NO es lo mismo que 12% mensual. ¡Lee bien el periodo!'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Banco ofrece "inversión al 10% anual". Si inviertes $100,000 por 1 año, ganas $10,000 de intereses. Si la tasa fuera 10% MENSUAL, ganarías mucho más (pero eso no existe en la realidad, sería sospechoso).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '3. CAPITAL'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El CAPITAL es la cantidad de dinero inicial que se invierte, se presta o se debe.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'También se le conoce como:',
        'items', jsonb_build_array(
          '✓ Principal',
          '✓ Monto inicial',
          '✓ Valor presente',
          '✓ Cantidad original'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Depositas $50,000 en el banco. Esos $50,000 son el CAPITAL. Si ganas $3,000 de intereses, el monto final es $53,000 (capital + intereses).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '4. MONTO O VALOR FUTURO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El MONTO es la suma del capital más los intereses generados.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fórmula básica:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Monto = Capital + Intereses',
        'items', jsonb_build_array(
          'O también: M = C + I'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Capital = $100,000. Intereses ganados = $8,000. Monto final = $108,000.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '5. INFLACIÓN'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'La inflación es CRÍTICA en seguros. Afecta primas, sumas aseguradas e indemnizaciones.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'La INFLACIÓN es el incremento generalizado y sostenido de los precios de bienes y servicios en una economía durante un periodo de tiempo.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Efectos de la inflación:',
        'items', jsonb_build_array(
          '✓ REDUCE el poder adquisitivo del dinero',
          '✓ Con la misma cantidad de dinero compras MENOS',
          '✓ Afecta el valor REAL del dinero',
          '✓ Impacta inversiones y ahorros',
          '✓ Obliga a AJUSTAR sumas aseguradas'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: En 2020, con $100 comprabas 10 kg de carne. En 2024, con $100 solo compras 7 kg. Hubo inflación. Tu dinero VALE MENOS en términos reales.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'IMPORTANTE EN SEGUROS: Si aseguras tu casa por $2,000,000 hoy y hay pérdida total en 10 años, esos $2,000,000 NO tendrán el mismo poder adquisitivo. Por eso es importante actualizar sumas aseguradas.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Caso real de inflación en seguros: En 2010 aseguraste tu auto por $200,000. Nunca actualizaste. En 2024 hay pérdida total. La aseguradora paga $200,000 pero autos similares cuestan $450,000 ahora. Perdiste poder adquisitivo por no actualizar.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6. PODER ADQUISITIVO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El poder adquisitivo es la capacidad que tiene el dinero para comprar bienes y servicios.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'La inflación REDUCE el poder adquisitivo. Las inversiones AUMENTAN el poder adquisitivo (si rinden más que la inflación).'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Inflación = 5% anual. Tu inversión rinde 8% anual. Ganancia REAL = 3% (8% - 5%). Tu poder adquisitivo AUMENTÓ 3%.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '7. AHORRO E INVERSIÓN'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'AHORRO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'El AHORRO es la parte del ingreso que NO se gasta y se guarda para el futuro.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'INVERSIÓN'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'La INVERSIÓN es colocar el ahorro en instrumentos que generen RENDIMIENTOS.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Diferencia:',
        'items', jsonb_build_array(
          'AHORRO: Guardas dinero (puede ser debajo del colchón)',
          'INVERSIÓN: Colocas dinero para que CREZCA (banco, bolsa, etc.)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Juan ahorra $500 al mes (los guarda). María invierte $500 al mes en CETES (ganan interés). En 5 años, Juan tiene menos poder adquisitivo (inflación). María tiene más (rendimientos).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '8. RIESGO Y RENDIMIENTO'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Regla básica de las finanzas: A MAYOR riesgo, MAYOR rendimiento esperado. A MENOR riesgo, MENOR rendimiento.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Ejemplos por nivel de riesgo:',
        'items', jsonb_build_array(
          'BAJO RIESGO, BAJO RENDIMIENTO: CETES, pagarés bancarios',
          'RIESGO MEDIO, RENDIMIENTO MEDIO: Bonos corporativos, fondos mixtos',
          'ALTO RIESGO, ALTO RENDIMIENTO: Acciones, criptomonedas, negocios'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Si alguien te ofrece ALTO rendimiento con BAJO riesgo, es SOSPECHOSO. Probablemente sea fraude.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '9. LIQUIDEZ'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'La LIQUIDEZ es la facilidad con la que un activo se puede convertir en EFECTIVO sin perder valor.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Ejemplos de liquidez:',
        'items', jsonb_build_array(
          'ALTA LIQUIDEZ: Efectivo, cuenta de banco (retiras cuando quieras)',
          'LIQUIDEZ MEDIA: CETES, fondos de inversión (tardas unos días)',
          'BAJA LIQUIDEZ: Casa, terreno (tardas meses en vender)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Necesitas $50,000 HOY por emergencia. Si están en cuenta de banco (alta liquidez), los retiras HOY. Si están en un terreno (baja liquidez), tardas meses en vender.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '10. RELACIÓN CON EL SEGURO'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Estos conceptos aplican directamente en seguros:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Aplicaciones:',
        'items', jsonb_build_array(
          '✓ Seguros de AHORRO generan intereses (dotal, vida con ahorro)',
          '✓ Las PRIMAS deben ajustarse por inflación',
          '✓ Las SUMAS ASEGURADAS deben actualizarse',
          '✓ Las aseguradoras INVIERTEN las primas',
          '✓ Los rendimientos permiten REDUCIR primas',
          '✓ El valor de RESCATE considera intereses acumulados'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Seguro dotal a 20 años. Pagas prima anual. La aseguradora INVIERTE esas primas. Al final de 20 años recibes tu suma asegurada MÁS rendimientos. Es un producto de ahorro E inversión.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ERRORES COMUNES EN EL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'NO confundir:',
        'items', jsonb_build_array(
          '❌ Tasa anual con tasa mensual',
          '❌ Capital con monto (capital es inicial, monto es final)',
          '❌ Inflación con interés (inflación reduce valor, interés lo aumenta)',
          '❌ Ahorro con inversión (ahorro es guardar, inversión es hacer crecer)',
          '❌ Liquidez con rentabilidad (son conceptos diferentes)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 4.4'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave:',
        'items', jsonb_build_array(
          'Interés = precio del dinero en el tiempo',
          'Tasa de interés = porcentaje aplicado al capital',
          'Capital = cantidad inicial',
          'Monto = capital + intereses',
          'Inflación = aumento de precios, reduce poder adquisitivo',
          'Mayor riesgo = mayor rendimiento esperado',
          'Liquidez = facilidad de convertir en efectivo',
          'En seguros: actualizar sumas aseguradas por inflación',
          'Seguros de ahorro generan intereses',
          'Estos conceptos son base para el Módulo 5'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CIERRE DEL MÓDULO 4'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Este módulo te ha dado el contexto completo del Sistema Financiero Mexicano:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Has aprendido:',
        'items', jsonb_build_array(
          '✓ Qué es el sistema financiero y para qué sirve',
          '✓ Quiénes son las autoridades y qué función tiene cada una',
          '✓ Cómo se estructura en 4 sectores',
          '✓ Dónde encajan las aseguradoras (sector NO bancario)',
          '✓ Conceptos financieros básicos esenciales',
          '✓ Cómo estos conceptos se aplican en seguros'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'IMPORTANTE: El Módulo 4 es TEÓRICO y CONCEPTUAL. Es la BASE para entender el Módulo 5, donde harás CÁLCULOS financieros aplicados.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Domina estos conceptos porque son fundamentales para:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Importancia:',
        'items', jsonb_build_array(
          '✓ Aprobar el examen de Cédula A',
          '✓ Entender el contexto donde operas',
          '✓ Explicar productos a clientes',
          '✓ Comprender el Módulo 5 (cálculos)',
          '✓ Ejercer profesionalmente con visión integral'
        )
      )
    )
  )
);