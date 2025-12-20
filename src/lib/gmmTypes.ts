/**
 * Tipos para el módulo GMM BX+
 */

export type TariffPackageStatus = 'draft' | 'active' | 'archived' | 'failed';

export interface TariffPackage {
  id: string;
  name: string;
  source_filename: string;
  source_hash: string;
  source_url: string | null;
  status: TariffPackageStatus;
  validation_errors: any | null;
  created_at: string;
  created_by: string | null;
  activated_at: string | null;
  activated_by: string | null;
  notes: string | null;
}

export interface TariffTable {
  id: string;
  tariff_package_id: string;
  table_key: string;
  data_json: any;
  row_count: number | null;
  created_at: string;
}

export interface GMMQuote {
  id: string;
  tariff_package_id: string;
  quote_number: string | null;

  zona: string;
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro: number;
  forma_pago: string;
  num_recibos: number;

  cob_reconocimiento_antiguedad: boolean;
  cob_medicamentos_fuera: boolean;
  cob_complicaciones_no_amparadas: boolean;
  cob_padecimientos_preexistentes: boolean;
  cob_eliminacion_deducible_accidente: boolean;
  cob_multiregion: boolean;
  cob_vip: boolean;
  cob_emergencia_medica_extranjero: boolean;
  cob_enfermedades_graves_extranjero: boolean;
  cob_cobertura_internacional: boolean;
  cob_ampliacion_servicios: boolean;
  cob_ayuda_diaria: boolean;
  cob_indemnizacion_eg: boolean;
  cob_maternidad: boolean;
  cob_xtensuz: boolean;

  monto_maternidad: number | null;
  monto_xtensuz: number | null;

  prima_neta_total: number;
  recargo: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total: number;

  primer_recibo: number;
  recibos_subsecuentes: number | null;

  input_json: any;
  result_json: any;

  pdf_url: string | null;

  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface GMMQuoteInsured {
  id: string;
  quote_id: string;
  orden: number;

  nombre: string;
  sexo: 'Hombre' | 'Mujer';
  edad: number;

  prima_base: number;
  prima_adicionales: number;
  prima_xtensuz: number;
  prima_total: number;

  adicionales_json: any | null;
  coberturas_adicionales?: Record<string, number>;
  adicionales_detalle?: Record<string, number>;

  created_at: string;
}

export interface QuoteInputInsured {
  nombre: string;
  sexo: 'Hombre' | 'Mujer';
  edad: number;
}

export interface QuoteInput {
  zona: string;
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro_seleccionado?: number;
  formas_pago: string[];

  insureds: QuoteInputInsured[];

  coberturas: {
    reconocimiento_antiguedad?: boolean;
    medicamentos_fuera?: boolean;
    complicaciones_no_amparadas?: boolean;
    padecimientos_preexistentes?: boolean;
    eliminacion_deducible_accidente?: boolean;
    multiregion?: boolean;
    vip?: boolean;
    emergencia_medica_extranjero?: boolean;
    enfermedades_graves_extranjero?: boolean;
    cobertura_internacional?: boolean;
    ampliacion_servicios?: boolean;
    ayuda_diaria?: boolean;
    indemnizacion_eg?: boolean;
    maternidad?: boolean;
    xtensuz?: boolean;
  };

