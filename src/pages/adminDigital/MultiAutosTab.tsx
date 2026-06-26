import { useState, useEffect } from 'react';
import { Plus, List, Search, Trash2, Eye, Shield, Loader as Loader2 } from 'lucide-react';
import type { Cliente, FleetVehicleConfig, FleetQuoteResult, FormaPago, Cotizacion } from './multiAutosTypes';
import { MultiAutosQuoteForm } from './MultiAutosQuoteForm';
import { MultiAutosFleetDashboard } from './MultiAutosFleetDashboard';
import { callQuoteWebService, loadInsurersConfig, INSURERS_CONFIG } from './multiAutosInsurers';
import { InsurerHealthPanel } from './InsurerHealthPanel';

const STORAGE_KEY = 'movi_multi_autos_quotes_v2';

type View = 'list' | 'new' | 'results' | 'detail';

function generateFolio(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `COT-${date}-${rand}`;
}

interface LoadingStep {
  insurer: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

function QuotingAnimation({ steps }: { steps: LoadingStep[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cotizando en tiempo real</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Consultando Web Services de aseguradoras...</p>
      </div>
      <div className="space-y-2 max-w-md mx-auto">
        {steps.map((step) => (
          <div key={step.insurer} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: INSURERS_CONFIG.find((c) => c.nombre === step.insurer)?.color || '#666' }}
            >
              {step.insurer.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{step.insurer}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {step.status === 'pending' && 'En cola...'}
                {step.status === 'loading' && 'Consultando Web Service...'}
                {step.status === 'done' && 'Cotizacion recibida'}
                {step.status === 'error' && 'No disponible'}
              </p>
            </div>
            <div className="flex-shrink-0">
              {step.status === 'loading' && <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
              {step.status === 'done' && <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-emerald-500" /></div>}
              {step.status === 'error' && <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-red-500" /></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MultiAutosTab() {
  const [view, setView] = useState<View>('list');
  const [quotes, setQuotes] = useState<Cotizacion[]>([]);
  const [currentResults, setCurrentResults] = useState<FleetQuoteResult[]>([]);
  const [currentFormaPago, setCurrentFormaPago] = useState<FormaPago>('Anual');
  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setQuotes(JSON.parse(stored));
    loadInsurersConfig();
  }, []);

  const saveQuotes = (updated: Cotizacion[]) => {
    setQuotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCalculate = async (
    cliente: Cliente,
    vehiculos: FleetVehicleConfig[],
    formaPago: FormaPago
  ) => {
    setIsCalculating(true);
    setCurrentFormaPago(formaPago);
    setView('results');

    // Initialize loading steps
    const steps: LoadingStep[] = INSURERS_CONFIG.map((c) => ({
      insurer: c.nombre,
      status: 'loading' as const,
    }));
    setLoadingSteps(steps);

    try {
      // Call the real WS edge function
      const { results: fleetResults, discountRate } = await callQuoteWebService(
        vehiculos, formaPago, cliente.edad, cliente.genero, cliente.codigoPostal
      );

      // Update loading steps based on actual results
      for (const fr of fleetResults) {
        for (const r of fr.resultados) {
          const stepIdx = steps.findIndex((s) => s.insurer === r.aseguradora);
          if (stepIdx >= 0) {
            steps[stepIdx].status = r.disponible ? 'done' : 'error';
          }
        }
      }
      setLoadingSteps([...steps]);

      setCurrentDiscount(discountRate);
      setCurrentResults(fleetResults);

      // Build totals per insurer
      const totalFlota: Record<string, number> = {};
      for (const fr of fleetResults) {
        for (const r of fr.resultados) {
          if (r.disponible) {
            totalFlota[r.aseguradora] = (totalFlota[r.aseguradora] || 0) + r.primaTotal;
          }
        }
      }

      // Save quote
      const newQuote: Cotizacion = {
        id: `q_${Date.now()}`,
        folio: generateFolio(),
        fecha: new Date().toISOString(),
        cliente,
        vehiculos,
        formaPago,
        status: 'Pendiente',
        resultadosFlota: fleetResults,
        descuentoVolumen: discountRate,
        totalFlota,
      };
      saveQuotes([newQuote, ...quotes]);
    } catch (err) {
      // Mark all as error on complete failure
      for (let i = 0; i < steps.length; i++) {
        steps[i].status = 'error';
      }
      setLoadingSteps([...steps]);
      console.error('Error cotizando via WS:', err);
    }

    setIsCalculating(false);
  };

  const handleDelete = (id: string) => {
    saveQuotes(quotes.filter((q) => q.id !== id));
  };

  const handleViewDetail = (quote: Cotizacion) => {
    setCurrentResults(quote.resultadosFlota);
    setCurrentFormaPago(quote.formaPago);
    setCurrentDiscount(quote.descuentoVolumen);
    setView('detail');
  };

  const filtered = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      q.folio.toLowerCase().includes(term) ||
      q.cliente.nombre.toLowerCase().includes(term) ||
      q.vehiculos.some((v) => v.vehiculo.descripcionCompleta.toLowerCase().includes(term))
    );
  });

  // Show loading animation while calculating
  if (isCalculating && view === 'results') {
    return <QuotingAnimation steps={loadingSteps} />;
  }

  return (
    <div className="space-y-5">
      {/* Health Status Panel */}
      {view === 'list' && <InsurerHealthPanel />}

      {/* Navigation */}
      {(view === 'list' || view === 'new') && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                view === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" /> Historial
            </button>
            <button
              onClick={() => setView('new')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                view === 'new' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <Plus className="w-4 h-4" /> Nueva Cotizacion
            </button>
          </div>
          {view === 'list' && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar folio, nombre o auto..."
                className="pl-9 pr-4 py-2 w-64 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}

      {/* New Quote Form */}
      {view === 'new' && (
        <MultiAutosQuoteForm onCalculate={handleCalculate} isCalculating={isCalculating} />
      )}

      {/* Results / Detail View */}
      {(view === 'results' || view === 'detail') && !isCalculating && (
        <MultiAutosFleetDashboard
          results={currentResults}
          formaPago={currentFormaPago}
          discountRate={currentDiscount}
          onClose={() => setView('list')}
        />
      )}

      {/* Quotes List */}
      {view === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Sin cotizaciones</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Crea una cotizacion para comparar 7 aseguradoras al instante</p>
              <button onClick={() => setView('new')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Nueva Cotizacion
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Folio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Vehiculos</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Pago</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Mejor Precio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Fecha</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((q) => {
                    const bestTotal = Object.values(q.totalFlota).sort((a, b) => a - b)[0] || 0;
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300">{q.folio}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{q.cliente.nombre}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg font-medium">
                              {q.vehiculos.length} auto{q.vehiculos.length > 1 ? 's' : ''}
                            </span>
                            {q.descuentoVolumen > 0 && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                -{(q.descuentoVolumen * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{q.formaPago}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                          ${Math.round(bestTotal).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(q.fecha).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleViewDetail(q)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors" title="Ver detalle">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
