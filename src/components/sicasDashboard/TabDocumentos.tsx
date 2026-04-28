import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, ChevronLeft, ChevronRight, Eye,
  ArrowUpDown, Download, X,
} from 'lucide-react';
import type { DashboardScope, SicasDocRow } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatNumber, formatDate } from '../../lib/sicasDashboardTypes';
import { fetchDocuments } from '../../lib/sicasDashboardService';

interface Props {
  userId: string;
  scope: DashboardScope | null;
  filterOptions: { aseguradoras: string[]; ramos: string[]; subramos: string[]; monedas: string[]; vendedores: { id: string; nombre: string }[] } | null;
  accentColor: string;
  vendedorId?: string;
  onDocumentClick: (docId: string) => void;
}

export default function TabDocumentos({ userId, scope, filterOptions, vendedorId, onDocumentClick }: Props) {
  const [docs, setDocs] = useState<SicasDocRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('fecha_captura');
  const [sortAsc, setSortAsc] = useState(false);
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [ramo, setRamo] = useState('');
  const [subramo, setSubramo] = useState('');
  const [moneda, setMoneda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const hasActiveFilters = tipo || status || aseguradora || ramo || subramo || moneda || fechaDesde || fechaHasta;

  const clearFilters = () => {
    setTipo(''); setStatus(''); setAseguradora(''); setRamo('');
    setSubramo(''); setMoneda(''); setFechaDesde(''); setFechaHasta('');
    setSearch(''); setPage(1);
  };

  const loadDocs = useCallback(async () => {
    if (!userId || !scope) return;
    setLoading(true);
    try {
      const result = await fetchDocuments({
        userId,
        scope: scope.scope,
        oficinaId: scope.oficina_id || undefined,
        vendedorId,
        page,
        pageSize,
        search: search || undefined,
        tipo: tipo || undefined,
        status: status || undefined,
        aseguradora: aseguradora || undefined,
        ramo: ramo || undefined,
        subramo: subramo || undefined,
        moneda: moneda || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        orderBy: sortField,
        orderAsc: sortAsc,
      });
      setDocs(result.data);
      setTotalCount(result.count);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, scope, vendedorId, page, pageSize, search, sortField, sortAsc, tipo, status, aseguradora, ramo, subramo, moneda, fechaDesde, fechaHasta]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
    setPage(1);
  };

  const handleExportCSV = () => {
    const headers = ['Poliza', 'Cliente', 'Ramo', 'Subramo', 'Aseguradora', 'Vendedor', 'Oficina', 'Vigencia Desde', 'Vigencia Hasta', 'Prima Neta', 'Prima Total', 'Moneda', 'Estatus', 'Tipo'];
    const rows = docs.map(d => [
      d.poliza, d.cliente, d.ramo, d.subramo, d.compania, d.vend_nombre, d.oficina_nombre,
      d.vigencia_desde, d.vigencia_hasta, d.prima_neta, d.prima_total, d.moneda, d.status_texto, d.tipo_documento,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentos-sicas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = "px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar poliza, cliente, aseguradora, ramo, vendedor..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {docs.length > 0 && (
              <button onClick={handleExportCSV} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0">
                <Download className="w-3 h-3" /> CSV
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={tipo} onChange={e => { setTipo(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Tipo: Todos</option>
              <option value="polizas">Polizas</option>
              <option value="fianzas">Fianzas</option>
            </select>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Status: Todos</option>
              <option value="vigente">Vigente</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <select value={aseguradora} onChange={e => { setAseguradora(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Aseguradora: Todas</option>
              {filterOptions?.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={ramo} onChange={e => { setRamo(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Ramo: Todos</option>
              {filterOptions?.ramos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={subramo} onChange={e => { setSubramo(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Subramo: Todos</option>
              {filterOptions?.subramos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={moneda} onChange={e => { setMoneda(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">Moneda: Todas</option>
              {filterOptions?.monedas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} className={`${selectClass} w-[130px]`} title="Desde" />
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} className={`${selectClass} w-[130px]`} title="Hasta" />
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatNumber(totalCount)} documentos</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <SortHeader label="Poliza" field="poliza" current={sortField} asc={sortAsc} onToggle={toggleSort} />
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">Aseguradora</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Ramo</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden 2xl:table-cell">Subramo</th>
                <SortHeader label="Vigencia" field="vigencia_desde" current={sortField} asc={sortAsc} onToggle={toggleSort} className="hidden md:table-cell" />
                <SortHeader label="Prima Neta" field="prima_neta" current={sortField} asc={sortAsc} onToggle={toggleSort} className="text-right" />
                <SortHeader label="Prima Total" field="prima_total" current={sortField} asc={sortAsc} onToggle={toggleSort} className="text-right hidden lg:table-cell" />
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Estatus</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">Vendedor</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden 2xl:table-cell">Oficina</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center">
                    <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">No se encontraron documentos</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      {hasActiveFilters ? 'Intenta ajustar los filtros' : 'Sincroniza los datos desde la pestana correspondiente'}
                    </p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : docs.map(doc => (
                <tr key={doc.id} className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => onDocumentClick(doc.id)}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[150px]">{doc.poliza || '-'}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">{doc.tipo_documento}{doc.moneda && doc.moneda !== 'MXN' ? ` / ${doc.moneda}` : ''}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{doc.cliente || '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px] hidden xl:table-cell">{doc.compania || '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden lg:table-cell">{doc.ramo || '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden 2xl:table-cell">{doc.subramo || '-'}</td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(doc.vigencia_desde)}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">a {formatDate(doc.vigencia_hasta)}</div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(doc.prima_neta)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 hidden lg:table-cell">{formatCurrency(doc.prima_total)}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={doc.status_texto} isVigente={doc.is_vigente} isCancelada={doc.is_cancelada} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[110px] hidden xl:table-cell">{doc.vend_nombre || '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden 2xl:table-cell">{doc.oficina_nombre || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={e => { e.stopPropagation(); onDocumentClick(doc.id); }} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && docs.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} de {formatNumber(totalCount)}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page <= 1} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30 text-xs text-gray-600 dark:text-gray-400 px-2">
                1
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="px-2 text-xs text-gray-700 dark:text-gray-300 font-medium">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30 text-xs text-gray-600 dark:text-gray-400 px-2">
                {totalPages}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({ label, field, current, onToggle, className = '' }: {
  label: string; field: string; current: string; asc?: boolean; onToggle: (f: string) => void; className?: string;
}) {
  const active = current === field;
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${className}`}
      onClick={() => onToggle(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-40'}`} />
      </div>
    </th>
  );
}

function StatusBadge({ status, isVigente, isCancelada }: { status: string | null; isVigente: boolean; isCancelada: boolean }) {
  const text = status || (isVigente ? 'Vigente' : isCancelada ? 'Cancelada' : '-');
  const classes = isVigente
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    : isCancelada
    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${classes}`}>
      {text}
    </span>
  );
}
