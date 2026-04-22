import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import {
  FileText, Search, RefreshCw, TrendingUp, AlertTriangle, ArrowUpDown,
  ChevronLeft, ChevronRight, Eye, ArrowLeft, Building2, User, Calendar,
  CreditCard, Hash, Loader2, Users, ChevronDown,
  ChevronUp, Download, LayoutDashboard, Table2, Database,
  Cloud, Clock, CheckCircle2, XCircle, Info,
} from 'lucide-react';
import MapeoUsuariosSICAS from '../components/produccion/MapeoUsuariosSICAS';
import SicasDashboardKPIs from '../components/produccion/SicasDashboardKPIs';
import SicasDashboardCharts from '../components/produccion/SicasDashboardCharts';
import SicasDashboardFilters, { type DashboardFilterState, getCurrentMonthRange } from '../components/produccion/SicasDashboardFilters';
import SicasRenovacionesPanel from '../components/produccion/SicasRenovacionesPanel';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SicasDocument {
  idDocto: number | string;
  documento: string;
  tipo: string;
  subtipo: string;
  ramo: string;
  subramo: string;
  aseguradora: string;
  cliente: string;
  fechaDesde: string;
  fechaHasta: string;
  primaNeta: number;
  primaTotal: number;
  moneda: string;
  status: string;
  statusRaw: string;
  statusCobro: string;
  vendedor: string;
  vendedorId: string;
  agente: string;
  agenteId: string;
  raw: Record<string, unknown>;
}

interface Pagination {
  page: number;
  pageSize: number;
  pages: number;
  maxRecords: number;
}

interface DocumentDetail {
  idDocto: number | string;
  documento: string;
  tipo: string;
  ramo: string;
  subramo: string;
  aseguradora: string;
  cliente: string | { nombre: string; rfc: string; direccion: string; telefono: string; email: string };
  fechaDesde: string;
  fechaHasta: string;
  primaNeta: number;
  primaTotal: number;
  moneda: string;
  status: string;
  statusRaw: string;
  agente: string | { id: string; nombre: string };
  vendedor: string | { id: string; nombre: string };
  fechas?: { desde: string; hasta: string; emision: string; captura: string };
  importes?: { primaNeta: number; primaTotal: number; derechoPoliza: number; iva: number; recargos: number; descuento: number };
  estatus?: { documento: string; cobro: string; usuario: string };
  raw: Record<string, unknown>;
  vendedorId?: string;
  agenteId?: string;
}

type ViewMode = 'dashboard' | 'table' | 'detail';
type ActiveTab = 'produccion' | 'sincronizacion' | 'mapeo';

