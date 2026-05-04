import { supabase } from './supabase';
import type { DashboardKPIs, DashboardCharts, TopItem, SicasDocRow, DashboardScope, DashboardDimension, OficinaOption, AvanceComercialData } from './sicasDashboardTypes';

export async function fetchUserScope(userId: string): Promise<DashboardScope> {
  const { data, error } = await supabase.rpc('get_sicas_user_scope', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as DashboardScope;
}

export async function fetchDashboardKPIs(
  userId: string,
  scope?: string,
  oficinaId?: string,
  vendedorId?: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<DashboardKPIs> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  if (fechaDesde) params.p_fecha_desde = fechaDesde;
  if (fechaHasta) params.p_fecha_hasta = fechaHasta;
  const { data, error } = await supabase.rpc('get_sicas_dashboard_kpis', params);
  if (error) throw new Error(error.message);
  return data as DashboardKPIs;
}

export async function fetchDashboardCharts(
  userId: string,
  scope?: string,
  oficinaId?: string,
  meses?: number,
  vendedorId?: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<DashboardCharts> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (meses) params.p_meses = meses;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  if (fechaDesde) params.p_fecha_desde = fechaDesde;
  if (fechaHasta) params.p_fecha_hasta = fechaHasta;
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

  const rpcParams: Record<string, unknown> = {
    p_user_id: userId,
    p_scope: scope || 'all',
    p_page: page,
    p_page_size: pageSize,
    p_order_by: orderBy,
    p_order_asc: orderAsc,
  };

  if (oficinaId) rpcParams.p_oficina_id = oficinaId;
  if (vendedorId) rpcParams.p_vendedor_id = vendedorId;
  if (search) rpcParams.p_search = search;
  if (cliente) rpcParams.p_cliente = cliente;
  if (aseguradora) rpcParams.p_aseguradora = aseguradora;
  if (ramo) rpcParams.p_ramo = ramo;
  if (subramo) rpcParams.p_subramo = subramo;
  if (status) rpcParams.p_status = status;
  if (tipo) rpcParams.p_tipo = tipo;
  if (moneda) rpcParams.p_moneda = moneda;
  if (fechaDesde) rpcParams.p_fecha_desde = fechaDesde;
  if (fechaHasta) rpcParams.p_fecha_hasta = fechaHasta;
  if (soloRenovaciones) {
    rpcParams.p_solo_renovaciones = true;
    rpcParams.p_dias_renovacion = diasRenovacion || 90;
  }

  const { data, error } = await supabase.rpc('get_sicas_documents', rpcParams);
  if (error) throw new Error(error.message);

  const result = data as { data: SicasDocRow[]; count: number } | null;
  return {
    data: result?.data ?? [],
    count: result?.count ?? 0,
  };
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
  const rpcParams: Record<string, unknown> = {
    p_user_id: userId,
    p_scope: scope || 'all',
  };
  if (oficinaId) rpcParams.p_oficina_id = oficinaId;

  const { data, error } = await supabase.rpc('get_sicas_filter_options', rpcParams);
  if (error) throw new Error(error.message);

  const result = data as {
    aseguradoras: string[];
    ramos: string[];
    subramos: string[];
    monedas: string[];
    vendedores: { id: string; nombre: string }[];
  } | null;

  return {
    aseguradoras: result?.aseguradoras ?? [],
    ramos: result?.ramos ?? [],
    subramos: result?.subramos ?? [],
    monedas: result?.monedas ?? [],
    vendedores: result?.vendedores ?? [],
  };
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
    .not('synced_at', 'is', null)
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

export async function fetchAvanceComercial(
  userId: string,
  scope?: string,
  oficinaId?: string,
  vendedorId?: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<AvanceComercialData> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (scope) params.p_scope = scope;
  if (oficinaId) params.p_oficina_id = oficinaId;
  if (vendedorId) params.p_vendedor_id = vendedorId;
  if (fechaDesde) params.p_fecha_desde = fechaDesde;
  if (fechaHasta) params.p_fecha_hasta = fechaHasta;
  const { data, error } = await supabase.rpc('get_sicas_avance_comercial', params);
  if (error) throw new Error(error.message);
  return data as AvanceComercialData;
}
