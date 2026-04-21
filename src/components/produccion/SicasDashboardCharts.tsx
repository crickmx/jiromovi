import { useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Users, Building2, Shield, CalendarClock } from 'lucide-react';
import GraficaLinea from './GraficaLinea';
import GraficaColumnasAgrupadas from './GraficaColumnasAgrupadas';
import GraficaCircular from '../../components/comisiones/GraficaCircular';
import GraficaColumnas from '../../components/comisiones/GraficaColumnas';

interface ChartData {
  primaPorMes: Array<{ mes: string; primaNeta: number; primaTotal: number; emisiones: number; count: number }>;
  porRamo: Array<{ name: string; count: number; prima: number }>;
  porAseguradora: Array<{ name: string; count: number; prima: number }>;
  porCliente: Array<{ name: string; count: number; prima: number }>;
  porSubramo: Array<{ name: string; count: number; prima: number }>;
  porEstatus: Array<{ estatus: string; count: number; prima: number }>;
  tipoDistribution: Array<{ tipo: string; count: number; prima: number }>;
  renovacionesPorPeriodo: Array<{ periodo: string; count: number; prima: number }>;
}

interface Props {
  charts: ChartData | null;
  loading: boolean;
  onChartItemClick?: (chartType: string, item: string) => void;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function fmtMonth(mes: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const [, m] = mes.split('-').map(Number);
  return m ? months[m - 1] || mes : mes;
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
];

function ChartCard({ title, icon: Icon, children, className = '' }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LoadingChart() {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-xs text-gray-400">Cargando...</span>
      </div>
    </div>
  );
}

function HorizontalBarChart({ data, valueFormatter = fmtCurrency, maxItems = 8 }: {
  data: Array<{ name: string; prima: number; count: number }>;
  valueFormatter?: (v: number) => string;
  maxItems?: number;
}) {
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => d.prima), 1);

  if (items.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Sin datos</p>;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.name} className="group">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{item.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{valueFormatter(item.prima)}</span>
          </div>
          <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out flex items-center px-2"
              style={{
                width: `${Math.max((item.prima / maxVal) * 100, 2)}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            >
              <span className="text-[10px] text-white font-medium whitespace-nowrap">{item.count} docs</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SicasDashboardCharts({ charts, loading, onChartItemClick }: Props) {
  const [chartView, setChartView] = useState<'prima' | 'emisiones'>('prima');

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <LoadingChart />
          </div>
        ))}
      </div>
    );
  }

  if (!charts) return null;

  const primaMesData = charts.primaPorMes.map(d => ({
    label: fmtMonth(d.mes),
    value1: d.primaTotal,
    value2: d.primaNeta,
  }));

  const emisionesMesData = charts.primaPorMes.map(d => ({
    label: fmtMonth(d.mes),
    value: d.emisiones,
  }));

  return (
    <div className="space-y-4">
      {/* Row 1: Prima por mes (full width) */}
      <ChartCard title="Prima Emitida por Mes" icon={TrendingUp} className="col-span-full">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setChartView('prima')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${chartView === 'prima' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Prima
          </button>
          <button
            onClick={() => setChartView('emisiones')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${chartView === 'emisiones' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Emisiones
          </button>
        </div>
        {chartView === 'prima' ? (
          <GraficaColumnasAgrupadas
            data={primaMesData}
            title=""
            series1Label="Prima Total"
            series2Label="Prima Neta"
            series1Color="#3b82f6"
            series2Color="#10b981"
            valueFormatter={fmtCurrency}
            height={280}
          />
        ) : (
          <GraficaLinea
            data={emisionesMesData}
            title=""
            color="#3b82f6"
            valueFormatter={(v) => v.toLocaleString()}
            height={280}
          />
        )}
      </ChartCard>

      {/* Row 2: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emisiones por ramo */}
        <ChartCard title="Emisiones por Ramo" icon={BarChart3}>
          <HorizontalBarChart data={charts.porRamo} />
        </ChartCard>

        {/* Emisiones por aseguradora */}
        <ChartCard title="Emisiones por Aseguradora" icon={Building2}>
          <HorizontalBarChart data={charts.porAseguradora} />
        </ChartCard>

        {/* Top clientes */}
        <ChartCard title="Top Clientes por Prima" icon={Users}>
          <HorizontalBarChart data={charts.porCliente} />
        </ChartCard>

        {/* Top subramos */}
        <ChartCard title="Top Subramos" icon={BarChart3}>
          <HorizontalBarChart data={charts.porSubramo} />
        </ChartCard>

        {/* Polizas vs Fianzas */}
        <ChartCard title="Polizas vs Fianzas" icon={Shield}>
          <GraficaCircular
            data={charts.tipoDistribution.map((d, i) => ({
              label: d.tipo,
              value: d.count,
              color: CHART_COLORS[i],
            }))}
            title=""
            valueFormatter={(v) => `${v} documentos`}
            size={220}
          />
        </ChartCard>

        {/* Renovaciones por periodo */}
        <ChartCard title="Vencimientos Proximos" icon={CalendarClock}>
          {charts.renovacionesPorPeriodo.length > 0 ? (
            <GraficaColumnas
              data={charts.renovacionesPorPeriodo.map((d, i) => ({
                label: d.periodo,
                value: d.count,
                color: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6',
              }))}
              title=""
              valueFormatter={(v) => `${v} docs`}
              height={220}
            />
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No hay vencimientos en los proximos 30 dias
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
