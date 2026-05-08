import { supabase } from './supabase';
import type { DashboardKPIs, DashboardCharts, TopItem, SicasDocRow, DashboardScope, DashboardDimension, OficinaOption, AvanceComercialData } from './sicasDashboardTypes';

// === Cartera Module Types ===

export interface CustomerProfile {
  id: string;
  usuario_id: string;
  sicas_vendor_id: string | null;
  oficina_id: string | null;
  client_name: string;
  normalized_name: string;
  rfc: string | null;
  total_policies_active: number;
  total_policies_expired: number;
  total_premium_active: number;
  total_premium_expired: number;
  ramos_activos: string[];
  aseguradoras_activas: string[];
  next_renewal_date: string | null;
  last_emission_date: string | null;
  last_activity_at: string | null;
  portfolio_status: string;
  is_high_value: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentAlert {
  id: string;
  usuario_id: string;
  sicas_vendor_id: string | null;
  oficina_id: string | null;
  alert_type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  client_name: string | null;
  document_id: string | null;
  policy_number: string | null;
  recommended_action: string | null;
  related_data: Record<string, unknown> | null;
  status: string;
  due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrossSellOpportunity {
  id: string;
  usuario_id: string;
  sicas_vendor_id: string | null;
  oficina_id: string | null;
  client_name: string;
  opportunity_type: string;
  description: string | null;
  current_products: string[];
  suggested_product: string | null;
  priority: 'high' | 'medium' | 'low';
  recommended_message: string | null;
  premium_current: number;
  status: string;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

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

// === Cartera Module Functions ===

export interface EntityAggregates {
  total_docs: number;
  prima_neta_total: number;
  prima_vigente: number;
  unique_count: number;
  polizas_vigentes: number;
  polizas_canceladas: number;
}

export async function fetchEntityAggregates(
  userId: string,
  dimension: string,
  entityName: string,
  entityId?: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<EntityAggregates> {
  const params: Record<string, unknown> = {
    p_user_id: userId,
    p_dimension: dimension,
    p_entity_name: entityName,
  };
  if (entityId) params.p_entity_id = entityId;
  if (fechaDesde) params.p_fecha_desde = fechaDesde;
  if (fechaHasta) params.p_fecha_hasta = fechaHasta;

  const { data, error } = await supabase.rpc('get_sicas_entity_aggregates', params);
  if (error) throw new Error(error.message);
  return (data || { total_docs: 0, prima_neta_total: 0, prima_vigente: 0, unique_count: 0, polizas_vigentes: 0, polizas_canceladas: 0 }) as EntityAggregates;
}

export async function fetchCustomerProfiles(
  userId: string,
  options?: { search?: string; sortBy?: string; sortAsc?: boolean; limit?: number; offset?: number; scope?: string; oficinaId?: string }
): Promise<{ data: CustomerProfile[]; count: number }> {
  let query = supabase
    .from('sicas_customer_profiles')
    .select('*', { count: 'exact' });

  if (options?.scope === 'office' && options?.oficinaId) {
    query = query.eq('oficina_id', options.oficinaId);
  } else if (options?.scope !== 'admin') {
    query = query.eq('usuario_id', userId);
  }

  if (options?.search) {
    query = query.or(`client_name.ilike.%${options.search}%,rfc.ilike.%${options.search}%`);
  }

  const sortCol = options?.sortBy || 'total_premium_active';
  const sortAsc = options?.sortAsc ?? false;
  query = query.order(sortCol, { ascending: sortAsc });

  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: (data || []) as CustomerProfile[], count: count || 0 };
}

export async function refreshCustomerProfiles(userId: string): Promise<void> {
  const { error } = await supabase.rpc('refresh_sicas_customer_profiles', { p_usuario_id: userId });
  if (error) throw new Error(error.message);
}

export async function fetchAgentAlerts(
  userId: string,
  options?: { unreadOnly?: boolean; priority?: string; limit?: number; scope?: string; oficinaId?: string }
): Promise<AgentAlert[]> {
  let query = supabase
    .from('sicas_agent_alerts')
    .select('*')
    .neq('status', 'dismissed');

  if (options?.scope === 'office' && options?.oficinaId) {
    query = query.eq('oficina_id', options.oficinaId);
  } else if (options?.scope !== 'admin') {
    query = query.eq('usuario_id', userId);
  }

  if (options?.unreadOnly) query = query.eq('status', 'new');
  if (options?.priority) query = query.eq('priority', options.priority);

  query = query.order('created_at', { ascending: false });
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as AgentAlert[];
}

export async function markAlertRead(alertId: string): Promise<void> {
  await supabase.from('sicas_agent_alerts').update({ status: 'seen' }).eq('id', alertId);
}

export async function dismissAlert(alertId: string): Promise<void> {
  await supabase.from('sicas_agent_alerts').update({ status: 'dismissed' }).eq('id', alertId);
}

export async function generateAlerts(userId: string): Promise<void> {
  // First refresh customer profiles so high-value detection works
  await supabase.rpc('refresh_sicas_customer_profiles', { p_usuario_id: userId });
  const { error } = await supabase.rpc('generate_sicas_agent_alerts', { p_usuario_id: userId });
  if (error) throw new Error(error.message);
}

export async function fetchCrossSellOpportunities(
  userId: string,
  options?: { limit?: number; confidence?: string; scope?: string; oficinaId?: string }
): Promise<CrossSellOpportunity[]> {
  let query = supabase
    .from('sicas_cross_sell_opportunities')
    .select('*')
    .eq('status', 'new');

  if (options?.scope === 'office' && options?.oficinaId) {
    query = query.eq('oficina_id', options.oficinaId);
  } else if (options?.scope !== 'admin') {
    query = query.eq('usuario_id', userId);
  }

  if (options?.confidence) query = query.eq('priority', options.confidence);
  query = query.order('premium_current', { ascending: false });
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as CrossSellOpportunity[];
}

export async function detectCrossSell(userId: string): Promise<void> {
  // Must refresh customer profiles before cross-sell detection (depends on profile data)
  await supabase.rpc('refresh_sicas_customer_profiles', { p_usuario_id: userId });
  const { error } = await supabase.rpc('detect_sicas_cross_sell', { p_usuario_id: userId });
  if (error) throw new Error(error.message);
}

export async function markOpportunityActioned(opportunityId: string): Promise<void> {
  await supabase.from('sicas_cross_sell_opportunities').update({ status: 'contacted', contacted_at: new Date().toISOString() }).eq('id', opportunityId);
}
