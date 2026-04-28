import { supabase } from './supabase';
import type { DashboardKPIs, DashboardCharts, TopItem, SicasDocRow, DashboardScope, DashboardDimension, OficinaOption } from './sicasDashboardTypes';

export async function fetchUserScope(userId: string): Promise<DashboardScope> {
  const { data, error } = await supabase.rpc('get_sicas_user_scope', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as DashboardScope;
}

export async function fetchDashboardKPIs(
  userId: string,
  scope?: string,
  oficinaId?: string,
  vendedorId?: string
): Promise<DashboardKPIs> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  const { data, error } = await supabase.rpc('get_sicas_dashboard_kpis', params);
  if (error) throw new Error(error.message);
  return data as DashboardKPIs;
}

export async function fetchDashboardCharts(
  userId: string,
  scope?: string,
  oficinaId?: string,
  meses?: number,
  vendedorId?: string
): Promise<DashboardCharts> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (meses) params.p_meses = meses;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  const { data, error } = await supabase.rpc('get_sicas_dashboard_charts', params);
  if (error) throw new Error(error.message);
  return data as DashboardCharts;
}

export async function fetchTopItems(
  userId: string,
  dimension: DashboardDimension,
  limit = 10,
  scope?: string,
  oficinaId?: string,
  fechaDesde?: string,
  fechaHasta?: string,
  vendedorId?: string
): Promise<TopItem[]> {
  const params: Record<string, unknown> = {
    p_user_id: userId,
    p_dimension: dimension,
    p_limit: limit,
  };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (fechaDesde) params.p_fecha_desde = fechaDesde;
  if (fechaHasta) params.p_fecha_hasta = fechaHasta;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  const { data, error } = await supabase.rpc('get_sicas_dashboard_top', params);
  if (error) throw new Error(error.message);
  return (data ?? []) as TopItem[];
}

export interface DocQueryParams {
  userId: string;
  scope: string;
  oficinaId?: string;
  vendedorId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  cliente?: string;
  aseguradora?: string;
  ramo?: string;
  subramo?: string;
  status?: string;
  tipo?: string;
  moneda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  soloRenovaciones?: boolean;
  diasRenovacion?: number;
  orderBy?: string;
  orderAsc?: boolean;
}

export async function fetchDocuments(params: DocQueryParams): Promise<{
  data: SicasDocRow[];
  count: number;
}> {
  const {
    userId, scope, oficinaId, vendedorId,
    page = 1, pageSize = 50,
    search, cliente, aseguradora, ramo, subramo, status, tipo, moneda,
    fechaDesde, fechaHasta,
    soloRenovaciones, diasRenovacion,
    orderBy = 'fecha_captura', orderAsc = false,
  } = params;

  let query = supabase
    .from('sicas_documents')
    .select('*', { count: 'exact' });

  if (scope === 'office' && oficinaId) {
    query = query.eq('oficina_id', oficinaId);
  }
  // For 'self' scope, RLS handles access via vend_id/nombre_sicas matching
  // For 'admin' scope, no client-side filter needed

  if (vendedorId) query = query.eq('vend_id', vendedorId);

  if (search) {
    query = query.or(
      `cliente.ilike.%${search}%,poliza.ilike.%${search}%,compania.ilike.%${search}%,ramo.ilike.%${search}%,vend_nombre.ilike.%${search}%`
    );
  }
  if (cliente) query = query.ilike('cliente', `%${cliente}%`);
  if (aseguradora) query = query.eq('compania', aseguradora);
  if (ramo) query = query.eq('ramo', ramo);
  if (subramo) query = query.eq('subramo', subramo);
  if (status === 'vigente') query = query.eq('is_vigente', true);
  else if (status === 'cancelada') query = query.eq('is_cancelada', true);
  else if (status) query = query.ilike('status_texto', `%${status}%`);
  if (tipo === 'polizas') query = query.eq('is_poliza', true);
  else if (tipo === 'fianzas') query = query.eq('is_fianza', true);
  if (moneda) query = query.eq('moneda', moneda);
  if (fechaDesde) query = query.gte('fecha_captura', fechaDesde);
  if (fechaHasta) query = query.lte('fecha_captura', fechaHasta + 'T23:59:59');

  if (soloRenovaciones) {
    query = query.eq('is_vigente', true).gte('renewal_days_remaining', 0);
    if (diasRenovacion) query = query.lte('renewal_days_remaining', diasRenovacion);
    else query = query.lte('renewal_days_remaining', 90);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order(orderBy, { ascending: orderAsc }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as SicasDocRow[], count: count ?? 0 };
}

export async function fetchFilterOptions(
  userId: string,
  scope: string,
  oficinaId?: string
): Promise<{
  aseguradoras: string[];
  ramos: string[];
  subramos: string[];
  monedas: string[];
  vendedores: { id: string; nombre: string }[];
}> {
  let query = supabase.from('sicas_documents').select('compania, ramo, subramo, moneda, vend_id, vend_nombre');

  if (scope === 'office' && oficinaId) {
    query = query.eq('oficina_id', oficinaId);
  }

  const { data } = await query.limit(10000);
  if (!data) return { aseguradoras: [], ramos: [], subramos: [], monedas: [], vendedores: [] };

  const aseguradoras = [...new Set(data.map(d => d.compania).filter(Boolean) as string[])].sort();
  const ramos = [...new Set(data.map(d => d.ramo).filter(Boolean) as string[])].sort();
  const subramos = [...new Set(data.map(d => d.subramo).filter(Boolean) as string[])].sort();
  const monedas = [...new Set(data.map(d => d.moneda).filter(Boolean) as string[])].sort();
  const vendMap = new Map<string, string>();
  for (const d of data) {
    if (d.vend_id && d.vend_nombre) vendMap.set(d.vend_id, d.vend_nombre);
  }
  const vendedores = Array.from(vendMap.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { aseguradoras, ramos, subramos, monedas, vendedores };
}

export async function fetchOficinas(): Promise<OficinaOption[]> {
  const { data, error } = await supabase.rpc('get_sicas_oficinas_con_documentos');
  if (error) return [];
  return (data ?? []) as OficinaOption[];
}

export async function fetchSyncStatus(): Promise<{
  jobId: string | null;
  status: string;
  percent: number;
  currentPage: number;
  totalPages: number;
  totalSynced: number;
  totalInSicas: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastSync: string | null;
}> {
  const { data } = await supabase
    .from('sicas_sync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastDoc } = await supabase
    .from('sicas_documents')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      jobId: null, status: 'none', percent: 0, currentPage: 0,
      totalPages: 0, totalSynced: 0, totalInSicas: 0,
      startedAt: null, finishedAt: null,
      lastSync: lastDoc?.synced_at || null,
    };
  }

  return {
    jobId: data.id,
    status: data.status,
    percent: data.percent || 0,
    currentPage: data.current_page || 0,
    totalPages: data.total_pages || 0,
    totalSynced: data.total_synced || 0,
    totalInSicas: data.total_in_sicas || 0,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    lastSync: lastDoc?.synced_at || data.finished_at,
  };
}
