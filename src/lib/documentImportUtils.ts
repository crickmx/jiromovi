import { supabase } from './supabase';
import type {
  DocumentImportBatch,
  ImportedDocument,
  UnmatchedVendorGroup,
  AssignVendorRequest,
  AssignVendorResponse,
  MatchedVendorGroup,
  ReassignUserRequest,
  ReassignUserResponse,
} from './documentImportTypes';

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}

export function normalizeName(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return null;

  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ');

  const accentMap: Record<string, string> = {
    á: 'a',
    é: 'e',
    í: 'i',
    ó: 'o',
    ú: 'u',
    ñ: 'n',
    ü: 'u',
    Á: 'a',
    É: 'e',
    Í: 'i',
    Ó: 'o',
    Ú: 'u',
    Ñ: 'n',
    Ü: 'u',
  };

  normalized = normalized.replace(/[áéíóúñüÁÉÍÓÚÑÜ]/g, (match) => accentMap[match] || match);

  return normalized;
}

export function calculateVendorKey(
  vendorEmail: string | null | undefined,
  vendorName: string | null | undefined
): string {
  const normalizedEmail = normalizeEmail(vendorEmail);
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  const normalizedName = normalizeName(vendorName);
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return 'unknown';
}

export async function getBatchById(batchId: string): Promise<DocumentImportBatch | null> {
  const { data, error } = await supabase
    .from('document_import_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (error) {
    console.error('Error al obtener batch:', error);
    return null;
  }

  return data;
}

export async function getAllBatches(): Promise<DocumentImportBatch[]> {
  const { data, error } = await supabase
    .from('document_import_batches')
    .select('*')
    .order('imported_at', { ascending: false });

  if (error) {
    console.error('Error al obtener batches:', error);
    return [];
  }

  return data || [];
}

export async function getDocumentsByBatchId(batchId: string): Promise<ImportedDocument[]> {
  const { data, error } = await supabase
    .from('imported_documents')
    .select('*')
    .eq('batch_id', batchId)
    .order('source_row_index', { ascending: true });

  if (error) {
    console.error('Error al obtener documentos:', error);
    return [];
  }

  return data || [];
}

