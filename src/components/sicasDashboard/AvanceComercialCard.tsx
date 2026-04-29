import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target, TrendingUp, TrendingDown, ChevronRight, Loader2,
  Zap, Award, AlertCircle,
} from 'lucide-react';
import type { AvanceComercialData, DashboardScope } from '../../lib/sicasDashboardTypes';
import { formatCurrency, formatFullCurrency, formatNumber } from '../../lib/sicasDashboardTypes';
import { fetchAvanceComercial } from '../../lib/sicasDashboardService';
import AvanceComercialModal from './AvanceComercialModal';

interface Props {
  userId: string;
  scope: DashboardScope | null;
  vendedorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  accentColor: string;
  onDocumentClick: (docId: string) => void;
}

export default function AvanceComercialCard({
  userId, scope, vendedorId, fechaDesde, fechaHasta, accentColor, onDocumentClick,
}: Props) {
  const [data, setData] = useState<AvanceComercialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !scope) return;
    setLoading(true);
    try {
      const result = await fetchAvanceComercial(
        userId,
        scope.scope,
        scope.oficina_id || undefined,
        vendedorId,
        fechaDesde,
        fechaHasta,
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, scope, vendedorId, fechaDesde, fechaHasta]);

  useEffect(() => { load(); }, [load]);

  const avancePrima = data?.crecimiento.avance_meta_prima_pct ?? 0;
  const avancePolizas = data?.crecimiento.avance_meta_polizas_pct ?? 0;
  const crecPrima = data?.crecimiento.prima_vs_anterior ?? 0;

  const sentiment = useMemo(() => {
    if (!data) return 'neutral';
    if (avancePrima >= 100 && crecPrima >= 0) return 'excellent';
    if (avancePrima >= 70 || crecPrima > 0) return 'good';
    if (avancePrima >= 40) return 'warning';
    return 'behind';
  }, [data, avancePrima, crecPrima]);

  const sentimentConfig = {
    excellent: { gradient: 'from-emerald-500 to-teal-600', icon: Award, label: 'Meta superada', ringColor: 'stroke-emerald-400' },
    good: { gradient: 'from-blue-500 to-cyan-600', icon: TrendingUp, label: 'En buen ritmo', ringColor: 'stroke-blue-400' },
    warning: { gradient: 'from-amber-500 to-orange-600', icon: Zap, label: 'Hay que acelerar', ringColor: 'stroke-amber-400' },
    behind: { gradient: 'from-red-500 to-rose-600', icon: AlertCircle, label: 'Por debajo de meta', ringColor: 'stroke-red-400' },
    neutral: { gradient: 'from-gray-400 to-gray-500', icon: Target, label: 'Cargando...', ringColor: 'stroke-gray-400' },
  };

  const config = sentimentConfig[sentiment];
  const SentimentIcon = config.icon;

  if (loading) {
    return (
      <div className="col-span-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-300 dark:bg-gray-600" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cappedAvancePrima = Math.min(avancePrima, 100);
  const circumference = 2 * Math.PI * 38;
  const strokeDash = (cappedAvancePrima / 100) * circumference;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="col-span-full group relative overflow-hidden rounded-2xl border border-white/20 dark:border-white/10 text-left transition-all duration-300 hover:scale-[1.005] hover:shadow-xl active:scale-[0.998]"
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-90`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_60%)]" />

        <div className="relative z-10 p-5 md:p-6">
          <div className="flex items-start gap-4 md:gap-6">
            {/* Circular progress gauge */}
            <div className="shrink-0 relative">
              <svg width="92" height="92" viewBox="0 0 92 92" className="transform -rotate-90">
                <circle cx="46" cy="46" r="38" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle
                  cx="46" cy="46" r="38" fill="none"
                  className={config.ringColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${strokeDash} ${circumference}`}
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">
                  {avancePrima > 999 ? '999+' : Math.round(avancePrima)}%
                </span>
                <span className="text-white/60 text-[9px] font-medium mt-0.5">de meta</span>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <SentimentIcon className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{config.label}</span>
              </div>

              <p className="text-white font-bold text-xl md:text-2xl leading-tight truncate">
                {formatFullCurrency(data.periodo_actual.prima_neta)}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                Prima neta periodo actual
              </p>

              {/* Comparison bar */}
              <div className="flex items-center gap-3 mt-3">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  crecPrima >= 0
                    ? 'bg-white/20 text-white'
                    : 'bg-red-900/30 text-red-200'
                }`}>
                  {crecPrima >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {crecPrima > 0 ? '+' : ''}{crecPrima.toFixed(1)}% vs anterior
                </div>
                <span className="text-white/50 text-[11px]">
                  {formatCurrency(data.periodo_anterior.prima_neta)} en {new Date(data.periodo_anterior.fecha_desde).getFullYear()}
                </span>
              </div>

              {/* Mini stats row */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/15">
                <MiniStat label="Polizas" value={formatNumber(data.periodo_actual.polizas)} delta={data.crecimiento.polizas_delta} />
                <MiniStat label="Meta mes" value={formatCurrency(data.meta_mensual.prima_neta)} />
                <MiniStat
                  label="Falta"
                  value={data.crecimiento.falta_prima > 0 ? formatCurrency(data.crecimiento.falta_prima) : 'Cumplida'}
                  isPositive={data.crecimiento.falta_prima <= 0}
                />
              </div>
            </div>

            {/* Open arrow */}
            <div className="shrink-0 flex items-center self-center opacity-60 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </button>

      {showModal && (
        <AvanceComercialModal
          data={data}
          accentColor={accentColor}
          userId={userId}
          scope={scope}
          vendedorId={vendedorId}
          onClose={() => setShowModal(false)}
          onDocumentClick={onDocumentClick}
        />
      )}
    </>
  );
}

function MiniStat({ label, value, delta, isPositive }: {
  label: string;
  value: string;
  delta?: number;
  isPositive?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-white/50 text-[9px] font-medium uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1">
        <p className={`text-sm font-bold leading-tight ${isPositive ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-[10px] font-bold ${delta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  );
}
