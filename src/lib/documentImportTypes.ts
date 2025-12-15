export interface DocumentImportBatch {
  id: string;
  file_name: string;
  imported_by: string | null;
  imported_at: string;
  records_total: number;
  records_matched: number;
  records_unmatched: number;
  status: 'uploaded' | 'needs_mapping' | 'ready_to_convert' | 'converted' | 'error' | 'processing' | 'completed' | 'failed' | 'partial';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  converted_at?: string | null;
  conversion_summary?: Record<string, any>;
}

export type MatchMethod =
  | 'direct_email'
  | 'mapping_email'
  | 'mapping_name'
  | 'manual'
  | 'none';

export interface ImportedDocument {
  id: string;
  batch_id: string;
  source_row_index: number;
  document_id: string;
  vendor_email_raw: string | null;
  vendor_name_raw: string | null;
  vendor_email_norm: string | null;
  vendor_name_norm: string | null;
  vendor_key: string;
  movi_user_id: string | null;
  match_method: MatchMethod;
  is_unmatched: boolean;
  document_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UnmatchedVendorGroup {
  vendor_key: string;
  type: 'email' | 'name' | 'unknown';
  display_value: string;
  document_count: number;
  sample_documents: string[];
  vendor_email_raw?: string;
  vendor_name_raw?: string;
  emails_detected?: string[];
  example_documents?: any[];
}

export interface AssignVendorRequest {
  batch_id: string;
  vendor_key: string;
  movi_user_id: string;
  save_mapping: boolean;
}

export interface AssignVendorResponse {
  success: boolean;
  updated_count: number;
  mapping_saved: boolean;
}
