import { useState } from 'react';
import { Check, X, Clock, TrendingDown, ChevronDown, ChevronUp, Receipt, Shield, Percent, TriangleAlert as AlertTriangle, KeyRound, WifiOff } from 'lucide-react';
import type { FleetQuoteResult, Vehiculo } from './multiAutosTypes';
import { INSURERS_CONFIG, type QuoteBreakdown } from './multiAutosInsurers';

interface FleetDashboardProps {
  results: FleetQuoteResult[];
  formaPago: string;
  discountRate: number;
  onClose: () => void;
}

function getInsurerColor(name: string): string {
  return INSURERS_CONFIG.find((i) => i.nombre === name)?.color || '#666';
}

function BreakdownPanel({ breakdown }: { breakdown: QuoteBreakdown }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>Prima Neta</span>
        <span className="font-mono">${breakdown.primaNeta.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>Derecho de Poliza</span>
        <span className="font-mono">${breakdown.derechoPoliza.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
        <span>Subtotal</span>
        <span className="font-mono">${breakdown.subtotal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>IVA (16%)</span>
        <span className="font-mono">${breakdown.iva.toLocaleString()}</span>
      </div>
      {breakdown.recargoFraccionamiento > 0 && (
        <div className="flex justify-between text-amber-600 dark:text-amber-400">
          <span>Recargo fraccionamiento</span>
          <span className="font-mono">${breakdown.recargoFraccionamiento.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between text-gray-900 dark:text-white font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
        <span>Prima Total</span>
        <span className="font-mono">${breakdown.primaTotalConRecargo.toLocaleString()}</span>
      </div>
      {breakdown.primerPago > 0 && breakdown.pagosSubsecuentes > 0 && (
        <>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 text-xs pt-1">
            <span>Primer pago (incluye Derecho Poliza)</span>
            <span className="font-mono">${breakdown.primerPago.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 text-xs">
            <span>Pagos subsecuentes</span>
            <span className="font-mono">${breakdown.pagosSubsecuentes.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function MultiAutosFleetDashboard({ results, formaPago, discountRate, onClose }: FleetDashboardProps) {
  const [expandedInsurer, setExpandedInsurer] = useState<string | null>(null);

  // Aggregate totals per insurer across all vehicles
  const insurerTotals: Record<string, { total: number; available: number; totalVehicles: number; totalResponseMs: number; breakdowns: { vehiculo: Vehiculo; breakdown: QuoteBreakdown }[]; error?: string; credentialStatus?: string; errorCategory?: string }> = {};

  for (const vResult of results) {
    for (const r of vResult.resultados) {
      if (!insurerTotals[r.aseguradora]) {
        insurerTotals[r.aseguradora] = { total: 0, available: 0, totalVehicles: 0, totalResponseMs: 0, breakdowns: [] };
      }
      insurerTotals[r.aseguradora].totalVehicles++;
      insurerTotals[r.aseguradora].totalResponseMs += r.tiempoRespuesta;
      insurerTotals[r.aseguradora].credentialStatus = r.credentialStatus;
      insurerTotals[r.aseguradora].errorCategory = r.errorCategory;
      if (r.disponible) {
        insurerTotals[r.aseguradora].available++;
        insurerTotals[r.aseguradora].total += r.primaTotal;
        const bd = vResult.breakdowns[r.aseguradora];
        if (bd) {
          insurerTotals[r.aseguradora].breakdowns.push({ vehiculo: vResult.vehiculo, breakdown: bd });
        }
      } else if (r.error) {
        insurerTotals[r.aseguradora].error = r.error;
      }
    }
  }

  const sortedInsurers = Object.entries(insurerTotals)
    .filter((entry) => entry[1].available > 0)
    .sort((a, b) => a[1].total - b[1].total);

  const cheapestTotal = sortedInsurers.length > 0 ? sortedInsurers[0][1].total : 0;
  const isFleet = results.length > 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isFleet ? 'Comparativo Multi-Vehiculo' : 'Resultados de Cotizacion'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {results.length} vehiculo{results.length > 1 ? 's' : ''} - {sortedInsurers.length} aseguradoras disponibles - Pago {formaPago}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {discountRate > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full">
              <Percent className="w-3.5 h-3.5" />
              {(discountRate * 100).toFixed(0)}% Descuento por Volumen Aplicado
            </div>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Nueva Cotizacion
          </button>
        </div>
      </div>

      {/* Fleet vehicle summary */}
      {isFleet && (
        <div className="flex flex-wrap gap-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
              <span className="w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-xs font-medium text-blue-900 dark:text-blue-200 truncate max-w-[200px]">{r.vehiculo.descripcionCompleta}</span>
            </div>
          ))}
        </div>
      )}

      {/* Insurer comparison cards */}
      <div className="space-y-3">
        {sortedInsurers.map(([insurer, data], idx) => {
          const color = getInsurerColor(insurer);
          const isBest = idx === 0;
          const savings = idx > 0 ? data.total - cheapestTotal : 0;
          const isExpanded = expandedInsurer === insurer;
          const config = INSURERS_CONFIG.find((c) => c.nombre === insurer);

          return (
            <div
              key={insurer}
              className={`bg-white dark:bg-gray-800 rounded-2xl border-2 overflow-hidden transition-all ${
                isBest ? 'border-emerald-400 shadow-md shadow-emerald-100/50 dark:shadow-emerald-900/20' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Main row */}
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" onClick={() => setExpandedInsurer(isExpanded ? null : insurer)}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                  {insurer.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{insurer}</p>
                    {isBest && (
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">MEJOR PRECIO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{config?.tipoApi}</span>
                    <span className="flex items-center gap-1"><Receipt className="w-3 h-3" />Derecho: ${config?.derechoPoliza.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(data.totalResponseMs / Math.max(data.totalVehicles, 1) / 1000).toFixed(1)}s</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                    ${Math.round(data.total).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isFleet ? 'Total flota' : 'Prima total'} ({formaPago})
                  </p>
                  {savings > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-end mt-0.5">
                      <TrendingDown className="w-3 h-3" /> +${Math.round(savings).toLocaleString()} vs mejor
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 text-gray-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Desglose por vehiculo</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.breakdowns.map((item, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          {item.vehiculo.descripcionCompleta}
                        </p>
                        <BreakdownPanel breakdown={item.breakdown} />
                      </div>
                    ))}
                  </div>

                  {/* Coverages */}
                  {data.breakdowns.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Coberturas incluidas</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {results[0]?.resultados.find((r) => r.aseguradora === insurer)?.coberturas.map((cob, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{cob.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="w-full mt-2 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all">
                    Seleccionar {insurer}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unavailable insurers */}
      {Object.entries(insurerTotals).filter((entry) => entry[1].available === 0).length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Aseguradoras no disponibles
          </p>
          <div className="space-y-2.5">
            {Object.entries(insurerTotals).filter((entry) => entry[1].available === 0).map(([name, d]) => {
              const error = d.error || '';
              const isDns = d.errorCategory === 'DNS_UNREACHABLE' || error.includes('DNS') || error.includes('alcanzable');
              const isCredMissing = d.credentialStatus === 'missing';
              const isCredExpired = d.credentialStatus === 'expired' || d.credentialStatus === 'invalid';
              const isMapping = d.errorCategory === 'MISSING_AMIS' || error.includes('AMIS') || error.includes('catalogo') || error.includes('mapeo');
              const isEndpoint = error.includes('HTTP 503') || error.includes('Incapsula');

              return (
                <div key={name} className="flex items-start gap-3 bg-white dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getInsurerColor(name) + '20' }}>
                    {isDns ? <WifiOff className="w-4 h-4 text-gray-500" /> :
                     isCredMissing || isCredExpired ? <KeyRound className="w-4 h-4 text-amber-500" /> :
                     isMapping || isEndpoint ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
                     <X className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
                      {isDns && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">DNS</span>}
                      {isCredMissing && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">SIN CREDENCIALES</span>}
                      {isCredExpired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">CREDENCIALES EXPIRADAS</span>}
                      {isMapping && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">CATALOGO / HOMOLOGACION</span>}
                      {isEndpoint && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">ENDPOINT BLOQUEADO</span>}
                    </div>
                    {error && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight break-all">{error}</p>}
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
