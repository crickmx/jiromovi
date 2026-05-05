import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { trackDocumentView } from '../lib/activityLogger';
import { TrendingUp, Database, Loader2, AlertTriangle, Users, BarChart3, RefreshCcw, Shield, FileText, Building2, Layers, CalendarClock, GitCompare, Cloud, Search, X, Filter, MapPin, CircleUser as UserCircle } from 'lucide-react';
import {
  type DashboardTab, type DashboardScope, type DashboardKPIs,
  type DashboardCharts, type GlobalFilters, type OficinaOption,
  DEFAULT_FILTERS, formatDate,
} from '../lib/sicasDashboardTypes';
import {
  fetchUserScope, fetchDashboardKPIs, fetchDashboardCharts,
  fetchFilterOptions, fetchOficinas,
} from '../lib/sicasDashboardService';
import TabResumen from '../components/sicasDashboard/TabResumen';
import TabProduccion from '../components/sicasDashboard/TabProduccion';
import TabRenovaciones from '../components/sicasDashboard/TabRenovaciones';
import TabEntidades from '../components/sicasDashboard/TabEntidades';
import TabDocumentos from '../components/sicasDashboard/TabDocumentos';
import TabComparativos from '../components/sicasDashboard/TabComparativos';
import TabSincronizacion from '../components/sicasDashboard/TabSincronizacion';
import DocumentoModal from '../components/sicasDashboard/DocumentoModal';
import EntityDetailModal from '../components/sicasDashboard/EntityDetailModal';
import { tienePermisoAdminEnModulo } from '../lib/permisosUtils';

const TAB_CONFIG: { key: DashboardTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'resumen', label: 'Resumen', icon: BarChart3 },
  { key: 'produccion', label: 'Produccion', icon: TrendingUp },
  { key: 'renovaciones', label: 'Renovaciones', icon: CalendarClock },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'aseguradoras', label: 'Aseguradoras', icon: Building2 },
  { key: 'ramos', label: 'Ramos', icon: Layers },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'comparativos', label: 'Comparativos', icon: GitCompare },
  { key: 'sincronizacion', label: 'Sincronizacion', icon: Cloud, adminOnly: true },
];

export async function callEdgeFunction(slug: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'Sesion no disponible.' };
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

interface EntityModalState {
  dimension: 'cliente' | 'aseguradora' | 'ramo' | 'oficina' | 'vendedor';
  entityName: string;
  entityId?: string;
}

