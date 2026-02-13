import { supabase } from './supabase';

export interface SicasDocument {
  id: string;
  id_docto: string;
  vend_id: string | null;
  vend_nombre: string | null;
  usuario_id: string | null;
  oficina_id: string | null;
  desp_nombre: string | null;
  ramo: string | null;
  subramo: string | null;
  compania: string | null;
  poliza: string | null;
  cliente: string | null;
  fecha_captura: string | null;
  fecha_emision: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  importe: number | null;
  prima_neta: number | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface SicasCommission {
  id: string;
  source: 'pendiente' | 'pagada';
  period_key: string;
  vend_id: string | null;
  vend_nombre: string | null;
  usuario_id: string | null;
  oficina_id: string | null;
  id_docto: string | null;
  documento_poliza: string | null;
  importe: number | null;
  base_comision: number | null;
  comision: number | null;
  isr: number | null;
  iva: number | null;
  retenciones: number | null;
  neto_pagar: number | null;
  fecha_pago: string | null;
  fecha_corte: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface SicasReceivable {
  id: string;
  vend_id: string | null;
  vend_nombre: string | null;
  usuario_id: string | null;
  oficina_id: string | null;
  id_docto: string | null;
  poliza: string | null;
  cliente: string | null;
  importe_pendiente: number | null;
  importe_original: number | null;
  fecha_limite: string | null;
  fecha_vencimiento: string | null;
  estatus: string | null;
  dias_vencido: number | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface SicasDigitalFile {
  FileName: string;
  FileExtension: string;
  FileSize?: number;
  FileData?: string;
  DocumentDate?: string;
  UploadDate?: string;
  Description?: string;
}

export interface SyncRun {
  run_id: string;
  module: string;
  keycode: string;
  report_name: string | null;
  from_date: string | null;
  to_date: string | null;
  pages_requested: number;
  items_per_page: number;
  records_fetched: number;
  records_upserted: number;
  records_failed: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

export async function getMyDocuments(filters?: {
  fromDate?: string;
  toDate?: string;
  ramo?: string;
  compania?: string;
}): Promise<SicasDocument[]> {
  let query = supabase
    .from('sicas_documents')
    .select('*')
    .order('fecha_captura', { ascending: false });

  if (filters?.fromDate) {
    query = query.gte('fecha_captura', filters.fromDate);
  }
  if (filters?.toDate) {
    query = query.lte('fecha_captura', filters.toDate);
  }
  if (filters?.ramo) {
    query = query.eq('ramo', filters.ramo);
  }
  if (filters?.compania) {
    query = query.eq('compania', filters.compania);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }

  return data || [];
}

export async function getMyCommissions(source: 'pendiente' | 'pagada'): Promise<SicasCommission[]> {
  const { data, error } = await supabase
    .from('sicas_commissions')
    .select('*')
    .eq('source', source)
    .order('fecha_corte', { ascending: false });

  if (error) {
    console.error('Error fetching commissions:', error);
    throw error;
  }

  return data || [];
}

export async function getMyReceivables(): Promise<SicasReceivable[]> {
  const { data, error } = await supabase
    .from('sicas_receivables')
    .select('*')
    .eq('estatus', 'pendiente')
    .order('fecha_limite', { ascending: true });

  if (error) {
    console.error('Error fetching receivables:', error);
    throw error;
  }

  return data || [];
}

export async function getDocumentsPendingRenewal(daysAhead: number = 30): Promise<SicasDocument[]> {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('sicas_documents')
    .select('*')
    .gte('vigencia_hasta', today.toISOString())
    .lte('vigencia_hasta', futureDate.toISOString())
    .order('vigencia_hasta', { ascending: true });

  if (error) {
    console.error('Error fetching documents pending renewal:', error);
    throw error;
  }

  return data || [];
}

export async function getDigitalFiles(idDocto: string, skipCache: boolean = false): Promise<{
  success: boolean;
  files: SicasDigitalFile[];
  cached?: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-get-digital-files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idDocto,
      skipCache,
    }),
  });

  return await response.json();
}

export async function syncDocuments(params?: {
  keyCode?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ success: boolean; run_id?: string; summary?: any; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync-documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params || {}),
  });

  return await response.json();
}

export async function syncCommissions(source: 'pendiente' | 'pagada'): Promise<{
  success: boolean;
  run_id?: string;
  summary?: any;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync-commissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  });

  return await response.json();
}

export async function syncReceivables(): Promise<{
  success: boolean;
  run_id?: string;
  summary?: any;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync-receivables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await response.json();
}

export async function getLastSyncRun(module: string): Promise<SyncRun | null> {
  const { data, error } = await supabase
    .from('sicas_sync_runs')
    .select('*')
    .eq('module', module)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching last sync run:', error);
    return null;
  }

  return data;
}

export async function getSyncHistory(module?: string, limit: number = 10): Promise<SyncRun[]> {
  let query = supabase
    .from('sicas_sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (module) {
    query = query.eq('module', module);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sync history:', error);
    return [];
  }

  return data || [];
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

export function getDaysUntilRenewal(vigenciaHasta: string | null): number | null {
  if (!vigenciaHasta) return null;
  const today = new Date();
  const renewalDate = new Date(vigenciaHasta);
  const diffTime = renewalDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
