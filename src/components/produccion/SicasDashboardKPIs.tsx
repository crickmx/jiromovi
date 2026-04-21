import { TrendingUp, TrendingDown, FileText, Shield, Briefcase, DollarSign, Users, Clock, XCircle, Target, Award, Building2, BarChart3, CalendarClock, Minus } from 'lucide-react';

interface KPIs {
  polizasEmitidas: number;
  fianzasEmitidas: number;
  totalDocumentos: number;
  primaNetaEmitida: number;
  primaTotalEmitida: number;
  mesPrimaNeta: number;
  mesPrimaTotal: number;
  mesEmisiones: number;
  clientesMes: number;
  clientesTotal: number;
  polizasVigentes: number;
  fianzasVigentes: number;
  primaVigente: number;
  renovaciones7dias: number;
  renovaciones15dias: number;
  renovaciones30dias: number;
  renovacionesMes: number;
  primaRenovar: number;
  cancelaciones: number;
  ticketPromedio: number;
  topClientePeriodo: string;
  topAseguradoraPeriodo: string;
  topRamoPeriodo: string;
  variacionMesAnterior: number;
  variacionInteranual: number;
}

interface Props {
  kpis: KPIs | null;
  loading: boolean;
  periodo: string;
  onKpiClick?: (kpiKey: string) => void;
}

function fmt(value: number, type: 'currency' | 'number' | 'percent' = 'number'): string {
  if (type === 'currency') return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  if (type === 'percent') return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  return value.toLocaleString('es-MX');
}

function VariationBadge({ value }: { value: number }) {
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmt(value, 'percent')}
    </span>
  );
}

function Skeleton() {
  return <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />;
}

interface KpiCardDef {
  key: string;
  label: string;
  icon: React.ElementType;
  gradient: string;
  getValue: (k: KPIs) => string;
  getSubValue?: (k: KPIs) => React.ReactNode;
}

const primaryKpis: KpiCardDef[] = [
  {
    key: 'mesPrimaTotal', label: 'Prima Emitida (Mes)', icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600',
    getValue: k => fmt(k.mesPrimaTotal, 'currency'),
    getSubValue: k => <VariationBadge value={k.variacionMesAnterior} />,
  },
  {
    key: 'polizasEmitidas', label: 'Polizas Emitidas', icon: Shield, gradient: 'from-blue-500 to-blue-600',
    getValue: k => fmt(k.polizasEmitidas),
    getSubValue: k => <span className="text-xs text-gray-500">{fmt(k.polizasVigentes)} vigentes</span>,
  },
  {
    key: 'fianzasEmitidas', label: 'Fianzas Emitidas', icon: Briefcase, gradient: 'from-orange-500 to-orange-600',
    getValue: k => fmt(k.fianzasEmitidas),
    getSubValue: k => <span className="text-xs text-gray-500">{fmt(k.fianzasVigentes)} vigentes</span>,
  },
  {
    key: 'renovacionesMes', label: 'Renovaciones del Mes', icon: CalendarClock, gradient: 'from-amber-500 to-amber-600',
    getValue: k => fmt(k.renovacionesMes),
    getSubValue: k => <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{fmt(k.primaRenovar, 'currency')} por renovar</span>,
  },
];

const secondaryKpis: KpiCardDef[] = [
  { key: 'primaNetaEmitida', label: 'Prima Neta Total', icon: DollarSign, gradient: 'from-teal-500 to-teal-600', getValue: k => fmt(k.primaNetaEmitida, 'currency') },
  { key: 'primaTotalEmitida', label: 'Prima Total', icon: TrendingUp, gradient: 'from-sky-500 to-sky-600', getValue: k => fmt(k.primaTotalEmitida, 'currency') },
  { key: 'clientesMes', label: 'Clientes (Periodo)', icon: Users, gradient: 'from-cyan-500 to-cyan-600', getValue: k => fmt(k.clientesMes), getSubValue: k => <span className="text-xs text-gray-500">{fmt(k.clientesTotal)} total</span> },
  { key: 'primaVigente', label: 'Prima Vigente', icon: Shield, gradient: 'from-green-500 to-green-600', getValue: k => fmt(k.primaVigente, 'currency') },
  { key: 'renovaciones7dias', label: 'Renov. 7 dias', icon: Clock, gradient: 'from-red-500 to-red-600', getValue: k => fmt(k.renovaciones7dias) },
  { key: 'renovaciones15dias', label: 'Renov. 15 dias', icon: Clock, gradient: 'from-orange-500 to-orange-600', getValue: k => fmt(k.renovaciones15dias) },
  { key: 'renovaciones30dias', label: 'Renov. 30 dias', icon: CalendarClock, gradient: 'from-amber-500 to-amber-600', getValue: k => fmt(k.renovaciones30dias) },
  { key: 'cancelaciones', label: 'Cancelaciones', icon: XCircle, gradient: 'from-red-500 to-red-600', getValue: k => fmt(k.cancelaciones) },
  { key: 'ticketPromedio', label: 'Ticket Promedio', icon: Target, gradient: 'from-blue-500 to-blue-600', getValue: k => fmt(k.ticketPromedio, 'currency') },
  { key: 'topClientePeriodo', label: 'Top Cliente', icon: Award, gradient: 'from-yellow-500 to-yellow-600', getValue: k => k.topClientePeriodo },
  { key: 'topAseguradoraPeriodo', label: 'Top Aseguradora', icon: Building2, gradient: 'from-sky-500 to-sky-600', getValue: k => k.topAseguradoraPeriodo },
  { key: 'topRamoPeriodo', label: 'Top Ramo', icon: BarChart3, gradient: 'from-teal-500 to-teal-600', getValue: k => k.topRamoPeriodo },
];

function KpiCard({ def, kpis, loading, onClick }: { def: KpiCardDef; kpis: KPIs | null; loading: boolean; onClick?: () => void }) {
  const Icon = def.icon;
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 relative overflow-hidden text-left transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5 group cursor-pointer"
    >
      <div className={`absolute inset-0 opacity-[0.03] bg-gradient-to-br ${def.gradient} group-hover:opacity-[0.06] transition-opacity`} />
      <div className="relative">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${def.gradient} flex items-center justify-center mb-2 shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {loading || !kpis ? <Skeleton /> : (
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{def.getValue(kpis)}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{def.label}</p>
        {!loading && kpis && def.getSubValue && (
          <div className="mt-1">{def.getSubValue(kpis)}</div>
        )}
      </div>
    </button>
  );
}

export default function SicasDashboardKPIs({ kpis, loading, periodo, onKpiClick }: Props) {
  return (
    <div className="space-y-4">
      {/* Primary KPIs - larger cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {primaryKpis.map(def => (
          <KpiCard key={def.key} def={def} kpis={kpis} loading={loading} onClick={() => onKpiClick?.(def.key)} />
        ))}
      </div>

      {/* Secondary KPIs - smaller grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {secondaryKpis.map(def => (
          <KpiCard key={def.key} def={def} kpis={kpis} loading={loading} onClick={() => onKpiClick?.(def.key)} />
        ))}
      </div>

      {/* Variation cards */}
      {!loading && kpis && (
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">vs mes anterior</span>
            <VariationBadge value={kpis.variacionMesAnterior} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">vs mismo mes ano anterior</span>
            <VariationBadge value={kpis.variacionInteranual} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Periodo:</span>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{periodo}</span>
          </div>
        </div>
      )}
    </div>
  );
}
