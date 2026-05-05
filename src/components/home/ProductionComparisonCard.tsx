import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionData {
  current_year: number;
  prev_year: number;
  current_prima: number;
  current_polizas: number;
  prev_prima: number;
  prev_polizas: number;
  meta_prima: number;
  meta_polizas: number;
  growth_prima_pct: number;
  growth_polizas_pct: number;
  avance_meta_prima_pct: number;
  avance_meta_polizas_pct: number;
}

interface Props {
  data: ProductionData | null;
  loading: boolean;
  onClick?: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-neutral-100 dark:bg-white/8 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProductionComparisonCard({ data, loading, onClick }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-white/8" />
          <div className="h-4 w-40 bg-neutral-100 dark:bg-white/8 rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-neutral-100 dark:bg-white/8 rounded-lg" />
          <div className="h-2 bg-neutral-100 dark:bg-white/8 rounded-full" />
          <div className="h-10 bg-neutral-100 dark:bg-white/8 rounded-lg" />
          <div className="h-2 bg-neutral-100 dark:bg-white/8 rounded-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15">
            <BarChart3 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Produccion Comparativa</h3>
        </div>
        <p className="text-sm text-neutral-400 dark:text-white/30 text-center py-6">Sin datos disponibles</p>
      </div>
    );
  }

  const primaGrowthPositive = data.growth_prima_pct >= 0;
  const polizasGrowthPositive = data.growth_polizas_pct >= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5 transition-all duration-200 ease-smooth h-full flex flex-col",
        onClick && "cursor-pointer hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-white/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15">
            <BarChart3 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Produccion</h3>
            <p className="text-[11px] text-neutral-400 dark:text-white/30">Ene - Hoy {data.current_year}</p>
          </div>
        </div>
        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
          primaGrowthPositive
            ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400"
        )}>
          {primaGrowthPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {primaGrowthPositive ? '+' : ''}{data.growth_prima_pct}%
        </div>
      </div>

      {/* Prima Neta Section */}
      <div className="flex-1 space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-white/40">Prima Neta</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              {formatCurrency(data.current_prima)}
            </span>
          </div>
          <ProgressBar
            value={data.current_prima}
            max={data.meta_prima}
            color="bg-gradient-to-r from-emerald-400 to-emerald-500"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-neutral-400 dark:text-white/25">
              {data.prev_year}: {formatCurrency(data.prev_prima)}
            </span>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-neutral-400 dark:text-white/30" />
              <span className="text-[10px] text-neutral-400 dark:text-white/25">
                Meta: {formatCurrency(data.meta_prima)}
              </span>
            </div>
          </div>
        </div>

        {/* Polizas Section */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-white/40">Polizas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                {data.current_polizas.toLocaleString()}
              </span>
              <span className={cn(
                "text-[11px] font-semibold",
                polizasGrowthPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {polizasGrowthPositive ? '+' : ''}{data.growth_polizas_pct}%
              </span>
            </div>
          </div>
          <ProgressBar
            value={data.current_polizas}
            max={data.meta_polizas}
            color="bg-gradient-to-r from-sky-400 to-sky-500"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-neutral-400 dark:text-white/25">
              {data.prev_year}: {data.prev_polizas.toLocaleString()}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-white/25">
              Meta: {data.meta_polizas.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Avance Meta */}
        <div className="pt-2 border-t border-neutral-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-white/40">Avance vs Meta (+20%)</span>
            <span className={cn(
              "text-sm font-bold",
              data.avance_meta_prima_pct >= 100
                ? "text-emerald-600 dark:text-emerald-400"
                : data.avance_meta_prima_pct >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
            )}>
              {data.avance_meta_prima_pct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
