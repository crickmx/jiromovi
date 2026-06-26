import { useState, useEffect } from 'react';
import { Plus, List, Search, Trash2, Eye, Shield } from 'lucide-react';
import type { Cliente, Vehiculo, PaqueteCobertura, FormaPago, CoberturasPersonalizadasCliente, Cotizacion, ResultadoAseguradora } from './multiAutosTypes';
import { MultiAutosQuoteForm } from './MultiAutosQuoteForm';
import { MultiAutosQuoteResults } from './MultiAutosQuoteResults';
import { calculateAllInsurers } from './multiAutosInsurers';

const STORAGE_KEY = 'movi_multi_autos_quotes';

type View = 'list' | 'new' | 'results' | 'detail';

function generateFolio(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `COT-${date}-${rand}`;
}

export function MultiAutosTab() {
  const [view, setView] = useState<View>('list');
  const [quotes, setQuotes] = useState<Cotizacion[]>([]);
  const [currentResults, setCurrentResults] = useState<ResultadoAseguradora[]>([]);
  const [currentFormaPago, setCurrentFormaPago] = useState<FormaPago>('Anual');
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Cotizacion | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setQuotes(JSON.parse(stored));
    }
  }, []);

  const saveQuotes = (updated: Cotizacion[]) => {
    setQuotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCalculate = async (
    cliente: Cliente,
    vehiculo: Vehiculo,
    paquete: PaqueteCobertura,
    formaPago: FormaPago,
    coberturas: CoberturasPersonalizadasCliente
  ) => {
    setIsCalculating(true);
    setCurrentFormaPago(formaPago);

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

    const results = calculateAllInsurers(vehiculo, paquete, formaPago, cliente.edad, cliente.genero, coberturas);
    setCurrentResults(results);

    const newQuote: Cotizacion = {
      id: `q_${Date.now()}`,
      folio: generateFolio(),
      fecha: new Date().toISOString(),
      cliente,
      vehiculo,
      paquete,
      formaPago,
      coberturas,
      status: 'Pendiente',
      resultados: results,
    };

    saveQuotes([newQuote, ...quotes]);
    setIsCalculating(false);
    setView('results');
  };

  const handleDelete = (id: string) => {
    saveQuotes(quotes.filter((q) => q.id !== id));
  };

  const handleViewDetail = (quote: Cotizacion) => {
    setSelectedQuote(quote);
    setCurrentResults(quote.resultados);
    setCurrentFormaPago(quote.formaPago);
    setView('detail');
  };

  const filtered = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      q.folio.toLowerCase().includes(term) ||
      q.cliente.nombre.toLowerCase().includes(term) ||
      q.vehiculo.descripcionCompleta.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      {/* View controls */}
      {(view === 'list' || view === 'new') && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                view === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <List className="w-4 h-4" />
              Historial
            </button>
            <button
              onClick={() => setView('new')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                view === 'new'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <Plus className="w-4 h-4" />
              Nueva Cotizacion
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

      {/* Results View */}
      {(view === 'results' || view === 'detail') && (
        <MultiAutosQuoteResults
          results={currentResults}
          formaPago={currentFormaPago}
          onClose={() => { setView('list'); setSelectedQuote(null); }}
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Crea una nueva cotizacion para comparar aseguradoras</p>
              <button
                onClick={() => setView('new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Cotizacion
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Folio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Vehiculo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Paquete</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Mejor Precio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Fecha</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((q) => {
                    const best = q.resultados.filter((r) => r.disponible).sort((a, b) => a.primaAnual - b.primaAnual)[0];
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300">{q.folio}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{q.cliente.nombre}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[180px] truncate">{q.vehiculo.descripcionCompleta}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                            q.paquete === 'Amplia' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            q.paquete === 'Limitada' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {q.paquete}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          {best ? `$${best.primaAnual.toLocaleString()}` : 'N/D'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(q.fecha).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleViewDetail(q)}
                              className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                              title="Eliminar"
                            >
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
