import { useState, useEffect, useMemo } from 'react';
import { X, Users, Building2, Layers, MapPin, CircleUser as UserCircle, Loader2, FileText, ChevronLeft, ChevronRight, Eye, DollarSign, Hash, Calendar } from 'lucide-react';
import { formatCurrency, formatFullCurrency, formatNumber, formatDate } from '../../lib/sicasDashboardTypes';
import { fetchDocuments, type DocQueryParams } from '../../lib/sicasDashboardService';
import type { SicasDocRow } from '../../lib/sicasDashboardTypes';

interface Props {
  dimension: 'cliente' | 'aseguradora' | 'ramo' | 'oficina' | 'vendedor';
  entityName: string;
  entityId?: string;
  userId: string;
  scope: string;
  oficinaId?: string;
  accentColor: string;
  onClose: () => void;
  onDocumentClick: (docId: string) => void;
}

const DIMENSION_CONFIG = {
  cliente: { icon: Users, label: 'Cliente', color: '#0ea5e9' },
  aseguradora: { icon: Building2, label: 'Aseguradora', color: '#14b8a6' },
  ramo: { icon: Layers, label: 'Ramo', color: '#f59e0b' },
  oficina: { icon: MapPin, label: 'Oficina', color: '#8b5cf6' },
  vendedor: { icon: UserCircle, label: 'Vendedor', color: '#06b6d4' },
};

const PAGE_SIZE = 20;

export default function EntityDetailModal({
  dimension, entityName, entityId, userId, scope, oficinaId,
  accentColor, onClose, onDocumentClick,
}: Props) {
  const config = DIMENSION_CONFIG[dimension];
  const Icon = config.icon;

  const [docs, setDocs] = useState<SicasDocRow[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    const params: DocQueryParams = {
      userId,
      scope: dimension === 'oficina' ? 'office' : scope,
      oficinaId: dimension === 'oficina' ? entityId : oficinaId,
      page,
      pageSize: PAGE_SIZE,
    };
    if (dimension === 'cliente') params.cliente = entityName;
    else if (dimension === 'aseguradora') params.aseguradora = entityName;
    else if (dimension === 'ramo') params.ramo = entityName;
    else if (dimension === 'vendedor') params.vendedorId = entityId;

    fetchDocuments(params)
      .then(({ data, count }) => { setDocs(data); setTotalDocs(count); })
      .catch(() => { setDocs([]); setTotalDocs(0); })
      .finally(() => setLoading(false));
  }, [dimension, entityName, entityId, userId, scope, oficinaId, page]);

  const kpis = useMemo(() => {
    if (loading && docs.length === 0) return null;
    const primaNeta = docs.reduce((s, d) => s + (d.prima_neta || 0), 0);
    const primaVigente = docs.filter(d => d.is_vigente).reduce((s, d) => s + (d.prima_neta || 0), 0);
    const uniqueKey = dimension === 'cliente'
      ? new Set(docs.map(d => d.compania).filter(Boolean)).size
      : new Set(docs.map(d => d.cliente).filter(Boolean)).size;
    return { primaNeta, primaVigente, uniqueKey };
  }, [docs, loading, dimension]);

  const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-white/15">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-blue-200 text-[10px] font-medium uppercase tracking-wider">{config.label}</p>
              <h2 className="text-lg font-bold text-white truncate">{entityName}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPICard icon={Hash} label="Total Documentos" value={formatNumber(totalDocs)} color={config.color} />
            <KPICard icon={DollarSign} label="Prima Neta Total" value={kpis ? formatCurrency(kpis.primaNeta) : '-'} color={config.color} />
            <KPICard icon={FileText} label="Prima Vigente" value={kpis ? formatCurrency(kpis.primaVigente) : '-'} color={config.color} />
            <KPICard
              icon={dimension === 'cliente' ? Building2 : Users}
              label={dimension === 'cliente' ? 'Aseguradoras Unicas' : 'Clientes Unicos'}
              value={kpis ? formatNumber(kpis.uniqueKey) : '-'}
              color={config.color}
            />
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando documentos...</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Sin documentos para esta entidad</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-left font-semibold">Poliza</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Aseguradora</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Ramo</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Prima Neta</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Vigencia</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Estatus</th>
                      <th className="px-3 py-2.5 text-center font-semibold w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {docs.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium truncate max-w-[140px]">
                          {doc.poliza || doc.id_docto}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[160px]">{doc.cliente || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">{doc.compania || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{doc.ramo || '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium whitespace-nowrap">
                          {formatFullCurrency(doc.prima_neta)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {formatDate(doc.vigencia_desde)} - {formatDate(doc.vigencia_hasta)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge isVigente={doc.is_vigente} isCancelada={doc.is_cancelada} status={doc.status_texto} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => onDocumentClick(doc.id)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatNumber(totalDocs)} documento{totalDocs !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: KIcon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <KIcon className="w-4 h-4" style={{ color }} />
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ isVigente, isCancelada, status }: { isVigente: boolean; isCancelada: boolean; status: string | null }) {
  const text = isVigente ? 'Vigente' : isCancelada ? 'Cancelada' : (status || '-');
  const cls = isVigente
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : isCancelada
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  return <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${cls}`}>{text}</span>;
}
