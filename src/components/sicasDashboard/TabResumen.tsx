import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, FileText, Shield, Users,
  Building2, Layers, CalendarClock, DollarSign, BarChart3,
  ArrowRight, AlertTriangle, CheckCircle2, Minus,
} from 'lucide-react';
import type { DashboardKPIs, DashboardCharts, DashboardTab } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber, formatPercent, monthLabel } from '../../lib/sicasDashboardTypes';
import GraficaLinea from '../produccion/GraficaLinea';
import GraficaCircular from '../comisiones/GraficaCircular';

interface Props {
  kpis: DashboardKPIs | null;
  charts: DashboardCharts | null;
  loading: boolean;
  accentColor: string;
  onDocumentClick: (docId: string) => void;
  onTabChange: (tab: DashboardTab) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </div>
  );
}

function KPICard({ label, value, subtitle, icon: Icon, trend, color, onClick }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number | null;
  color: string;
  onClick?: () => void;
}) {
  const trendIcon = trend === null || trend === undefined ? null
    : trend > 0 ? TrendingUp
    : trend < 0 ? TrendingDown
    : Minus;

  const trendColor = trend === null || trend === undefined ? ''
    : trend > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : trend < 0 ? 'text-red-500 dark:text-red-400'
    : 'text-gray-500';

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trendIcon && trend !== null && trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            {(() => { const TI = trendIcon; return <TI className="w-3 h-3" />; })()}
            {formatPercent(trend)}
          </div>
        )}
      </div>
      <p className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      <div className="flex items-center gap-1 text-[10px] font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
        Ver detalle <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

export default function TabResumen({ kpis, charts, loading, accentColor, onDocumentClick, onTabChange }: Props) {
  const primaLineData = useMemo(() => {
    if (!charts?.prima_por_mes) return [];
    return charts.prima_por_mes.map(m => ({
      label: monthLabel(m.mes),
      value: m.prima_neta,
    }));
  }, [charts]);

  const aseguradoraPieData = useMemo(() => {
    if (!charts?.por_aseguradora) return [];
    return charts.por_aseguradora.slice(0, 8).map(a => ({
      label: a.nombre,
      value: a.prima,
    }));
  }, [charts]);

  const ramoPieData = useMemo(() => {
    if (!charts?.por_ramo) return [];
    return charts.por_ramo.slice(0, 8).map(r => ({
      label: r.nombre,
      value: r.prima,
    }));
  }, [charts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-80 animate-pulse" />
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-700 dark:text-gray-300 font-medium">No hay datos de produccion disponibles</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Ejecuta una sincronizacion desde la pestana correspondiente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Documentos Emitidos"
          value={formatNumber(kpis.total_emitidos)}
          subtitle={`${formatNumber(kpis.polizas_emitidas)} polizas, ${formatNumber(kpis.fianzas_emitidas)} fianzas`}
          icon={FileText}
          color={accentColor}
          onClick={() => onTabChange('produccion')}
        />
        <KPICard
          label="Prima Neta Emitida"
          value={formatCurrency(kpis.prima_neta_emitida)}
          subtitle={`Prima total: ${formatCurrency(kpis.prima_total_emitida)}`}
          icon={DollarSign}
          trend={kpis.variacion_mes_anterior}
          color="#10b981"
          onClick={() => onTabChange('produccion')}
        />
        <KPICard
          label="Documentos Vigentes"
          value={formatNumber(kpis.documentos_vigentes)}
          subtitle={`${formatNumber(kpis.clientes_vigentes)} clientes activos`}
          icon={CheckCircle2}
          color="#0ea5e9"
          onClick={() => onTabChange('documentos')}
        />
        <KPICard
          label="Renovaciones Pendientes"
          value={formatNumber(kpis.renovaciones_pendientes)}
          subtitle={`Prima: ${formatCurrency(kpis.prima_por_renovar)}`}
          icon={CalendarClock}
          color="#f59e0b"
          onClick={() => onTabChange('renovaciones')}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Ticket Promedio"
          value={formatCurrency(kpis.ticket_promedio)}
          icon={BarChart3}
          color="#8b5cf6"
          onClick={() => onTabChange('produccion')}
        />
        <KPICard
          label="Clientes en Emision"
          value={formatNumber(kpis.clientes_emision)}
          icon={Users}
          color="#06b6d4"
          onClick={() => onTabChange('clientes')}
        />
        <KPICard
          label="Acumulado YTD"
          value={formatCurrency(kpis.acumulado_ytd)}
          subtitle={`Ant: ${formatCurrency(kpis.acumulado_ytd_anterior)}`}
          trend={kpis.crecimiento_ytd}
          icon={TrendingUp}
          color="#10b981"
          onClick={() => onTabChange('comparativos')}
        />
        <KPICard
          label="Cancelaciones"
          value={formatNumber(kpis.cancelaciones_periodo)}
          icon={AlertTriangle}
          color="#ef4444"
          onClick={() => onTabChange('documentos')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficaLinea
          data={primaLineData}
          title="Prima Neta por Mes"
          valueFormatter={v => formatFullCurrency(v)}
          color={accentColor}
          height={280}
        />
        <GraficaCircular
          data={aseguradoraPieData}
          title="Distribucion por Aseguradora"
          valueFormatter={v => formatCurrency(v)}
          size={220}
        />
      </div>

      {/* Renovaciones urgentes + Top items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Renovaciones urgentes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-500" /> Renovaciones Urgentes
          </h3>
          <div className="space-y-2">
            <RenewalBadge label="Proximos 7 dias" count={kpis.renovaciones_7dias} color="bg-red-500" onClick={() => onTabChange('renovaciones')} />
            <RenewalBadge label="Proximos 15 dias" count={kpis.renovaciones_15dias} color="bg-orange-500" onClick={() => onTabChange('renovaciones')} />
            <RenewalBadge label="Proximos 30 dias" count={kpis.renovaciones_30dias} color="bg-amber-500" onClick={() => onTabChange('renovaciones')} />
          </div>
          <button
            onClick={() => onTabChange('renovaciones')}
            className="mt-3 w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Ver todas las renovaciones
          </button>
        </div>

        {/* Top cliente */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Principal Cliente
          </h3>
          {kpis.top_cliente?.nombre ? (
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white truncate">{kpis.top_cliente.nombre}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatFullCurrency(kpis.top_cliente.prima)}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Concentracion top 5: {formatPercent(kpis.concentracion_top5_clientes)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin datos</p>
          )}
          <button
            onClick={() => onTabChange('clientes')}
            className="mt-3 w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Ver todos los clientes
          </button>
        </div>

        {/* Top aseguradora */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-500" /> Principal Aseguradora
          </h3>
          {kpis.top_aseguradora?.nombre ? (
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white truncate">{kpis.top_aseguradora.nombre}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatFullCurrency(kpis.top_aseguradora.prima)}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Concentracion top 3: {formatPercent(kpis.concentracion_top3_aseguradoras)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin datos</p>
          )}
          <button
            onClick={() => onTabChange('aseguradoras')}
            className="mt-3 w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Ver todas las aseguradoras
          </button>
        </div>
      </div>

      {/* Prima por ramo chart */}
      <GraficaCircular
        data={ramoPieData}
        title="Distribucion por Ramo"
        valueFormatter={v => formatCurrency(v)}
        size={220}
      />
    </div>
  );
}

function RenewalBadge({ label, count, color, onClick }: { label: string; count: number; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatNumber(count)}</span>
    </button>
  );
}
