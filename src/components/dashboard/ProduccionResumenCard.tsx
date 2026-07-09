import { Target, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMiResumen } from '@/lib/useMiResumen';

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

export function ProduccionResumenCard() {
  const data = useMiResumen();

  if (data === 'loading') {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4">
        <Sk className="h-5 w-40 mb-4" />
        <Sk className="h-16 mb-3" />
        <Sk className="h-16" />
      </div>
    );
  }

  // Error de red, usuario no vinculado a Bonos, o rol sin card personal.
  if (data === 'error' || !data.vinculado || data.aplica === false) {
    return null;
  }

  const { produccion, convencion, renovaciones = [] } = data;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-neutral-400 dark:text-white/40" />
        <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90">Mi Producción</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl p-3 bg-neutral-50 dark:bg-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40 mb-1">
            Prima convenio (año)
          </p>
          <p className="text-lg font-bold text-neutral-800 dark:text-white">
            {produccion ? money(produccion.prima_conv_actual) : '—'}
          </p>
          {produccion?.delta_pct != null && (
            <p className={cn(
              'text-[11px] font-semibold flex items-center gap-1 mt-1',
              produccion.delta_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
            )}>
              {produccion.delta_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {produccion.delta_pct >= 0 ? '+' : ''}{produccion.delta_pct}% vs año anterior
            </p>
          )}
        </div>

        {produccion?.meta_monto != null && (
          <div className="rounded-xl p-3 bg-neutral-50 dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40 mb-1">
              Meta {produccion.meta_pct != null ? `(${produccion.meta_pct}%)` : ''}
            </p>
            <p className="text-lg font-bold text-neutral-800 dark:text-white">{money(produccion.meta_monto)}</p>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E84F8A] to-[#8E1A52] rounded-full"
                style={{ width: `${Math.min(100, produccion.meta_pct ?? 0)}%` }}
              />
            </div>
          </div>
        )}

        {convencion && (
          <div className="rounded-xl p-3 bg-neutral-50 dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/40 mb-1">
              Convención
            </p>
            <p className="text-lg font-bold text-neutral-800 dark:text-white capitalize">{convencion.nivel || 'Sin nivel'}</p>
            {convencion.siguiente && (
              <p className="text-[10px] text-neutral-400 dark:text-white/40 mt-1">
                Faltan {money(convencion.falta)} para {convencion.siguiente}
              </p>
            )}
          </div>
        )}
      </div>

      {renovaciones.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-white/40 mb-2 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Próximas renovaciones
          </p>
          <div className="space-y-1">
            {renovaciones.slice(0, 5).map(r => (
              <div key={r.numero_poliza} className="flex items-center justify-between text-[11px] py-1.5 border-b last:border-0 border-neutral-100 dark:border-white/6">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-700 dark:text-white/80 truncate">{r.asegurado || '—'}</p>
                  <p className="text-[10px] text-neutral-400 dark:text-white/35">{r.ramo} · {r.compania}</p>
                </div>
                <span className="text-neutral-500 dark:text-white/50 shrink-0 ml-2">
                  {new Date(r.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
