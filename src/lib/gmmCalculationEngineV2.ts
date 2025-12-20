/**
 * MOTOR DE CÁLCULO GMM BX+ V2 - ESTRUCTURAL Y PREVENTIVO
 *
 * PRINCIPIO FUNDAMENTAL:
 * El Excel es la ÚNICA fuente de verdad.
 * El sistema NO infiere, NO simplifica, NO reinterpreta.
 *
 * ARQUITECTURA DE 5 CAPAS:
 * 1. Datos Base (lookup puro, sin cálculos)
 * 2. Construcción de Prima Base FINAL
 * 3. Cargas del Sistema (denominador)
 * 4. Coberturas Adicionales (modular y extensible)
 * 5. Totales
 */

import type {
  QuoteInput,
  QuoteCalculationResult,
  InsuredCalculation,
  PaymentPlanResult,
  TariffTables,
} from './gmmTypes';
import {
  parsePercentToString,
  parseMoney,
  normalizeCoaseguroKey,
  coasegurosMatch,
  normalizeTopsCoaseguroTable,
  formatMoneySafe
} from './gmmParsingUtils';

// ============================================================================
// UTILIDADES DE REDONDEO (Réplica exacta del Excel)
// ============================================================================

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundTo5Decimals(value: number): number {
  return Math.round(value * 100000) / 100000;
}

// ============================================================================
// CAPA 1: DATOS BASE (LOOKUP PURO - SIN CÁLCULOS)
// ============================================================================

/**
 * Búsqueda genérica en tabla (vlookup puro)
 * NO calcula nada, solo busca valores
 */
function vlookup(
  table: any[],
  key: any,
  valueCol: number = 1,
  tableName: string = 'unknown'
): number {
  let row = table.find(r => r.col_0 === key);

  if (!row) {
    const keyNum = Number(key);
    const isNumericKey = !isNaN(keyNum);

    if (isNumericKey) {
      row = table.find(r => {
        const rowNum = Number(r.col_0);
        return !isNaN(rowNum) && Math.abs(rowNum - keyNum) < 0.0001;
      });
    }
  }

  if (!row) {
    row = table.find(r => String(r.col_0) === String(key));
  }

  if (!row) {
    const availableKeys = table.slice(0, 10).map(r => `"${r.col_0}"`).join(', ');
    const totalKeys = table.length;
    throw new Error(
      `[CAPA 1 - LOOKUP] Valor "${key}" no encontrado en tabla "${tableName}".\n` +
      `Valores disponibles (${totalKeys} total): ${availableKeys}${totalKeys > 10 ? '...' : ''}\n` +
      `Tipo del valor buscado: ${typeof key}`
    );
  }
  return Number(row[`col_${valueCol}`] || 0);
}

/**
 * Búsqueda por edad y sexo
 */
function vlookupByAge(table: any[], edad: number, sexo: string): number {
  const row = table.find(r => Number(r.col_0) === edad);
  if (!row) {
    const minAge = Math.min(...table.map(r => Number(r.col_0)));
    const maxAge = Math.max(...table.map(r => Number(r.col_0)));
    throw new Error(
      `[CAPA 1 - LOOKUP] Edad ${edad} no encontrada.\n` +
      `Rango válido: ${minAge} - ${maxAge} años`
    );
  }
  const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
  return Number(row[col] || 0);
}

/**
 * Obtener tope de coaseguro
 */
function getTopeCoaseguro(
  table: any[],
  coaseguro: any,
  tipo: 'contratado_inferior' | 'superior' = 'contratado_inferior'
): number {
  if (!table || table.length === 0) {
    console.error('[CAPA 1 - LOOKUP] Tabla de topes vacía');
    return 0;
  }

  const coaseguroNormalizado = normalizeCoaseguroKey(coaseguro);
  const normalizedTable = normalizeTopsCoaseguroTable(table);

  for (const row of normalizedTable) {
    if (coasegurosMatch(row.coaseguro_key, coaseguroNormalizado)) {
      return row[tipo];
    }
  }

  console.warn(`[CAPA 1 - LOOKUP] No se encontró tope para coaseguro "${coaseguro}"`);
  return 0;
}

