import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Search, Download, Calendar } from 'lucide-react';

export interface DashboardFilterState {
  fechaDesde: string;
  fechaHasta: string;
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

function getMonthRange(year: number, month: number): { desde: string; hasta: string } {
  const desde = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const hasta = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { desde, hasta };
}

export function getCurrentMonthRange(): { fechaDesde: string; fechaHasta: string } {
  const { desde, hasta } = getPresetRange('todo');
  return { fechaDesde: desde, fechaHasta: hasta };
}

type PresetKey = 'este_mes' | 'mes_anterior' | 'trimestre' | 'semestre' | 'anio' | 'ultimo_anio' | 'todo';

function getPresetRange(key: PresetKey): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (key) {
    case 'este_mes':
      return getMonthRange(y, m);
    case 'mes_anterior': {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return getMonthRange(py, pm);
    }
    case 'trimestre': {
      const qStart = Math.floor(m / 3) * 3;
      const desde = `${y}-${String(qStart + 1).padStart(2, '0')}-01`;
      const lastMonth = qStart + 2;
      const lastDay = new Date(y, lastMonth + 1, 0).getDate();
      const hasta = `${y}-${String(lastMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { desde, hasta };
    }
    case 'semestre': {
      const sStart = m < 6 ? 0 : 6;
      const sEnd = m < 6 ? 5 : 11;
      const desde = `${y}-${String(sStart + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, sEnd + 1, 0).getDate();
      const hasta = `${y}-${String(sEnd + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { desde, hasta };
    }
    case 'anio': {
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    }
    case 'ultimo_anio': {
      const desde = `${y - 1}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const hasta = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { desde, hasta };
    }
    case 'todo': {
      return { desde: '2015-01-01', hasta: `${y}-12-31` };
    }
  }
}

const presets: { key: PresetKey; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'ultimo_anio', label: 'Ultimos 12 meses' },
  { key: 'anio', label: 'Ano' },
  { key: 'semestre', label: 'Semestre' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'este_mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes anterior' },
];

function formatRangeLabel(desde: string, hasta: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  try {
    const d1 = new Date(desde + 'T00:00:00');
    const d2 = new Date(hasta + 'T00:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return `${desde} - ${hasta}`;
    if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
      return `${months[d1.getMonth()]} ${d1.getFullYear()}`;
    }
    if (d1.getFullYear() === d2.getFullYear()) {
      return `${months[d1.getMonth()]} - ${months[d2.getMonth()]} ${d1.getFullYear()}`;
    }
    return `${months[d1.getMonth()]} ${d1.getFullYear()} - ${months[d2.getMonth()]} ${d2.getFullYear()}`;
  } catch {
    return `${desde} - ${hasta}`;
  }
}

export default function SicasDashboardFilters({ filters, onFiltersChange, availableFilters, onExport, loading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const update = (key: keyof DashboardFilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const applyPreset = (key: PresetKey) => {
    const { desde, hasta } = getPresetRange(key);
    onFiltersChange({ ...filters, fechaDesde: desde, fechaHasta: hasta });
    setDatePickerOpen(false);
  };

  const clearAll = () => {
    const { fechaDesde, fechaHasta } = getCurrentMonthRange();
    onFiltersChange({
      fechaDesde,
      fechaHasta,
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

  const currentPreset = presets.find(p => {
    const r = getPresetRange(p.key);
    return r.desde === filters.fechaDesde && r.hasta === filters.fechaHasta;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Top bar: search + date range + filter toggle + export */}
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

        {/* Date range selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDatePickerOpen(!datePickerOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${datePickerOpen ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatRangeLabel(filters.fechaDesde, filters.fechaHasta)}</span>
            {datePickerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {datePickerOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDatePickerOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-[320px]">
                {/* Presets */}
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {presets.map(p => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p.key)}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${currentPreset?.key === p.key ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Rango personalizado</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Desde</label>
                      <input
                        type="date"
                        value={filters.fechaDesde}
                        onChange={e => update('fechaDesde', e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <span className="text-gray-400 text-xs mt-4">-</span>
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Hasta</label>
                      <input
                        type="date"
                        value={filters.fechaHasta}
                        onChange={e => update('fechaHasta', e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDatePickerOpen(false)}
                  className="mt-3 w-full py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </>
          )}
        </div>

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
