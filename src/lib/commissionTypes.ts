export interface CommissionOffice {
  id: string;
  name: string;
  created_at: string;
}

export interface CommissionFiscalRegime {
  id: string;
  name: string;
  iva_trasladado: number;
  iva_retenido: number;
  isr: number;
  otros_json: Record<string, number>;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export interface CommissionAgent {
  id: string;
  name: string;
  email: string;
  office_id: string | null;
  fiscal_regime_id: string | null;
  usuario_id: string | null;
  created_at: string;
  office?: CommissionOffice;
  fiscal_regime?: CommissionFiscalRegime;
  usuario?: {
    id: string;
    regimen_fiscal_id: string | null;
    regimen_fiscal?: CommissionFiscalRegime;
  };
}

export interface CommissionBusinessRule {
  id: string;
  ramo: string;
  aseguradora: string;
  office_id: string | null;
  campo_base: string;
  tipo_calculo: '%_sobre_base' | 'monto_fijo' | '%_con_min_max' | 'usar_portpart';
  porcentaje: number | null;
  monto_fijo: number | null;
  minimo: number | null;
  maximo: number | null;
  prioridad: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export interface CommissionBatch {
  id: string;
  name: string;
  display_name?: string;
  date_from?: string;
  date_to?: string;
  period_start?: string;
  period_end?: string;
  uploaded_by?: string | null;
  status: 'draft' | 'closed';
  rules_version?: string | null;
  source_file?: string | null;
  total_commission?: number;
  created_at: string;
  updated_at?: string;
}

export interface CommissionDetail {
  id: string;
  batch_id: string;
  agent_id: string;
  ramo: string;
  aseguradora: string;
  office_id: string | null;
  poliza: string;
  nombre_asegurado: string | null;
  prima_neta: number;
  importe_base: number;
  porcentaje_comision: number;
  concepto: string | null;
  date_fpago: string;
  commission_bruta: number;
  commission_neta: number;
  is_manual_adjusted: boolean;
  adjusted_by_user_id: string | null;
  adjusted_at: string | null;
  adjusted_commission_neta: number | null;
  adjust_reason: string | null;
  raw_row: Record<string, any>;
  created_at: string;
  agent?: CommissionAgent;
  tipo_ramo?: 'VIDA' | 'DAÑOS' | null;
  costo_dispersion?: number | null;
  asimilados_retencion_contable?: number | null;
  asimilados_base_vida?: number | null;
  asimilados_comision_vida?: number | null;
  asimilados_base_danios_pre?: number | null;
  asimilados_base_danios_sin_iva?: number | null;
  asimilados_comision_danios?: number | null;
  asimilados_isr_vida?: number | null;
  asimilados_isr_danios?: number | null;
  asimilados_isr_total?: number | null;
  asimilados_comision_final?: number | null;
}

export interface CommissionError {
  id: string;
  batch_id: string;
  error_type: 'agent_not_found' | 'rule_not_found' | 'invalid_data' | 'other';
  email_agente: string | null;
  poliza: string | null;
  detalle: string;
  raw_row: Record<string, any>;
  resolved: boolean;
  created_at: string;
}

export interface WeekSummary {
  weekNumber: number;
  dateFrom: string;
  dateTo: string;
  count: number;
  selected: boolean;
}

export interface BatchSummary {
  total_bruta: number;
  total_impuestos: number;
  total_neta: number;
  total_polizas: number;
  by_ramo: Record<string, {
    bruta: number;
    impuestos: number;
    neta: number;
    count: number;
  }>;
  by_aseguradora: Record<string, {
    bruta: number;
    impuestos: number;
    neta: number;
    count: number;
  }>;
}

export interface AgentSummary {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  office_name: string | null;
  regime_name: string | null;
  total_commission: number;
  total_polizas: number;
}
