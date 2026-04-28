import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Building2, Layers, Search, ChevronLeft,
  ChevronRight, Eye, Loader2, FileText, DollarSign,
  BarChart3, ArrowUpDown, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { DashboardKPIs, DashboardCharts, DashboardScope, TopItem, SicasDocRow } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber, formatDate } from '../../lib/sicasDashboardTypes';
import { fetchTopItems, fetchDocuments } from '../../lib/sicasDashboardService';
import GraficaCircular from '../comisiones/GraficaCircular';

interface Props {
  dimension: 'cliente' | 'aseguradora' | 'ramo';
  kpis: DashboardKPIs | null;
  charts: DashboardCharts | null;
  loading: boolean;
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
  vendedorId?: string;
  onDocumentClick: (docId: string) => void;
  onEntityClick?: (dimension: 'cliente' | 'aseguradora' | 'ramo' | 'oficina' | 'vendedor', name: string, id?: string) => void;
}

const DIMENSION_CONFIG = {
  cliente: { icon: Users, label: 'Clientes', plural: 'clientes', color: '#0ea5e9' },
  aseguradora: { icon: Building2, label: 'Aseguradoras', plural: 'aseguradoras', color: '#14b8a6' },
  ramo: { icon: Layers, label: 'Ramos', plural: 'ramos', color: '#f59e0b' },
};

export default function TabEntidades({ dimension, kpis, charts, loading, userId, scope, accentColor, vendedorId, onDocumentClick, onEntityClick }: Props) {
  const config = DIMENSION_CONFIG[dimension];
  const [items, setItems] = useState<TopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDocs, setItemDocs] = useState<SicasDocRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [docPage, setDocPage] = useState(1);
  const docPageSize = 20;

  useEffect(() => {
    if (!userId || !scope) return;
    setLoadingItems(true);
    fetchTopItems(userId, dimension, 50, scope.scope, scope.oficina_id || undefined, undefined, undefined, vendedorId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [userId, scope, dimension, vendedorId]);

  const loadItemDocs = useCallback(async (itemName: string) => {
    if (!userId || !scope) return;
    setLoadingDocs(true);
    try {
      const params: Record<string, any> = {
        userId,
        scope: scope.scope,
        oficinaId: scope.oficina_id || undefined,
        vendedorId,
        page: docPage,
        pageSize: docPageSize,
      };
      if (dimension === 'cliente') params.cliente = itemName;
      else if (dimension === 'aseguradora') params.aseguradora = itemName;
      else if (dimension === 'ramo') params.ramo = itemName;

      const result = await fetchDocuments(params);
      setItemDocs(result.data);
      setDocCount(result.count);
    } catch {
      setItemDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId, scope, dimension, docPage, vendedorId]);

  useEffect(() => {
    if (selectedItem) loadItemDocs(selectedItem);
  }, [selectedItem, loadItemDocs]);

  const chartData = useMemo(() => {
    const source = dimension === 'cliente' ? charts?.por_cliente
      : dimension === 'aseguradora' ? charts?.por_aseguradora
      : charts?.por_ramo;
    if (!source) return [];
    return source.slice(0, 10).map(item => ({
      label: item.nombre,
      value: item.prima,
    }));
  }, [charts, dimension]);

  const maxPrima = Math.max(...items.map(i => i.prima_neta), 1);
  const docTotalPages = Math.max(1, Math.ceil(docCount / docPageSize));

  return (
    <div className="space-y-4">
      {/* Chart */}
      <GraficaCircular
        data={chartData}
        title={`Distribucion por ${config.label}`}
        valueFormatter={v => formatCurrency(v)}
        size={220}
      />

      {/* Ranking Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <config.icon className="w-4 h-4" style={{ color: config.color }} />
            Top {config.plural} ({formatNumber(items.length)})
          </h3>
        </div>
        {loadingItems ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Sin datos</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((item, idx) => {
              const isExpanded = selectedItem === item.nombre;
              return (
                <div key={idx}>
                  <button
                    onClick={() => {
                      if (onEntityClick) {
                        onEntityClick(dimension, item.nombre);
                      } else {
                        setSelectedItem(isExpanded ? null : item.nombre);
                        setDocPage(1);
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <span className="text-[10px] font-bold text-gray-400 w-6 text-right shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.nombre}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white shrink-0">{formatCurrency(item.prima_neta)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>{formatNumber(item.documentos)} documentos</span>
                        {item.clientes && <span>{formatNumber(item.clientes)} clientes</span>}
                        {item.proxima_renovacion && <span>Prox. renov: {formatDate(item.proxima_renovacion)}</span>}
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(item.prima_neta / maxPrima) * 100}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 px-4 py-3">
                      {loadingDocs ? (
                        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
                      ) : itemDocs.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">Sin documentos</p>
                      ) : (
                        <>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">
                                <th className="pb-2 text-left font-semibold">Poliza</th>
                                <th className="pb-2 text-left font-semibold hidden sm:table-cell">{dimension === 'cliente' ? 'Aseguradora' : 'Cliente'}</th>
                                <th className="pb-2 text-left font-semibold hidden md:table-cell">Ramo</th>
                                <th className="pb-2 text-right font-semibold">Prima</th>
                                <th className="pb-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {itemDocs.map(doc => (
                                <tr key={doc.id} className="hover:bg-white dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onDocumentClick(doc.id)}>
                                  <td className="py-1.5 text-gray-900 dark:text-white font-medium truncate max-w-[140px]">{doc.poliza || '-'}</td>
                                  <td className="py-1.5 text-gray-600 dark:text-gray-400 truncate max-w-[120px] hidden sm:table-cell">{dimension === 'cliente' ? doc.compania : doc.cliente}</td>
                                  <td className="py-1.5 text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden md:table-cell">{doc.ramo || '-'}</td>
                                  <td className="py-1.5 text-gray-900 dark:text-white font-semibold text-right whitespace-nowrap">{formatCurrency(doc.prima_neta)}</td>
                                  <td className="py-1.5 text-center">
                                    <Eye className="w-3 h-3 text-gray-400 inline" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {docTotalPages > 1 && (
                            <div className="flex items-center justify-end gap-1 mt-2">
                              <button onClick={() => setDocPage(p => Math.max(1, p - 1))} disabled={docPage <= 1} className="p-0.5 rounded text-gray-400 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                              <span className="text-[10px] text-gray-500">{docPage}/{docTotalPages}</span>
                              <button onClick={() => setDocPage(p => Math.min(docTotalPages, p + 1))} disabled={docPage >= docTotalPages} className="p-0.5 rounded text-gray-400 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
