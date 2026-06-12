export type ProductId = 'BXPLUS' | 'BNV' | 'BNP';
export type RelationType = 'Titular' | 'Conyuge' | 'Hijo' | 'Dependiente';
export type GenderType = 'Masculino' | 'Femenino';
export type RegionZone = 'Zona 1' | 'Zona 2';
export type FormaPago = 'Anual' | 'Semestral' | 'Trimestral' | 'Mensual';

export interface QuotePerson {
  id: string;
  name: string;
  relation: RelationType;
  gender: GenderType;
  age: number;
}

export interface ClientType {
  client_type: string;
  discount_factor: number;
}

export interface InternalFactor {
  factor_name: string;
  value: number;
}

// ========================
// BNV Types
// ========================

export interface BnvTariffPackage {
  id: string;
  product: 'BNV';
  version_name: string;
  source_filename: string | null;
  source_hash: string | null;
  status: 'draft' | 'active' | 'archived' | 'failed';
  derecho_poliza: number;
  asistencia_extranjero: number;
  sumas_aseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  topes_coaseguro: number[];
  client_types: ClientType[];
  internal_factors: InternalFactor[];
  rates_count: number;
  created_at: string;
}

export interface BnvQuoteInput {
  region_zone: RegionZone;
  suma_asegurada: number;
  deducible: number;
  coaseguro: number;
  tope_coaseguro: number;
  client_type: string;
  asistencia_extranjero: boolean;
  forma_pago: FormaPago;
}

export interface BnvPersonResult {
  person_id: string;
  person_name: string;
  relation: RelationType;
  age: number;
  lookup_key: string;
  base_rate: number;
  discounted_rate: number;
}

export interface BnvPaymentBreakdown {
  forma_pago: FormaPago;
  prima_neta: number;
  asistencia_extranjero: number;
  derecho_poliza: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_pago: number;
  pagos_subsecuentes: number;
  num_recibos: number;
}

export interface BnvCalculationResult {
  product: 'BNV';
  people_results: BnvPersonResult[];
  prima_anual_total: number;
  totals: Record<FormaPago, BnvPaymentBreakdown>;
  tariff_package_id: string;
  error?: string;
}

// ========================
// BNP Types
// ========================

export interface BnpTariffPackage {
  id: string;
  product: 'BNP';
  version_name: string;
  source_filename: string | null;
  source_hash: string | null;
  status: 'draft' | 'active' | 'archived' | 'failed';
  derecho_poliza: number;
  asistencia_extranjero: number;
  costo_catastrofica_extranjero: number;
  sumas_aseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  client_types: ClientType[];
  internal_factors: InternalFactor[];
  rates_count: number;
  created_at: string;
}

export interface BnpQuoteInput {
  region_zone: RegionZone;
  suma_asegurada: number;
  deducible: number;
  coaseguro: number;
  client_type: string;
  maternidad_titular: boolean;
  maternidad_conyuge: boolean;
  asistencia_extranjero: boolean;
  cobertura_catastrofica_extranjero: boolean;
  forma_pago: FormaPago;
}

export interface BnpPersonResult {
  person_id: string;
  person_name: string;
  relation: RelationType;
  age: number;
  gender: GenderType;
  lookup_key: string;
  annual_premium: number;
}

export interface BnpPaymentBreakdown {
  forma_pago: FormaPago;
  prima_neta: number;
  asistencia_extranjero: number;
  catastrofica_extranjero: number;
  derecho_poliza: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_pago: number;
  pagos_subsecuentes: number;
  num_recibos: number;
}

export interface BnpCalculationResult {
  product: 'BNP';
  people_results: BnpPersonResult[];
  prima_anual_total: number;
  totals: Record<FormaPago, BnpPaymentBreakdown>;
  tariff_package_id: string;
  error?: string;
}

// ========================
// BX+ Adapter Types
// ========================

export interface BxplusQuoteInput {
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  tope_coaseguro_seleccionado?: number;
  forma_pago: FormaPago;
}

export interface BxplusPaymentBreakdown {
  forma_pago: FormaPago;
  recargo: number;
  prima_neta: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_pago: number;
  pagos_subsecuentes: number;
  num_recibos: number;
}

export interface BxplusCalculationResult {
  product: 'BXPLUS';
  people_results: Array<{
    person_id: string;
    person_name: string;
    age: number;
    gender: GenderType;
    prima_base: number;
    prima_total: number;
  }>;
  prima_anual_total: number;
  totals: Record<FormaPago, BxplusPaymentBreakdown>;
  tariff_package_id: string;
  error?: string;
}

// ========================
// Unified Multi-Cotizador Types
// ========================

export type CarrierResult = BnvCalculationResult | BnpCalculationResult | BxplusCalculationResult;

export interface MultiGmmOption {
  product_id: ProductId;
  enabled: boolean;
  input: BnvQuoteInput | BnpQuoteInput | BxplusQuoteInput;
}

export interface MultiGmmQuoteInput {
  client_name: string;
  people: QuotePerson[];
  options: MultiGmmOption[];
  selected_formas_pago: FormaPago[];
}

export interface MultiGmmCalculationResults {
  options: CarrierResult[];
  fecha_cotizacion: string;
}

export interface SavedMultiGmmQuote {
  id: string;
  folio: string;
  created_by: string;
  client_name: string;
  people_json: QuotePerson[];
  options_json: MultiGmmOption[];
  results_json: CarrierResult[];
  selected_formas_pago: FormaPago[];
  status: 'draft' | 'calculated' | 'pdf_generated' | 'deleted';
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

// ========================
// Payment Factor Constants
// ========================

export const PAYMENT_FACTORS: Record<FormaPago, { factor: number; num_recibos: number }> = {
  Anual: { factor: 1.0, num_recibos: 1 },
  Semestral: { factor: 1.03, num_recibos: 2 },
  Trimestral: { factor: 1.05, num_recibos: 4 },
  Mensual: { factor: 1.07, num_recibos: 12 },
};

export const IVA_RATE = 0.16;

export const PRODUCT_LABELS: Record<ProductId, string> = {
  BXPLUS: 'BX+',
  BNV: 'Bupa Nacional Vital',
  BNP: 'Bupa Nacional Plus',
};

export const PRODUCT_COLORS: Record<ProductId, string> = {
  BXPLUS: '#0284c7',
  BNV: '#0d9488',
  BNP: '#7c3aed',
};
