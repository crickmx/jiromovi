import { useState, useEffect } from 'react';
import { Calculator, Save, FileText, Plus, Trash2, Calendar, DollarSign, Users, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { InfoTooltip } from '../components/ui/info-tooltip';
import { supabase } from '../lib/supabase';
import { calculateQuote, loadTariffTables, getTopeCoaseguroOpciones, getTopeCoaseguroRango } from '../lib/gmmCalculationEngine';
import { generateQuotePDF } from '../lib/gmmPdfGenerator';
import { getCoverageHelpText, COVERAGE_LABELS } from '../lib/gmmCoverageHelp';
import { formatMoneySafe } from '../lib/gmmParsingUtils';
import type { QuoteInput, QuoteInputInsured, QuoteCalculationResult, TariffTables, GMMQuote, GMMQuoteInsured } from '../lib/gmmTypes';

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return '—';
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercentage(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${(num * 100).toFixed(0)}%`;
}

export default function GMMCotizador() {
  const [activeTab, setActiveTab] = useState('cotizador');

  const [tariffPackageId, setTariffPackageId] = useState<string>('');
  const [tariffTables, setTariffTables] = useState<TariffTables | null>(null);
  const [loading, setLoading] = useState(true);

  const [input, setInput] = useState<QuoteInput>({
    zona: '',
    estado: '',
    nivel_hospitalario: '',
    tabulador: '',
    suma_asegurada: '',
    deducible: '',
    coaseguro: '',
    formas_pago: [],
    insureds: [{ nombre: '', sexo: 'Hombre', edad: 30 }],
    coberturas: {},
    montos: {},
  });

  const [result, setResult] = useState<QuoteCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quotes, setQuotes] = useState<GMMQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<GMMQuote | null>(null);
  const [insureds, setInsureds] = useState<GMMQuoteInsured[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    loadActiveTariff();
  }, []);

  useEffect(() => {
    if (activeTab === 'cotizaciones') {
      loadQuotes();
    }
  }, [activeTab]);

  async function loadActiveTariff() {
    try {
      const { data: pkg, error: pkgError } = await supabase
        .from('tariff_packages')
        .select('id')
        .eq('status', 'active')
        .maybeSingle();

      if (pkgError) throw pkgError;
      if (!pkg) {
        alert('No hay tarifas activas. Contacta al administrador.');
        setLoading(false);
        return;
      }

      setTariffPackageId(pkg.id);

      const { data: tables, error: tablesError } = await supabase
        .from('tariff_tables')
        .select('*')
        .eq('tariff_package_id', pkg.id);

      if (tablesError) throw tablesError;

      const loaded = loadTariffTables(tables || []);
      setTariffTables(loaded);

      if (loaded.factor_estado.length > 0) {
        setInput(prev => ({ ...prev, estado: loaded.factor_estado[0].col_0 }));
      }
      if (loaded.factor_nivel_hospitalario.length > 0) {
        setInput(prev => ({ ...prev, nivel_hospitalario: loaded.factor_nivel_hospitalario[0].col_0 }));
      }
      if (loaded.factor_tabulador.length > 0) {
        setInput(prev => ({ ...prev, tabulador: loaded.factor_tabulador[0].col_0 }));
      }
      if (loaded.factor_suma_asegurada.length > 0) {
        setInput(prev => ({ ...prev, suma_asegurada: loaded.factor_suma_asegurada[0].col_0 }));
      }
      if (loaded.factor_deducible.length > 0) {
        setInput(prev => ({ ...prev, deducible: loaded.factor_deducible[0].col_0 }));
      }
      if (loaded.factor_coaseguro.length > 0) {
        setInput(prev => ({ ...prev, coaseguro: loaded.factor_coaseguro[0].col_0 }));
      }
      if (loaded.forma_pago.length > 0) {
        setInput(prev => ({ ...prev, formas_pago: [loaded.forma_pago[0].col_0] }));
      }
    } catch (error) {
      console.error('Error loading tariff:', error);
      alert('Error al cargar tarifas');
    } finally {
      setLoading(false);
    }
  }

  async function loadQuotes() {
    setLoadingQuotes(true);
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
      setLoadingQuotes(false);
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

  function handleAddInsured() {
    if (input.insureds.length >= 8) {
      alert('Máximo 8 asegurados');
      return;
    }
    setInput(prev => ({
      ...prev,
      insureds: [...prev.insureds, { nombre: '', sexo: 'Hombre', edad: 30 }],
    }));
  }

  function handleRemoveInsured(index: number) {
    if (input.insureds.length === 1) {
      alert('Debe haber al menos un asegurado');
      return;
    }
    setInput(prev => ({
      ...prev,
      insureds: prev.insureds.filter((_, i) => i !== index),
    }));
  }

  function handleInsuredChange(index: number, field: keyof QuoteInputInsured, value: any) {
    setInput(prev => ({
      ...prev,
      insureds: prev.insureds.map((ins, i) =>
        i === index ? { ...ins, [field]: value } : ins
      ),
    }));
  }

  function handleCalculate() {
    if (!tariffTables) {
      alert('Tarifas no cargadas');
      return;
    }

    const valid = input.insureds.every(ins => ins.nombre.trim() && ins.edad && ins.edad > 0);
    if (!valid) {
      alert('Complete todos los campos de asegurados (nombre y edad válida)');
      return;
    }

    if (!input.estado || !input.nivel_hospitalario || !input.tabulador ||
        !input.suma_asegurada || !input.deducible || !input.coaseguro || input.formas_pago.length === 0) {
      alert('Por favor complete todos los parámetros del plan antes de calcular (incluyendo al menos una forma de pago)');
      return;
    }

    setCalculating(true);
    try {
      const calculated = calculateQuote(input, tariffTables);
      setResult(calculated);
    } catch (error: any) {
      console.error('Error calculating:', error);
      const message = error.message || 'Error al calcular la cotización';
      alert(`Error en el cálculo:\n\n${message}`);
    } finally {
      setCalculating(false);
    }
  }

  async function handleDownloadPDF(quote: GMMQuote) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('nombre_completo, celular_laboral')
        .eq('id', user.id)
        .maybeSingle();

      const { data: insuredsData } = await supabase
        .from('gmm_quote_insureds')
        .select('*')
        .eq('quote_id', quote.id)
        .order('orden');

      if (!insuredsData || insuredsData.length === 0) {
        alert('No se encontraron asegurados para esta cotización');
        return;
      }

      const asesorInfo = {
        nombre: usuario?.nombre_completo || 'Asesor JIRO',
        celular: usuario?.celular_laboral || '',
      };

      const pdfBlob = await generateQuotePDF(quote, insuredsData, asesorInfo);

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Cotizacion_${quote.quote_number}_${quote.id.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Error al generar PDF: ${error.message}`);
    }
  }

  async function handleSave() {
    if (!result) {
      alert('Calcule la cotización primero');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const firstPlan = result.payment_plans[0];

      const { data: quote, error: quoteError } = await supabase
        .from('gmm_quotes')
        .insert({
          tariff_package_id: tariffPackageId,
          zona: input.zona || 'N/A',
          estado: input.estado,
          nivel_hospitalario: input.nivel_hospitalario,
          tabulador: input.tabulador,
          suma_asegurada: input.suma_asegurada,
          deducible: input.deducible,
          coaseguro: input.coaseguro,
          tope_coaseguro: input.tope_coaseguro_seleccionado || result.tope_coaseguro,
          forma_pago: input.formas_pago.join(', '),
          num_recibos: firstPlan.num_recibos,

          cob_reconocimiento_antiguedad: input.coberturas.reconocimiento_antiguedad || false,
          cob_medicamentos_fuera: input.coberturas.medicamentos_fuera || false,
          cob_complicaciones_no_amparadas: input.coberturas.complicaciones_no_amparadas || false,
          cob_padecimientos_preexistentes: input.coberturas.padecimientos_preexistentes || false,
          cob_eliminacion_deducible_accidente: input.coberturas.eliminacion_deducible_accidente || false,
          cob_multiregion: input.coberturas.multiregion || false,
          cob_vip: input.coberturas.vip || false,
          cob_emergencia_medica_extranjero: input.coberturas.emergencia_medica_extranjero || false,
          cob_enfermedades_graves_extranjero: input.coberturas.enfermedades_graves_extranjero || false,
          cob_cobertura_internacional: input.coberturas.cobertura_internacional || false,
          cob_ampliacion_servicios: input.coberturas.ampliacion_servicios || false,
          cob_ayuda_diaria: input.coberturas.ayuda_diaria || false,
          cob_indemnizacion_eg: input.coberturas.indemnizacion_eg || false,
          cob_maternidad: input.coberturas.maternidad || false,
          cob_xtensuz: input.coberturas.xtensuz || false,

          monto_maternidad: input.montos?.maternidad || null,
          monto_xtensuz: input.montos?.xtensuz || null,

          prima_neta_total: result.prima_neta_total,
          recargo: firstPlan.recargo,
          gastos_expedicion: firstPlan.gastos_expedicion,
          subtotal: firstPlan.subtotal,
          iva: firstPlan.iva,
          total: firstPlan.total,
          primer_recibo: firstPlan.primer_recibo,
          recibos_subsecuentes: firstPlan.recibos_subsecuentes,

          input_json: input,
          result_json: result,

          created_by: user.id,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      const insuredsData = result.insureds.map((ins, idx) => ({
        quote_id: quote.id,
        orden: idx + 1,
        nombre: ins.nombre,
        sexo: ins.sexo,
        edad: ins.edad,
        prima_base: ins.prima_base,
        prima_adicionales: ins.prima_adicionales,
        prima_xtensuz: ins.prima_xtensuz,
        prima_total: ins.prima_total,
        adicionales_json: ins.adicionales_detalle,
      }));

      const { error: insuredsError } = await supabase
        .from('gmm_quote_insureds')
        .insert(insuredsData);

      if (insuredsError) throw insuredsError;

      alert(`Cotización guardada: ${quote.quote_number}`);
      setActiveTab('cotizaciones');
      loadQuotes();
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Cargando tarifas...</div>
        </div>
      </Layout>
    );
  }

  if (!tariffTables) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">No hay tarifas activas</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="GMM BX+"
        subtitle="Cotizador de Gastos Médicos Mayores"
      />

      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="cotizador">
              <Calculator className="w-4 h-4 mr-2" />
              Cotizador
            </TabsTrigger>
            <TabsTrigger value="cotizaciones">
              <FileText className="w-4 h-4 mr-2" />
              Mis Cotizaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cotizador">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Parámetros del Plan</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                      <select
                        value={input.estado}
                        onChange={(e) => setInput({ ...input, estado: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_estado.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Hospitalario</label>
                      <select
                        value={input.nivel_hospitalario}
                        onChange={(e) => setInput({ ...input, nivel_hospitalario: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_nivel_hospitalario.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tabulador</label>
                      <select
                        value={input.tabulador}
                        onChange={(e) => setInput({ ...input, tabulador: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_tabulador.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{row.col_0}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suma Asegurada</label>
                      <select
                        value={input.suma_asegurada}
                        onChange={(e) => setInput({ ...input, suma_asegurada: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_suma_asegurada.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{formatCurrency(row.col_0)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deducible</label>
                      <select
                        value={input.deducible}
                        onChange={(e) => setInput({ ...input, deducible: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_deducible.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{formatCurrency(row.col_0)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Coaseguro</label>
                      <select
                        value={input.coaseguro}
                        onChange={(e) => {
                          const newCoaseguro = e.target.value;
                          const rango = getTopeCoaseguroRango(tariffTables.tope_coaseguro_rangos, newCoaseguro);
                          setInput({
                            ...input,
                            coaseguro: newCoaseguro,
                            tope_coaseguro_seleccionado: rango?.tope_default
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {tariffTables.factor_coaseguro.map((row) => (
                          <option key={row.col_0} value={row.col_0}>{formatPercentage(row.col_0)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tope de Coaseguro
                      </label>
                      {(() => {
                        if (!input.coaseguro) {
                          return (
                            <div className="text-sm text-gray-500 italic py-2">
                              Selecciona un coaseguro primero
                            </div>
                          );
                        }

                        const rango = getTopeCoaseguroRango(tariffTables.tope_coaseguro_rangos, input.coaseguro);

                        if (!rango) {
                          return (
                            <div className="text-sm text-red-600 py-2">
                              No se encontró rango de tope para el coaseguro seleccionado
                            </div>
                          );
                        }

                        const valorActual = input.tope_coaseguro_seleccionado || rango.tope_default;

                        return (
                          <>
                            <input
                              type="number"
                              value={valorActual}
                              min={rango.tope_min}
                              max={rango.tope_max}
                              step={1000}
                              onChange={(e) => {
                                const valor = Number(e.target.value);
                                if (valor >= rango.tope_min && valor <= rango.tope_max) {
                                  setInput({
                                    ...input,
                                    tope_coaseguro_seleccionado: valor
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                              <p className="font-medium mb-1">Rango permitido:</p>
                              <div className="flex items-center justify-between">
                                <span>Mínimo: <span className="font-semibold">{formatMoneySafe(rango.tope_min)}</span></span>
                                <span>Máximo: <span className="font-semibold">{formatMoneySafe(rango.tope_max)}</span></span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Formas de Pago (selecciona una o más)</label>
                      <div className="grid grid-cols-2 gap-3">
                        {tariffTables.forma_pago.map((row) => (
                          <label key={row.col_0} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={input.formas_pago.includes(row.col_0)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setInput({ ...input, formas_pago: [...input.formas_pago, row.col_0] });
                                } else {
                                  setInput({ ...input, formas_pago: input.formas_pago.filter(fp => fp !== row.col_0) });
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{row.col_0}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Asegurados</h3>
                    <Button onClick={handleAddInsured} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {input.insureds.map((insured, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-sm text-gray-700">Asegurado {idx + 1}</span>
                          {input.insureds.length > 1 && (
                            <button
                              onClick={() => handleRemoveInsured(idx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-6">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo*</label>
                            <input
                              type="text"
                              placeholder="Nombre completo"
                              value={insured.nombre}
                              onChange={(e) => handleInsuredChange(idx, 'nombre', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              required
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Sexo*</label>
                            <select
                              value={insured.sexo}
                              onChange={(e) => handleInsuredChange(idx, 'sexo', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="Hombre">Hombre</option>
                              <option value="Mujer">Mujer</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Edad*</label>
                            <input
                              type="number"
                              placeholder="Edad"
                              min="0"
                              max="99"
                              value={insured.edad || ''}
                              onChange={(e) => {
                                const edad = parseInt(e.target.value);
                                handleInsuredChange(idx, 'edad', !isNaN(edad) && edad > 0 ? edad : undefined as any);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Coberturas Opcionales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'reconocimiento_antiguedad',
                      'medicamentos_fuera',
                      'complicaciones_no_amparadas',
                      'padecimientos_preexistentes',
                      'eliminacion_deducible_accidente',
                      'multiregion',
                      'vip',
                      'emergencia_medica_extranjero',
                      'enfermedades_graves_extranjero',
                      'cobertura_internacional',
                      'ampliacion_servicios',
                      'ayuda_diaria',
                      'indemnizacion_eg',
                    ].map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm group cursor-pointer">
                        <input
                          type="checkbox"
                          checked={input.coberturas[key as keyof typeof input.coberturas] || false}
                          onChange={(e) =>
                            setInput({
                              ...input,
                              coberturas: { ...input.coberturas, [key]: e.target.checked },
                            })
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1">{COVERAGE_LABELS[key] || key}</span>
                        <InfoTooltip content={getCoverageHelpText(key)} />
                      </label>
                    ))}
                  </div>
                </Card>

                <div className="flex gap-3">
                  <Button onClick={handleCalculate} disabled={calculating} className="flex-1">
                    <Calculator className="w-4 h-4 mr-2" />
                    {calculating ? 'Calculando...' : 'Calcular'}
                  </Button>
                  {result && (
                    <Button onClick={handleSave} disabled={saving} variant="outline" className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                {result && (
                  <>
                    <Card className="p-6 sticky top-6">
                      <h3 className="text-lg font-semibold mb-4">Resumen General</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Prima Neta Total</span>
                          <span className="font-medium">${result.prima_neta_total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Tope Coaseguro</span>
                          <span>{formatMoneySafe(result.tope_coaseguro)}</span>
                        </div>
                      </div>
                    </Card>

                    {result.payment_plans.map((plan, idx) => (
                      <Card key={idx} className="p-6">
                        <h3 className="text-lg font-semibold mb-4 text-blue-600">{plan.forma_pago}</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Prima Neta</span>
                            <span className="font-medium">${result.prima_neta_total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Recargo</span>
                            <span className="font-medium">${plan.recargo.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Gastos Expedición</span>
                            <span className="font-medium">${plan.gastos_expedicion.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium">${plan.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">IVA</span>
                            <span className="font-medium">${plan.iva.toFixed(2)}</span>
                          </div>
                          <div className="border-t pt-3 flex justify-between">
                            <span className="font-semibold">TOTAL</span>
                            <span className="font-bold text-lg text-blue-600">${plan.total.toFixed(2)}</span>
                          </div>

                          <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Primer Recibo</span>
                              <span className="font-medium">${plan.primer_recibo.toFixed(2)}</span>
                            </div>
                            {plan.num_recibos > 1 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Recibos Subsecuentes ({plan.num_recibos - 1})</span>
                                <span className="font-medium">${plan.recibos_subsecuentes.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cotizaciones">
            {loadingQuotes ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Cargando cotizaciones...</div>
              </div>
            ) : quotes.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay cotizaciones guardadas</p>
                <Button
                  onClick={() => setActiveTab('cotizador')}
                  className="mt-4"
                  variant="outline"
                >
                  Crear nueva cotización
                </Button>
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
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{quote.quote_number}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(quote.created_at).toLocaleDateString('es-MX')}
                          </div>
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">
                              {quote.result_json?.insureds?.[0]?.nombre || 'Sin nombre'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            ${quote.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div>
                  {selectedQuote ? (
                    <Card className="p-6 sticky top-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Detalle de Cotización</h3>
                        <Button
                          onClick={() => handleDownloadPDF(selectedQuote)}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </div>

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
                            <div className="flex justify-between">
                              <span className="text-gray-600">Estado:</span>
                              <span className="font-medium">{selectedQuote.estado}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Nivel:</span>
                              <span className="font-medium">{selectedQuote.nivel_hospitalario}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Suma Asegurada:</span>
                              <span className="font-medium">{selectedQuote.suma_asegurada}</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-gray-700 mb-2">Formas de Pago Calculadas</h4>
                          {selectedQuote.result_json?.payment_plans?.map((plan: any, idx: number) => (
                            <div key={idx} className="mb-3 p-3 bg-gray-50 rounded">
                              <div className="font-medium text-sm text-blue-600 mb-2">{plan.forma_pago}</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Total:</span>
                                  <span className="font-medium">${plan.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Primer Recibo:</span>
                                  <span className="font-medium">${plan.primer_recibo.toFixed(2)}</span>
                                </div>
                                {plan.num_recibos > 1 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Subsecuentes ({plan.num_recibos - 1}):</span>
                                    <span className="font-medium">${plan.recibos_subsecuentes.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
