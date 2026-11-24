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

/**
 * Obtiene pólizas vigentes desde la tabla sincronizada
 */
export async function getMyDocuments(filters?: {
  fromDate?: string;
  toDate?: string;
  ramo?: string;
  compania?: string;
}): Promise<SicasDocument[]> {
  let query = supabase
    .from('sicas_polizas_vigentes')
    .select('*')
    .order('vigencia_desde', { ascending: false });

  if (filters?.ramo) {
    query = query.eq('ramo', filters.ramo);
  }
  if (filters?.compania) {
    query = query.eq('aseguradora', filters.compania);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }

  // Mapear a la interfaz esperada
  return (data || []).map((item: any) => ({
    id: item.id,
    id_docto: item.id_documento,
    vend_id: item.vend_id,
    vend_nombre: item.vend_nombre,
    usuario_id: item.usuario_id,
    oficina_id: item.oficina_id,
    desp_nombre: item.desp_nombre,
    ramo: item.ramo,
    subramo: item.subramo,
    compania: item.aseguradora,
    poliza: item.no_poliza,
    cliente: item.contratante || item.asegurado,
    fecha_captura: item.vigencia_desde,
    fecha_emision: item.vigencia_desde,
    vigencia_desde: item.vigencia_desde,
    vigencia_hasta: item.vigencia_hasta,
    importe: item.prima_total,
    prima_neta: item.prima_neta,
    synced_at: item.synced_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function getMyCommissions(source: 'pendiente' | 'pagada'): Promise<SicasCommission[]> {
  const { data, error } = await supabase
    .from('sicas_commissions')
    .select('*')
    .eq('source', source)
    .order('fecha_pago', { ascending: false });

  if (error) {
    console.error('Error fetching commissions:', error);
    throw error;
  }

  return data || [];
}

export async function getMyReceivables(): Promise<SicasReceivable[]> {
  const { data, error } = await supabase
    .from('sicas_cobranza_pendiente')
    .select('*')
    .order('dias_vencidos', { ascending: false });

  if (error) {
    console.error('Error fetching receivables:', error);
    throw error;
  }

  // Mapear a la interfaz esperada
  return (data || []).map((item: any) => ({
    id: item.id,
    vend_id: item.vend_id,
    vend_nombre: item.vend_nombre,
    usuario_id: item.usuario_id,
    oficina_id: item.oficina_id,
    id_docto: item.id_documento,
    poliza: item.no_poliza,
    cliente: item.cliente,
    importe_pendiente: item.importe_pendiente,
    importe_original: null,
    fecha_limite: item.fecha_limite,
    fecha_vencimiento: item.fecha_limite,
    estatus: item.status,
    dias_vencido: item.dias_vencidos,
    synced_at: item.created_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function getDocumentsPendingRenewal(daysAhead: number = 30): Promise<SicasDocument[]> {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  let query = supabase
    .from('sicas_renovaciones_proximas')
    .select('*')
    .lte('dias_para_vencer', daysAhead)
    .order('vigencia_hasta', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents pending renewal:', error);
    throw error;
  }

  // Mapear a la interfaz esperada
  return (data || []).map((item: any) => ({
    id: item.id || '',
    id_docto: item.id_documento,
    vend_id: item.vend_id,
    vend_nombre: item.vend_nombre,
    usuario_id: item.usuario_id,
    oficina_id: item.oficina_id,
    desp_nombre: null,
    ramo: item.ramo,
    subramo: null,
    compania: item.aseguradora,
    poliza: item.no_poliza,
    cliente: item.contratante,
    fecha_captura: null,
    fecha_emision: null,
    vigencia_desde: null,
    vigencia_hasta: item.vigencia_hasta,
    importe: item.prima_total,
    prima_neta: null,
    synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
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
  // Usar sicas_production_sync_log en lugar de sicas_sync_runs
  const { data, error } = await supabase
    .from('sicas_production_sync_log')
    .select('*')
    .eq('sync_type', 'polizas_vigentes')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last sync run:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Mapear al formato esperado
  return {
    run_id: data.id,
    module: 'documents',
    keycode: 'H03117',
    report_name: 'Pólizas Vigentes',
    from_date: null,
    to_date: null,
    pages_requested: 1,
    items_per_page: 200,
    records_fetched: data.records_fetched || 0,
    records_upserted: data.records_inserted || 0,
    records_failed: data.records_errors || 0,
    status: data.status as any,
    error_message: data.error_message,
    started_at: data.started_at,
    finished_at: data.completed_at,
    duration_seconds: null,
  } as SyncRun;
}

export async function getSyncHistory(module?: string, limit: number = 10): Promise<SyncRun[]> {
  let query = supabase
    .from('sicas_production_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (module) {
    query = query.eq('sync_type', 'polizas_vigentes');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sync history:', error);
    return [];
  }

  // Mapear al formato esperado
  return (data || []).map((item: any) => ({
    run_id: item.id,
    module: 'documents',
    keycode: 'H03117',
    report_name: 'Pólizas Vigentes',
    from_date: null,
    to_date: null,
    pages_requested: 1,
    items_per_page: 200,
    records_fetched: item.records_fetched || 0,
    records_upserted: item.records_inserted || 0,
    records_failed: item.records_errors || 0,
    status: item.status as any,
    error_message: item.error_message,
    started_at: item.started_at,
    finished_at: item.completed_at,
    duration_seconds: null,
  }));
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
