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
  const { data, error } = await supabase
    .from('imported_documents')
    .select('*')
    .eq('batch_id', batchId)
    .eq('is_unmatched', true);

  if (error) {
    console.error('Error al obtener vendedores no reconocidos:', error);
    return [];
  }

  const groupsMap = new Map<string, UnmatchedVendorGroup>();

  data?.forEach((doc) => {
    if (!groupsMap.has(doc.vendor_key)) {
      const type = doc.vendor_key.startsWith('email:')
        ? 'email'
        : doc.vendor_key.startsWith('name:')
        ? 'name'
        : 'unknown';

      const displayValue = doc.vendor_key.startsWith('email:')
        ? doc.vendor_key.substring(6)
        : doc.vendor_key.startsWith('name:')
        ? doc.vendor_key.substring(5)
        : 'Desconocido';

      groupsMap.set(doc.vendor_key, {
        vendor_key: doc.vendor_key,
        type,
        display_value: displayValue,
        document_count: 0,
        sample_documents: [],
        vendor_email_raw: doc.vendor_email_raw || undefined,
        vendor_name_raw: doc.vendor_name_raw || undefined,
      });
    }

    const group = groupsMap.get(doc.vendor_key)!;
    group.document_count++;
    if (group.sample_documents.length < 10) {
      group.sample_documents.push(doc.document_id);
    }
  });

  return Array.from(groupsMap.values()).sort((a, b) => b.document_count - a.document_count);
}

export async function assignVendorToUser(
  request: AssignVendorRequest
): Promise<AssignVendorResponse> {
  const { data, error } = await supabase.rpc('assign_vendor_to_user', {
    p_batch_id: request.batch_id,
    p_vendor_key: request.vendor_key,
    p_movi_user_id: request.movi_user_id,
    p_save_mapping: request.save_mapping,
  });

  if (error) {
    console.error('Error al asignar vendedor:', error);
    throw error;
  }

  return data as AssignVendorResponse;
}

export async function searchMoviUsers(query: string) {
  const normalizedQuery = query.toLowerCase().trim();

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email')
    .or(
      `nombre_completo.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`
    )
    .limit(20);

  if (error) {
    console.error('Error al buscar usuarios:', error);
    return [];
  }

  return data || [];
}

export function getVendorGroupLabel(group: UnmatchedVendorGroup): string {
  if (group.type === 'email' && group.vendor_email_raw) {
    return group.vendor_email_raw;
  }
  if (group.type === 'name' && group.vendor_name_raw) {
    return group.vendor_name_raw;
  }
  return group.display_value;
}
