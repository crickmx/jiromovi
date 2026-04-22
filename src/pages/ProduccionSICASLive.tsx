import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import {
  FileText, Search, RefreshCw, TrendingUp, AlertTriangle, X, ArrowUpDown,
  ChevronLeft, ChevronRight, Eye, ArrowLeft, Building2, User, Calendar,
  CreditCard, Hash, Loader2, WifiOff, Link as LinkIcon, Users, ChevronDown,
  ChevronUp, Download, LayoutDashboard, Table2, Database,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import MapeoUsuariosSICAS from '../components/produccion/MapeoUsuariosSICAS';
import SicasDashboardKPIs from '../components/produccion/SicasDashboardKPIs';
import SicasDashboardCharts from '../components/produccion/SicasDashboardCharts';
import SicasDashboardFilters, { type DashboardFilterState, getCurrentMonthRange } from '../components/produccion/SicasDashboardFilters';
import SicasRenovacionesPanel from '../components/produccion/SicasRenovacionesPanel';

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
type ActiveTab = 'produccion' | 'mapeo' | 'sync';

async function callLocalQuery(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sesion no disponible. Intenta recargar la pagina.', code: 'NO_SESSION' };
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sicas-local-query`, {
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
    catch { return { ok: false, error: `Error del servidor (${res.status})`, code: 'PARSE_ERROR' }; }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.', code: 'NETWORK_ERROR' };
  }
}

async function callSicasProduction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sesion no disponible.', code: 'NO_SESSION' };
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sicas-production-query`, {
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
    catch { return { ok: false, error: `Error del servidor (${res.status})`, code: 'PARSE_ERROR' }; }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.', code: 'NETWORK_ERROR' };
  }
}

async function callSyncFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sesion no disponible.', code: 'NO_SESSION' };
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sicas-sync-local-documents`, {
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
    catch { return { ok: false, error: `Error del servidor (${res.status})`, code: 'PARSE_ERROR' }; }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red.', code: 'NETWORK_ERROR' };
  }
}

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

function exportToCSV(documents: SicasDocument[], filename: string) {
  const headers = ['Documento', 'Tipo', 'Cliente', 'Ramo', 'Subramo', 'Aseguradora', 'Vigencia Desde', 'Vigencia Hasta', 'Prima Neta', 'Prima Total', 'Moneda', 'Estatus', 'Vendedor', 'Agente'];
  const rows = documents.map(d => [d.documento, d.tipo, d.cliente, d.ramo, d.subramo, d.aseguradora, d.fechaDesde, d.fechaHasta, d.primaNeta, d.primaTotal, d.moneda, d.status, d.vendedor, d.agente]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
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

export default function ProduccionSICASLive() {
  const { usuario } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeTab, setActiveTab] = useState<ActiveTab>('produccion');
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [documents, setDocuments] = useState<SicasDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, pages: 1, maxRecords: 0 });
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filters, setFilters] = useState<DashboardFilterState>(() => {
    const { fechaDesde, fechaHasta } = getCurrentMonthRange();
    return { fechaDesde, fechaHasta, type: 'all', status: '', ramo: '', subramo: '', aseguradora: '', cliente: '', moneda: '', agente: '', search: '' };
  });
  const [sortField, setSortField] = useState('DatDocumentos.FDesde');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<{ message: string; code?: string; noMapping?: boolean } | null>(null);
  const [mappedVendors, setMappedVendors] = useState<Array<{ usuario_id: string; nombre: string; id_sicas: string; nombre_sicas: string; oficina: string | null }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [loadingVendors, setLoadingVendors] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canSelectVendor = isAdmin || isGerente;

  const loadMappedVendors = useCallback(async () => {
    if (!canSelectVendor) return;
    setLoadingVendors(true);
    try {
      const data = await callSicasProduction({ action: 'list-mapped-vendors' });
      if (data.ok && data.vendors) setMappedVendors(data.vendors as any);
    } catch { /* silent */ }
    finally { setLoadingVendors(false); }
  }, [canSelectVendor]);

  useEffect(() => { loadMappedVendors(); }, [loadMappedVendors]);

  const loadDashboard = useCallback(async () => {
    if (!usuario) return;
    setLoadingDashboard(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action: 'dashboard',
        fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta,
        type: filters.type,
        status: filters.status || undefined, ramo: filters.ramo || undefined,
        subramo: filters.subramo || undefined, aseguradora: filters.aseguradora || undefined,
        cliente: filters.cliente || undefined, moneda: filters.moneda || undefined,
        agente: filters.agente || undefined, search: filters.search || undefined,
      };
      if (selectedVendorId) body.vendorId = selectedVendorId;

      const data = await callLocalQuery(body);
      if (data.ok) { setDashboardData(data); setError(null); }
      else {
        if (data.noMapping) setError({ message: data.error as string, code: data.code as string, noMapping: true });
        else setError({ message: data.error as string, code: data.code as string });
      }
    } catch { setError({ message: 'No fue posible consultar los datos.' }); }
    finally { setLoadingDashboard(false); }
  }, [usuario, selectedVendorId, filters]);

  const loadDocuments = useCallback(async () => {
    if (!usuario) return;
    setLoadingDocs(true);
    try {
      const body: Record<string, unknown> = {
        action: 'documents', page: currentPage, pageSize,
        type: filters.type, sortField, sortDirection: sortDir,
      };
      if (selectedVendorId) body.vendorId = selectedVendorId;
      if (filters.fechaDesde) body.fechaDesde = filters.fechaDesde;
      if (filters.fechaHasta) body.fechaHasta = filters.fechaHasta;
      if (filters.search) body.search = filters.search;
      if (filters.status) body.status = filters.status;
      if (filters.ramo) body.ramo = filters.ramo;
      if (filters.aseguradora) body.aseguradora = filters.aseguradora;

      const data = await callLocalQuery(body);
      if (data.ok) {
        setDocuments((data.items || []) as SicasDocument[]);
        setPagination((data.pagination || { page: 1, pageSize: 25, pages: 1, maxRecords: 0 }) as Pagination);
      } else if (!error?.noMapping) {
        setError({ message: data.error as string, code: data.code as string });
      }
    } catch { if (!error?.noMapping) setError({ message: 'Error al cargar documentos.' }); }
    finally { setLoadingDocs(false); }
  }, [usuario, selectedVendorId, currentPage, pageSize, filters, sortField, sortDir]);

  const loadDetail = async (idDocto: string | number) => {
    setLoadingDetail(true); setViewMode('detail');
    try {
      const body: Record<string, unknown> = { action: 'detail', idDocto };
      if (selectedVendorId) body.vendorId = selectedVendorId;
      const data = await callLocalQuery(body);
      if (data.ok) setSelectedDoc(data.document as DocumentDetail);
      else { setSelectedDoc(null); setError({ message: data.error as string, code: data.code as string }); }
    } catch { setError({ message: 'Error al cargar detalle del documento.' }); }
    finally { setLoadingDetail(false); }
  };

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (viewMode === 'table' && !error?.noMapping) loadDocuments(); }, [viewMode, loadDocuments]);

  const handleFiltersChange = (newFilters: DashboardFilterState) => { setFilters(newFilters); setCurrentPage(1); };
  const handleVendorChange = (vendorId: string) => { setSelectedVendorId(vendorId); setCurrentPage(1); setDashboardData(null); setDocuments([]); setError(null); };
  const handleExport = (format: 'csv' | 'excel') => {
    const filename = `produccion-sicas-${filters.fechaDesde}_${filters.fechaHasta}`;
    if (format === 'csv') exportToCSV(documents, filename);
    else exportToExcel(documents, filename);
  };
  const handleKpiClick = (kpiKey: string) => {
    if (kpiKey.startsWith('renovacion')) {
      const el = document.getElementById('renovaciones-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else { setViewMode('table'); }
  };
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setCurrentPage(1);
  };

  const showContent = !error?.noMapping;

  if (viewMode === 'detail') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => { setViewMode('dashboard'); setSelectedDoc(null); }} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 font-medium transition-colors">
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

  const kpis = dashboardData?.kpis as Record<string, unknown> | undefined;
  const charts = dashboardData?.charts as Record<string, unknown> | undefined;
  const renewals = (dashboardData?.renewals || []) as SicasDocument[];
  const availableFilters = dashboardData?.availableFilters as { ramos: string[]; subramos: string[]; aseguradoras: string[]; monedas: string[] } | undefined;
  const periodo = (dashboardData?.periodo || `${filters.fechaDesde} - ${filters.fechaHasta}`) as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" /> Produccion SICAS
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Datos locales sincronizados
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'produccion' && showContent && (
              <>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('dashboard')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'dashboard' ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </button>
                  <button onClick={() => setViewMode('table')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Table2 className="w-3.5 h-3.5" /> Tabla
                  </button>
                </div>
                <button onClick={() => { loadDashboard(); if (viewMode === 'table') loadDocuments(); }} disabled={loadingDashboard || loadingDocs} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium">
                  <RefreshCw className={`w-3.5 h-3.5 ${(loadingDashboard || loadingDocs) ? 'animate-spin' : ''}`} /> Actualizar
                </button>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            <button onClick={() => setActiveTab('produccion')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === 'produccion' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              <TrendingUp className="w-4 h-4" /> Produccion
            </button>
            <button onClick={() => setActiveTab('sync')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === 'sync' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              <Download className="w-4 h-4" /> Sincronizacion
            </button>
            <button onClick={() => setActiveTab('mapeo')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === 'mapeo' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
              <Users className="w-4 h-4" /> Mapeo de Usuarios
            </button>
          </div>
        )}

        {activeTab === 'mapeo' && isAdmin && (
          <MapeoUsuariosSICAS callApi={(body) => callSicasProduction(body)} />
        )}

        {activeTab === 'sync' && isAdmin && (
          <SyncPanel onSyncComplete={loadDashboard} />
        )}

        {activeTab === 'produccion' && <>
          {canSelectVendor && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ver produccion de:</label>
                </div>
                <select value={selectedVendorId} onChange={e => handleVendorChange(e.target.value)} disabled={loadingVendors} className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
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

          {error && !error.noMapping && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 dark:text-red-300 text-sm font-medium">{error.message}</p>
                {error.code && <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">Codigo: {error.code}</p>}
              </div>
              <button onClick={loadDashboard} className="text-red-600 hover:text-red-800 text-xs font-medium whitespace-nowrap">Reintentar</button>
            </div>
          )}

          {error?.noMapping && !canSelectVendor && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <LinkIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">Tu cuenta no tiene un vinculo con SICAS</p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">Contacta a un administrador para que realice el mapeo de tu usuario.</p>
              </div>
            </div>
          )}

          {showContent && (
            <>
              <SicasDashboardFilters filters={filters} onFiltersChange={handleFiltersChange} availableFilters={availableFilters || null} onExport={viewMode === 'table' && documents.length > 0 ? handleExport : undefined} loading={loadingDashboard} />

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
                <DocumentsTable documents={documents} loading={loadingDocs} pagination={pagination} currentPage={currentPage} pageSize={pageSize} sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} onViewDetail={loadDetail} />
              )}
            </>
          )}
        </>}
      </div>
    </div>
  );
}

function SyncPanel({ onSyncComplete }: { onSyncComplete: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, unknown> | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const [statusData, logsData] = await Promise.all([
        callLocalQuery({ action: 'sync-status' }),
        callLocalQuery({ action: 'sync-logs' }),
      ]);
      if (statusData.ok) setSyncStatus(statusData);
      if (logsData.ok) setSyncLogs((logsData.logs || []) as any[]);
    } catch { /* silent */ }
    finally { setLoadingStatus(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  const runSync = async (type: 'full' | 'incremental') => {
    setSyncing(true); setSyncResult(null);
    try {
      const data = await callSyncFunction({ action: type });
      setSyncResult(data);
      if (data.ok) { loadStatus(); onSyncComplete(); }
    } catch (err: any) { setSyncResult({ ok: false, error: err?.message || 'Error' }); }
    finally { setSyncing(false); }
  };

  const lastSync = syncStatus?.lastSync as any;
  const isSyncing = syncStatus?.isSyncing as boolean;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" /> Sincronizacion SICAS
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Descarga documentos desde SICAS hacia la base de datos local de MOVI
          </p>
        </div>

        <div className="p-5 space-y-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando estado...</div>
          ) : (
            <>
              {lastSync && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Ultima sincronizacion exitosa</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(lastSync.finishedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tipo</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{lastSync.syncType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Registros leidos</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{(lastSync.recordsRead || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Insertados</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{(lastSync.recordsInserted || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {!lastSync && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">No se ha realizado ninguna sincronizacion. Ejecuta una sincronizacion completa para comenzar.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button onClick={() => runSync('full')} disabled={syncing || isSyncing} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Sincronizacion Completa
                </button>
                <button onClick={() => runSync('incremental')} disabled={syncing || isSyncing || !lastSync} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm font-medium border border-gray-200 dark:border-gray-600">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizacion Incremental
                </button>
              </div>

              {isSyncing && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Sincronizacion en progreso...
                </div>
              )}
            </>
          )}

          {syncResult && (
            <div className={`rounded-lg p-4 border ${syncResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                {syncResult.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                <span className={`text-sm font-medium ${syncResult.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                  {syncResult.ok ? 'Sincronizacion completada' : 'Error en sincronizacion'}
                </span>
              </div>
              {syncResult.ok && syncResult.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {Object.entries(syncResult.summary as Record<string, number>).map(([key, val]) => (
                    <div key={key} className="text-xs">
                      <span className="text-gray-500 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                      <span className="font-medium text-gray-900 dark:text-white">{val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
              {!syncResult.ok && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{syncResult.error as string}</p>}
            </div>
          )}
        </div>
      </div>

      {syncLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Historial de sincronizaciones
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Leidos</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Insertados</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase hidden sm:table-cell">Fallidos</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase hidden sm:table-cell">Mapeos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {syncLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(log.startedAt)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 capitalize">{log.syncType}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${log.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : log.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : log.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-gray-700 dark:text-gray-300">{(log.recordsRead || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-gray-700 dark:text-gray-300">{(log.recordsInserted || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-gray-700 dark:text-gray-300 hidden sm:table-cell">{(log.recordsFailed || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-gray-700 dark:text-gray-300 hidden sm:table-cell">{(log.userMapsCreated || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTable({ documents, loading, pagination, currentPage, pageSize, sortField, sortDir, onToggleSort, onPageChange, onPageSizeChange, onViewDetail }: {
  documents: SicasDocument[]; loading: boolean; pagination: Pagination; currentPage: number; pageSize: number; sortField: string; sortDir: 'asc' | 'desc'; onToggleSort: (field: string) => void; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; onViewDetail: (idDocto: string | number) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">Resultados por pagina:</span>
        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">
          <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
              <SortableHeader label="Documento" field="DatDocumentos.Documento" current={sortField} dir={sortDir} onToggle={onToggleSort} />
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Ramo</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Aseguradora</th>
              <SortableHeader label="Vigencia" field="DatDocumentos.FDesde" current={sortField} dir={sortDir} onToggle={onToggleSort} className="hidden sm:table-cell" />
              <SortableHeader label="Prima Neta" field="DatDocumentos.PrimaNeta" current={sortField} dir={sortDir} onToggle={onToggleSort} className="text-right" />
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estatus</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">{Array.from({ length: 8 }).map((_, j) => (<td key={j} className="px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>))}</tr>
              ))
            ) : documents.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center"><FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No se encontraron documentos</p></td></tr>
            ) : documents.map((doc) => (
              <tr key={String(doc.idDocto)} className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => onViewDetail(doc.idDocto)}>
                <td className="px-3 py-2.5"><div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{doc.documento || '-'}</div><div className="text-[10px] text-gray-500 dark:text-gray-400">{doc.tipo || doc.subtipo}</div></td>
                <td className="px-3 py-2.5"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[160px]">{doc.cliente || '-'}</div></td>
                <td className="px-3 py-2.5 hidden lg:table-cell"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[100px]">{doc.ramo || '-'}</div></td>
                <td className="px-3 py-2.5 hidden md:table-cell"><div className="text-gray-700 dark:text-gray-300 text-xs truncate max-w-[100px]">{doc.aseguradora || '-'}</div></td>
                <td className="px-3 py-2.5 hidden sm:table-cell"><div className="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(doc.fechaDesde)}</div><div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">a {formatDate(doc.fechaHasta)}</div></td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(doc.primaNeta)}</td>
                <td className="px-3 py-2.5 text-center"><span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${statusColor(doc.status)}`}>{doc.status}</span></td>
                <td className="px-3 py-2.5 text-center"><button onClick={e => { e.stopPropagation(); onViewDetail(doc.idDocto); }} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && documents.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, pagination.maxRecords)} de {pagination.maxRecords} documentos
            {pagination.pages > 1 && ` (pagina ${currentPage} de ${pagination.pages})`}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300 font-medium">{currentPage} / {pagination.pages}</span>
            <button onClick={() => onPageChange(Math.min(pagination.pages, currentPage + 1))} disabled={currentPage >= pagination.pages} className="p-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({ label, field, current, dir, onToggle, className = '' }: { label: string; field: string; current: string; dir: 'asc' | 'desc'; onToggle: (f: string) => void; className?: string; }) {
  const active = current === field;
  return (
    <th className={`px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${className}`} onClick={() => onToggle(field)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-40'}`} /></div>
    </th>
  );
}

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
            {clienteObj?.direccion && <DetailField label="Direccion" value={clienteObj.direccion} />}
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
            {doc.importes?.descuento ? <DetailField label="Descuento" value={formatCurrency(doc.importes.descuento)} /> : null}
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
      {isAdmin && doc.raw && Object.keys(doc.raw).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowRaw(!showRaw)} className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors">
            <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Datos crudos (Debug)</span>
            {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showRaw && (
            <div className="px-6 pb-4">
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto max-h-96 text-gray-700 dark:text-gray-300">{JSON.stringify(doc.raw, null, 2)}</pre>
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
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"><Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {title}</h3>
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
