import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Search, Download } from 'lucide-react';

export interface DashboardFilterState {
  periodo: string;
  type: 'all' | 'policies' | 'bonds';
  status: string;
  ramo: string;
  subramo: string;
  aseguradora: string;
  cliente: string;
  moneda: string;
  agente: string;
  search: string;
}

interface AvailableFilters {
  ramos: string[];
  subramos: string[];
  aseguradoras: string[];
  monedas: string[];
}

interface Props {
  filters: DashboardFilterState;
  onFiltersChange: (filters: DashboardFilterState) => void;
  availableFilters: AvailableFilters | null;
  onExport?: (format: 'csv' | 'excel') => void;
  loading?: boolean;
}

function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

const periodOptions = generatePeriodOptions();

export default function SicasDashboardFilters({ filters, onFiltersChange, availableFilters, onExport, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  const update = (key: keyof DashboardFilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    const now = new Date();
    onFiltersChange({
      periodo: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      type: 'all',
      status: '',
      ramo: '',
      subramo: '',
      aseguradora: '',
      cliente: '',
      moneda: '',
      agente: '',
      search: '',
    });
  };

  const activeCount = [
    filters.status, filters.ramo, filters.subramo, filters.aseguradora,
    filters.cliente, filters.moneda, filters.agente, filters.search,
  ].filter(Boolean).length + (filters.type !== 'all' ? 1 : 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Top bar: search + period + filter toggle + export */}
      <div className="p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        {/* Type tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
          {([['all', 'Todos'], ['policies', 'Polizas'], ['bonds', 'Fianzas']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update('type', val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filters.type === val ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <select
          value={filters.periodo}
          onChange={e => update('periodo', e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar documento, cliente..."
            value={filters.search}
            onChange={e => update('search', e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {filters.search && (
            <button onClick={() => update('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${expanded ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{activeCount}</span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Export */}
        {onExport && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onExport('csv')}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => onExport('excel')}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        )}
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            <FilterField label="Estatus">
              <select value={filters.status} onChange={e => update('status', e.target.value)} className="filter-select">
                <option value="">Todos</option>
                <option value="vigente">Vigente</option>
                <option value="renovada">Renovada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no vigente">No Vigente</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </FilterField>

            <FilterField label="Ramo">
              <select value={filters.ramo} onChange={e => update('ramo', e.target.value)} className="filter-select">
                <option value="">Todos</option>
                {availableFilters?.ramos.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FilterField>

            <FilterField label="Subramo">
              <select value={filters.subramo} onChange={e => update('subramo', e.target.value)} className="filter-select">
                <option value="">Todos</option>
                {availableFilters?.subramos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterField>

            <FilterField label="Aseguradora">
              <select value={filters.aseguradora} onChange={e => update('aseguradora', e.target.value)} className="filter-select">
                <option value="">Todas</option>
                {availableFilters?.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </FilterField>

            <FilterField label="Moneda">
              <select value={filters.moneda} onChange={e => update('moneda', e.target.value)} className="filter-select">
                <option value="">Todas</option>
                {availableFilters?.monedas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </FilterField>

            <FilterField label="Cliente">
              <input
                type="text"
                placeholder="Nombre del cliente..."
                value={filters.cliente}
                onChange={e => update('cliente', e.target.value)}
                className="filter-select"
              />
            </FilterField>

            <FilterField label="Agente / Vendedor">
              <input
                type="text"
                placeholder="Nombre del agente..."
                value={filters.agente}
                onChange={e => update('agente', e.target.value)}
                className="filter-select"
              />
            </FilterField>
          </div>

          {activeCount > 0 && (
            <div className="mt-2 flex justify-end">
              <button onClick={clearAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Limpiar todos los filtros
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .filter-select {
          width: 100%;
          padding: 6px 8px;
          background: rgb(249 250 251);
          border: 1px solid rgb(229 231 235);
          border-radius: 6px;
          font-size: 12px;
          color: rgb(17 24 39);
          outline: none;
        }
        .filter-select:focus {
          box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5);
          border-color: transparent;
        }
        .dark .filter-select {
          background: rgb(55 65 81);
          border-color: rgb(75 85 99);
          color: rgb(243 244 246);
        }
      `}</style>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{label}</label>
      {children}
    </div>
  );
}