/**
 * Validar tope de coaseguro dentro de rango permitido
 */
export function validateTopeCoaseguro(
  topeSeleccionado: number,
  topeMin: number,
  topeMax: number,
  coaseguro: string
): void {
  if (topeSeleccionado < topeMin || topeSeleccionado > topeMax) {
    throw new Error(
      `[VALIDACIÓN] Tope de coaseguro ${formatMoneySafe(topeSeleccionado)} fuera de rango.\n` +
      `Para coaseguro ${coaseguro}, el rango permitido es ${formatMoneySafe(topeMin)} - ${formatMoneySafe(topeMax)}`
    );
  }
}

// ============================================================================
// CAPA 2: CONSTRUCCIÓN DE PRIMA BASE FINAL
// ============================================================================

interface PrimaBaseComponents {
  baseEdadSexo: number;
  factorEstado: number;
  factorNivelHospitalario: number;
  factorTabulador: number;
  factorSumaAsegurada: number;
  factorDeducible: number;
  factorCoaseguro: number;
  primaBaseFinal: number;
}

/**
 * Calcular Prima Base FINAL aplicando TODOS los factores
 * Orden: base × estado × nivel × tabulador × SA × deducible × coaseguro
 */
function calcularPrimaBaseFinal(
  edad: number,
  sexo: string,
  input: QuoteInput,
  tables: TariffTables
): PrimaBaseComponents {
  // 1. Base edad/sexo (sin factores)
  const baseEdadSexo = vlookupByAge(tables.base_intermedia_edad_sexo, edad, sexo);

  // 2. Obtener todos los factores del plan
  const factorEstado = vlookup(tables.factor_estado, input.estado, 2, 'Factor Estado');
  const factorNivelHospitalario = vlookup(tables.factor_nivel_hospitalario, input.nivel_hospitalario, 1, 'Nivel Hospitalario');
  const factorTabulador = vlookup(tables.factor_tabulador, input.tabulador, 1, 'Tabulador');
  const factorSumaAsegurada = vlookup(tables.factor_suma_asegurada, input.suma_asegurada, 1, 'Suma Asegurada');
  const factorDeducible = vlookup(tables.factor_deducible, input.deducible, 1, 'Deducible');
  const factorCoaseguro = vlookup(tables.factor_coaseguro, input.coaseguro, 1, 'Coaseguro');

  // 3. Construir Prima Base FINAL (mismo orden que Excel)
  let primaBaseFinal = baseEdadSexo;
  primaBaseFinal *= factorEstado;
  primaBaseFinal *= factorNivelHospitalario;
  primaBaseFinal *= factorTabulador;
  primaBaseFinal *= factorSumaAsegurada;
  primaBaseFinal *= factorDeducible;
  primaBaseFinal *= factorCoaseguro;
  primaBaseFinal = roundTo2Decimals(primaBaseFinal);

  return {
    baseEdadSexo,
    factorEstado,
    factorNivelHospitalario,
    factorTabulador,
    factorSumaAsegurada,
    factorDeducible,
    factorCoaseguro,
    primaBaseFinal
  };
}

// ============================================================================
// CAPA 3: CARGAS DEL SISTEMA (DENOMINADOR)
// ============================================================================

interface CargasSistema {
  sumCargas: number;
  denominador: number;
  primaBaseConCargas: number;
}

/**
 * Aplicar cargas del sistema para obtener prima base con cargas
 * Formula: primaBaseConCargas = primaBaseFinal / (1 - SUM(cargas))
 */
