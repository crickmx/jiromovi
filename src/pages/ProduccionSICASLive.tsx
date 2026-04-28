import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import {
  TrendingUp, Database, Loader2, AlertTriangle, Users,
  BarChart3, RefreshCcw, Shield, FileText, Building2,
  Layers, CalendarClock, GitCompare, Cloud, Search,
  X, ChevronDown, Filter,
} from 'lucide-react';
import {
  type DashboardTab, type DashboardScope, type DashboardKPIs,
  type DashboardCharts, type GlobalFilters, type SicasDocRow,
  DEFAULT_FILTERS, formatCurrency, formatFullCurrency, formatNumber,
  formatPercent, formatDate, monthLabel, daysUntilRenewal,
  renewalUrgencyColor, renewalUrgencyBg,
} from '../lib/sicasDashboardTypes';
import {
  fetchUserScope, fetchDashboardKPIs, fetchDashboardCharts,
  fetchTopItems, fetchDocuments, fetchFilterOptions, fetchSyncStatus,
} from '../lib/sicasDashboardService';
import TabResumen from '../components/sicasDashboard/TabResumen';
import TabProduccion from '../components/sicasDashboard/TabProduccion';
import TabRenovaciones from '../components/sicasDashboard/TabRenovaciones';
import TabEntidades from '../components/sicasDashboard/TabEntidades';
import TabDocumentos from '../components/sicasDashboard/TabDocumentos';
import TabComparativos from '../components/sicasDashboard/TabComparativos';
import TabSincronizacion from '../components/sicasDashboard/TabSincronizacion';
import DocumentoModal from '../components/sicasDashboard/DocumentoModal';
import MapeoUsuariosSICAS from '../components/produccion/MapeoUsuariosSICAS';
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    aseguradoras: string[];
    ramos: string[];
    subramos: string[];
    monedas: string[];
    vendedores: { id: string; nombre: string }[];
  } | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const hasAdminAccess = isAdmin || (isGerente && tienePermisoAdminEnModulo(usuario, 'sicas'));

  const accentColor = (usuario as any)?.oficina?.accent_color || '#0E23E2';

  const visibleTabs = useMemo(() =>
    TAB_CONFIG.filter(t => !t.adminOnly || hasAdminAccess),
    [hasAdminAccess]
  );

  // Load scope on mount
  useEffect(() => {
    if (!usuario?.id) return;
    (async () => {
      try {
        const s = await fetchUserScope(usuario.id);
        setScope(s);
      } catch (err: any) {
        console.error('[Scope]', err);
        const fallbackScope: DashboardScope = {
          scope: isAdmin ? 'admin' : isGerente ? 'office' : 'self',
          rol: usuario.rol || 'Agente',
          oficina_id: (usuario as any)?.oficina?.id || null,
        };
        setScope(fallbackScope);
      }
    })();
  }, [usuario?.id]);

  // Load dashboard data
  const loadData = useCallback(async () => {
    if (!usuario?.id || !scope) return;
    setLoading(true);
    setError(null);
    try {
      const [kpiData, chartData] = await Promise.all([
        fetchDashboardKPIs(usuario.id, scope.scope, scope.oficina_id || undefined),
        fetchDashboardCharts(usuario.id, scope.scope, scope.oficina_id || undefined),
      ]);
      setKpis(kpiData);
      setCharts(chartData);
    } catch (err: any) {
      console.error('[Dashboard]', err);
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [usuario?.id, scope]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load filter options once
  useEffect(() => {
    if (!usuario?.id || !scope) return;
    fetchFilterOptions(usuario.id, scope.scope, scope.oficina_id || undefined)
      .then(setFilterOptions)
      .catch(() => {});
  }, [usuario?.id, scope]);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedDocId(docId);
  };

  const scopeLabel = scope?.scope === 'admin'
    ? 'Vista Global'
    : scope?.scope === 'office'
    ? `Oficina: ${(usuario as any)?.oficina?.nombre || ''}`
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeFiltersCount > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-0.5 min-w-max">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
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
            onDocumentClick={handleDocumentClick}
            onTabChange={handleTabChange}
          />
        )}
        {activeTab === 'produccion' && (
          <TabProduccion
            kpis={kpis}
            charts={charts}
            loading={loading}
            userId={usuario?.id || ''}
            scope={scope}
            accentColor={accentColor}
            onDocumentClick={handleDocumentClick}
          />
        )}
        {activeTab === 'renovaciones' && (
          <TabRenovaciones
            kpis={kpis}
            loading={loading}
            userId={usuario?.id || ''}
            scope={scope}
            accentColor={accentColor}
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
            scope={scope}
            accentColor={accentColor}
            onDocumentClick={handleDocumentClick}
          />
        )}
        {activeTab === 'documentos' && (
          <TabDocumentos
            userId={usuario?.id || ''}
            scope={scope}
            filterOptions={filterOptions}
            accentColor={accentColor}
            onDocumentClick={handleDocumentClick}
          />
        )}
        {activeTab === 'comparativos' && (
          <TabComparativos
            kpis={kpis}
            charts={charts}
            loading={loading}
            accentColor={accentColor}
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
      </div>
    </div>
  );
}

// Inline filters panel
function FiltersPanel({ filters, onChange, options, onClose }: {
  filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void;
  options: { aseguradoras: string[]; ramos: string[]; subramos: string[]; monedas: string[]; vendedores: { id: string; nombre: string }[] } | null;
  onClose: () => void;
}) {
  const update = (key: keyof GlobalFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    onChange(DEFAULT_FILTERS);
  };

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
