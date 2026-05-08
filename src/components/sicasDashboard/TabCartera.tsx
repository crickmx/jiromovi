import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCcw, Loader2, ChevronLeft, ChevronRight,
  ArrowUpDown, Calendar,
} from 'lucide-react';
import type { DashboardScope } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatDate } from '../../lib/sicasDashboardTypes';
import { fetchCustomerProfiles, refreshCustomerProfiles, type CustomerProfile } from '../../lib/sicasDashboardService';

interface Props {
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
  onClientClick?: (clientName: string) => void;
}

type SortField = 'total_premium_active' | 'total_policies_active' | 'next_renewal_date' | 'portfolio_status' | 'last_emission_date';

export default function TabCartera({ userId, scope, accentColor, onClientClick }: Props) {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('total_premium_active');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadProfiles = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await fetchCustomerProfiles(userId, {
        search: search || undefined,
        sortBy,
        sortAsc,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        scope: scope?.scope,
        oficinaId: scope?.oficina_id,
      });
      setProfiles(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('[TabCartera]', err);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [userId, search, sortBy, sortAsc, page, scope]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCustomerProfiles(userId);
      await loadProfiles();
    } catch (err) {
      console.error('[TabCartera] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);


  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor + '15' }}>
              <Users className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Mi Cartera</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{totalCount} clientes en cartera</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar cliente o RFC..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 transition-all"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {search ? 'No se encontraron clientes' : 'Cartera vacia'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {search ? 'Intenta con otro termino de busqueda' : 'Haz clic en "Actualizar" para generar perfiles de clientes'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">Cliente</th>
                    <SortableHeader field="total_policies_active" label="Polizas" current={sortBy} asc={sortAsc} onSort={handleSort} />
                    <SortableHeader field="total_premium_active" label="Prima Activa" current={sortBy} asc={sortAsc} onSort={handleSort} />
                    <SortableHeader field="next_renewal_date" label="Prox. Renovacion" current={sortBy} asc={sortAsc} onSort={handleSort} />
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Ramos</th>
                    <SortableHeader field="portfolio_status" label="Estatus" current={sortBy} asc={sortAsc} onSort={handleSort} />
                    <SortableHeader field="last_emission_date" label="Ultima Emision" current={sortBy} asc={sortAsc} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => onClientClick?.(p.client_name)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.client_name}</p>
                          {p.rfc && <p className="text-[10px] text-gray-400 mt-0.5">{p.rfc}</p>}
                          {p.is_high_value && <span className="inline-block px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[9px] font-medium mt-0.5">Alto valor</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 dark:text-white">{p.total_policies_active}</span>
                          {p.total_policies_expired > 0 && <span className="text-gray-400">+{p.total_policies_expired} venc.</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{formatCurrency(p.total_premium_active)}</td>
                      <td className="px-4 py-3">
                        {p.next_renewal_date ? (
                          <RenewalBadge date={p.next_renewal_date} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(p.ramos_activos || []).slice(0, 3).map(r => (
                            <span key={r} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
                              {r}
                            </span>
                          ))}
                          {(p.ramos_activos || []).length > 3 && (
                            <span className="text-[10px] text-gray-400">+{p.ramos_activos.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PortfolioStatusBadge status={p.portfolio_status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {p.last_emission_date ? formatDate(p.last_emission_date) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} de {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <span className="text-xs text-gray-600 dark:text-gray-400 px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SortableHeader({ field, label, current, asc, onSort }: {
  field: SortField;
  label: string;
  current: SortField;
  asc: boolean;
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th className="text-left px-4 py-2.5">
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 font-medium text-xs transition-colors ${
          isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}

function RenewalBadge({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const color = days <= 0 ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
    : days <= 7 ? 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
    : days <= 15 ? 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'
    : days <= 30 ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
    : 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      <Calendar className="w-3 h-3" />
      {days <= 0 ? 'Vencida' : `${days}d`}
    </span>
  );
}

function PortfolioStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    renewing: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
    expired: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    lost: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700',
    no_followup: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20',
  };
  const labels: Record<string, string> = {
    active: 'Activo', renewing: 'Por renovar', expired: 'Vencido', lost: 'Perdido', no_followup: 'Sin seguimiento',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || styles.active}`}>
      {labels[status] || status}
    </span>
  );
}
