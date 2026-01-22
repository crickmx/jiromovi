export type VendorMappingSourceType = 'email' | 'name';
export type VendorMappingStatus = 'active' | 'inactive';
export type VendorMatchMethod = 'direct_email' | 'mapping_email' | 'mapping_name' | 'manual' | 'none';

export interface VendorMapping {
  id: string;
  source_type: VendorMappingSourceType;
  source_value: string;
  source_raw_examples: Array<{
    email?: string;
    name?: string;
  }>;
  movi_user_id: string;
  status: VendorMappingStatus;
  created_by: string | null;
  updated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  usuarios?: {
    nombre_completo: string;
    email: string;
    nombre_sicas: string | null;
  };
}

export interface UnmatchedVendor {
  vendor_key: string;
  vendor_type: 'email' | 'name' | 'unknown';
  vendor_email: string;
  vendor_name: string;
  polizas_count: number;
  total_commission: number;
  example_polizas: Array<{
    id: string;
    poliza: string;
    ramo: string;
    aseguradora: string;
    prima_base: number;
    commission_neta: number;
  }>;
}

export interface VendorMappingApplyResult {
  total_processed: number;
  matched: number;
  still_unmatched: number;
}

export interface VendorAssignmentResult {
  updated_count: number;
  mapping_created: boolean;
}
