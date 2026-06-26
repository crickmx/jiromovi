import { Check, X, Clock, TrendingDown } from 'lucide-react';
import type { ResultadoAseguradora } from './multiAutosTypes';
import { INSURERS } from './multiAutosInsurers';

interface QuoteResultsProps {
  results: ResultadoAseguradora[];
  formaPago: string;
  onClose: () => void;
}

function getInsurerColor(name: string): string {
  return INSURERS.find((i) => i.nombre === name)?.color || '#666';
}

export function MultiAutosQuoteResults({ results, formaPago, onClose }: QuoteResultsProps) {
  const available = results.filter((r) => r.disponible);
  const unavailable = results.filter((r) => !r.disponible);
  const cheapest = available.length > 0 ? available[0].primaAnual : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resultados de Cotizacion</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {available.length} aseguradoras disponibles de {results.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Nueva Cotizacion
        </button>
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {available.map((result, idx) => {
          const color = getInsurerColor(result.aseguradora);
          const isBest = idx === 0;
          const savings = idx > 0 ? result.primaAnual - cheapest : 0;

          return (
            <div
              key={result.aseguradora}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg ${
                isBest ? 'border-emerald-400 shadow-md shadow-emerald-100 dark:shadow-emerald-900/20' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {isBest && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg">
                  MEJOR PRECIO
                </div>
              )}

              {/* Header */}
              <div className="p-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {result.aseguradora.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{result.aseguradora}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {(result.tiempoRespuesta / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Prima anual</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${result.primaAnual.toLocaleString()}</p>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-750 rounded-xl p-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Pago {formaPago}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">${result.primaPorPago.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase">Total</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">${result.primaTotal.toLocaleString()}</p>
                  </div>
                </div>

                {savings > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <TrendingDown className="w-3.5 h-3.5" />
                    +${savings.toLocaleString()} vs mejor precio
                  </div>
                )}

                {/* Coverages */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
                  {result.coberturas.slice(0, 5).map((cob, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{cob.nombre}</span>
                    </div>
                  ))}
                  {result.coberturas.length > 5 && (
                    <p className="text-[10px] text-gray-400 pl-5">+{result.coberturas.length - 5} mas</p>
                  )}
                </div>

                <button className="w-full mt-2 py-2.5 text-sm font-medium rounded-xl border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                  Seleccionar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unavailable */}
      {unavailable.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <X className="w-4 h-4 text-red-500" />
            No disponibles ({unavailable.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unavailable.map((r) => (
              <span key={r.aseguradora} className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                {r.aseguradora}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
