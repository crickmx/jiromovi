import { supabase } from './supabase';
import type {
  DocumentImportBatch,
  ImportedDocument,
  UnmatchedVendorGroup,
  AssignVendorRequest,
  AssignVendorResponse,
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

export async function getAllMoviUsers() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, oficina_id')
    .order('nombre_completo', { ascending: true });

  if (error) {
    console.error('Error al obtener usuarios:', error);
    return [];
  }

  return data || [];
}

export async function searchMoviUsers(query: string) {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return getAllMoviUsers();
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, oficina_id')
    .or(
      `nombre_completo.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`
    )
    .order('nombre_completo', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error al buscar usuarios:', error);
    return [];
  }

  return data || [];
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
