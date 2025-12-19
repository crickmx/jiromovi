import { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { supabase } from '../lib/supabase';
import type { GMMQuote, GMMQuoteInsured } from '../lib/gmmTypes';

export default function GMMCotizaciones() {
  const [quotes, setQuotes] = useState<GMMQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<GMMQuote | null>(null);
  const [insureds, setInsureds] = useState<GMMQuoteInsured[]>([]);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('gmm_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuoteDetails(quoteId: string) {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from('gmm_quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      const { data: insuredsData, error: insuredsError } = await supabase
        .from('gmm_quote_insureds')
        .select('*')
        .eq('quote_id', quoteId)
        .order('orden');

      if (insuredsError) throw insuredsError;

      setSelectedQuote(quote);
      setInsureds(insuredsData || []);
    } catch (error) {
      console.error('Error loading quote details:', error);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Cargando cotizaciones...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Mis Cotizaciones GMM BX+"
        subtitle="Historial de cotizaciones realizadas"
      />

      <div className="max-w-7xl mx-auto p-6">
        {quotes.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay cotizaciones guardadas</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {quotes.map((quote) => (
                <Card
                  key={quote.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedQuote?.id === quote.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:border-blue-300'
                  }`}
                  onClick={() => loadQuoteDetails(quote.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{quote.quote_number}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(quote.created_at).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        ${quote.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Estado:</span>
                      <span className="ml-1 font-medium">{quote.estado}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Nivel:</span>
                      <span className="ml-1 font-medium">{quote.nivel_hospitalario}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Suma Asegurada:</span>
                      <span className="ml-1 font-medium">{quote.suma_asegurada}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Forma Pago:</span>
                      <span className="ml-1 font-medium">{quote.forma_pago}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              {selectedQuote ? (
                <Card className="p-6 sticky top-6">
                  <h3 className="text-lg font-semibold mb-4">Detalle de Cotización</h3>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Información General</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Número:</span>
                          <span className="font-medium">{selectedQuote.quote_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha:</span>
                          <span className="font-medium">
                            {new Date(selectedQuote.created_at).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Asegurados ({insureds.length})
                      </h4>
                      <div className="space-y-2">
                        {insureds.map((insured) => (
                          <div key={insured.id} className="bg-gray-50 rounded p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm">{insured.nombre}</div>
                                <div className="text-xs text-gray-600">
                                  {insured.sexo}, {insured.edad} años
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-blue-600">
                                  ${insured.prima_total.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">Prima</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Resumen Financiero
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prima Neta</span>
                          <span className="font-medium">${selectedQuote.prima_neta_total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Recargo</span>
                          <span className="font-medium">${selectedQuote.recargo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gastos Expedición</span>
                          <span className="font-medium">${selectedQuote.gastos_expedicion.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">${selectedQuote.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">IVA (16%)</span>
                          <span className="font-medium">${selectedQuote.iva.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-semibold">TOTAL</span>
                          <span className="font-bold text-lg text-blue-600">
                            ${selectedQuote.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Recibos</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Primer Recibo</span>
                          <span className="font-medium">${selectedQuote.primer_recibo.toFixed(2)}</span>
                        </div>
                        {selectedQuote.num_recibos > 1 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Recibos Subsecuentes ({selectedQuote.num_recibos - 1})
                            </span>
                            <span className="font-medium">
                              ${selectedQuote.recibos_subsecuentes?.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Coberturas Activas</h4>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { key: 'cob_reconocimiento_antiguedad', label: 'Reconocimiento Antigüedad' },
                          { key: 'cob_medicamentos_fuera', label: 'Medicamentos Fuera' },
                          { key: 'cob_complicaciones_no_amparadas', label: 'Complicaciones' },
                          { key: 'cob_padecimientos_preexistentes', label: 'Preexistentes' },
                          { key: 'cob_eliminacion_deducible_accidente', label: 'Eliminar Deducible Accidente' },
                          { key: 'cob_multiregion', label: 'Multiregión' },
                          { key: 'cob_vip', label: 'VIP' },
                          { key: 'cob_emergencia_medica_extranjero', label: 'Emergencia Extranjero' },
                          { key: 'cob_enfermedades_graves_extranjero', label: 'EG Extranjero' },
                          { key: 'cob_cobertura_internacional', label: 'Internacional' },
                          { key: 'cob_ampliacion_servicios', label: 'Ampliación Servicios' },
                          { key: 'cob_ayuda_diaria', label: 'Ayuda Diaria' },
                          { key: 'cob_indemnizacion_eg', label: 'Indemnización EG' },
                          { key: 'cob_maternidad', label: 'Maternidad' },
                          { key: 'cob_xtensuz', label: 'Xtensuz' },
                        ]
                          .filter(({ key }) => selectedQuote[key as keyof GMMQuote])
                          .map(({ key, label }) => (
                            <span
                              key={key}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                            >
                              {label}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Selecciona una cotización para ver detalles</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
