import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, TriangleAlert as AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';

interface CPData {
  ytd_prima: number;
  ytd_polizas: number;
  meta_prima: number;
  avance_meta_pct: number;
  month_prima: number;
  month_polizas: number;
  month_growth: number;
  prev_month_prima: number;
  cobranza_count: number;
  cobranza_prima: number;
  renov_30: number;
  renov_60: number;
  renov_90: number;
  comisiones_mes: number;
  top_ramos: { nombre: string; polizas: number; prima: number }[];
  current_year: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
}

function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-400 dark:text-white/30">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
  const positive = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {positive ? '+' : ''}{value}%
    </span>
  );
}

function ProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  const color = percent >= 100 ? '#10b981' : percent >= 70 ? '#0ea5e9' : percent >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke}
        className="text-neutral-100 dark:text-white/8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

export function CentroProduccionWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<CPData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_cp_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        if (d) setData(d as unknown as CPData);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id, usuario.rol, usuario.oficina_id]);

  const isManager = ['Administrador', 'Gerente'].includes(usuario.rol);
  const scopeLabel = isManager ? (usuario.rol === 'Administrador' ? 'Global' : 'Oficina') : 'Personal';

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] p-5 animate-pulse">
        <div className="h-5 w-48 bg-neutral-100 dark:bg-white/6 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-neutral-100 dark:bg-white/6 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-neutral-400 dark:text-white/30">Sin datos de produccion disponibles</p>
      </div>
    );
  }

  const totalRenov = data.renov_30 + data.renov_60 + data.renov_90;

  return (
    <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-50 dark:border-white/4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-white/80">Centro de Produccion</h3>
            <p className="text-[10px] text-neutral-400 dark:text-white/30">{scopeLabel} &middot; {data.current_year}</p>
          </div>
        </div>
        <button
          onClick={() => nav('/produccion')}
          className="text-xs text-neutral-400 dark:text-white/30 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 transition-colors"
        >
          Ver todo <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Row 1: YTD Production with Meta Progress + Monthly */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* YTD Card with progress ring */}
          <div className="md:col-span-2 flex items-center gap-4 rounded-xl bg-gradient-to-br from-slate-50 to-cyan-50/30 dark:from-white/[0.03] dark:to-cyan-500/[0.03] border border-neutral-100 dark:border-white/6 p-4">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <ProgressRing percent={data.avance_meta_pct} size={64} />
              <span className="absolute text-xs font-bold text-neutral-800 dark:text-white/80">
                {Math.round(data.avance_meta_pct)}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-neutral-400 dark:text-white/35 uppercase tracking-wider mb-0.5">Produccion YTD</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">{fmt(data.ytd_prima)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-neutral-400 dark:text-white/30">Meta: {fmt(data.meta_prima)}</span>
                <span className="text-[10px] text-neutral-300 dark:text-white/15">&middot;</span>
                <span className="text-[10px] text-neutral-400 dark:text-white/30">{data.ytd_polizas} polizas</span>
              </div>
            </div>
          </div>

          {/* Monthly card */}
          <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/6 p-4 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-medium text-neutral-400 dark:text-white/35 uppercase tracking-wider mb-0.5">Produccion mes</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">{fmt(data.month_prima)}</p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-neutral-400 dark:text-white/30">{data.month_polizas} polizas</span>
              <GrowthBadge value={data.month_growth} />
            </div>
          </div>
        </div>

        {/* Row 2: Mini KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Comisiones */}
          <button
            onClick={() => nav('/produccion/mis-comisiones')}
            className="text-left rounded-xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/6 p-3 hover:border-blue-200 dark:hover:border-blue-500/20 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-2">
              <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{fmt(data.comisiones_mes)}</p>
            <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">Comisiones mes</p>
          </button>

          {/* Cobranza Pendiente */}
          <button
            onClick={() => nav('/produccion/cobranza')}
            className="text-left rounded-xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/6 p-3 hover:border-amber-200 dark:hover:border-amber-500/20 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{data.cobranza_count}</p>
            <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">Cob. pendiente</p>
          </button>

          {/* Renovaciones */}
          <button
            onClick={() => nav('/mis-polizas')}
            className="text-left rounded-xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/6 p-3 hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-2">
              <Calendar className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{totalRenov}</p>
            <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">Renovaciones 90d</p>
          </button>

          {/* Polizas YTD */}
          <button
            onClick={() => nav('/produccion')}
            className="text-left rounded-xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/6 p-3 hover:border-emerald-200 dark:hover:border-emerald-500/20 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{data.ytd_polizas}</p>
            <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">Polizas {data.current_year}</p>
          </button>
        </div>

        {/* Row 3: Top Ramos (only if data) */}
        {data.top_ramos.length > 0 && (
          <div className="rounded-xl border border-neutral-100 dark:border-white/6 overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50/50 dark:bg-white/[0.02] border-b border-neutral-100 dark:border-white/4">
              <p className="text-[10px] font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wider">Top Ramos {data.current_year}</p>
            </div>
            <div className="divide-y divide-neutral-50 dark:divide-white/4">
              {data.top_ramos.map((ramo, i) => {
                const maxPrima = data.top_ramos[0]?.prima || 1;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[10px] font-bold text-neutral-300 dark:text-white/20 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-neutral-700 dark:text-white/70 truncate">{ramo.nombre}</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white tabular-nums flex-shrink-0">{fmt(ramo.prima)}</span>
                      </div>
                      <div className="h-1 bg-neutral-100 dark:bg-white/6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${(ramo.prima / maxPrima) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-400 dark:text-white/30 flex-shrink-0">{ramo.polizas}p</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
