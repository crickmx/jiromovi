/*
  # Módulos 4 y 5 - Sistemas Financieros y Cálculos

  1. Módulo 4: Sistemas y Mercados Financieros (2 lecciones)
    - Lección 4.1: Sistema Financiero Mexicano
    - Lección 4.2: Sectores del Sistema Financiero
  
  2. Módulo 5: Cálculos Financieros Básicos (5 lecciones)
    - Lección 5.1: Porcentajes y Decimales
    - Lección 5.2: Tasas de Interés
    - Lección 5.3: Regla de Tres
    - Lección 5.4: Capitalización
    - Lección 5.5: Tasa de Rendimiento
  
  Basado en páginas 83-93 del Manual CNSF oficial
*/

-- ============================================================================
-- MÓDULO 4: SISTEMAS Y MERCADOS FINANCIEROS
-- ============================================================================

-- Lección 4.1: Sistema Financiero Mexicano
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 4.1 - Sistema Financiero Mexicano',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Sistema Financiero Mexicano'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El sistema financiero mexicano es el conjunto de instituciones, mercados, instrumentos y marco legal que permite la captación, administración, regulación y canalización de recursos entre ahorradores e inversionistas.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Autoridades Reguladoras'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'SHCP (Secretaría de Hacienda y Crédito Público): Máxima autoridad del sistema financiero. Define la política financiera, autoriza la constitución de instituciones financieras y coordina a las comisiones reguladoras.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'BANXICO (Banco de México): Banco central con autonomía constitucional. Sus objetivos son mantener la estabilidad del poder adquisitivo de la moneda nacional (control de inflación) y promover el sano desarrollo del sistema financiero.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CNSF (Comisión Nacional de Seguros y Fianzas): Regula y supervisa a las instituciones de seguros y fianzas. Protege los intereses de los usuarios y mantiene la estabilidad del sector asegurador.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CONSAR (Comisión Nacional del Sistema de Ahorro para el Retiro): Regula el sistema de pensiones y Afores. Supervisa que los recursos de los trabajadores sean administrados adecuadamente.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CNBV (Comisión Nacional Bancaria y de Valores): Supervisa y regula a bancos, casas de bolsa y demás participantes del mercado de valores. Vigila la estabilidad del sistema bancario.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CONDUSEF (Comisión Nacional para la Protección y Defensa de los Usuarios de Servicios Financieros): Protege y defiende los derechos de los usuarios. Atiende quejas y promueve la educación financiera.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'IPAB (Instituto para la Protección al Ahorro Bancario): Protege los depósitos bancarios de los ahorradores hasta por 400 mil UDIs (aproximadamente $3 millones de pesos).'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Memoriza las funciones de cada autoridad. BANXICO controla la inflación y es autónomo. CNSF regula seguros. CNBV regula bancos. CONSAR regula Afores. IPAB protege el ahorro bancario.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 83-85 del Manual CNSF'
      )
    )
  ),
  1,
  45
FROM cedula_a_modulos m WHERE m.orden = 4;

-- Lección 4.2: Sectores del Sistema Financiero
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 4.2 - Sectores del Sistema Financiero',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Sectores del Sistema Financiero'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '1. Sector Bancario'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Instituciones bancarias:',
        'items', jsonb_build_array(
          'Banca Múltiple: Bancos comerciales que captan ahorro y otorgan créditos',
          'Banca de Desarrollo: Bancos gubernamentales (NAFIN, BANCOMEXT, etc.)',
          'Operan con: cuentas de ahorro, cuentas de cheques, créditos, tarjetas'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '2. Sector No Bancario'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Incluye:',
        'items', jsonb_build_array(
          'Instituciones de Seguros: Aseguradoras de vida, daños, accidentes y enfermedades',
          'Instituciones de Fianzas: Otorgan fianzas para garantizar cumplimiento de obligaciones',
          'Afores: Administradoras de Fondos para el Retiro',
          'Siefores: Sociedades de Inversión Especializada de Fondos para el Retiro',
          'Sociedades de Inversión: Fondos de inversión en valores',
          'Casas de Bolsa: Intermediarios en el mercado de valores'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '3. Auxiliares de Crédito'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Entidades de apoyo:',
        'items', jsonb_build_array(
          'Almacenes Generales de Depósito: Almacenamiento y custodia',
          'Arrendadoras Financieras: Arrendamiento de bienes',
          'Empresas de Factoraje: Compra de cuentas por cobrar',
          'Uniones de Crédito: Apoyo financiero a sus socios',
          'Casas de Cambio: Compra-venta de divisas'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '4. Sector Bursátil (Mercado de Valores)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Participantes:',
        'items', jsonb_build_array(
          'Bolsa Mexicana de Valores (BMV): Mercado organizado para compra-venta de valores',
          'Casas de Bolsa: Intermediarios autorizados',
          'Emisoras: Empresas que emiten acciones y deuda',
          'Inversionistas: Personas físicas y morales que invierten',
          'Indeval: Depósito central de valores'
        )
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Mercado Primario: Emisión y colocación de valores nuevos. Las empresas obtienen recursos directamente. Mercado Secundario: Compra-venta de valores ya emitidos entre inversionistas. Proporciona liquidez al mercado.'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: El sector bancario capta ahorro y da créditos. Las aseguradoras y Afores son sector no bancario. Auxiliares de crédito incluyen arrendadoras, factoraje y almacenes. El mercado de valores tiene mercado primario (emisión) y secundario (compra-venta).'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 83-85 del Manual CNSF'
      )
    )
  ),
  2,
  45