  montos?: {
    maternidad?: number;
    xtensuz?: number;
  };
}

export interface InsuredCalculation {
  nombre: string;
  sexo: 'Hombre' | 'Mujer';
  edad: number;
  prima_base: number;
  prima_adicionales: number;
  adicionales_detalle: Record<string, number>;
  prima_xtensuz: number;
  prima_total: number;
}

export interface PaymentPlanResult {
  forma_pago: string;
  recargo: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_recibo: number;
  recibos_subsecuentes: number;
  num_recibos: number;
}

export interface QuoteCalculationResult {
  insureds: InsuredCalculation[];
  prima_neta_total: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total_con_iva: number;
  tope_coaseguro: number;
  payment_plans: PaymentPlanResult[];
}

export interface TopeCoaseguroRango {
  coaseguro: string;
  tope_min: number;
  tope_max: number;
  tope_default?: number;
}

export interface TariffTables {
  factor_estado: any[];
  factor_nivel_hospitalario: any[];
  factor_tabulador: any[];
  factor_suma_asegurada: any[];
  factor_deducible: any[];
  factor_coaseguro: any[];
  tope_coaseguro: any[];
  tope_coaseguro_rangos?: TopeCoaseguroRango[];
  forma_pago: any[];
  base_intermedia_edad_sexo: any[];
  coef_medicamentos: number;
  coef_preexistentes: number;
  coef_complicaciones: number;
  coef_vip: number;
  coef_antiguedad: number;
  coef_emergencia_ext: number;
  coef_enf_graves_ext: number;
  coef_ayuda_diaria: number;
  coef_ampliacion_servicios: number;
  denominador_cargas: number[];
  // denominador_cargas_coberturas YA NO SE USA - ahora se calcula dinámicamente
  // Fórmula: 0.350445 + 0.702939 × (factor_deducible × factor_coaseguro)
  deducible_accidente_keys: any[];
  deducible_accidente_factors: any[];
  multiregion_carga_sistema: any[];
  cobertura_internacional_carga_sistema: any[];
  maternidad_tasa_por_edad: any[];
  maternidad_threshold: number;
  indemnizacion_eg_tabla: any[];
  indemnizacion_eg_monto: number;
  xtensuz_factor: any[];
  gastos_expedicion: number;
  iva: number;
}

export interface ExcelRangeDefinition {
  sheet: string;
  range: string;
  type: 'table' | 'value' | 'array';
}

export const EXCEL_RANGES: Record<string, ExcelRangeDefinition> = {
  factor_estado: { sheet: 'Tarifa', range: 'W4:Y38', type: 'table' },
  factor_nivel_hospitalario: { sheet: 'Tarifa', range: 'AA4:AB6', type: 'table' },
  factor_tabulador: { sheet: 'Tarifa', range: 'AA11:AB16', type: 'table' },
  factor_suma_asegurada: { sheet: 'Tarifa', range: 'N4:O9', type: 'table' },
  factor_deducible: { sheet: 'Tarifa', range: 'Q4:R14', type: 'table' },
  factor_coaseguro: { sheet: 'Tarifa', range: 'T4:U8', type: 'table' },
  tope_coaseguro: { sheet: 'Tarifa', range: 'T13:U17', type: 'table' },
  forma_pago: { sheet: 'Tarifa', range: 'BL31:BN35', type: 'table' },
  base_intermedia_edad_sexo: { sheet: 'Tarifa', range: 'C3:E110', type: 'table' },
  coef_medicamentos: { sheet: 'Tarifa', range: 'AJ3', type: 'value' },
  coef_preexistentes: { sheet: 'Tarifa', range: 'AJ7', type: 'value' },
  coef_complicaciones: { sheet: 'Tarifa', range: 'AJ11', type: 'value' },
  coef_vip: { sheet: 'Tarifa', range: 'BI3', type: 'value' },
  coef_antiguedad: { sheet: 'Tarifa', range: 'BI7', type: 'value' },
  coef_emergencia_ext: { sheet: 'Tarifa', range: 'AW3', type: 'value' },
  coef_enf_graves_ext: { sheet: 'Tarifa', range: 'AW7', type: 'value' },
  coef_ayuda_diaria: { sheet: 'Tarifa', range: 'BC3', type: 'value' },
  coef_ampliacion_servicios: { sheet: 'Tarifa', range: 'BC7', type: 'value' },
  denominador_cargas: { sheet: 'Tarifa', range: 'L4:L6', type: 'array' },
  deducible_accidente_keys: { sheet: 'Tarifa', range: 'AU15:AU23', type: 'array' },
  deducible_accidente_factors: { sheet: 'Tarifa', range: 'AW15:AW23', type: 'array' },
  multiregion_carga_sistema: { sheet: 'Tarifa', range: 'AQ42:AS74', type: 'table' },
  cobertura_internacional_carga_sistema: { sheet: 'Tarifa', range: 'AY42:BA76', type: 'table' },
  maternidad_tasa_por_edad: { sheet: 'Tarifa', range: 'AN18:AO68', type: 'table' },
  maternidad_threshold: { sheet: 'Tarifa', range: 'CU2', type: 'value' },
  indemnizacion_eg_tabla: { sheet: 'Tarifa', range: 'BE3:BG50', type: 'table' },
  indemnizacion_eg_monto: { sheet: 'Tarifa', range: 'DK2', type: 'value' },
  xtensuz_factor: { sheet: 'Tarifa', range: 'AJ15:AK18', type: 'table' },
  gastos_expedicion: { sheet: 'Cotizacion', range: 'O67', type: 'value' },
  iva: { sheet: 'Cotizacion', range: 'O69', type: 'value' },
};

// ============================================================================
// COTIZACIONES COMPARATIVAS - MÚLTIPLES OPCIONES
// ============================================================================

/**
 * Plan de una opción individual (sin asegurados)
 */
export interface QuoteOptionPlan {
  zona: string;
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro_seleccionado?: number;
  formas_pago: string[];
  montos?: {
    maternidad?: number;
    xtensuz?: number;
  };
}

/**
 * Coberturas de una opción individual
 */
export interface QuoteOptionCoberturas {
  reconocimiento_antiguedad?: boolean;
  medicamentos_fuera?: boolean;
  complicaciones_no_amparadas?: boolean;
  padecimientos_preexistentes?: boolean;
  eliminacion_deducible_accidente?: boolean;
  multiregion?: boolean;
  vip?: boolean;
  emergencia_medica_extranjero?: boolean;
  enfermedades_graves_extranjero?: boolean;
  cobertura_internacional?: boolean;
  ampliacion_servicios?: boolean;
  ayuda_diaria?: boolean;
  indemnizacion_eg?: boolean;
  maternidad?: boolean;
  xtensuz?: boolean;
}

/**
 * Una opción de cotización (plan + coberturas)
 */
export interface QuoteOption {
  plan: QuoteOptionPlan;
  coberturas: QuoteOptionCoberturas;
}

/**
 * Input para cotización con múltiples opciones
 * Asegurados comunes + array de opciones (1 a 3)
 */
export interface QuoteInputMultiOption {
  insureds: QuoteInputInsured[];
  options: QuoteOption[];
}

/**
 * Resultado de una opción calculada
 */
export interface QuoteOptionResult {
  totales: {
    prima_neta: number;
    gastos_expedicion: number;
    subtotal: number;
    iva: number;
    total_pagar: number;
    forma_pago: string;
    recargo: number;
    primer_recibo: number;
    recibos_subsecuentes: number | null;
  };
  insureds: InsuredCalculation[];
  plan: QuoteOptionPlan;
  coberturas: QuoteOptionCoberturas;
}

/**
 * Resultado de cotización con múltiples opciones calculadas
 */
export interface QuoteCalculationMultiResult {
  options: QuoteOptionResult[];
  tariff_package_id: string;
  fecha_cotizacion: string;
}