function aplicarCargasSistema(
  primaBaseFinal: number,
  tables: TariffTables
): CargasSistema {
  const sumCargas = tables.denominador_cargas.reduce((acc, val) => acc + (Number(val) || 0), 0);
  const denominador = 1 - sumCargas;

  if (denominador <= 0) {
    throw new Error(
      `[CAPA 3 - CARGAS] Denominador inválido: ${denominador}.\n` +
      `La suma de cargas (${sumCargas}) debe ser menor a 1.`
    );
  }

  const primaBaseConCargas = roundTo2Decimals(primaBaseFinal / denominador);

  return {
    sumCargas,
    denominador,
    primaBaseConCargas
  };
}

// ============================================================================
// CAPA 4: COBERTURAS ADICIONALES (MODULAR Y EXTENSIBLE)
// ============================================================================

interface CoberturaConfig {
  nombre: string;
  activa: boolean;
  coeficiente?: number;
  calcularFactor?: (edad: number, sexo: string, input: QuoteInput, tables: TariffTables) => number;
  baseCalculo: 'primaBaseConCargas' | 'primaBaseFinal';
}

/**
 * Calcular una cobertura adicional
 */
function calcularCobertura(
  config: CoberturaConfig,
  primaBaseConCargas: number,
  primaBaseFinal: number,
  edad: number,
  sexo: string,
  input: QuoteInput,
  tables: TariffTables
): number {
  if (!config.activa) {
    return 0;
  }

  const base = config.baseCalculo === 'primaBaseConCargas' ? primaBaseConCargas : primaBaseFinal;

  let factor: number;
  if (config.calcularFactor) {
    factor = config.calcularFactor(edad, sexo, input, tables);
  } else if (config.coeficiente !== undefined) {
    factor = config.coeficiente;
  } else {
    throw new Error(`[CAPA 4 - COBERTURAS] Cobertura "${config.nombre}" sin coeficiente ni función de cálculo`);
  }

  return roundTo2Decimals(base * factor);
}

/**
 * Configuración de todas las coberturas adicionales
 */
function obtenerConfiguracionCoberturas(
  input: QuoteInput,
  tables: TariffTables
): CoberturaConfig[] {
  return [
    {
      nombre: 'medicamentos_fuera',
      activa: input.coberturas.medicamentos_fuera,
      coeficiente: tables.coef_medicamentos,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'padecimientos_preexistentes',
      activa: input.coberturas.padecimientos_preexistentes,
      coeficiente: tables.coef_preexistentes,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'complicaciones_no_amparadas',
      activa: input.coberturas.complicaciones_no_amparadas,
      coeficiente: tables.coef_complicaciones,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'vip',
      activa: input.coberturas.vip,
      coeficiente: tables.coef_vip,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'reconocimiento_antiguedad',
      activa: input.coberturas.reconocimiento_antiguedad,
      coeficiente: tables.coef_antiguedad,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'emergencia_medica_extranjero',
      activa: input.coberturas.emergencia_medica_extranjero,
      coeficiente: tables.coef_emergencia_ext,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'enfermedades_graves_extranjero',
      activa: input.coberturas.enfermedades_graves_extranjero,
      coeficiente: tables.coef_enf_graves_ext,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'ayuda_diaria',
      activa: input.coberturas.ayuda_diaria,
      coeficiente: tables.coef_ayuda_diaria,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'ampliacion_servicios',
      activa: input.coberturas.ampliacion_servicios,
      coeficiente: tables.coef_ampliacion_servicios,
      baseCalculo: 'primaBaseConCargas'
    },
    {
      nombre: 'eliminacion_deducible_accidente',
      activa: input.coberturas.eliminacion_deducible_accidente,
      baseCalculo: 'primaBaseConCargas',
      calcularFactor: (edad, sexo, input, tables) => {
        const key = input.deducible;
        const row = tables.deducible_accidente_keys.findIndex(k => k === key);
        if (row >= 0 && tables.deducible_accidente_factors[row]) {
          return roundTo3Decimals(Number(tables.deducible_accidente_factors[row]));
        }
        return 0;
      }
    },
    {
      nombre: 'multiregion',
      activa: input.coberturas.multiregion,
      baseCalculo: 'primaBaseConCargas',
      calcularFactor: (edad, sexo, input, tables) => {
        const row = tables.multiregion_carga_sistema.find(r => r.col_0 === input.estado);
        if (row) {
          return roundTo5Decimals(Number(row.col_1 || 0));
        }
        return 0;
      }
    },
    {
      nombre: 'cobertura_internacional',
      activa: input.coberturas.cobertura_internacional,
      baseCalculo: 'primaBaseConCargas',
      calcularFactor: (edad, sexo, input, tables) => {
        const row = tables.cobertura_internacional_carga_sistema.find(r => Number(r.col_0) === edad);
        if (row) {
          const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
          return roundTo5Decimals(Number(row[col] || 0));
        }
        return 0;
      }
    },
    {
      nombre: 'indemnizacion_eg',
      activa: input.coberturas.indemnizacion_eg,
      baseCalculo: 'primaBaseConCargas',
      calcularFactor: (edad, sexo, input, tables) => {
        const row = tables.indemnizacion_eg_tabla.find(r => Number(r.col_0) === edad);
        if (row) {
          const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
          return roundTo5Decimals(Number(row[col] || 0));
        }
        return 0;
      }
    }
  ];
}

