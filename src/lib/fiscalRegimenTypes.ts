export type RegimenCodigo = 'asimilados' | 'honorarios' | 'resico';
export type RuleEstado = 'activo' | 'borrador' | 'inactivo';
export type ConceptoCodigo =
  | 'comision_gravada'
  | 'comision_exenta'
  | 'comision_total'
  | 'iva'
  | 'ret_isr'
  | 'ret_iva'
  | 'ret_contable'
  | 'costo_dispersion'
  | 'total_fiscal'
  | 'total_final';

export type BaseCodigo = 'comision_gravada' | 'comision_exenta' | 'comision_total' | 'iva' | 'none';
export type TipoRegla = 'porcentaje' | 'formula' | 'fijo' | 'derivado';
export type SignoResultado = 'positivo' | 'negativo' | 'neutro';

export interface FiscalRegimenRule {
  id: string;
  regimen_codigo: RegimenCodigo;
  nombre_regimen: string;
  version: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  estado: RuleEstado;
  notas: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface FiscalRegimenRuleLine {
  id: string;
  fiscal_regime_rule_id: string;
  concepto_codigo: ConceptoCodigo;
  concepto_nombre: string;
  base_codigo: BaseCodigo;
  tipo_regla: TipoRegla;
  valor_porcentaje: number | null;
  formula_texto: string | null;
  signo_resultado: SignoResultado;
  orden_visual: number;
  mostrar_en_pdf: boolean;
  mostrar_en_ui: boolean;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalRegimenRuleWithLines extends FiscalRegimenRule {
  lines: FiscalRegimenRuleLine[];
}

export interface DynamicFiscalResult {
  regimenCodigo: RegimenCodigo;
  ruleId: string;
  ruleVersion: string;
  comisionGravada: number;
  comisionExenta: number;
  comisionTotal: number;
  iva: number;
  retIsr: number;
  retIva: number;
  retContable: number;
  costoDispersion: number;
  totalFiscal: number;
  totalFinal: number;
  lineResults: Record<ConceptoCodigo, number>;
}

export const CONCEPTO_LABELS: Record<ConceptoCodigo, string> = {
  comision_gravada: 'Comisión Gravada',
  comision_exenta: 'Comisión Exenta',
  comision_total: 'Comisión Total',
  iva: 'IVA',
  ret_isr: 'Ret. ISR',
  ret_iva: 'Ret. IVA',
  ret_contable: 'Ret. Contable',
  costo_dispersion: 'Costo Dispersión',
  total_fiscal: 'Total Fiscal',
  total_final: 'Total Final',
};

export const BASE_LABELS: Record<BaseCodigo, string> = {
  comision_gravada: 'Comisión Gravada',
  comision_exenta: 'Comisión Exenta',
  comision_total: 'Comisión Total',
  iva: 'IVA',
  none: 'N/A',
};

export const TIPO_REGLA_LABELS: Record<TipoRegla, string> = {
  porcentaje: 'Porcentaje',
  formula: 'Fórmula',
  fijo: 'Valor Fijo',
  derivado: 'Derivado',
};

export const REGIMEN_LABELS: Record<RegimenCodigo, string> = {
  honorarios: 'Honorarios',
  resico: 'RESICO',
  asimilados: 'Asimilados a Salarios',
};

export const FORMULA_VARIABLES = [
  'comision_gravada',
  'comision_exenta',
  'comision_total',
  'iva',
  'ret_isr',
  'ret_iva',
  'ret_contable',
  'costo_dispersion',
  'total_fiscal',
  'total_final',
] as const;