FROM cedula_a_modulos m WHERE m.orden = 4;

-- ============================================================================
-- MÓDULO 5: CÁLCULOS FINANCIEROS BÁSICOS
-- ============================================================================

-- Lección 5.1: Porcentajes y Decimales
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 5.1 - Porcentajes y Decimales',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Porcentajes y Decimales'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Los porcentajes son fundamentales en el cálculo de primas, deducibles, coaseguros y comisiones. Dominar su uso es esencial para el examen.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Conversión Porcentaje a Decimal'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Para convertir porcentaje a decimal, divide entre 100 o mueve el punto decimal dos lugares a la izquierda.'
      ),
      jsonb_build_object(
        'type', 'ejemplo',
        'content', 'Ejemplos: 25% = 25/100 = 0.25 | 10% = 10/100 = 0.10 | 5% = 5/100 = 0.05 | 100% = 100/100 = 1.00'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Cálculo de Porcentajes'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fórmula: Porcentaje de un número = (Número) × (Porcentaje en decimal)'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 1: ¿Cuánto es el 15% de $10,000? Solución: $10,000 × 0.15 = $1,500'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 2 (Deducible): Vehículo asegurado en $200,000 con deducible de 5%. ¿Cuánto es el deducible? Solución: $200,000 × 0.05 = $10,000'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 3 (Coaseguro): Gastos de $50,000 con coaseguro del 10%. ¿Cuánto paga el asegurado? Solución: $50,000 × 0.10 = $5,000'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Aumentos y Descuentos'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Aumento: Cantidad final = Cantidad inicial × (1 + porcentaje). Descuento: Cantidad final = Cantidad inicial × (1 - porcentaje)'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo (Aumento): Prima de $5,000 con aumento del 12%. Nueva prima = $5,000 × 1.12 = $5,600'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo (Descuento): Suma asegurada $300,000 con demérito del 15%. Nuevo valor = $300,000 × 0.85 = $255,000'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Tip para el examen: Para aumento súmale 1 al decimal (15% de aumento = 1.15). Para descuento réstale al 1 (15% de descuento = 0.85). Esto agiliza los cálculos.'
      )
    )
  ),
  1,
  25
FROM cedula_a_modulos m WHERE m.orden = 5;

-- Lección 5.2: Tasas de Interés
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 5.2 - Tasas de Interés',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tasas de Interés'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El interés es el costo del dinero en el tiempo. Representa el rendimiento por prestar dinero o el costo por tomarlo prestado.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Interés Simple'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Se calcula solo sobre el capital inicial. Fórmula: I = C × i × t. Donde: I = Interés, C = Capital, i = Tasa de interés (decimal), t = Tiempo'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Capital de $100,000 al 10% anual por 2 años. I = $100,000 × 0.10 × 2 = $20,000. Monto final = $100,000 + $20,000 = $120,000'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Interés Compuesto'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Se calcula sobre el capital más los intereses acumulados. Fórmula: M = C × (1 + i)^t. Donde: M = Monto final, C = Capital, i = Tasa, t = Tiempo'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Capital $100,000 al 10% anual por 2 años. M = $100,000 × (1.10)² = $100,000 × 1.21 = $121,000. Interés ganado = $121,000 - $100,000 = $21,000'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Conversión de Tasas'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Equivalencias:',
        'items', jsonb_build_array(
          'Tasa anual a mensual: Divide entre 12',
          'Tasa anual a diaria: Divide entre 360 o 365',
          'Tasa mensual a anual: Multiplica por 12',
          'Ejemplo: 24% anual = 24/12 = 2% mensual'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Interés simple se calcula sobre el capital inicial. Interés compuesto sobre capital + intereses. En seguros usualmente se trabaja con interés simple para períodos cortos.'
      )
    )
  ),
  2,
  25
FROM cedula_a_modulos m WHERE m.orden = 5;