/**
 * Calcular todas las coberturas adicionales de un asegurado
 */
function calcularCoberturasAdicionales(
  primaBaseConCargas: number,
  primaBaseFinal: number,
  edad: number,
  sexo: string,
  input: QuoteInput,
  tables: TariffTables
): { adicionales: Record<string, number>; total: number } {
  const configuraciones = obtenerConfiguracionCoberturas(input, tables);
  const adicionales: Record<string, number> = {};
  let total = 0;

  for (const config of configuraciones) {
    const prima = calcularCobertura(
      config,
      primaBaseConCargas,
      primaBaseFinal,
      edad,
      sexo,
      input,
      tables
    );

    if (prima > 0) {
      adicionales[config.nombre] = prima;
      total += prima;
    }
  }

  return { adicionales, total };
}

// ============================================================================
// CAPA 5: TOTALES
// ============================================================================

/**
 * Calcular prima neta por asegurado
 */
function calcularPrimaNetaAsegurado(
  primaBaseFinal: number,
  totalCoberturas: number
): number {
  return roundTo2Decimals(primaBaseFinal + totalCoberturas);
}

/**
 * Calcular totales de la cotización
 */
function calcularTotales(
  primaNetaTotal: number,
  numAsegurados: number,
  tables: TariffTables
): { gastosExpedicion: number; subtotal: number; iva: number; totalConIVA: number } {
  const gastosExpedicion = roundTo2Decimals(numAsegurados * tables.gastos_expedicion);
  const subtotal = roundTo2Decimals(primaNetaTotal + gastosExpedicion);
  const iva = roundTo2Decimals(subtotal * tables.iva);
  const totalConIVA = roundTo2Decimals(subtotal + iva);

  return {
    gastosExpedicion,
    subtotal,
    iva,
    totalConIVA
  };
}

// ============================================================================
// VALIDACIONES AUTOMÁTICAS (ANTI-ERRORES FUTUROS)
// ============================================================================