export default function ProduccionSICASLive() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
  const [scope, setScope] = useState<DashboardScope | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [entityModal, setEntityModal] = useState<EntityModalState | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    aseguradoras: string[];
    ramos: string[];
    subramos: string[];
    monedas: string[];
    vendedores: { id: string; nombre: string }[];
  } | null>(null);
  const [oficinas, setOficinas] = useState<OficinaOption[]>([]);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isEjecutivo = usuario?.rol === 'Ejecutivo';
  const isOfficeRole = isGerente || isEmpleado || isEjecutivo;
  const hasAdminAccess = isAdmin || (isGerente && tienePermisoAdminEnModulo(usuario, 'sicas'));

  const accentColor = (usuario as any)?.oficina?.accent_color || '#0E23E2';

  const visibleTabs = useMemo(() =>
    TAB_CONFIG.filter(t => !t.adminOnly || hasAdminAccess),
    [hasAdminAccess]
  );

  // Effective scope considering admin filters
  const effectiveScope = useMemo(() => {
    if (!scope) return null;
    if (isAdmin && filters.oficina) {
      return { ...scope, scope: 'office' as const, oficina_id: filters.oficina };
    }
    return scope;
  }, [scope, isAdmin, filters.oficina]);

  const effectiveOficinaId = effectiveScope?.scope === 'office' ? effectiveScope.oficina_id : undefined;
  const effectiveVendedorId = filters.vendedor || undefined;

  useEffect(() => {
    if (!usuario?.id) return;
    (async () => {
      try {
        const s = await fetchUserScope(usuario.id);
        setScope(s);
      } catch (err: any) {
        console.error('[Scope]', err);
        const fallbackScope: DashboardScope = {
          scope: isAdmin ? 'admin' : isOfficeRole ? 'office' : 'self',
          rol: usuario.rol || 'Agente',
          oficina_id: (usuario as any)?.oficina?.id || null,
        };
        setScope(fallbackScope);
      }
    })();
  }, [usuario?.id]);

  const effectiveFechaDesde = filters.fechaDesde || undefined;
  const effectiveFechaHasta = filters.fechaHasta || undefined;

  // Load dashboard data reacting to filter changes
  const loadData = useCallback(async () => {
    if (!usuario?.id || !effectiveScope) return;
    setLoading(true);
    setError(null);
    try {
      const [kpiData, chartData] = await Promise.all([
        fetchDashboardKPIs(usuario.id, effectiveScope.scope, effectiveOficinaId || undefined, effectiveVendedorId, effectiveFechaDesde, effectiveFechaHasta),
        fetchDashboardCharts(usuario.id, effectiveScope.scope, effectiveOficinaId || undefined, undefined, effectiveVendedorId, effectiveFechaDesde, effectiveFechaHasta),
      ]);
      setKpis(kpiData);
      setCharts(chartData);
    } catch (err: any) {
      console.error('[Dashboard]', err);
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [usuario?.id, effectiveScope, effectiveOficinaId, effectiveVendedorId, effectiveFechaDesde, effectiveFechaHasta]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load filter options and oficinas once
  useEffect(() => {
    if (!usuario?.id || !scope) return;
    fetchFilterOptions(usuario.id, scope.scope, scope.oficina_id || undefined)
      .then(setFilterOptions)
      .catch(() => {});
    if (isAdmin) {
      fetchOficinas().then(setOficinas).catch(() => {});
    }
  }, [usuario?.id, scope, isAdmin]);

  const handleTabChange = (tab: DashboardTab) => setActiveTab(tab);
  const handleDocumentClick = (docId: string) => {
    setSelectedDocId(docId);
    trackDocumentView(docId, docId);
  };
  const handleEntityClick = (dimension: EntityModalState['dimension'], entityName: string, entityId?: string) => {
    setEntityModal({ dimension, entityName, entityId });
  };

  const scopeLabel = effectiveScope?.scope === 'admin'
    ? 'Vista Global'
    : effectiveScope?.scope === 'office'
    ? `Oficina: ${oficinas.find(o => o.id === effectiveOficinaId)?.nombre || (usuario as any)?.oficina?.nombre || ''}`
    : 'Mi Produccion';

  const activeFiltersCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== 'periodo' && v !== DEFAULT_FILTERS[k as keyof GlobalFilters]
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1480px] mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor + '15' }}>
                <TrendingUp className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              Produccion SICAS
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> {scopeLabel}
              </span>
              {kpis?.last_sync && (
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Sync: {formatDate(kpis.last_sync)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Range */}
            <DateRangeSelector
              fechaDesde={filters.fechaDesde}
              fechaHasta={filters.fechaHasta}
              onChange={(desde, hasta) => setFilters(f => ({ ...f, fechaDesde: desde, fechaHasta: hasta }))}
            />
            {/* Admin Office Filter */}
            {isAdmin && oficinas.length > 0 && (
              <select
                value={filters.oficina}
                onChange={e => setFilters(f => ({ ...f, oficina: e.target.value, vendedor: '' }))}
                className="px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px]"
              >
                <option value="">Todas las oficinas</option>
                {oficinas.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre} ({o.documentos})</option>
                ))}
              </select>
            )}
            {/* Vendor Filter (admin, office roles) */}
            {(isAdmin || isOfficeRole) && filterOptions?.vendedores && filterOptions.vendedores.length > 0 && (
              <select
                value={filters.vendedor}
                onChange={e => setFilters(f => ({ ...f, vendedor: e.target.value }))}
                className="px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px]"
              >
                <option value="">Todos los vendedores</option>
                {filterOptions.vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeFiltersCount > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">{activeFiltersCount}</span>
              )}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 text-xs font-medium transition-all disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <FiltersPanel
            filters={filters}
            onChange={setFilters}
            options={filterOptions}
            onClose={() => setShowFilters(false)}
          />
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</p>
            <button onClick={loadData} className="text-red-600 text-xs font-medium hover:text-red-800 whitespace-nowrap">Reintentar</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
          <div className="flex flex-wrap gap-0.5">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 text-[11px] md:text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  style={isActive ? { backgroundColor: accentColor } : undefined}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'resumen' && (
          <TabResumen
            kpis={kpis}
            charts={charts}
            loading={loading}
            accentColor={accentColor}
            isAdmin={isAdmin}
            userId={usuario?.id || ''}
            scope={effectiveScope}
            vendedorId={effectiveVendedorId}
            fechaDesde={effectiveFechaDesde}
            fechaHasta={effectiveFechaHasta}
            onDocumentClick={handleDocumentClick}
            onTabChange={handleTabChange}
            onEntityClick={handleEntityClick}
          />
        )}
        {activeTab === 'produccion' && (
          <TabProduccion
            kpis={kpis}
            charts={charts}
            loading={loading}
            userId={usuario?.id || ''}
            scope={effectiveScope}
            accentColor={accentColor}
            isAdmin={isAdmin}
            vendedorId={effectiveVendedorId}
            fechaDesde={effectiveFechaDesde}
            fechaHasta={effectiveFechaHasta}
            onDocumentClick={handleDocumentClick}
            onEntityClick={handleEntityClick}
          />
        )}
        {activeTab === 'renovaciones' && (
          <TabRenovaciones
            kpis={kpis}
            loading={loading}
            userId={usuario?.id || ''}
            scope={effectiveScope}
            accentColor={accentColor}
            vendedorId={effectiveVendedorId}
            onDocumentClick={handleDocumentClick}
          />
        )}
        {(activeTab === 'clientes' || activeTab === 'aseguradoras' || activeTab === 'ramos') && (
          <TabEntidades
            dimension={activeTab === 'clientes' ? 'cliente' : activeTab === 'aseguradoras' ? 'aseguradora' : 'ramo'}
            kpis={kpis}
            charts={charts}
            loading={loading}
            userId={usuario?.id || ''}
            scope={effectiveScope}
            accentColor={accentColor}
            vendedorId={effectiveVendedorId}
            onDocumentClick={handleDocumentClick}
            onEntityClick={handleEntityClick}
          />
        )}
        {activeTab === 'documentos' && (
          <TabDocumentos
            userId={usuario?.id || ''}
            scope={effectiveScope}
            filterOptions={filterOptions}
            accentColor={accentColor}
            vendedorId={effectiveVendedorId}
            onDocumentClick={handleDocumentClick}
          />
        )}
        {activeTab === 'comparativos' && (
          <TabComparativos
            kpis={kpis}
            charts={charts}
            loading={loading}
            userId={usuario?.id || ''}
            scope={effectiveScope}
            accentColor={accentColor}
            isAdmin={isAdmin}
            vendedorId={effectiveVendedorId}
            onEntityClick={handleEntityClick}
          />
        )}
        {activeTab === 'sincronizacion' && hasAdminAccess && (
          <TabSincronizacion
            userId={usuario?.id}
            onSyncComplete={loadData}
            accentColor={accentColor}
          />
        )}

        {/* Document Detail Modal */}
        {selectedDocId && (
          <DocumentoModal
            docId={selectedDocId}
            isAdmin={hasAdminAccess}
            onClose={() => setSelectedDocId(null)}
          />
        )}

        {/* Entity Detail Modal */}
        {entityModal && (
          <EntityDetailModal
            dimension={entityModal.dimension}
            entityName={entityModal.entityName}
            entityId={entityModal.entityId}
            userId={usuario?.id || ''}
            scope={effectiveScope?.scope || 'self'}
            oficinaId={effectiveOficinaId || undefined}
            accentColor={accentColor}
            fechaDesde={effectiveFechaDesde}
            fechaHasta={effectiveFechaHasta}
            onClose={() => setEntityModal(null)}
            onDocumentClick={handleDocumentClick}
          />
        )}
      </div>
    </div>
  );
}