interface SyncRun {
  run_id: string;
  module: string;
  keycode: string;
  records_fetched: number;
  records_upserted: number;
  records_failed: number;
  status: string;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

// ─── DB Row Mapper ──────────────────────────────────────────────────────────

function dbRowToDocument(row: Record<string, any>): SicasDocument {
  return {
    idDocto: row.id_docto,
    documento: row.poliza || '',
    tipo: row.tipo_documento || '',
    subtipo: row.subtipo_documento || '',
    ramo: row.ramo || '',
    subramo: row.subramo || '',
    aseguradora: row.aseguradora_nombre || row.compania || '',
    cliente: row.cliente || '',
    fechaDesde: row.vigencia_desde || '',
    fechaHasta: row.vigencia_hasta || '',
    primaNeta: Number(row.prima_neta) || 0,
    primaTotal: Number(row.prima_total) || 0,
    moneda: row.moneda || 'MXN',
    status: row.status_texto || '',
    statusRaw: row.status_codigo || '',
    statusCobro: row.status_cobro || '',
    vendedor: row.vend_nombre || '',
    vendedorId: row.vend_id || '',
    agente: row.agente_nombre || '',
    agenteId: row.sicas_id_agente || '',
    raw: row.raw_data || {},
  };
}

// ─── Edge Function Helper (for sync and vendor management) ──────────────────

async function callEdgeFunction(slug: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sesion no disponible.' };
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Error del servidor (${res.status})` }; }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.' };
  }
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'vigente' || s === 'v') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (s === 'cancelada' || s === 'c') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (s === 'vencida' || s === 'x' || s === 'no vigente' || s === 'n') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (s === 'renovada') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

// ─── Export Utils ────────────────────────────────────────────────────────────

function exportToCSV(documents: SicasDocument[], filename: string) {
  const headers = ['Documento', 'Tipo', 'Cliente', 'Ramo', 'Subramo', 'Aseguradora', 'Vigencia Desde', 'Vigencia Hasta', 'Prima Neta', 'Prima Total', 'Moneda', 'Estatus', 'Vendedor', 'Agente'];
  const rows = documents.map(d => [
    d.documento, d.tipo, d.cliente, d.ramo, d.subramo, d.aseguradora,
    d.fechaDesde, d.fechaHasta, d.primaNeta, d.primaTotal, d.moneda,
    d.status, d.vendedor, d.agente,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToExcel(documents: SicasDocument[], filename: string) {
  try {
    const XLSX = await import('xlsx');
    const wsData = [
      ['Documento', 'Tipo', 'Cliente', 'Ramo', 'Subramo', 'Aseguradora', 'Vigencia Desde', 'Vigencia Hasta', 'Prima Neta', 'Prima Total', 'Moneda', 'Estatus', 'Vendedor', 'Agente'],
      ...documents.map(d => [d.documento, d.tipo, d.cliente, d.ramo, d.subramo, d.aseguradora, d.fechaDesde, d.fechaHasta, d.primaNeta, d.primaTotal, d.moneda, d.status, d.vendedor, d.agente]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produccion SICAS');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch { exportToCSV(documents, filename); }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProduccionSICASLive() {
  const { usuario } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeTab, setActiveTab] = useState<ActiveTab>('produccion');

  // Dashboard
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Documents (table)
  const [documents, setDocuments] = useState<SicasDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, pages: 1, maxRecords: 0 });
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Detail
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [filters, setFilters] = useState<DashboardFilterState>(() => {
    const { fechaDesde, fechaHasta } = getCurrentMonthRange();
    return { fechaDesde, fechaHasta, type: 'all', status: '', ramo: '', subramo: '', aseguradora: '', cliente: '', moneda: '', agente: '', search: '' };
  });

  // Table sort/page
  const [sortField, setSortField] = useState('vigencia_desde');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Errors
  const [error, setError] = useState<{ message: string; code?: string; noMapping?: boolean } | null>(null);

  // Vendor selector (admin/gerente)
  const [mappedVendors, setMappedVendors] = useState<Array<{ usuario_id: string; nombre: string; id_sicas: string; nombre_sicas: string; oficina: string | null }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [loadingVendors, setLoadingVendors] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEjecutivo = usuario?.rol === 'Ejecutivo';
  const canSelectVendor = isAdmin || isGerente;
  const isAgent = !isAdmin && !isGerente && !isEjecutivo;

  // ─── Auto-resolve agent's SICAS vendor ID ──────────────────────────

  useEffect(() => {
    if (!usuario || canSelectVendor) return;
    const idSicas = (usuario as any)?.id_sicas;
    if (idSicas && String(idSicas).trim()) {
      setSelectedVendorId(String(idSicas).trim());
    } else {
      // Try mapping table
      (async () => {
        const { data } = await supabase
          .from('sicas_mapeo_vendedor_usuario')
          .select('id_sicas_vendedor')
          .eq('movi_user_id', usuario.id)
          .limit(1)
          .maybeSingle();
        if (data?.id_sicas_vendedor) {
          setSelectedVendorId(String(data.id_sicas_vendedor));
        } else {
          setError({ message: 'Tu usuario no esta vinculado a un vendedor en SICAS. Contacta al administrador para que realice el mapeo.', noMapping: true });
        }
      })();
    }
  }, [usuario, canSelectVendor]);

  // ─── Load Mapped Vendors (edge function) ────────────────────────────

  const loadMappedVendors = useCallback(async () => {
    if (!canSelectVendor) return;
    setLoadingVendors(true);
    try {
      const data = await callEdgeFunction('sicas-production-query', { action: 'list-mapped-vendors' });
      if (data.ok && data.vendors) setMappedVendors(data.vendors as any);
    } catch { /* silent */ }
    finally { setLoadingVendors(false); }
  }, [canSelectVendor]);

  useEffect(() => { loadMappedVendors(); }, [loadMappedVendors]);

  // ─── Load Dashboard (local DB via RPC) ──────────────────────────────

  const loadDashboard = useCallback(async () => {
    if (!usuario) return;
    setLoadingDashboard(true);
    setError(null);
    try {
      const rpcParams: Record<string, any> = {
        p_fecha_desde: filters.fechaDesde || null,
        p_fecha_hasta: filters.fechaHasta || null,
        p_tipo: filters.type || 'all',
        p_status: filters.status || null,
        p_ramo: filters.ramo || null,
        p_subramo: filters.subramo || null,
        p_aseguradora: filters.aseguradora || null,
        p_cliente: filters.cliente || null,
        p_moneda: filters.moneda || null,
        p_search: filters.search || null,
        p_vend_id: selectedVendorId || null,
      };

      const { data: dashResult, error: dashErr } = await supabase.rpc('get_sicas_local_dashboard', rpcParams);

      if (dashErr) throw dashErr;
      if (!dashResult) throw new Error('Sin datos');

      const result = typeof dashResult === 'string' ? JSON.parse(dashResult) : dashResult;

      // Load monthly prima for charts
      const { data: monthlyData } = await supabase.rpc('get_sicas_monthly_prima', {
        p_vend_id: selectedVendorId || null,
        p_fecha_desde: filters.fechaDesde || null,
        p_fecha_hasta: filters.fechaHasta || null,
      });

      const primaPorMes = (monthlyData || []).map((m: any) => ({
        mes: m.mes,
        primaNeta: Number(m.primaNeta) || 0,
        primaTotal: Number(m.primaTotal) || 0,
        emisiones: Number(m.emisiones) || 0,
        count: Number(m.count) || 0,
      }));

      // Build charts from dashboard aggregates
      const porRamo = (result.topRamos || []).map((r: any) => ({ name: r.name, count: Number(r.count), prima: Number(r.prima) }));
      const porAseguradora = (result.topAseguradoras || []).map((r: any) => ({ name: r.name, count: Number(r.count), prima: Number(r.prima) }));
      const porCliente = (result.topClientes || []).map((r: any) => ({ name: r.name, count: Number(r.count), prima: Number(r.prima) }));
      const porEstatus = (result.porEstatus || []).map((r: any) => ({ estatus: r.estatus, count: Number(r.count), prima: Number(r.prima) }));

      setDashboardData({
        ok: true,
        kpis: result.kpis,
        charts: { primaPorMes, porRamo, porAseguradora, porCliente, porSubramo: [], porEstatus, tipoDistribution: [], renovacionesPorPeriodo: [] },
        renewals: result.renewals || [],
        availableFilters: result.availableFilters,
        periodo: `${filters.fechaDesde} - ${filters.fechaHasta}`,
      });
    } catch (err: any) {
      console.error('[Dashboard] Error:', err);
      setError({ message: err?.message || 'Error cargando dashboard.' });
    } finally {
      setLoadingDashboard(false);
    }
  }, [usuario, selectedVendorId, filters]);

  // ─── Load Documents (local DB direct query) ────────────────────────

  const loadDocuments = useCallback(async () => {
    if (!usuario) return;
    setLoadingDocs(true);
    try {
      let query = supabase
        .from('sicas_documents')
        .select('*', { count: 'exact' });

      if (selectedVendorId) query = query.eq('vend_id', selectedVendorId);
      if (filters.fechaDesde) query = query.gte('vigencia_desde', filters.fechaDesde);
      if (filters.fechaHasta) query = query.lte('vigencia_hasta', filters.fechaHasta);
      if (filters.type === 'policies') query = query.eq('is_poliza', true);
      if (filters.type === 'bonds') query = query.eq('is_fianza', true);
      if (filters.status) query = query.ilike('status_texto', filters.status);
      if (filters.ramo) query = query.ilike('ramo', `%${filters.ramo}%`);
      if (filters.aseguradora) query = query.ilike('aseguradora_nombre', `%${filters.aseguradora}%`);
      if (filters.search) query = query.or(`poliza.ilike.%${filters.search}%,cliente.ilike.%${filters.search}%,aseguradora_nombre.ilike.%${filters.search}%`);

      const ascending = sortDir === 'asc';
      query = query.order(sortField, { ascending });

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: rows, count, error: qErr } = await query;

      if (qErr) throw qErr;

      const totalRecords = count || 0;
      setDocuments((rows || []).map(dbRowToDocument));
      setPagination({
        page: currentPage,
        pageSize,
        pages: Math.max(1, Math.ceil(totalRecords / pageSize)),
        maxRecords: totalRecords,
      });
    } catch (err: any) {
      console.error('[Documents] Error:', err);
      if (!error?.noMapping) setError({ message: err?.message || 'Error al cargar documentos.' });
    } finally {
      setLoadingDocs(false);
    }
  }, [usuario, selectedVendorId, currentPage, pageSize, filters, sortField, sortDir]);

  // ─── Load Detail (local DB) ─────────────────────────────────────────

  const loadDetail = async (idDocto: string | number) => {
    setLoadingDetail(true);
    setViewMode('detail');
    try {
      const { data: row, error: dErr } = await supabase
        .from('sicas_documents')
        .select('*')
        .eq('id_docto', String(idDocto))
        .maybeSingle();

      if (dErr) throw dErr;
      if (!row) { setSelectedDoc(null); return; }

      setSelectedDoc({
        idDocto: row.id_docto,
        documento: row.poliza || '',
        tipo: row.tipo_documento || '',
        ramo: row.ramo || '',
        subramo: row.subramo || '',
        aseguradora: row.aseguradora_nombre || row.compania || '',
        cliente: row.cliente || '-',
        fechaDesde: row.vigencia_desde || '',
        fechaHasta: row.vigencia_hasta || '',
        primaNeta: Number(row.prima_neta) || 0,
        primaTotal: Number(row.prima_total) || 0,
        moneda: row.moneda || 'MXN',
        status: row.status_texto || '',
        statusRaw: row.status_codigo || '',
        agente: row.agente_nombre || '-',
        vendedor: row.vend_nombre || '-',
        vendedorId: row.vend_id || '',
        agenteId: row.sicas_id_agente || '',
        fechas: {
          desde: row.vigencia_desde || '',
          hasta: row.vigencia_hasta || '',
          emision: row.fecha_emision || '',
          captura: row.fecha_captura || '',
        },
        importes: {
          primaNeta: Number(row.prima_neta) || 0,
          primaTotal: Number(row.prima_total) || 0,
          derechoPoliza: Number(row.derechos) || 0,
          iva: Number(row.impuestos) || 0,
          recargos: Number(row.recargos) || 0,
          descuento: 0,
        },
        estatus: {
          documento: row.status_texto || '',
          cobro: row.status_cobro || '',
          usuario: '',
        },
        raw: row.raw_data || {},
      });
    } catch (err: any) {
      console.error('[Detail] Error:', err);
      setSelectedDoc(null);
      setError({ message: 'Error al cargar detalle del documento.' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Effects ────────────────────────────────────────────────────────

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (viewMode === 'table') loadDocuments(); }, [viewMode, loadDocuments]);

  const handleFiltersChange = (newFilters: DashboardFilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setCurrentPage(1);
    setDashboardData(null);
    setDocuments([]);
    setError(null);
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const filename = `produccion-sicas-${filters.fechaDesde}_${filters.fechaHasta}`;
    if (format === 'csv') exportToCSV(documents, filename);
    else exportToExcel(documents, filename);
  };

  const handleKpiClick = (kpiKey: string) => {
    if (kpiKey.startsWith('renovacion')) {
      const el = document.getElementById('renovaciones-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setViewMode('table');
    }
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setCurrentPage(1);
  };

  // ─── Detail View ────────────────────────────────────────────────────

  if (viewMode === 'detail') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => { setViewMode('dashboard'); setSelectedDoc(null); }}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al dashboard
          </button>
          {loadingDetail ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Cargando detalle...</p>
            </div>
          ) : selectedDoc ? (
            <DetailView doc={selectedDoc} isAdmin={isAdmin} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No se pudo cargar el detalle del documento.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main View ─────────────────────────────────────────────────────

  const kpis = dashboardData?.kpis as Record<string, unknown> | undefined;
  const charts = dashboardData?.charts as Record<string, unknown> | undefined;
  const renewals = (dashboardData?.renewals || []) as SicasDocument[];
  const availableFilters = dashboardData?.availableFilters as { ramos: string[]; subramos: string[]; aseguradoras: string[]; monedas: string[] } | undefined;
  const periodo = (dashboardData?.periodo || `${filters.fechaDesde} - ${filters.fechaHasta}`) as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" />
              Produccion SICAS
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Datos locales sincronizados
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'produccion' && (
              <>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('dashboard')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'dashboard' ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </button>
                  <button onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Table2 className="w-3.5 h-3.5" /> Tabla
                  </button>
                </div>
                <button onClick={() => { loadDashboard(); if (viewMode === 'table') loadDocuments(); }}
                  disabled={loadingDashboard || loadingDocs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium">
                  <RefreshCw className={`w-3.5 h-3.5 ${(loadingDashboard || loadingDocs) ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Admin tabs */}
        {isAdmin && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            {([
              { key: 'produccion' as const, icon: TrendingUp, label: 'Produccion' },
              { key: 'sincronizacion' as const, icon: Cloud, label: 'Sincronizacion' },
              { key: 'mapeo' as const, icon: Users, label: 'Mapeo de Usuarios' },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Mapeo tab */}
        {activeTab === 'mapeo' && isAdmin && (
          <MapeoUsuariosSICAS callApi={(body) => callEdgeFunction('sicas-production-query', body)} />
        )}

        {/* Sincronizacion tab */}
        {activeTab === 'sincronizacion' && isAdmin && (
          <SyncPanel userId={usuario?.id} />
        )}

        {/* Production tab */}
        {activeTab === 'produccion' && <>

          {/* Vendor selector */}
          {canSelectVendor && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ver produccion de:</label>
                </div>
                <select value={selectedVendorId} onChange={e => handleVendorChange(e.target.value)}
                  disabled={loadingVendors}
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Todos los vendedores</option>
                  {mappedVendors.map(v => (
                    <option key={v.id_sicas} value={v.id_sicas}>
                      {v.nombre} - {v.nombre_sicas} (ID: {v.id_sicas}){v.oficina ? ` | ${v.oficina}` : ''}
                    </option>
                  ))}
                </select>
                {loadingVendors && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
              </div>
            </div>
          )}

          {/* No mapping warning for agents */}
          {error?.noMapping && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <Users className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">Sin vinculacion SICAS</p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">{error.message}</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && !error.noMapping && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 dark:text-red-300 text-sm font-medium">{error.message}</p>
              </div>
              <button onClick={loadDashboard} className="text-red-600 hover:text-red-800 text-xs font-medium whitespace-nowrap">Reintentar</button>
            </div>
          )}

          {/* Filters */}
          <SicasDashboardFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            availableFilters={availableFilters || null}
            onExport={viewMode === 'table' && documents.length > 0 ? handleExport : undefined}
            loading={loadingDashboard}
          />

          {viewMode === 'dashboard' ? (
            <>
              <SicasDashboardKPIs kpis={kpis as any} loading={loadingDashboard} periodo={periodo} onKpiClick={handleKpiClick} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <SicasDashboardCharts charts={charts as any} loading={loadingDashboard} />
                </div>
                <div id="renovaciones-panel">
                  <SicasRenovacionesPanel renewals={renewals} loading={loadingDashboard} kpis={kpis as any} onDocumentClick={loadDetail} />
                </div>
              </div>
            </>
          ) : (
            <DocumentsTable
              documents={documents} loading={loadingDocs} pagination={pagination}
              currentPage={currentPage} pageSize={pageSize} sortField={sortField} sortDir={sortDir}
              onToggleSort={toggleSort} onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              onViewDetail={loadDetail}
            />
          )}
        </>}
      </div>
    </div>
  );
}

// ─── Sync Panel ─────────────────────────────────────────────────────────────

interface UnmappedVendor {
  vendId: string;
  vendName: string;
  docCount: number;
}

interface DiagnosticData {
  totalDocs: number;
  distinctVendors: number;
  distinctAseguradoras: number;
  polizas: number;
  fianzas: number;
  vigentes: number;
  canceladas: number;
  renewables: number;
  withUserId: number;
  withOficinaId: number;
  userMaps: number;
  vendorMaps: number;
  despachoMaps: number;
  usersWithIdSicas: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncRecords: number;
  mappedVendorIds: number;
  unmappedVendorIds: number;
  unmappedVendors: UnmappedVendor[];
  userMapEntries: number;
  stuckRuns: number;
}

function SyncPanel({ userId }: { userId?: string }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, any> | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [totalDocs, setTotalDocs] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const [docsR, mapsR, vendorR, despR, usersR] = await Promise.all([
        supabase.rpc('get_sicas_sync_diagnostics'),
        supabase.from('sicas_document_user_map').select('*', { count: 'exact', head: true }),
        supabase.from('sicas_mapeo_vendedor_usuario').select('*', { count: 'exact', head: true }),
        supabase.from('sicas_mapeo_despacho_oficina').select('*', { count: 'exact', head: true }),
        supabase.from('usuarios').select('id', { count: 'exact', head: true }).not('id_sicas', 'is', null).neq('id_sicas', ''),
      ]);

      if (docsR.data) {
        const d = typeof docsR.data === 'string' ? JSON.parse(docsR.data) : docsR.data;
        setDiagnostics({
          totalDocs: d.totalDocs || 0,
          distinctVendors: d.distinctVendors || 0,
          distinctAseguradoras: d.distinctAseguradoras || 0,
          polizas: d.polizas || 0,
          fianzas: d.fianzas || 0,
          vigentes: d.vigentes || 0,
          canceladas: d.canceladas || 0,
          renewables: d.renewables || 0,
          withUserId: d.withUserId || 0,
          withOficinaId: d.withOficinaId || 0,
          userMaps: mapsR.count ?? 0,
          vendorMaps: vendorR.count ?? 0,
          despachoMaps: despR.count ?? 0,
          usersWithIdSicas: usersR.count ?? 0,
          lastSyncAt: d.lastSyncAt || null,
          lastSyncStatus: d.lastSyncStatus || null,
          lastSyncRecords: d.lastSyncRecords || 0,
          mappedVendorIds: d.mappedVendorIds || 0,
          unmappedVendorIds: d.unmappedVendorIds || 0,
          unmappedVendors: Array.isArray(d.unmappedVendors) ? d.unmappedVendors : [],
          userMapEntries: d.userMapEntries || 0,
          stuckRuns: d.stuckRuns || 0,
        });
      }
    } catch (err) {
      console.error('[Diagnostics] Error:', err);
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  const loadSyncInfo = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [{ data: history }, { count }] = await Promise.all([
        supabase.from('sicas_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
        supabase.from('sicas_documents').select('*', { count: 'exact', head: true }),
      ]);
      setSyncHistory(history || []);
      setTotalDocs(count ?? 0);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadSyncInfo(); loadDiagnostics(); }, [loadSyncInfo, loadDiagnostics]);

  const runSync = async (mode: 'full' | 'incremental') => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await callEdgeFunction('sicas-sync-local-documents', {
        action: mode,
        triggeredBy: userId || null,
      });
      setSyncResult(result);
      loadSyncInfo();
    } catch (err: any) {
      setSyncResult({ ok: false, error: err?.message || 'Error desconocido' });
    } finally {
      setSyncing(false);
    }
  };

  const lastSync = syncHistory[0];

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Documentos Locales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalDocs !== null ? totalDocs.toLocaleString() : '-'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ultima Sincronizacion</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {lastSync?.started_at ? formatDate(lastSync.started_at) : 'Nunca'}
          </p>
          {lastSync && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {lastSync.status === 'completed' ? (
                <span className="text-emerald-600 dark:text-emerald-400">{lastSync.records_upserted} registros sincronizados</span>
              ) : lastSync.status === 'running' ? (
                <span className="text-blue-600 dark:text-blue-400">En progreso...</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Error: {lastSync.error_message?.substring(0, 50)}</span>
              )}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</span>
          </div>
          {totalDocs === 0 ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Sin datos - ejecuta una sincronizacion completa</p>
          ) : (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Datos disponibles</p>
          )}
        </div>
      </div>

      {/* Sync buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-600" /> Sincronizar con SICAS
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          La sincronizacion descarga todos los documentos desde SICAS y los almacena localmente. Esto permite consultar y filtrar sin limites de la API.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => runSync('full')} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Sincronizacion Completa
          </button>
          <button onClick={() => runSync('incremental')} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm font-medium">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Incremental (30 dias)
          </button>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div className={`mt-4 p-3 rounded-lg border text-sm ${syncResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
            {syncResult.ok ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Sincronizacion exitosa</p>
                  {syncResult.stats && (
                    <p className="text-xs mt-1 opacity-80">
                      {(syncResult.stats as any).documentsUpserted || (syncResult.stats as any).records_upserted || 0} documentos sincronizados
                      {' '}{(syncResult.stats as any).pagesProcessed || 0} paginas procesadas
                      {' '}en {((syncResult.stats as any).durationMs || 0) / 1000}s
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Error en sincronizacion</p>
                  <p className="text-xs mt-1 opacity-80">{syncResult.error as string}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync history */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de Sincronizaciones</h3>
        </div>
        {loadingHistory ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></div>
        ) : syncHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">No hay sincronizaciones registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Reporte</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Leidos</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Guardados</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Duracion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {syncHistory.map(run => (
                  <tr key={run.run_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(run.started_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{run.keycode || run.module}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${run.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : run.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{run.records_fetched?.toLocaleString() || 0}</td>
                    <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{run.records_upserted?.toLocaleString() || 0}</td>
                    <td className="px-3 py-2 text-xs text-right text-gray-500 dark:text-gray-400">{run.duration_seconds ? `${run.duration_seconds}s` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diagnostic Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" /> Diagnostico del Sistema
          </h3>
          <button onClick={loadDiagnostics} disabled={loadingDiag}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50">
            {loadingDiag ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
        {loadingDiag && !diagnostics ? (
          <div className="p-6 text-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" /></div>
        ) : diagnostics ? (
          <div className="p-4 space-y-4">
            {/* Documents summary */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Documentos en Base Local</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Total', value: diagnostics.totalDocs.toLocaleString(), color: 'text-blue-700 dark:text-blue-300' },
                  { label: 'Polizas', value: diagnostics.polizas.toLocaleString(), color: 'text-emerald-700 dark:text-emerald-300' },
                  { label: 'Fianzas', value: diagnostics.fianzas.toLocaleString(), color: 'text-orange-700 dark:text-orange-300' },
                  { label: 'Vigentes', value: diagnostics.vigentes.toLocaleString(), color: 'text-green-700 dark:text-green-300' },
                  { label: 'Canceladas', value: diagnostics.canceladas.toLocaleString(), color: 'text-red-700 dark:text-red-300' },
                  { label: 'Renovables', value: diagnostics.renewables.toLocaleString(), color: 'text-amber-700 dark:text-amber-300' },
                  { label: 'Vendedores', value: diagnostics.distinctVendors.toLocaleString(), color: 'text-cyan-700 dark:text-cyan-300' },
                  { label: 'Aseguradoras', value: diagnostics.distinctAseguradoras.toLocaleString(), color: 'text-sky-700 dark:text-sky-300' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapping status */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mapeos y Vinculaciones</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Docs con usuario_id', value: diagnostics.withUserId, total: diagnostics.totalDocs },
                  { label: 'Docs con oficina_id', value: diagnostics.withOficinaId, total: diagnostics.totalDocs },
                  { label: 'User-doc mappings', value: diagnostics.userMaps, total: null },
                  { label: 'Vendor mappings', value: diagnostics.vendorMaps, total: null },
                  { label: 'Despacho mappings', value: diagnostics.despachoMaps, total: null },
                  { label: 'Usuarios con id_sicas', value: diagnostics.usersWithIdSicas, total: null },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{item.value.toLocaleString()}</p>
                      {item.total !== null && item.total > 0 && (
                        <p className="text-[10px] text-gray-400">/ {item.total.toLocaleString()} ({Math.round((item.value / item.total) * 100)}%)</p>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor overlap warning */}
            {diagnostics.unmappedVendorIds > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Vendedores Sin Mapear ({diagnostics.unmappedVendorIds} de {diagnostics.distinctVendors})
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {diagnostics.mappedVendorIds === 0
                        ? 'Ningun vendedor en documentos esta mapeado a un usuario MOVI. Los agentes no podran ver sus polizas hasta que se creen los mapeos en Mapeo de Vendedores.'
                        : `${diagnostics.unmappedVendorIds} vendedor(es) no estan vinculados a un usuario MOVI. Sus documentos no seran visibles para agentes.`
                      }
                    </p>
                  </div>
                  {diagnostics.unmappedVendors.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-amber-200 dark:border-amber-700">
                            <th className="text-left py-1 px-2 text-amber-700 dark:text-amber-400 font-semibold">ID</th>
                            <th className="text-left py-1 px-2 text-amber-700 dark:text-amber-400 font-semibold">Nombre Vendedor</th>
                            <th className="text-right py-1 px-2 text-amber-700 dark:text-amber-400 font-semibold">Docs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 dark:divide-amber-800">
                          {diagnostics.unmappedVendors.map(v => (
                            <tr key={v.vendId}>
                              <td className="py-1 px-2 text-amber-800 dark:text-amber-300 font-mono">{v.vendId}</td>
                              <td className="py-1 px-2 text-amber-800 dark:text-amber-300">{v.vendName}</td>
                              <td className="py-1 px-2 text-right text-amber-800 dark:text-amber-300 font-semibold">{v.docCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Last sync info */}
            {diagnostics.lastSyncAt && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Ultima sincronizacion exitosa: <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(diagnostics.lastSyncAt)}</span> - {diagnostics.lastSyncRecords} registros - Estado: <span className="font-medium">{diagnostics.lastSyncStatus}</span></p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Documents Table ────────────────────────────────────────────────────────

function DocumentsTable({ documents, loading, pagination, currentPage, pageSize, sortField, sortDir, onToggleSort, onPageChange, onPageSizeChange, onViewDetail }: {
  documents: SicasDocument[]; loading: boolean; pagination: Pagination; currentPage: number; pageSize: number;
  sortField: string; sortDir: 'asc' | 'desc'; onToggleSort: (field: string) => void;
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; onViewDetail: (idDocto: string | number) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {pagination.maxRecords.toLocaleString()} documentos encontrados
        </span>
        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
              <SortableHeader label="Documento" field="poliza" current={sortField} dir={sortDir} onToggle={onToggleSort} />
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Ramo</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Aseguradora</th>
              <SortableHeader label="Vigencia" field="vigencia_desde" current={sortField} dir={sortDir} onToggle={onToggleSort} className="hidden sm:table-cell" />
              <SortableHeader label="Prima Neta" field="prima_neta" current={sortField} dir={sortDir} onToggle={onToggleSort} className="text-right" />
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estatus</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                  ))}
                </tr>
              ))
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No se encontraron documentos</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Si es la primera vez, ejecuta una sincronizacion desde la pestana correspondiente</p>
                </td>
              </tr>
            ) : documents.map((doc) => (
              <tr key={String(doc.idDocto)} className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => onViewDetail(doc.idDocto)}>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{doc.documento || '-'}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{doc.tipo || doc.subtipo}</div>
                </td>
                <td className="px-3 py-2.5"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[160px]">{doc.cliente || '-'}</div></td>
                <td className="px-3 py-2.5 hidden lg:table-cell"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[100px]">{doc.ramo || '-'}</div></td>
                <td className="px-3 py-2.5 hidden md:table-cell"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[100px]">{doc.aseguradora || '-'}</div></td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <div className="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(doc.fechaDesde)}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">a {formatDate(doc.fechaHasta)}</div>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(doc.primaNeta)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${statusColor(doc.status)}`}>{doc.status}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={e => { e.stopPropagation(); onViewDetail(doc.idDocto); }}
                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && documents.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, pagination.maxRecords)} de {pagination.maxRecords.toLocaleString()} documentos
            {pagination.pages > 1 && ` (pagina ${currentPage} de ${pagination.pages})`}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
              className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300 font-medium">{currentPage} / {pagination.pages}</span>
            <button onClick={() => onPageChange(Math.min(pagination.pages, currentPage + 1))} disabled={currentPage >= pagination.pages}
              className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Header ────────────────────────────────────────────────────────

function SortableHeader({ label, field, current, dir, onToggle, className = '' }: {
  label: string; field: string; current: string; dir: 'asc' | 'desc'; onToggle: (f: string) => void; className?: string;
}) {
  const active = current === field;
  return (
    <th className={`px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${className}`} onClick={() => onToggle(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
      </div>
    </th>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function DetailView({ doc, isAdmin }: { doc: DocumentDetail; isAdmin: boolean }) {
  const [showRaw, setShowRaw] = useState(false);

  const clienteObj = typeof doc.cliente === 'object' && doc.cliente !== null ? doc.cliente : null;
  const clienteNombre = clienteObj ? clienteObj.nombre : String(doc.cliente || '-');
  const agenteObj = typeof doc.agente === 'object' && doc.agente !== null ? doc.agente : null;
  const vendedorObj = typeof doc.vendedor === 'object' && doc.vendedor !== null ? doc.vendedor : null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">{doc.tipo || 'Documento'}</p>
              <h2 className="text-xl font-bold text-white">{doc.documento || '-'}</h2>
              <p className="text-blue-200 text-sm mt-1">{doc.aseguradora} - {doc.ramo}</p>
            </div>
            <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${statusColor(doc.status)} self-start`}>{doc.status}</span>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DetailSection icon={User} title="Cliente">
            <DetailField label="Nombre" value={clienteNombre} />
            {clienteObj?.rfc && <DetailField label="RFC" value={clienteObj.rfc} />}
            {clienteObj?.telefono && <DetailField label="Telefono" value={clienteObj.telefono} />}
            {clienteObj?.email && <DetailField label="Email" value={clienteObj.email} />}
          </DetailSection>
          <DetailSection icon={Calendar} title="Vigencia">
            <DetailField label="Desde" value={formatDate(doc.fechas?.desde || doc.fechaDesde)} />
            <DetailField label="Hasta" value={formatDate(doc.fechas?.hasta || doc.fechaHasta)} />
            {doc.fechas?.emision && <DetailField label="Emision" value={formatDate(doc.fechas.emision)} />}
            {doc.fechas?.captura && <DetailField label="Captura" value={formatDate(doc.fechas.captura)} />}
          </DetailSection>
          <DetailSection icon={CreditCard} title="Importes">
            <DetailField label="Prima Neta" value={formatCurrency(doc.importes?.primaNeta ?? doc.primaNeta)} />
            <DetailField label="Prima Total" value={formatCurrency(doc.importes?.primaTotal ?? doc.primaTotal)} />
            {doc.importes?.derechoPoliza ? <DetailField label="Derecho de Poliza" value={formatCurrency(doc.importes.derechoPoliza)} /> : null}
            {doc.importes?.iva ? <DetailField label="IVA" value={formatCurrency(doc.importes.iva)} /> : null}
            {doc.importes?.recargos ? <DetailField label="Recargos" value={formatCurrency(doc.importes.recargos)} /> : null}
          </DetailSection>
          <DetailSection icon={FileText} title="Documento">
            <DetailField label="Tipo" value={doc.tipo} />
            {doc.subramo && <DetailField label="Subramo" value={doc.subramo} />}
            <DetailField label="Moneda" value={doc.moneda || 'MXN'} />
            {doc.estatus?.cobro && <DetailField label="Estatus cobro" value={doc.estatus.cobro} />}
          </DetailSection>
          <DetailSection icon={Building2} title="Vendedor / Agente">
            <DetailField label="Vendedor" value={vendedorObj?.nombre || String(doc.vendedor || '-')} />
            {(vendedorObj?.id || doc.vendedorId) && <DetailField label="ID Vendedor" value={vendedorObj?.id || doc.vendedorId} />}
            <DetailField label="Agente" value={agenteObj?.nombre || String(doc.agente || '-')} />
            {(agenteObj?.id || doc.agenteId) && <DetailField label="ID Agente" value={agenteObj?.id || doc.agenteId} />}
          </DetailSection>
        </div>
      </div>

      {isAdmin && doc.raw && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowRaw(!showRaw)} className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors">
            <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Datos crudos (Debug)</span>
            {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showRaw && (
            <div className="px-6 pb-4">
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto max-h-96 text-gray-700 dark:text-gray-300">
                {JSON.stringify(doc.raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200 text-right truncate">{value}</span>
    </div>
  );
}
