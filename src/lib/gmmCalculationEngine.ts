/**
 * Motor de cálculo GMM BX+
 * Replica exactamente la lógica del Excel
 */

import type {
  QuoteInput,
  QuoteCalculationResult,
  InsuredCalculation,
  TariffTables,
} from './gmmTypes';

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundTo5Decimals(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function vlookup(table: any[], key: any, valueCol: number = 1): number {
  const row = table.find(r => r.col_0 === key);
  if (!row) throw new Error(`Key "${key}" not found in table`);
  return Number(row[`col_${valueCol}`] || 0);
}

function vlookupByAge(table: any[], edad: number, sexo: string): number {
  const row = table.find(r => Number(r.col_0) === edad);
  if (!row) throw new Error(`Age ${edad} not found`);
  const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
  return Number(row[col] || 0);
}

export function calculateQuote(
  input: QuoteInput,
  tables: TariffTables
): QuoteCalculationResult {
  const factorEstado = vlookup(tables.factor_estado, input.estado);
  const factorNivel = vlookup(tables.factor_nivel_hospitalario, input.nivel_hospitalario);
  const factorTabulador = vlookup(tables.factor_tabulador, input.tabulador);
  const factorSA = vlookup(tables.factor_suma_asegurada, input.suma_asegurada);
  const factorDeducible = vlookup(tables.factor_deducible, input.deducible);
  const factorCoaseguro = vlookup(tables.factor_coaseguro, input.coaseguro);

  const topeCoaseguro = vlookup(tables.tope_coaseguro, input.coaseguro);

  const formaPago = tables.forma_pago.find(r => r.col_0 === input.forma_pago);
  if (!formaPago) throw new Error(`Forma de pago "${input.forma_pago}" not found`);
  const factorFormaPago = Number(formaPago.col_1 || 0);
  const numRecibos = Number(formaPago.col_2 || 1);

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
    insureds,
    prima_neta_total: primaNetaTotal,
    recargo,
    gastos_expedicion: gastosExpedicion,
    subtotal,
    iva,
    total,
    primer_recibo: primerRecibo,
    recibos_subsecuentes: recibosSubsecuentes,
    num_recibos: numRecibos,
    tope_coaseguro: topeCoaseguro,
  };
}

export function loadTariffTables(tables: any[]): TariffTables {
  const get = (key: string) => tables.find(t => t.table_key === key)?.data_json;

  return {
    factor_estado: get('factor_estado') || [],
    factor_nivel_hospitalario: get('factor_nivel_hospitalario') || [],
    factor_tabulador: get('factor_tabulador') || [],
    factor_suma_asegurada: get('factor_suma_asegurada') || [],
    factor_deducible: get('factor_deducible') || [],
    factor_coaseguro: get('factor_coaseguro') || [],
    tope_coaseguro: get('tope_coaseguro') || [],
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
