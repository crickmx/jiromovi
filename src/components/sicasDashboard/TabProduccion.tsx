import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, FileText, DollarSign, BarChart3, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Loader2, MapPin, CircleUser as UserCircle } from 'lucide-react';
import type { DashboardKPIs, DashboardCharts, DashboardScope, TopItem } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber, formatDate, monthLabel } from '../../lib/sicasDashboardTypes';
import { fetchTopItems } from '../../lib/sicasDashboardService';
import GraficaLinea from '../produccion/GraficaLinea';
import GraficaColumnasAgrupadas from '../produccion/GraficaColumnasAgrupadas';

interface Props {
  kpis: DashboardKPIs | null;
  charts: DashboardCharts | null;
  loading: boolean;
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
  isAdmin?: boolean;
  vendedorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  onDocumentClick: (docId: string) => void;
  onEntityClick?: (dimension: 'cliente' | 'aseguradora' | 'ramo' | 'oficina' | 'vendedor', name: string, id?: string) => void;
}

export default function TabProduccion({ kpis, charts, loading, userId, scope, accentColor, isAdmin, vendedorId, fechaDesde, fechaHasta, onDocumentClick, onEntityClick }: Props) {
  const [topRamos, setTopRamos] = useState<TopItem[]>([]);
  const [topAseguradoras, setTopAseguradoras] = useState<TopItem[]>([]);
  const [topOficinas, setTopOficinas] = useState<TopItem[]>([]);
  const [topVendedores, setTopVendedores] = useState<TopItem[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);

  useEffect(() => {
    if (!userId || !scope) return;
    setLoadingTop(true);
    const promises: Promise<TopItem[]>[] = [
      fetchTopItems(userId, 'ramo', 10, scope.scope, scope.oficina_id || undefined, fechaDesde, fechaHasta, vendedorId),
      fetchTopItems(userId, 'aseguradora', 10, scope.scope, scope.oficina_id || undefined, fechaDesde, fechaHasta, vendedorId),
    ];
    if (isAdmin) {
      promises.push(fetchTopItems(userId, 'oficina', 10, scope.scope, scope.oficina_id || undefined, fechaDesde, fechaHasta, vendedorId));
      promises.push(fetchTopItems(userId, 'vendedor', 10, scope.scope, scope.oficina_id || undefined, fechaDesde, fechaHasta, vendedorId));
    }
    Promise.all(promises).then(results => {
      setTopRamos(results[0]);
      setTopAseguradoras(results[1]);
      if (results[2]) setTopOficinas(results[2]);
      if (results[3]) setTopVendedores(results[3]);
    }).catch(() => {})
    .finally(() => setLoadingTop(false));
  }, [userId, scope, isAdmin, vendedorId, fechaDesde, fechaHasta]);

  const emisionLineData = useMemo(() => {
    if (!charts?.prima_por_mes) return [];
    return charts.prima_por_mes.map(m => ({
      label: monthLabel(m.mes),
      value: m.emisiones,
    }));
  }, [charts]);

  const primaComparativoData = useMemo(() => {
    if (!charts?.prima_por_mes || charts.prima_por_mes.length < 2) return [];
    return charts.prima_por_mes.map(m => ({
      label: monthLabel(m.mes),
      value1: m.prima_neta,
      value2: m.prima_total,
    }));
  }, [charts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKPI icon={FileText} label="Emisiones" value={formatNumber(kpis?.total_emitidos || 0)} color={accentColor} />
        <MiniKPI icon={DollarSign} label="Prima Neta" value={formatCurrency(kpis?.prima_neta_emitida || 0)} color="#10b981" />
        <MiniKPI icon={BarChart3} label="Ticket Promedio" value={formatCurrency(kpis?.ticket_promedio || 0)} color="#8b5cf6" />
        <MiniKPI icon={TrendingUp} label="Var. Mensual" value={`${(kpis?.variacion_mes_anterior ?? 0) > 0 ? '+' : ''}${(kpis?.variacion_mes_anterior ?? 0).toFixed(1)}%`} color={((kpis?.variacion_mes_anterior ?? 0) >= 0) ? '#10b981' : '#ef4444'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficaLinea
          data={emisionLineData}
          title="Emisiones por Mes"
          valueFormatter={v => formatNumber(v)}
          color={accentColor}
          height={280}
        />
        <GraficaColumnasAgrupadas
          data={primaComparativoData}
          title="Prima Neta vs Prima Total"
          series1Label="Prima Neta"
          series2Label="Prima Total"
          series1Color={accentColor}
          series2Color="#94a3b8"
          valueFormatter={v => formatCurrency(v)}
          height={280}
        />
      </div>

      {/* Top Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopTable
          title="Top 10 Ramos"
          items={topRamos}
          loading={loadingTop}
          accentColor={accentColor}
          onItemClick={onEntityClick ? (item) => onEntityClick('ramo', item.nombre) : undefined}
        />
        <TopTable
          title="Top 10 Aseguradoras"
          items={topAseguradoras}
          loading={loadingTop}
          accentColor={accentColor}
          onItemClick={onEntityClick ? (item) => onEntityClick('aseguradora', item.nombre) : undefined}
        />
      </div>

      {/* Admin: Top Offices & Vendors */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopTable
            title="Top 10 Oficinas"
            icon={MapPin}
            items={topOficinas}
            loading={loadingTop}
            accentColor="#8b5cf6"
            onItemClick={onEntityClick ? (item) => onEntityClick('oficina', item.nombre, item.oficina_id) : undefined}
          />
          <TopTable
            title="Top 10 Vendedores"
            icon={UserCircle}
            items={topVendedores}
            loading={loadingTop}
            accentColor="#06b6d4"
            onItemClick={onEntityClick ? (item) => onEntityClick('vendedor', item.nombre, item.vend_id) : undefined}
          />
        </div>
      )}
    </div>
  );
}

function MiniKPI({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function TopTable({ title, icon: TblIcon, items, loading, accentColor, onItemClick }: {
  title: string; icon?: React.ElementType; items: TopItem[]; loading: boolean; accentColor: string;
  onItemClick?: (item: TopItem) => void;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const maxPrima = Math.max(...items.map(i => i.prima_neta), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        {TblIcon && <TblIcon className="w-4 h-4" style={{ color: accentColor }} />}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Sin datos</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${onItemClick ? 'cursor-pointer' : ''}`}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 w-5 text-right">{idx + 1}</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.nombre}</span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(item.prima_neta)}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">{formatNumber(item.documentos)} docs</span>
                </div>
              </div>
              <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(item.prima_neta / maxPrima) * 100}%`, backgroundColor: accentColor }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