interface ValidationResult {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

/**
 * Validar que todas las tablas necesarias existan
 */
function validarTablas(tables: TariffTables): ValidationResult {
  const resultado: ValidationResult = {
    valido: true,
    errores: [],
    advertencias: []
  };

  const tablasRequeridas = [
    'base_intermedia_edad_sexo',
    'factor_estado',
    'factor_nivel_hospitalario',
    'factor_tabulador',
    'factor_suma_asegurada',
    'factor_deducible',
    'factor_coaseguro',
    'denominador_cargas'
  ];

  for (const tabla of tablasRequeridas) {
    if (!tables[tabla] || (Array.isArray(tables[tabla]) && tables[tabla].length === 0)) {
      resultado.errores.push(`[VALIDACIÓN] Tabla requerida "${tabla}" no existe o está vacía`);
      resultado.valido = false;
    }
  }

  return resultado;
}

/**
 * Validar que los factores estén en rangos razonables
 */
function validarFactores(components: PrimaBaseComponents): ValidationResult {
  const resultado: ValidationResult = {
    valido: true,
    errores: [],
    advertencias: []
  };

  // Validar que ningún factor sea 0 o negativo
  const factores = [
    { nombre: 'baseEdadSexo', valor: components.baseEdadSexo },
    { nombre: 'factorEstado', valor: components.factorEstado },
    { nombre: 'factorNivelHospitalario', valor: components.factorNivelHospitalario },
    { nombre: 'factorTabulador', valor: components.factorTabulador },
    { nombre: 'factorSumaAsegurada', valor: components.factorSumaAsegurada },
    { nombre: 'factorDeducible', valor: components.factorDeducible },
    { nombre: 'factorCoaseguro', valor: components.factorCoaseguro }
  ];

  for (const factor of factores) {
    if (factor.valor <= 0) {
      resultado.errores.push(`[VALIDACIÓN] Factor "${factor.nombre}" = ${factor.valor} (debe ser > 0)`);
      resultado.valido = false;
    }
    if (factor.valor > 100) {
      resultado.advertencias.push(`[VALIDACIÓN] Factor "${factor.nombre}" = ${factor.valor} parece inusualmente alto`);
    }
  }

  return resultado;
}

// ============================================================================
// MODO COMPARACIÓN / DEBUG
// ============================================================================

interface DebugInfo {
  capa1_datosBase: {
    baseEdadSexo: number;
    factorEstado: number;
    factorNivelHospitalario: number;
    factorTabulador: number;
    factorSumaAsegurada: number;
    factorDeducible: number;
    factorCoaseguro: number;
  };
  capa2_primaBaseFinal: number;
  capa3_cargas: {
    sumCargas: number;
    denominador: number;
    primaBaseConCargas: number;
  };
  capa4_coberturas: Record<string, number>;
  capa5_totales: {
    primaNetaAsegurado: number;
  };
  validaciones: {
    tablas: ValidationResult;
    factores: ValidationResult;
  };
}

/**
 * Generar información de debug completa por asegurado
 */
function generarDebugInfo(
  components: PrimaBaseComponents,
  cargas: CargasSistema,
  coberturas: { adicionales: Record<string, number>; total: number },
  primaNetaAsegurado: number,
  tables: TariffTables
): DebugInfo {
  return {
    capa1_datosBase: {
      baseEdadSexo: components.baseEdadSexo,
      factorEstado: components.factorEstado,
      factorNivelHospitalario: components.factorNivelHospitalario,
      factorTabulador: components.factorTabulador,
      factorSumaAsegurada: components.factorSumaAsegurada,
      factorDeducible: components.factorDeducible,
      factorCoaseguro: components.factorCoaseguro
    },
    capa2_primaBaseFinal: components.primaBaseFinal,
    capa3_cargas: {
      sumCargas: cargas.sumCargas,
      denominador: cargas.denominador,
      primaBaseConCargas: cargas.primaBaseConCargas
    },
    capa4_coberturas: coberturas.adicionales,
    capa5_totales: {
      primaNetaAsegurado
    },
    validaciones: {
      tablas: validarTablas(tables),
      factores: validarFactores(components)
    }
  };
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================

export function calculateQuoteV2(
  input: QuoteInput,
  tables: TariffTables,
  debug: boolean = false
): QuoteCalculationResult {
  // Validar tablas antes de comenzar
  const validacionTablas = validarTablas(tables);
  if (!validacionTablas.valido) {
    throw new Error(
      '[VALIDACIÓN] Tablas inválidas:\n' +
      validacionTablas.errores.join('\n')
    );
  }

  // Obtener tope de coaseguro
  const topeCoaseguroDefault = getTopeCoaseguro(tables.tope_coaseguro, input.coaseguro, 'contratado_inferior');
  const topeCoaseguro = input.tope_coaseguro_seleccionado || topeCoaseguroDefault;

  // Calcular por cada asegurado
  const insureds: InsuredCalculation[] = input.insureds.map((insured, index) => {
    const edad = insured.edad;

    if (!edad || edad <= 0) {
      throw new Error(
        `[VALIDACIÓN] Edad obligatoria para asegurado "${insured.nombre}".\n` +
        `Proporcione un valor de edad válido (número entero positivo).`
      );
    }

    // CAPA 2: Prima Base Final
    const components = calcularPrimaBaseFinal(edad, insured.sexo, input, tables);

    // Validar factores
    const validacionFactores = validarFactores(components);
    if (!validacionFactores.valido) {
      throw new Error(
        `[VALIDACIÓN] Factores inválidos para asegurado "${insured.nombre}":\n` +
        validacionFactores.errores.join('\n')
      );
    }

    // CAPA 3: Cargas del Sistema
    const cargas = aplicarCargasSistema(components.primaBaseFinal, tables);

    // CAPA 4: Coberturas Adicionales
    const coberturas = calcularCoberturasAdicionales(
      cargas.primaBaseConCargas,
      components.primaBaseFinal,
      edad,
      insured.sexo,
      input,
      tables
    );

    // CAPA 5: Prima Neta Asegurado
    const primaNetaAsegurado = calcularPrimaNetaAsegurado(
      cargas.primaBaseConCargas,
      coberturas.total
    );

    // Generar debug info si está activado
    if (debug) {
      const debugInfo = generarDebugInfo(
        components,
        cargas,
        coberturas,
        primaNetaAsegurado,
        tables
      );
      console.log(`[DEBUG] Asegurado ${index + 1} - ${insured.nombre}:`, debugInfo);
    }

    // Calcular suma de coberturas adicionales
    const primaAdicionales = Object.values(coberturas.adicionales).reduce((sum, val) => sum + val, 0);
    // Prima Base CON cargas (lo que aparece en el Excel como "Prima Neta Cobertura Básica")
    const primaBase = cargas.primaBaseConCargas;
    const primaTotal = primaBase + primaAdicionales;

    return {
      nombre: insured.nombre,
      edad,
      sexo: insured.sexo,
      parentesco: insured.parentesco,
      fecha_nacimiento: insured.fecha_nacimiento,
      prima_base: primaBase,
      prima_adicionales: primaAdicionales,
      adicionales_detalle: coberturas.adicionales,
      prima_xtensuz: 0,
      prima_total: primaTotal,
      coberturas_adicionales: coberturas.adicionales,
      prima_neta: primaNetaAsegurado
    };
  });

  // CAPA 5: Totales generales
  const primaNetaTotal = insureds.reduce((sum, i) => sum + i.prima_neta, 0);
  const totales = calcularTotales(primaNetaTotal, insureds.length, tables);

  // Calcular formas de pago para las opciones seleccionadas
  const formasPagoSeleccionadas = input.formas_pago && input.formas_pago.length > 0
    ? input.formas_pago
    : ['ANUAL']; // Default a ANUAL si no hay selección

  const paymentPlans = calcularFormasDePago(
    primaNetaTotal,
    totales.gastosExpedicion,
    formasPagoSeleccionadas
  );

  return {
    insureds,
    prima_neta_total: primaNetaTotal,
    gastos_expedicion: totales.gastosExpedicion,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total_con_iva: totales.totalConIVA,
    tope_coaseguro: topeCoaseguro,
    payment_plans: paymentPlans
  };
}

/**
 * Calcular formas de pago
 */
function calcularFormasDePago(
  primaNetaTotal: number,
  gastosExpedicion: number,
  formasPagoSeleccionadas: string[]
): PaymentPlanResult[] {
  const plans: PaymentPlanResult[] = [];

  // Definir recargos y número de recibos por forma de pago
  const formasPagoConfig: Record<string, { recargo: number; numRecibos: number }> = {
    'ANUAL': { recargo: 0, numRecibos: 1 },
    'Anual': { recargo: 0, numRecibos: 1 },
    'SEMESTRAL': { recargo: 0.03, numRecibos: 2 },
    'Semestral': { recargo: 0.03, numRecibos: 2 },
    'TRIMESTRAL': { recargo: 0.05, numRecibos: 4 },
    'Trimestral': { recargo: 0.05, numRecibos: 4 },
    'MENSUAL': { recargo: 0.07, numRecibos: 12 },
    'Mensual': { recargo: 0.07, numRecibos: 12 }
  };

  // Generar plan para cada forma de pago seleccionada
  for (const formaPago of formasPagoSeleccionadas) {
    const config = formasPagoConfig[formaPago];
    if (!config) {
      console.warn(`Forma de pago no reconocida: "${formaPago}". Valores aceptados:`, Object.keys(formasPagoConfig));
      continue;
    }

    const recargo = roundTo2Decimals(primaNetaTotal * config.recargo);
    const subtotal = roundTo2Decimals(primaNetaTotal + recargo + gastosExpedicion);
    const iva = roundTo2Decimals(subtotal * 0.16);
    const total = roundTo2Decimals(subtotal + iva);

    const primerRecibo = roundTo2Decimals(total / config.numRecibos);
    const recibosSubsecuentes = config.numRecibos > 1 ? primerRecibo : 0;

    plans.push({
      forma_pago: formaPago,
      recargo,
      gastos_expedicion: gastosExpedicion,
      subtotal,
      iva,
      total,
      primer_recibo: primerRecibo,
      recibos_subsecuentes: recibosSubsecuentes,
      num_recibos: config.numRecibos
    });
  }

  return plans;
}

// ============================================================================
// FUNCIONES AUXILIARES PARA LA UI
// ============================================================================

/**
 * Obtener opciones de tope de coaseguro
 */
export function getTopeCoaseguroOpciones(
  table: any[],
  coaseguro: any
): { contratado_inferior: number; superior: number | null } | null {
  if (!table || table.length === 0) {
    return null;
  }

  const coaseguroNormalizado = normalizeCoaseguroKey(coaseguro);

  const row = table.find(r => {
    const rowKey = normalizeCoaseguroKey(r.col_0);
    return rowKey === coaseguroNormalizado;
  });

  if (!row) {
    return null;
  }

  const contratadoInferior = parseMoney(row.col_1);
  const superior = row.col_2 ? parseMoney(row.col_2) : null;

  return {
    contratado_inferior: contratadoInferior,
    superior: superior
  };
}

/**
 * Obtener rango de tope de coaseguro
 */
export function getTopeCoaseguroRango(
  rangos: any[] | undefined,
  coaseguro: any
): { tope_min: number; tope_max: number; tope_default: number } | null {
  if (!rangos || rangos.length === 0) {
    return null;
  }

  const coaseguroNormalizado = normalizeCoaseguroKey(coaseguro);

  const rango = rangos.find(r => {
    const rangoKey = normalizeCoaseguroKey(r.coaseguro);
    return rangoKey === coaseguroNormalizado;
  });

  if (!rango) {
    return null;
  }

  return {
    tope_min: rango.tope_min,
    tope_max: rango.tope_max,
    tope_default: rango.tope_default || rango.tope_min,
  };
}

/**
 * Cargar todas las tablas de tarifas desde la base de datos
 */
export function loadTariffTables(tables: any[]): TariffTables {
  const get = (key: string) => tables.find(t => t.table_key === key)?.data_json;

  // Normalizar la tabla de topes de coaseguro
  const topeCoaseguroRaw = get('tope_coaseguro') || [];
  const topeCoaseguro = normalizeTopsCoaseguroTable(topeCoaseguroRaw);

  // Cargar tabla de rangos de tope de coaseguro
  let topeCoaseguroRangos;
  const rangosExplicit = get('tope_coaseguro_rangos');

  if (rangosExplicit && Array.isArray(rangosExplicit) && rangosExplicit.length > 0) {
    topeCoaseguroRangos = rangosExplicit;
  } else if (topeCoaseguro.length > 0) {
    topeCoaseguroRangos = topeCoaseguro.map(row => ({
      coaseguro: row.col_0,
      tope_min: row.col_1 || 0,
      tope_max: row.col_2 || row.col_1 || 0,
      tope_default: row.col_1 || 0,
    }));
  } else {
    topeCoaseguroRangos = [];
  }

  return {
    factor_estado: get('factor_estado') || [],
    factor_nivel_hospitalario: get('factor_nivel_hospitalario') || [],
    factor_tabulador: get('factor_tabulador') || [],
    factor_suma_asegurada: get('factor_suma_asegurada') || [],
    factor_deducible: get('factor_deducible') || [],
    factor_coaseguro: get('factor_coaseguro') || [],
    forma_pago: get('forma_pago') || [],
    base_intermedia_edad_sexo: get('base_intermedia_edad_sexo') || [],
    denominador_cargas: get('denominador_cargas') || [],
    tope_coaseguro: topeCoaseguro,
    tope_coaseguro_rangos: topeCoaseguroRangos,
    coef_medicamentos: Number(get('coef_medicamentos')?.[0]?.col_0 || 0),
    coef_preexistentes: Number(get('coef_preexistentes')?.[0]?.col_0 || 0),
    coef_complicaciones: Number(get('coef_complicaciones')?.[0]?.col_0 || 0),
    coef_vip: Number(get('coef_vip')?.[0]?.col_0 || 0),
    coef_antiguedad: Number(get('coef_antiguedad')?.[0]?.col_0 || 0),
    coef_emergencia_ext: Number(get('coef_emergencia_ext')?.[0]?.col_0 || 0),
    coef_enf_graves_ext: Number(get('coef_enf_graves_ext')?.[0]?.col_0 || 0),
    coef_ayuda_diaria: Number(get('coef_ayuda_diaria')?.[0]?.col_0 || 0),
    coef_ampliacion_servicios: Number(get('coef_ampliacion_servicios')?.[0]?.col_0 || 0),
    deducible_accidente_keys: (get('deducible_accidente') || []).map((r: any) => r.col_0),
    deducible_accidente_factors: (get('deducible_accidente') || []).map((r: any) => r.col_1),
    multiregion_carga_sistema: get('multiregion_carga_sistema') || [],
    cobertura_internacional_carga_sistema: get('cobertura_internacional_carga_sistema') || [],
    maternidad_tasa_por_edad: get('maternidad_tasa_por_edad') || [],
    maternidad_threshold: Number(get('maternidad_threshold')?.[0]?.col_0 || 0),
    indemnizacion_eg_tabla: get('indemnizacion_eg_tabla') || [],
    indemnizacion_eg_monto: Number(get('indemnizacion_eg_monto')?.[0]?.col_0 || 0),
    xtensuz_factor: get('xtensuz_factor') || [],
    gastos_expedicion: Number(get('gastos_expedicion')?.[0]?.col_0 || 300),
    iva: Number(get('iva')?.[0]?.col_0 || 0.16)
  };
}

// ============================================================================
// EXPORTACIONES PARA PRUEBAS Y VALIDACIÓN
// ============================================================================

export {
  calcularPrimaBaseFinal,
  aplicarCargasSistema,
  calcularCoberturasAdicionales,
  validarTablas,
  validarFactores,
  generarDebugInfo
};
