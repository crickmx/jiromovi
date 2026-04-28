import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, GitCompare, DollarSign, BarChart3 } from 'lucide-react';
import type { DashboardKPIs, DashboardCharts } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber, formatPercent, monthLabel } from '../../lib/sicasDashboardTypes';
import GraficaColumnasAgrupadas from '../produccion/GraficaColumnasAgrupadas';
import GraficaLinea from '../produccion/GraficaLinea';

interface Props {
  kpis: DashboardKPIs | null;
  charts: DashboardCharts | null;
  loading: boolean;
  accentColor: string;
}

export default function TabComparativos({ kpis, charts, loading, accentColor }: Props) {
  const primaLineData = useMemo(() => {
    if (!charts?.prima_por_mes) return [];
    return charts.prima_por_mes.map(m => ({
      label: monthLabel(m.mes),
      value: m.prima_neta,
    }));
  }, [charts]);

  const emisionesData = useMemo(() => {
    if (!charts?.prima_por_mes) return [];
    return charts.prima_por_mes.map(m => ({
      label: monthLabel(m.mes),
      value1: m.polizas,
      value2: m.fianzas,
    }));
  }, [charts]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500">
        Sin datos comparativos disponibles
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComparisonCard
          title="vs Mes Anterior"
          current={kpis.prima_neta_emitida}
          previous={kpis.prima_mes_anterior}
          variation={kpis.variacion_mes_anterior}
          accentColor={accentColor}
        />
        <ComparisonCard
          title="vs Mismo Mes Ano Anterior"
          current={kpis.prima_neta_emitida}
          previous={kpis.prima_mismo_mes_ant}
          variation={kpis.variacion_interanual}
          accentColor={accentColor}
        />
        <ComparisonCard
          title="Acumulado YTD"
          current={kpis.acumulado_ytd}
          previous={kpis.acumulado_ytd_anterior}
          variation={kpis.crecimiento_ytd}
          accentColor={accentColor}
        />
      </div>

      {/* Concentration indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Concentracion de Cartera
          </h3>
          <div className="space-y-4">
            <ConcentrationBar
              label="Top 5 Clientes"
              value={kpis.concentracion_top5_clientes}
              color="#0ea5e9"
            />
            <ConcentrationBar
              label="Top 3 Aseguradoras"
              value={kpis.concentracion_top3_aseguradoras}
              color="#14b8a6"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
            Una alta concentracion indica dependencia de pocos clientes/aseguradoras. Se recomienda diversificar por debajo del 60%.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Metricas Clave
          </h3>
          <div className="space-y-3">
            <MetricRow label="Ticket Promedio" value={formatFullCurrency(kpis.ticket_promedio)} />
            <MetricRow label="Prima Vigente Total" value={formatFullCurrency(kpis.prima_vigente)} />
            <MetricRow label="Clientes Vigentes" value={formatNumber(kpis.clientes_vigentes)} />
            <MetricRow label="Documentos Vigentes" value={formatNumber(kpis.documentos_vigentes)} />
            <MetricRow label="Cancelaciones" value={formatNumber(kpis.cancelaciones_periodo)} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <GraficaLinea
        data={primaLineData}
        title="Evolucion de Prima Neta"
        valueFormatter={v => formatFullCurrency(v)}
        color={accentColor}
        height={300}
      />

      <GraficaColumnasAgrupadas
        data={emisionesData}
        title="Polizas vs Fianzas por Mes"
        series1Label="Polizas"
        series2Label="Fianzas"
        series1Color={accentColor}
        series2Color="#f59e0b"
        valueFormatter={v => formatNumber(v)}
        height={280}
      />
    </div>
  );
}

function ComparisonCard({ title, current, previous, variation, accentColor }: {
  title: string; current: number; previous: number; variation: number; accentColor: string;
}) {
  const isPositive = variation > 0;
  const isNeutral = variation === 0;
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{title}</h3>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-bold">{formatPercent(variation)}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Actual</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatFullCurrency(current)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Anterior</p>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{formatFullCurrency(previous)}</p>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, previous > 0 ? (current / previous) * 100 : 100)}%`,
              backgroundColor: isPositive ? '#10b981' : isNeutral ? '#6b7280' : '#ef4444',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ConcentrationBar({ label, value, color }: { label: string; value: number; color: string }) {
  const isRisky = Math.abs(value) > 60;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`text-xs font-bold ${isRisky ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
          {Math.abs(value).toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.abs(value))}%`, backgroundColor: isRisky ? '#f59e0b' : color }}
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
