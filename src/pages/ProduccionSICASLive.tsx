import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { FileText, Search, Filter, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Shield, AlertTriangle, X, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Briefcase, DollarSign, Clock, CheckCircle, XCircle, ArrowLeft, Building2, User, Calendar, CreditCard, Hash, Loader2, WifiOff, Link as LinkIcon, Users } from 'lucide-react';
import MapeoUsuariosSICAS from '../components/produccion/MapeoUsuariosSICAS';

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

interface Summary {
  totalDocumentos: number;
  totalPolizas: number;
  totalFianzas: number;
  primaNetaTotal: number;
  primaTotalTotal: number;
  vigentes: number;
  vencidas: number;
  canceladas: number;
  porRamo: Record<string, { count: number; prima: number }>;
  porAseguradora: Record<string, { count: number; prima: number }>;
  porMes: Record<string, { count: number; prima: number }>;
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
}

type ViewMode = 'list' | 'detail';
type DocType = 'all' | 'policies' | 'bonds';

// ─── API Helper ──────────────────────────────────────────────────────────────

async function callSicasProduction(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  const res = await fetch(`${supabaseUrl}/functions/v1/sicas-production-query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Apikey': supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'vigente' || s === 'v') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (s === 'cancelada' || s === 'c') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (s === 'vencida' || s === 'x' || s === 'no vigente' || s === 'n') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProduccionSICASLive() {
  const { usuario } = useAuth();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Summary
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Documents list
  const [documents, setDocuments] = useState<SicasDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, pages: 1, maxRecords: 0 });
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Detail
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [docType, setDocType] = useState<DocType>('all');
  const [searchText, setSearchText] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ramoFilter, setRamoFilter] = useState('');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [sortField, setSortField] = useState('DatDocumentos.FDesde');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Errors
  const [error, setError] = useState<{ message: string; code?: string; noMapping?: boolean } | null>(null);

  // Admin vendor selector
  const [mappedVendors, setMappedVendors] = useState<Array<{ usuario_id: string; nombre: string; id_sicas: string; nombre_sicas: string; oficina: string | null }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [loadingVendors, setLoadingVendors] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isAdmin = usuario?.rol === 'Administrador';

  // ─── Load Mapped Vendors (admin only) ───────────────────────────────────

  const loadMappedVendors = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingVendors(true);
    try {
      const data = await callSicasProduction({ action: 'list-mapped-vendors' });
      if (data.ok && data.vendors) {
        setMappedVendors(data.vendors as typeof mappedVendors);
      }
    } catch {
      // silent
    } finally {
      setLoadingVendors(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadMappedVendors();
  }, [loadMappedVendors]);

  // ─── Load Summary ────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    if (!usuario) return;
    if (isAdmin && !selectedVendorId) return;
    setLoadingSummary(true);
    try {
      const body: Record<string, unknown> = { action: 'summary' };
      if (isAdmin && selectedVendorId) body.vendorId = selectedVendorId;
      const data = await callSicasProduction(body);
      if (data.ok) {
        setSummary(data.summary);
        setError(null);
      } else {
        if (data.noMapping) setError({ message: data.error, code: data.code, noMapping: true });
        else setError({ message: data.error, code: data.code });
      }
    } catch (e) {
      setError({ message: 'No fue posible consultar SICAS en este momento.' });
    } finally {
      setLoadingSummary(false);
    }
  }, [usuario, isAdmin, selectedVendorId]);

  // ─── Load Documents ──────────────────────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    if (!usuario) return;
    if (isAdmin && !selectedVendorId) return;
    setLoadingDocs(true);
    try {
      const body: Record<string, unknown> = {
        action: 'documents',
        page: currentPage,
        pageSize,
        type: docType,
        sortField,
        sortDirection: sortDir,
      };
      if (isAdmin && selectedVendorId) body.vendorId = selectedVendorId;
      if (searchApplied) body.search = searchApplied;
      if (statusFilter) body.status = statusFilter;
      if (ramoFilter) body.ramo = ramoFilter;
      if (aseguradoraFilter) body.aseguradora = aseguradoraFilter;
      if (fechaDesde) body.fechaDesde = fechaDesde;
      if (fechaHasta) body.fechaHasta = fechaHasta;

      const data = await callSicasProduction(body);
      if (data.ok) {
        setDocuments(data.items || []);
        setPagination(data.pagination || { page: 1, pageSize: 25, pages: 1, maxRecords: 0 });
        setError(null);
      } else {
        if (data.noMapping) setError({ message: data.error, code: data.code, noMapping: true });
        else if (!error?.noMapping) setError({ message: data.error, code: data.code });
      }
    } catch (e) {
      if (!error?.noMapping) setError({ message: 'Error al cargar documentos.' });
    } finally {
      setLoadingDocs(false);
    }
  }, [usuario, isAdmin, selectedVendorId, currentPage, pageSize, docType, searchApplied, statusFilter, ramoFilter, aseguradoraFilter, fechaDesde, fechaHasta, sortField, sortDir]);

  // ─── Load Detail ─────────────────────────────────────────────────────────

  const loadDetail = async (idDocto: string | number) => {
    setLoadingDetail(true);
    setViewMode('detail');
    try {
      const body: Record<string, unknown> = { action: 'detail', idDocto };
      if (isAdmin && selectedVendorId) body.vendorId = selectedVendorId;
      const data = await callSicasProduction(body);
      if (data.ok) {
        setSelectedDoc(data.document);
      } else {
        setSelectedDoc(null);
        setError({ message: data.error, code: data.code });
      }
    } catch {
      setError({ message: 'Error al cargar detalle del documento.' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!error?.noMapping) loadDocuments();
  }, [loadDocuments]);

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearchText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchApplied(val);
      setCurrentPage(1);
    }, 500);
  };

  const clearFilters = () => {
    setSearchText('');
    setSearchApplied('');
    setStatusFilter('');
    setRamoFilter('');
    setAseguradoraFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setDocType('all');
    setCurrentPage(1);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const activeFilterCount = [searchApplied, statusFilter, ramoFilter, aseguradoraFilter, fechaDesde, fechaHasta].filter(Boolean).length + (docType !== 'all' ? 1 : 0);

  const [activeTab, setActiveTab] = useState<'produccion' | 'mapeo'>('produccion');

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setCurrentPage(1);
    setSummary(null);
    setDocuments([]);
    setError(null);
  };

  // ─── Detail View ─────────────────────────────────────────────────────────

  if (viewMode === 'detail') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => { setViewMode('list'); setSelectedDoc(null); }}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al listado
          </button>

          {loadingDetail ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Consultando detalle en SICAS...</p>
            </div>
          ) : selectedDoc ? (
            <DetailView doc={selectedDoc} isAdmin={isAdmin} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No se pudo cargar el detalle del documento.</p>
              {error && <p className="text-sm text-red-500 mt-2">{error.message}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Produccion SICAS
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Consulta en tiempo real de tus documentos en SICAS Online
            </p>
          </div>
          {activeTab === 'produccion' && (
            <button
              onClick={() => { loadSummary(); loadDocuments(); }}
              disabled={loadingSummary || loadingDocs}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingSummary || loadingDocs) ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
        </div>

        {/* Admin tabs */}
        {isAdmin && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('produccion')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === 'produccion' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              <TrendingUp className="w-4 h-4" /> Produccion
            </button>
            <button
              onClick={() => setActiveTab('mapeo')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeTab === 'mapeo' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              <Users className="w-4 h-4" /> Mapeo de Usuarios
            </button>
          </div>
        )}

        {/* Mapeo tab (admin only) */}
        {activeTab === 'mapeo' && isAdmin && (
          <MapeoUsuariosSICAS callApi={(body) => callSicasProduction(body)} />
        )}

        {/* Production tab content */}
        {activeTab === 'produccion' && <>

        {/* Admin vendor selector */}
        {isAdmin && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver produccion de:</label>
              </div>
              <select
                value={selectedVendorId}
                onChange={e => handleVendorChange(e.target.value)}
                disabled={loadingVendors}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">-- Selecciona un vendedor --</option>
                {mappedVendors.map(v => (
                  <option key={v.id_sicas} value={v.id_sicas}>
                    {v.nombre} - {v.nombre_sicas} (ID: {v.id_sicas}){v.oficina ? ` | ${v.oficina}` : ''}
                  </option>
                ))}
              </select>
              {loadingVendors && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
            </div>
            {!selectedVendorId && !loadingVendors && mappedVendors.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Selecciona un vendedor para consultar su produccion en SICAS en tiempo real.
              </p>
            )}
            {!loadingVendors && mappedVendors.length === 0 && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                No hay vendedores vinculados a SICAS. Ve a la pestana "Mapeo de Usuarios" para configurarlos.
              </div>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && !error.noMapping && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-red-800 dark:text-red-300 text-sm font-medium">{error.message}</p>
              {error.code && <p className="text-red-600 dark:text-red-400 text-xs mt-1">Codigo: {error.code}</p>}
            </div>
            <button onClick={() => { loadSummary(); loadDocuments(); }} className="text-red-600 hover:text-red-800 text-sm font-medium whitespace-nowrap">
              Reintentar
            </button>
          </div>
        )}

        {/* Non-admin no mapping */}
        {error?.noMapping && !isAdmin && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <LinkIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">Tu cuenta no tiene un vinculo con SICAS</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">Contacta a un administrador para que realice el mapeo de tu usuario.</p>
            </div>
          </div>
        )}

        {/* Summary cards - show when production is queryable */}
        {(isAdmin ? !!selectedVendorId : !error?.noMapping) && <SummaryCards summary={summary} loading={loadingSummary} />}

        {/* Filters bar */}
        {(isAdmin ? !!selectedVendorId : !error?.noMapping) && <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Top bar */}
          <div className="p-4 flex flex-col sm:flex-row gap-3">
            {/* Type tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
              {([['all', 'Todos'], ['policies', 'Polizas'], ['bonds', 'Fianzas']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setDocType(val); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${docType === val ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por documento o cliente..."
                value={searchText}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
              />
              {searchText && (
                <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors shrink-0 ${showFilters ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Todos</option>
                    <option value="vigente">Vigente</option>
                    <option value="vencida">Vencida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ramo</label>
                  <input
                    type="text"
                    placeholder="Ej: Autos, Vida..."
                    value={ramoFilter}
                    onChange={e => { setRamoFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Aseguradora</label>
                  <input
                    type="text"
                    placeholder="Ej: GNP, Chubb..."
                    value={aseguradoraFilter}
                    onChange={e => { setAseguradoraFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vigencia desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => { setFechaDesde(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vigencia hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => { setFechaHasta(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resultados por pagina</label>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <button onClick={clearFilters} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <SortableHeader label="Documento" field="DatDocumentos.Documento" current={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Ramo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Aseguradora</th>
                  <SortableHeader label="Vigencia" field="DatDocumentos.FDesde" current={sortField} dir={sortDir} onToggle={toggleSort} className="hidden sm:table-cell" />
                  <SortableHeader label="Prima Neta" field="DatDocumentos.PrimaNeta" current={sortField} dir={sortDir} onToggle={toggleSort} className="text-right" />
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estatus</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loadingDocs ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                      ))}
                    </tr>
                  ))
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">No se encontraron documentos</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Ajusta los filtros o intenta de nuevo</p>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={String(doc.idDocto)}
                      className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => loadDetail(doc.idDocto)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{doc.documento || '-'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{doc.tipo || doc.subtipo}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{doc.cliente || '-'}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{doc.ramo || '-'}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{doc.aseguradora || '-'}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(doc.fechaDesde)}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          a {formatDate(doc.fechaHasta)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {formatCurrency(doc.primaNeta)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); loadDetail(doc.idDocto); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loadingDocs && documents.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, pagination.maxRecords)} de {pagination.maxRecords} documentos
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 font-medium">
                  {currentPage} / {pagination.pages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage >= pagination.pages}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>}

        </>}
      </div>
    </div>
  );
}

// ─── Summary Cards ───────────────────────────────────────────────────────────

function SummaryCards({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  const cards = [
    { label: 'Total Documentos', value: summary?.totalDocumentos ?? 0, icon: FileText, color: 'from-blue-500 to-blue-600', format: 'number' },
    { label: 'Prima Neta Total', value: summary?.primaNetaTotal ?? 0, icon: DollarSign, color: 'from-emerald-500 to-emerald-600', format: 'currency' },
    { label: 'Prima Total', value: summary?.primaTotalTotal ?? 0, icon: TrendingUp, color: 'from-teal-500 to-teal-600', format: 'currency' },
    { label: 'Polizas', value: summary?.totalPolizas ?? 0, icon: Shield, color: 'from-sky-500 to-sky-600', format: 'number' },
    { label: 'Fianzas', value: summary?.totalFianzas ?? 0, icon: Briefcase, color: 'from-orange-500 to-orange-600', format: 'number' },
    { label: 'Vigentes', value: summary?.vigentes ?? 0, icon: CheckCircle, color: 'from-green-500 to-green-600', format: 'number' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 relative overflow-hidden">
            <div className={`absolute inset-0 opacity-[0.04] bg-gradient-to-br ${card.color}`} />
            <div className="relative">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              {loading ? (
                <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {card.format === 'currency' ? formatCurrency(card.value as number) : (card.value as number).toLocaleString('es-MX')}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sortable Header ─────────────────────────────────────────────────────────

function SortableHeader({ label, field, current, dir, onToggle, className = '' }: {
  label: string;
  field: string;
  current: string;
  dir: 'asc' | 'desc';
  onToggle: (f: string) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${className}`}
      onClick={() => onToggle(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
      </div>
    </th>
  );
}

// ─── Detail View Component ───────────────────────────────────────────────────

function DetailView({ doc, isAdmin }: { doc: DocumentDetail; isAdmin: boolean }) {
  const [showRaw, setShowRaw] = useState(false);

  const clienteObj = typeof doc.cliente === 'object' && doc.cliente !== null ? doc.cliente : null;
  const clienteNombre = clienteObj ? clienteObj.nombre : String(doc.cliente || '-');
  const agenteObj = typeof doc.agente === 'object' && doc.agente !== null ? doc.agente : null;
  const vendedorObj = typeof doc.vendedor === 'object' && doc.vendedor !== null ? doc.vendedor : null;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">{doc.tipo || 'Documento'}</p>
              <h2 className="text-xl font-bold text-white">{doc.documento || '-'}</h2>
              <p className="text-blue-200 text-sm mt-1">{doc.aseguradora} - {doc.ramo}</p>
            </div>
            <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${statusColor(doc.status)} self-start`}>
              {doc.status}
            </span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cliente */}
          <DetailSection icon={User} title="Cliente">
            <DetailField label="Nombre" value={clienteNombre} />
            {clienteObj?.rfc && <DetailField label="RFC" value={clienteObj.rfc} />}
            {clienteObj?.telefono && <DetailField label="Telefono" value={clienteObj.telefono} />}
            {clienteObj?.email && <DetailField label="Email" value={clienteObj.email} />}
            {clienteObj?.direccion && <DetailField label="Direccion" value={clienteObj.direccion} />}
          </DetailSection>

          {/* Vigencia */}
          <DetailSection icon={Calendar} title="Vigencia">
            <DetailField label="Desde" value={formatDate(doc.fechas?.desde || doc.fechaDesde)} />
            <DetailField label="Hasta" value={formatDate(doc.fechas?.hasta || doc.fechaHasta)} />
            {doc.fechas?.emision && <DetailField label="Emision" value={formatDate(doc.fechas.emision)} />}
            {doc.fechas?.captura && <DetailField label="Captura" value={formatDate(doc.fechas.captura)} />}
          </DetailSection>

          {/* Importes */}
          <DetailSection icon={CreditCard} title="Importes">
            <DetailField label="Prima Neta" value={formatCurrency(doc.importes?.primaNeta ?? doc.primaNeta)} />
            <DetailField label="Prima Total" value={formatCurrency(doc.importes?.primaTotal ?? doc.primaTotal)} />
            {doc.importes?.derechoPoliza ? <DetailField label="Derecho de Poliza" value={formatCurrency(doc.importes.derechoPoliza)} /> : null}
            {doc.importes?.iva ? <DetailField label="IVA" value={formatCurrency(doc.importes.iva)} /> : null}
            {doc.importes?.recargos ? <DetailField label="Recargos" value={formatCurrency(doc.importes.recargos)} /> : null}
            {doc.importes?.descuento ? <DetailField label="Descuento" value={formatCurrency(doc.importes.descuento)} /> : null}
          </DetailSection>

          {/* Datos del documento */}
          <DetailSection icon={FileText} title="Documento">
            <DetailField label="Tipo" value={doc.tipo} />
            {doc.subramo && <DetailField label="Subramo" value={doc.subramo} />}
            <DetailField label="Moneda" value={doc.moneda || 'MXN'} />
            {doc.estatus?.cobro && <DetailField label="Estatus cobro" value={doc.estatus.cobro} />}
          </DetailSection>

          {/* Vendedor / Agente */}
          <DetailSection icon={Building2} title="Vendedor / Agente">
            <DetailField label="Vendedor" value={vendedorObj?.nombre || String(doc.vendedor || '-')} />
            {(vendedorObj?.id || doc.vendedorId) && <DetailField label="ID Vendedor" value={vendedorObj?.id || doc.vendedorId} />}
            <DetailField label="Agente" value={agenteObj?.nombre || String(doc.agente || '-')} />
            {(agenteObj?.id || doc.agenteId) && <DetailField label="ID Agente" value={agenteObj?.id || doc.agenteId} />}
          </DetailSection>
        </div>
      </div>

      {/* Raw JSON for admin/debug */}
      {isAdmin && doc.raw && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors"
          >
            <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Datos crudos de SICAS (Debug)</span>
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