export async function getUnmatchedVendorGroups(
  batchId: string
): Promise<UnmatchedVendorGroup[]> {
  const { data, error } = await supabase.rpc('get_unmatched_vendors_by_name', {
    p_batch_id: batchId,
  });

  if (error) {
    console.error('Error al obtener vendedores no reconocidos:', error);
    return [];
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map((group: any) => {
    const displayValue = group.vendor_display_name || 'Sin información';
    const vendorNameNorm = group.vendor_name_norm || 'unknown';
    const emailsDetected = group.emails_detected || [];
    const isUnknown = vendorNameNorm === 'unknown';

    return {
      vendor_key: vendorNameNorm,
      type: isUnknown ? 'unknown' : 'name',
      display_value: displayValue,
      document_count: Number(group.document_count),
      sample_documents: group.example_documents
        ? group.example_documents.slice(0, 10).map((doc: any) => doc.document_id)
        : [],
      vendor_name_raw: displayValue,
      vendor_email_raw: emailsDetected.length > 0 ? emailsDetected[0] : undefined,
      emails_detected: emailsDetected,
      example_documents: group.example_documents || [],
    };
  });
}

export async function assignVendorToUser(
  request: AssignVendorRequest
): Promise<AssignVendorResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  const { data, error } = await supabase.rpc('assign_vendor_by_name', {
    p_batch_id: request.batch_id,
    p_vendor_name_norm: request.vendor_key,
    p_movi_user_id: request.movi_user_id,
    p_save_mapping: request.save_mapping,
    p_created_by: userId || null,
  });

  if (error) {
    console.error('Error al asignar vendedor:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('No se recibió respuesta de la asignación');
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    success: true,
    updated_count: result.updated_count || 0,
    mapping_saved: result.mapping_saved || false,
  };
}

export async function getMatchedVendorGroups(
  batchId: string
): Promise<MatchedVendorGroup[]> {
  const { data, error } = await supabase.rpc('get_matched_vendors_by_name', {
    p_batch_id: batchId,
  });

  if (error) {
    console.error('Error al obtener vendedores reconocidos:', error);
    return [];
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map((group: any) => ({
    movi_user_id: group.movi_user_id,
    user_name: group.user_name || 'Sin nombre',
    user_email: group.user_email || 'Sin email',
    document_count: Number(group.document_count),
    vendor_names_detected: group.vendor_names_detected || [],
    vendor_emails_detected: group.vendor_emails_detected || [],
    example_documents: group.example_documents || [],
  }));
}

export async function reassignUserDocuments(
  request: ReassignUserRequest
): Promise<ReassignUserResponse> {
  const { data, error } = await supabase.rpc('reassign_user_documents', {
    p_batch_id: request.batch_id,
    p_old_user_id: request.old_user_id,
    p_new_user_id: request.new_user_id,
    p_save_mapping: request.save_mapping,
  });

  if (error) {
    console.error('Error al reasignar documentos:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('No se recibió respuesta de la reasignación');
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    success: true,
    updated_count: result.updated_count || 0,
    mapping_saved: result.mapping_saved || false,
  };
}

export async function getAllMoviUsers() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email_laboral, email_personal, oficina_id, rol')
    .eq('activo', true)
    .order('nombre_completo', { ascending: true });

  if (error) {
    console.error('Error al obtener usuarios:', error);
    return [];
  }

  return (data || []).map(user => ({
    id: user.id,
    nombre_completo: user.nombre_completo,
    email: user.email_laboral || user.email_personal || 'Sin email',
    rol: user.rol
  }));
}

export async function searchMoviUsers(query: string) {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return getAllMoviUsers();
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email_laboral, email_personal, oficina_id, rol')
    .eq('activo', true)
    .or(
      `nombre_completo.ilike.%${normalizedQuery}%,email_laboral.ilike.%${normalizedQuery}%,email_personal.ilike.%${normalizedQuery}%`
    )
    .order('nombre_completo', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error al buscar usuarios:', error);
    return [];
  }

  return (data || []).map(user => ({
    id: user.id,
    nombre_completo: user.nombre_completo,
    email: user.email_laboral || user.email_personal || 'Sin email',
    rol: user.rol
  }));
}

export function getVendorGroupLabel(group: UnmatchedVendorGroup): string {
  if (group.type === 'name' && group.vendor_name_raw) {
    return group.vendor_name_raw;
  }
  return group.display_value;
}

export async function getDocumentsByVendorGroup(
  batchId: string,
  vendorKey: string,
  limit: number = 10,
  offset: number = 0
) {
  const { data, error } = await supabase.rpc('get_documents_by_vendor_key', {
    p_batch_id: batchId,
    p_vendor_key: vendorKey,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('Error al obtener documentos del grupo:', error);
    return [];
  }

  return data || [];
}

export async function deleteBatch(batchId: string) {
  const { data, error } = await supabase.rpc('delete_import_batch', {
    p_batch_id: batchId,
  });

  if (error) {
    console.error('Error al eliminar batch:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('No se recibió respuesta al eliminar el batch');
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result.success) {
    throw new Error(result.error || 'Error al eliminar el batch');
  }

  return {
    success: true,
    documents_deleted: result.documents_deleted,
  };
}

export interface BatchConversionValidation {
  can_convert: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    total_documents: number;
    unmatched_documents?: number;
    total_agents: number;
    weeks: Array<{
      week_number: number;
      week_start: string;
      week_end: string;
      document_count: number;
      agent_count: number;
    }>;
  };
}

export interface ConversionResult {
  success: boolean;
  message: string;
  batches: Array<{
    id: string;
    week_number: number;
    period_start: string;
    period_end: string;
    document_count: number;
  }>;
}

export async function validateBatchForConversion(
  batchId: string
): Promise<BatchConversionValidation> {
  const { data, error } = await supabase.rpc('validate_batch_for_conversion', {
    batch_id_param: batchId,
  });

  if (error) {
    console.error('Error al validar batch para conversión:', error);
    throw error;
  }

  return data as BatchConversionValidation;
}

export async function convertBatchToCommissions(
  batchId: string
): Promise<ConversionResult> {
  const { data: session } = await supabase.auth.getSession();

  if (!session?.session?.access_token) {
    throw new Error('No hay sesión activa');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convert-import-to-commission-batches/${batchId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al convertir batch');
  }

  const result = await response.json();
  return result as ConversionResult;
}

export function getBatchStatusLabel(status: string): { text: string; color: string } {
  const statusMap: Record<string, { text: string; color: string }> = {
    uploaded: { text: 'Cargado', color: 'blue' },
    needs_mapping: { text: 'Pendiente de asignación', color: 'yellow' },
    ready_to_convert: { text: 'Listo para convertir', color: 'green' },
    converted: { text: 'Convertido', color: 'purple' },
    error: { text: 'Error', color: 'red' },
  };

  return statusMap[status] || { text: status, color: 'gray' };
}

export function formatWeekPeriod(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  const formatter = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
