/**
 * Motor de cálculo GMM BX+
 * Replica exactamente la lógica del Excel
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
  normalizeTopsCoaseguroTable
} from './gmmParsingUtils';

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundTo5Decimals(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function vlookup(table: any[], key: any, valueCol: number = 1, tableName: string = 'unknown'): number {
  // Intentar búsqueda exacta primero
  let row = table.find(r => r.col_0 === key);

  // Si no hay coincidencia exacta, intentar comparación numérica si ambos son números
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

  // Si aún no hay coincidencia, intentar comparación de strings
  if (!row) {
    row = table.find(r => String(r.col_0) === String(key));
  }

  if (!row) {
    const availableKeys = table.slice(0, 10).map(r => `"${r.col_0}"`).join(', ');
    const totalKeys = table.length;
    throw new Error(
      `Valor "${key}" no encontrado en tabla "${tableName}".\n` +
      `Valores disponibles (${totalKeys} total): ${availableKeys}${totalKeys > 10 ? '...' : ''}\n` +
      `Tipo del valor buscado: ${typeof key}`
    );
  }
  return Number(row[`col_${valueCol}`] || 0);
}

function vlookupByAge(table: any[], edad: number, sexo: string): number {
  const row = table.find(r => Number(r.col_0) === edad);
  if (!row) {
    const minAge = Math.min(...table.map(r => Number(r.col_0)));
    const maxAge = Math.max(...table.map(r => Number(r.col_0)));
    throw new Error(
      `Edad ${edad} no encontrada en tabla de tarifas.\n` +
      `Rango válido: ${minAge} - ${maxAge} años`
    );
  }
  const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
  return Number(row[col] || 0);
}

/**
 * Obtiene el tope de coaseguro de forma segura
 * @param table - Tabla de topes de coaseguro
 * @param coaseguro - Valor de coaseguro (puede ser "10%", 10, 0.10, etc.)
 * @param tipo - 'contratado_inferior' o 'superior'
 * @returns Tope de coaseguro o 0 si no se encuentra
 */
function getTopeCoaseguro(
  table: any[],
  coaseguro: any,
  tipo: 'contratado_inferior' | 'superior' = 'contratado_inferior'
): number {
  if (!table || table.length === 0) {
    console.error('getTopeCoaseguro: tabla vacía');
    return 0;
  }

  // Normalizar el coaseguro a formato "10%"
  const coaseguroNormalizado = normalizeCoaseguroKey(coaseguro);

  // Buscar en la tabla usando comparación normalizada
  const row = table.find(r => {
    const rowKey = normalizeCoaseguroKey(r.col_0);
    return rowKey === coaseguroNormalizado;
  });

  if (!row) {
    const availableKeys = table.slice(0, 10).map(r => `"${r.col_0}"`).join(', ');
    console.error(
      `getTopeCoaseguro: No se encontró tope para coaseguro "${coaseguro}" (normalizado: "${coaseguroNormalizado}").\n` +
      `Valores disponibles: ${availableKeys}`
    );
    return 0;
  }

  // Obtener el valor correcto según el tipo
  const colIndex = tipo === 'contratado_inferior' ? 1 : 2;
  const value = row[`col_${colIndex}`];

  // Parsear el valor (puede venir como "$40,000" o 40000)
  const parsed = parseMoney(value);

  if (isNaN(parsed) || parsed === 0) {
    console.error(
      `getTopeCoaseguro: Valor inválido para coaseguro "${coaseguro}", tipo "${tipo}": ${value}`
    );
    return 0;
  }

  return parsed;
}