function DateRangeSelector({ fechaDesde, fechaHasta, onChange }: {
  fechaDesde: string;
  fechaHasta: string;
  onChange: (desde: string, hasta: string) => void;
}) {
  const setPreset = (preset: string) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'este_mes') {
      const lastDay = new Date(y, m + 1, 0).getDate();
      const mm = String(m + 1).padStart(2, '0');
      onChange(`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'mes_anterior') {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const lastDay = new Date(py, pm + 1, 0).getDate();
      const mm = String(pm + 1).padStart(2, '0');
      onChange(`${py}-${mm}-01`, `${py}-${mm}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'trimestre') {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      const qEnd = new Date(y, Math.floor(m / 3) * 3 + 3, 0);
      onChange(formatISO(qStart), formatISO(qEnd));
    } else if (preset === 'este_anio') {
      onChange(`${y}-01-01`, `${y}-12-31`);
    } else if (preset === 'todo') {
      onChange('', '');
    }
  };

  const activePreset = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const mm = String(m + 1).padStart(2, '0');
    const lastDay = new Date(y, m + 1, 0).getDate();
    if (fechaDesde === `${y}-${mm}-01` && fechaHasta === `${y}-${mm}-${String(lastDay).padStart(2, '0')}`) return 'este_mes';
    if (fechaDesde === `${y}-01-01` && fechaHasta === `${y}-12-31`) return 'este_anio';
    if (!fechaDesde && !fechaHasta) return 'todo';
    return '';
  })();

  const presetBtnClass = (key: string) =>
    `px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
      activePreset === key
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  const inputClass = "px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-500 w-[120px]";

  return (
    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-0.5">
      <CalendarClock className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
      <div className="flex items-center gap-0.5">
        <button onClick={() => setPreset('este_mes')} className={presetBtnClass('este_mes')}>Mes</button>
        <button onClick={() => setPreset('mes_anterior')} className={presetBtnClass('mes_anterior')}>Ant.</button>
        <button onClick={() => setPreset('trimestre')} className={presetBtnClass('trimestre')}>Trim.</button>
        <button onClick={() => setPreset('este_anio')} className={presetBtnClass('este_anio')}>Anio</button>
        <button onClick={() => setPreset('todo')} className={presetBtnClass('todo')}>Todo</button>
      </div>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
      <input
        type="date"
        value={fechaDesde}
        onChange={e => onChange(e.target.value, fechaHasta)}
        className={inputClass}
        title="Desde"
      />
      <span className="text-[10px] text-gray-400">-</span>
      <input
        type="date"
        value={fechaHasta}
        onChange={e => onChange(fechaDesde, e.target.value)}
        className={inputClass}
        title="Hasta"
      />
    </div>
  );
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function FiltersPanel({ filters, onChange, options, onClose }: {
  filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void;
  options: { aseguradoras: string[]; ramos: string[]; subramos: string[]; monedas: string[]; vendedores: { id: string; nombre: string }[] } | null;
  onClose: () => void;
}) {
  const update = (key: keyof GlobalFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => onChange(DEFAULT_FILTERS);

  const selectClass = "w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" /> Filtros Globales
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Limpiar</button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Busqueda</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={e => update('search', e.target.value)}
              placeholder="Poliza, cliente..."
              className={`${selectClass} pl-7`}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Tipo</label>
          <select value={filters.tipo} onChange={e => update('tipo', e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            <option value="polizas">Polizas</option>
            <option value="fianzas">Fianzas</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Estatus</label>
          <select value={filters.status} onChange={e => update('status', e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            <option value="vigente">Vigente</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Aseguradora</label>
          <select value={filters.aseguradora} onChange={e => update('aseguradora', e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {options?.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Ramo</label>
          <select value={filters.ramo} onChange={e => update('ramo', e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            {options?.ramos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">Moneda</label>
          <select value={filters.moneda} onChange={e => update('moneda', e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {options?.monedas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
