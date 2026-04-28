import { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock, AlertTriangle, Clock, Search, ChevronLeft,
  ChevronRight, Eye, Loader2, FileText, DollarSign,
} from 'lucide-react';
import type { DashboardKPIs, DashboardScope, SicasDocRow } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber, formatDate, daysUntilRenewal, renewalUrgencyColor, renewalUrgencyBg } from '../../lib/sicasDashboardTypes';
import { fetchDocuments } from '../../lib/sicasDashboardService';

interface Props {
  kpis: DashboardKPIs | null;
  loading: boolean;
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
  vendedorId?: string;
  onDocumentClick: (docId: string) => void;
}

export default function TabRenovaciones({ kpis, loading, userId, scope, accentColor, vendedorId, onDocumentClick }: Props) {
  const [filterDias, setFilterDias] = useState(90);
  const [docs, setDocs] = useState<SicasDocRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 25;

  const loadRenovaciones = useCallback(async () => {
    if (!userId || !scope) return;
    setLoadingDocs(true);
    try {
      const result = await fetchDocuments({
        userId,
        scope: scope.scope,
        oficinaId: scope.oficina_id || undefined,
        vendedorId,
        page,
        pageSize,
        search: search || undefined,
        soloRenovaciones: true,
        diasRenovacion: filterDias,
        orderBy: 'vigencia_hasta',
        orderAsc: true,
      });
      setDocs(result.data);
      setTotalCount(result.count);
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId, scope, vendedorId, page, pageSize, search, filterDias]);

  useEffect(() => { loadRenovaciones(); }, [loadRenovaciones]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-4">
      {/* Urgency KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UrgencyCard label="Proximos 7 dias" count={kpis?.renovaciones_7dias || 0} color="bg-red-500" borderColor="border-red-200 dark:border-red-800" loading={loading} onClick={() => { setFilterDias(7); setPage(1); }} active={filterDias === 7} />
        <UrgencyCard label="Proximos 15 dias" count={kpis?.renovaciones_15dias || 0} color="bg-orange-500" borderColor="border-orange-200 dark:border-orange-800" loading={loading} onClick={() => { setFilterDias(15); setPage(1); }} active={filterDias === 15} />
        <UrgencyCard label="Proximos 30 dias" count={kpis?.renovaciones_30dias || 0} color="bg-amber-500" borderColor="border-amber-200 dark:border-amber-800" loading={loading} onClick={() => { setFilterDias(30); setPage(1); }} active={filterDias === 30} />
        <UrgencyCard label="Proximos 90 dias" count={kpis?.renovaciones_pendientes || 0} color="bg-blue-500" borderColor="border-blue-200 dark:border-blue-800" loading={loading} onClick={() => { setFilterDias(90); setPage(1); }} active={filterDias === 90} />
      </div>

      {/* Prima por renovar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatFullCurrency(kpis?.prima_por_renovar || 0)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Prima total por renovar (90 dias)</p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: accentColor }} />
            Renovaciones ({formatNumber(totalCount)})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar poliza, cliente..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {loadingDocs ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No hay renovaciones pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Urgencia</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Poliza</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Aseguradora</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Ramo</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Prima</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Vence</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {docs.map(doc => {
                  const days = daysUntilRenewal(doc.vigencia_hasta);
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${renewalUrgencyBg(days)}`} onClick={() => onDocumentClick(doc.id)}>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold ${renewalUrgencyColor(days)}`}>
                          {days !== null ? (days <= 0 ? 'VENCIDO' : `${days}d`) : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{doc.poliza || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{doc.cliente || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px] hidden md:table-cell">{doc.compania || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden lg:table-cell">{doc.ramo || '-'}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white text-right whitespace-nowrap">{formatCurrency(doc.prima_neta)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 text-center whitespace-nowrap">{formatDate(doc.vigencia_hasta)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={e => { e.stopPropagation(); onDocumentClick(doc.id); }} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loadingDocs && docs.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} de {formatNumber(totalCount)}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="px-2 text-xs text-gray-700 dark:text-gray-300 font-medium">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UrgencyCard({ label, count, color, borderColor, loading, onClick, active }: {
  label: string; count: number; color: string; borderColor: string; loading: boolean; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl border p-3 text-left transition-all w-full ${
        active ? `${borderColor} ring-2 ring-offset-1 ring-blue-400` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</span>
      </div>
      {loading ? (
        <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(count)}</p>
      )}
    </button>
  );
}
