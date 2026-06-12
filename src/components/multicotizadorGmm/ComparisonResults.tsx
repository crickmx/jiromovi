import { CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import type { CarrierResult, FormaPago, OptionResult } from '../../lib/multicotizadorGmm/types';
import { PRODUCT_LABELS, PRODUCT_COLORS, PAYMENT_FACTORS } from '../../lib/multicotizadorGmm/types';

interface ComparisonResultsProps {
  results: OptionResult[];
  selectedFormaPago: FormaPago;
}

const FORMAS_PAGO: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

function formatCurrency(value: number): string {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getTotal(result: CarrierResult, forma: FormaPago): number {
  if (result.error || !result.totals) return 0;
  const breakdown = result.totals[forma];
  if (!breakdown) return 0;
  return breakdown.total;
}

function getPrimaPago(result: CarrierResult, forma: FormaPago): { primer_pago: number; pagos_sub: number; num_recibos: number } {
  if (result.error || !result.totals) return { primer_pago: 0, pagos_sub: 0, num_recibos: 1 };
  const breakdown = result.totals[forma];
  if (!breakdown) return { primer_pago: 0, pagos_sub: 0, num_recibos: 1 };
  return { primer_pago: breakdown.primer_pago, pagos_sub: breakdown.pagos_subsecuentes, num_recibos: breakdown.num_recibos };
}

export function ComparisonResults({ results, selectedFormaPago }: ComparisonResultsProps) {
  const validOptions = results.filter(r => !r.result.error);
  const errorOptions = results.filter(r => r.result.error);

  const cheapest = validOptions.length > 0
    ? validOptions.reduce((min, r) => getTotal(r.result, selectedFormaPago) < getTotal(min.result, selectedFormaPago) ? r : min)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {validOptions.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {validOptions
            .sort((a, b) => getTotal(a.result, selectedFormaPago) - getTotal(b.result, selectedFormaPago))
            .map((opt, idx) => {
              const total = getTotal(opt.result, selectedFormaPago);
              const isCheapest = opt === cheapest;
              const color = PRODUCT_COLORS[opt.product_id];
              return (
                <div
                  key={opt.option_id}
                  className={`relative rounded-2xl border-2 p-5 transition-all ${
                    isCheapest
                      ? 'border-teal-400 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 shadow-lg shadow-teal-100/30 dark:shadow-teal-900/10'
                      : 'border-neutral-200 dark:border-white/[0.06] bg-white dark:bg-neutral-900'
                  }`}
                >
                  {isCheapest && (
                    <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wide">
                      Mejor Precio
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {opt.option_label}
                    </span>
                    {isCheapest && <CheckCircle className="w-4 h-4 text-teal-500 ml-auto" />}
                    {idx === validOptions.length - 1 && validOptions.length > 1 && !isCheapest && (
                      <TrendingUp className="w-4 h-4 text-red-400 ml-auto" />
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                    {PRODUCT_LABELS[opt.product_id]}
                  </div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {formatCurrency(total)}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Total {selectedFormaPago.toLowerCase()}
                  </div>
                  {cheapest && opt !== cheapest && (
                    <div className="mt-2 text-xs text-red-500 dark:text-red-400 font-medium">
                      +{formatCurrency(total - getTotal(cheapest.result, selectedFormaPago))} vs mejor
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Error alerts */}
      {errorOptions.map(opt => (
        <div key={opt.option_id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{opt.option_label} ({PRODUCT_LABELS[opt.product_id]}):</strong> {opt.result.error}
          </span>
        </div>
      ))}

      {/* Detailed comparison table */}
      {validOptions.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Comparativa por Forma de Pago</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Forma de Pago</th>
                  {validOptions.map(opt => (
                    <th key={opt.option_id} className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: PRODUCT_COLORS[opt.product_id] }}>
                      <div>{opt.option_label}</div>
                      <div className="font-normal text-[10px] opacity-70">{PRODUCT_LABELS[opt.product_id]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FORMAS_PAGO.map(fp => {
                  const totals = validOptions.map(opt => getTotal(opt.result, fp));
                  const minTotal = Math.min(...totals.filter(t => t > 0));
                  return (
                    <tr key={fp} className={`border-b border-neutral-50 dark:border-white/[0.03] ${fp === selectedFormaPago ? 'bg-teal-50/30 dark:bg-teal-900/5' : ''}`}>
                      <td className="px-5 py-3 text-neutral-700 dark:text-neutral-300 font-medium">
                        {fp}
                        <span className="text-neutral-400 dark:text-neutral-500 text-xs ml-1.5">
                          ({PAYMENT_FACTORS[fp].num_recibos === 1 ? '1 pago' : `${PAYMENT_FACTORS[fp].num_recibos} pagos`})
                        </span>
                      </td>
                      {validOptions.map((opt, idx) => {
                        const total = totals[idx];
                        const isCheap = total === minTotal && total > 0;
                        return (
                          <td key={opt.option_id} className={`px-5 py-3 text-right font-semibold ${isCheap ? 'text-teal-700 dark:text-teal-400' : 'text-neutral-900 dark:text-white'}`}>
                            {total > 0 ? formatCurrency(total) : '-'}
                            {isCheap && validOptions.length > 1 && (
                              <TrendingDown className="inline w-3.5 h-3.5 ml-1.5 text-teal-500" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-person breakdown */}
      {validOptions.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Desglose por Asegurado</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Asegurado</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Edad</th>
                  {validOptions.map(opt => (
                    <th key={opt.option_id} className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: PRODUCT_COLORS[opt.product_id] }}>
                      {opt.option_label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validOptions[0]?.result.people_results.map((_, pIdx) => {
                  const personName = validOptions[0].result.people_results[pIdx]?.person_name || `Asegurado ${pIdx + 1}`;
                  const personAge = validOptions[0].result.people_results[pIdx]?.age || 0;
                  return (
                    <tr key={pIdx} className="border-b border-neutral-50 dark:border-white/[0.03]">
                      <td className="px-5 py-3 text-neutral-900 dark:text-white font-medium">{personName}</td>
                      <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">{personAge}</td>
                      {validOptions.map(opt => {
                        const pr = opt.result.people_results[pIdx];
                        let amount = 0;
                        if (pr) {
                          if ('discounted_rate' in pr) amount = (pr as any).discounted_rate;
                          else if ('annual_premium' in pr) amount = (pr as any).annual_premium;
                          else if ('prima_total' in pr) amount = (pr as any).prima_total;
                        }
                        return (
                          <td key={opt.option_id} className="px-5 py-3 text-right text-neutral-900 dark:text-white">
                            {amount > 0 ? formatCurrency(amount) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-neutral-50 dark:bg-white/[0.02]">
                  <td className="px-5 py-3 font-semibold text-neutral-900 dark:text-white" colSpan={2}>Prima Anual Total</td>
                  {validOptions.map(opt => (
                    <td key={opt.option_id} className="px-5 py-3 text-right font-bold text-neutral-900 dark:text-white">
                      {formatCurrency(opt.result.prima_anual_total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment details for selected forma */}
      {validOptions.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Detalle de Pago - {selectedFormaPago}
            </h4>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100 dark:divide-white/[0.06]">
            {validOptions.map(opt => {
              const pago = getPrimaPago(opt.result, selectedFormaPago);
              return (
                <div key={opt.option_id} className="p-5 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[opt.product_id] }} />
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{opt.option_label}</span>
                    <span className="text-[10px] text-neutral-400">({PRODUCT_LABELS[opt.product_id]})</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Primer pago</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(pago.primer_pago)}</span>
                  </div>
                  {pago.num_recibos > 1 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">{pago.num_recibos - 1} pagos de</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(pago.pagos_sub)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs pt-2 border-t border-neutral-100 dark:border-white/[0.06] mt-2">
                    <span className="text-neutral-500 dark:text-neutral-400">Total anualizado</span>
                    <span className="font-bold text-neutral-900 dark:text-white">{formatCurrency(getTotal(opt.result, selectedFormaPago))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