-- Lección 5.3: Regla de Tres
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 5.3 - Regla de Tres',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Regla de Tres'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Método para resolver problemas de proporcionalidad. Muy útil para calcular primas proporcionales, prorrateos y ajustes.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Regla de Tres Simple Directa'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Si A es a B como C es a X, entonces: X = (B × C) / A'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo (Prima proporcional): Una prima anual es $12,000. ¿Cuánto corresponde a 5 meses? 12 meses → $12,000 | 5 meses → X | X = ($12,000 × 5) / 12 = $5,000'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo (Ajuste de suma): Si $100,000 generan prima de $2,000, ¿cuánto es la prima para $250,000? $100,000 → $2,000 | $250,000 → X | X = ($2,000 × $250,000) / $100,000 = $5,000'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Regla de Tres Inversa'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cuando las magnitudes son inversamente proporcionales (más de uno, menos del otro). X = (A × B) / C'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: 10 trabajadores terminan una obra en 6 días. ¿En cuántos días la terminarían 15 trabajadores? 10 trabajadores × 6 días = 60 días-trabajador. 60 / 15 = 4 días'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Identifica si es directa (más-más, menos-menos) o inversa (más-menos). Para calcular prima proporcional por tiempo, usa regla de tres directa. Verifica que las unidades sean consistentes.'
      )
    )
  ),
  3,
  20
FROM cedula_a_modulos m WHERE m.orden = 5;

-- Lección 5.4: Capitalización
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 5.4 - Capitalización',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Capitalización'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Es el proceso de calcular el valor futuro de una cantidad presente, considerando los intereses que se acumulan en el tiempo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Valor Futuro'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fórmula: VF = VP × (1 + i)^n. Donde: VF = Valor Futuro, VP = Valor Presente, i = Tasa de interés, n = Número de periodos'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 1: ¿Cuánto tendrá en 3 años si invierte $50,000 al 8% anual? VF = $50,000 × (1.08)³ = $50,000 × 1.2597 = $62,985'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 2 (Reservas técnicas): Una aseguradora debe acumular $1,000,000 en 5 años al 6% anual. Valor inicial necesario: VP = VF / (1 + i)^n = $1,000,000 / (1.06)^5 = $747,258'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Capitalización con Depósitos Periódicos'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Para calcular el valor futuro de pagos iguales periódicos (anualidades). Fórmula simplificada: VF = Pago × [ ((1 + i)^n - 1) / i ]'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Ahorra $1,000 mensuales durante 12 meses al 1% mensual. VF = $1,000 × [ ((1.01)^12 - 1) / 0.01 ] = $1,000 × 12.68 = $12,680'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Capitalización calcula valor futuro. Actualización calcula valor presente. La tasa y el periodo deben estar en las mismas unidades (si es mensual, usa tasa mensual y periodos en meses).'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 90-93 del Manual CNSF'
      )
    )
  ),
  4,
  25
FROM cedula_a_modulos m WHERE m.orden = 5;

-- Lección 5.5: Tasa de Rendimiento
INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 5.5 - Tasa de Rendimiento',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Tasa de Rendimiento'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'La tasa de rendimiento mide la ganancia o pérdida de una inversión en relación con la cantidad invertida, expresada como porcentaje.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Fórmula Básica'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Tasa de Rendimiento = [(Valor Final - Valor Inicial) / Valor Inicial] × 100%'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 1: Invirtió $100,000 y después de un año tiene $110,000. Rendimiento = [($110,000 - $100,000) / $100,000] × 100% = 10%'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo 2: Compró acciones en $50,000 y las vendió en $47,000. Rendimiento = [($47,000 - $50,000) / $50,000] × 100% = -6% (pérdida)'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Rendimiento Anualizado'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Para comparar inversiones de diferentes plazos, se calcula el rendimiento anual equivalente. Fórmula: Rendimiento Anualizado = [(Valor Final / Valor Inicial)^(1/años) - 1] × 100%'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Inversión de $100,000 creció a $150,000 en 3 años. Rendimiento Anualizado = [($150,000 / $100,000)^(1/3) - 1] × 100% = [(1.5)^0.333 - 1] × 100% = 14.47% anual'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Rendimiento Real vs Nominal'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Rendimiento Nominal: Ganancia sin considerar inflación. Rendimiento Real: Ganancia ajustada por inflación. Fórmula aproximada: Rendimiento Real = Rendimiento Nominal - Inflación'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'Ejemplo: Rendimiento nominal 10%, inflación 4%. Rendimiento real ≈ 10% - 4% = 6%'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Aplicación en Seguros'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Las aseguradoras calculan rendimientos de:',
        'items', jsonb_build_array(
          'Inversiones de reservas técnicas',
          'Fondos de pensiones',
          'Portafolio de inversiones',
          'Deben cumplir tasas mínimas regulatorias'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: La tasa de rendimiento compara ganancia contra inversión inicial. Un rendimiento negativo significa pérdida. El rendimiento real considera la inflación. Las aseguradoras deben invertir las reservas técnicas con rendimientos adecuados.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 90-93 del Manual CNSF'
      )
    )
  ),
  5,
  25
FROM cedula_a_modulos m WHERE m.orden = 5;