/**
 * Obtiene todas las opciones de tope para un coaseguro dado
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

export function calculateQuote(
  input: QuoteInput,
  tables: TariffTables
): QuoteCalculationResult {
  const factorEstado = vlookup(tables.factor_estado, input.estado, 1, 'Factor Estado');
  const factorNivel = vlookup(tables.factor_nivel_hospitalario, input.nivel_hospitalario, 1, 'Nivel Hospitalario');
  const factorTabulador = vlookup(tables.factor_tabulador, input.tabulador, 1, 'Tabulador');
  const factorSA = vlookup(tables.factor_suma_asegurada, input.suma_asegurada, 1, 'Suma Asegurada');
  const factorDeducible = vlookup(tables.factor_deducible, input.deducible, 1, 'Deducible');
  const factorCoaseguro = vlookup(tables.factor_coaseguro, input.coaseguro, 1, 'Coaseguro');

  // Tope de coaseguro con manejo seguro
  const topeCoaseguroDefault = getTopeCoaseguro(tables.tope_coaseguro, input.coaseguro, 'contratado_inferior');
  const topeCoaseguro = input.tope_coaseguro_seleccionado || topeCoaseguroDefault;

  const sumCargas = tables.denominador_cargas.reduce((acc, val) => acc + (Number(val) || 0), 0);
  const denominador = 1 - sumCargas;

  const insureds: InsuredCalculation[] = input.insureds.map(insured => {
    let edad = insured.edad;
    if (!edad && insured.fecha_nacimiento) {
      const nacimiento = new Date(insured.fecha_nacimiento);
      const hoy = new Date();
      edad = hoy.getFullYear() - nacimiento.getFullYear();
      const m = hoy.getMonth() - nacimiento.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
      }
    }
    if (!edad) throw new Error(`Age required for ${insured.nombre}`);

    const baseIntermedia = vlookupByAge(tables.base_intermedia_edad_sexo, edad, insured.sexo);

    let primaBase = baseIntermedia;
    primaBase *= factorEstado;
    primaBase *= factorNivel;
    primaBase *= factorTabulador;
    primaBase *= factorSA;
    primaBase *= factorDeducible;
    primaBase *= factorCoaseguro;
    primaBase = roundTo2Decimals(primaBase);

    let primaAdicionales = 0;
    const adicionales: Record<string, number> = {};

    const baseFactores = baseIntermedia * factorEstado * factorNivel * factorTabulador * factorSA * factorDeducible * factorCoaseguro;

    if (input.coberturas.medicamentos_fuera) {
      const cobertura = roundTo2Decimals((baseFactores / denominador) * tables.coef_medicamentos);
      adicionales.medicamentos_fuera = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.padecimientos_preexistentes) {
      const cobertura = roundTo2Decimals((baseFactores / denominador) * tables.coef_preexistentes);
      adicionales.padecimientos_preexistentes = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.complicaciones_no_amparadas) {
      const cobertura = roundTo2Decimals((baseFactores / denominador) * tables.coef_complicaciones);
      adicionales.complicaciones_no_amparadas = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.vip) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_vip);
      adicionales.vip = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.reconocimiento_antiguedad) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_antiguedad);
      adicionales.reconocimiento_antiguedad = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.emergencia_medica_extranjero) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_emergencia_ext);
      adicionales.emergencia_medica_extranjero = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.enfermedades_graves_extranjero) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_enf_graves_ext);
      adicionales.enfermedades_graves_extranjero = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.ayuda_diaria) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_ayuda_diaria);
      adicionales.ayuda_diaria = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.ampliacion_servicios) {
      const cobertura = roundTo2Decimals(primaBase * tables.coef_ampliacion_servicios);
      adicionales.ampliacion_servicios = cobertura;
      primaAdicionales += cobertura;
    }

    if (input.coberturas.eliminacion_deducible_accidente) {
      const key = input.deducible;
      const row = tables.deducible_accidente_keys.findIndex(k => k === key);
      if (row >= 0 && tables.deducible_accidente_factors[row]) {
        const factor = roundTo3Decimals(Number(tables.deducible_accidente_factors[row]));
        const cobertura = roundTo2Decimals(primaBase * factor);
        adicionales.eliminacion_deducible_accidente = cobertura;
        primaAdicionales += cobertura;
      }
    }

    if (input.coberturas.multiregion) {
      const row = tables.multiregion_carga_sistema.find(r => Number(r.col_0) === edad);
      if (row) {
        const col = insured.sexo === 'Hombre' ? 'col_1' : 'col_2';
        const factor = roundTo5Decimals(Number(row[col] || 0));
        const cobertura = roundTo2Decimals(primaBase * factor);
        adicionales.multiregion = cobertura;
        primaAdicionales += cobertura;
      }
    }

    if (input.coberturas.cobertura_internacional) {
      const row = tables.cobertura_internacional_carga_sistema.find(r => Number(r.col_0) === edad);
      if (row) {
        const col = insured.sexo === 'Hombre' ? 'col_1' : 'col_2';
        const factor = roundTo5Decimals(Number(row[col] || 0));
        const cobertura = roundTo2Decimals(primaBase * factor);
        adicionales.cobertura_internacional = cobertura;
        primaAdicionales += cobertura;
      }
    }

    if (input.coberturas.indemnizacion_eg) {
      const row = tables.indemnizacion_eg_tabla.find(r => Number(r.col_0) === edad);
      if (row) {
        const col = insured.sexo === 'Hombre' ? 'col_1' : 'col_2';
        const tasa = Number(row[col] || 0);
        const cobertura = roundTo2Decimals(tasa * tables.indemnizacion_eg_monto);
        adicionales.indemnizacion_eg = cobertura;
        primaAdicionales += cobertura;
      }
    }

    if (input.coberturas.maternidad && insured.sexo === 'Mujer' && input.montos?.maternidad) {
      const monto = input.montos.maternidad;
      const threshold = tables.maternidad_threshold;
      if (monto > threshold) {
        const row = tables.maternidad_tasa_por_edad.find(r => Number(r.col_0) === edad);
        if (row) {
          const tasa = Number(row.col_1 || 0);
          const cobertura = roundTo2Decimals((monto - threshold) * tasa);
          adicionales.maternidad = cobertura;
          primaAdicionales += cobertura;
        }
      }
    }

    primaAdicionales = roundTo2Decimals(primaAdicionales);

    let primaXtensuz = 0;
    if (input.coberturas.xtensuz && input.montos?.xtensuz) {
      const monto = input.montos.xtensuz;
      const row = tables.xtensuz_factor.find(r => Number(r.col_0) === monto);
      if (row) {
        const factor = Number(row.col_1 || 0);
        const primaAntesXtensuz = primaBase + primaAdicionales;
        primaXtensuz = roundTo2Decimals(primaAntesXtensuz * factor);
      }
    }

    const primaTotal = roundTo2Decimals(primaBase + primaAdicionales + primaXtensuz);

    return {
      nombre: insured.nombre,
      sexo: insured.sexo,
      edad,
      prima_base: primaBase,
      prima_adicionales: primaAdicionales,
      adicionales_detalle: adicionales,
      prima_xtensuz: primaXtensuz,
      prima_total: primaTotal,
    };
  });

  const primaNetaTotal = roundTo2Decimals(insureds.reduce((acc, ins) => acc + ins.prima_total, 0));

  // Calcular múltiples planes de pago
  const paymentPlans = input.formas_pago.map(formaPagoName => {
    const formaPago = tables.forma_pago.find(r => r.col_0 === formaPagoName);
    if (!formaPago) {
      const available = tables.forma_pago.map(r => `"${r.col_0}"`).join(', ');
      throw new Error(
        `Forma de pago "${formaPagoName}" no encontrada.\n` +
        `Formas de pago disponibles: ${available}`
      );
    }
    const factorFormaPago = Number(formaPago.col_1 || 0);
    const numRecibos = Number(formaPago.col_2 || 1);

    const recargo = roundTo2Decimals(primaNetaTotal * factorFormaPago);
    const gastosExpedicion = tables.gastos_expedicion;
    const subtotal = roundTo2Decimals(primaNetaTotal + recargo + gastosExpedicion);
    const iva = roundTo2Decimals(subtotal * tables.iva);
    const total = roundTo2Decimals(subtotal + iva);

    let primerRecibo = total;
    let recibosSubsecuentes = 0;

    if (numRecibos > 1) {
      primerRecibo = roundTo2Decimals(((subtotal - gastosExpedicion) / numRecibos + gastosExpedicion) * (1 + tables.iva));
      const resto = total - primerRecibo;
      recibosSubsecuentes = roundTo2Decimals(resto / (numRecibos - 1));
    }

    return {
      forma_pago: formaPagoName,
      recargo,
      gastos_expedicion: gastosExpedicion,
      subtotal,
      iva,
      total,
      primer_recibo: primerRecibo,
      recibos_subsecuentes: recibosSubsecuentes,
      num_recibos: numRecibos,
    };
  });

  return {
    insureds,
    prima_neta_total: primaNetaTotal,
    tope_coaseguro: topeCoaseguro,
    payment_plans: paymentPlans,
  };
}

export function loadTariffTables(tables: any[]): TariffTables {
  const get = (key: string) => tables.find(t => t.table_key === key)?.data_json;

  // Normalizar la tabla de topes de coaseguro
  const topeCoaseguroRaw = get('tope_coaseguro') || [];
  const topeCoaseguro = normalizeTopsCoaseguroTable(topeCoaseguroRaw);

  return {
    factor_estado: get('factor_estado') || [],
    factor_nivel_hospitalario: get('factor_nivel_hospitalario') || [],
    factor_tabulador: get('factor_tabulador') || [],
    factor_suma_asegurada: get('factor_suma_asegurada') || [],
    factor_deducible: get('factor_deducible') || [],
    factor_coaseguro: get('factor_coaseguro') || [],
    tope_coaseguro: topeCoaseguro,
    tope_coaseguro_opciones: get('tope_coaseguro_opciones'),
    forma_pago: get('forma_pago') || [],
    base_intermedia_edad_sexo: get('base_intermedia_edad_sexo') || [],
    coef_medicamentos: Number(get('coef_medicamentos')) || 0,
    coef_preexistentes: Number(get('coef_preexistentes')) || 0,
    coef_complicaciones: Number(get('coef_complicaciones')) || 0,
    coef_vip: Number(get('coef_vip')) || 0,
    coef_antiguedad: Number(get('coef_antiguedad')) || 0,
    coef_emergencia_ext: Number(get('coef_emergencia_ext')) || 0,
    coef_enf_graves_ext: Number(get('coef_enf_graves_ext')) || 0,
    coef_ayuda_diaria: Number(get('coef_ayuda_diaria')) || 0,
    coef_ampliacion_servicios: Number(get('coef_ampliacion_servicios')) || 0,
    denominador_cargas: get('denominador_cargas') || [],
    deducible_accidente_keys: get('deducible_accidente_keys') || [],
    deducible_accidente_factors: get('deducible_accidente_factors') || [],
    multiregion_carga_sistema: get('multiregion_carga_sistema') || [],
    cobertura_internacional_carga_sistema: get('cobertura_internacional_carga_sistema') || [],
    maternidad_tasa_por_edad: get('maternidad_tasa_por_edad') || [],
    maternidad_threshold: Number(get('maternidad_threshold')) || 15000,
    indemnizacion_eg_tabla: get('indemnizacion_eg_tabla') || [],
    indemnizacion_eg_monto: Number(get('indemnizacion_eg_monto')) || 0,
    xtensuz_factor: get('xtensuz_factor') || [],
    gastos_expedicion: Number(get('gastos_expedicion')) || 0,
    iva: 0.16,
  };
}
