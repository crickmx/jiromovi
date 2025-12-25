import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Calculator, Save, FileText, Plus, Trash2, Calendar, DollarSign, Users, ChevronDown, ChevronRight, Download, Search, Edit, ArrowLeftRight } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { InfoTooltip } from '../components/ui/info-tooltip';
import { supabase } from '../lib/supabase';
import { MultiOptionQuote } from '../components/gmm/MultiOptionQuote';
import {
  calculateQuoteV2 as calculateQuote,
  calculateQuoteMultiOption,
  loadTariffTables,
  getTopeCoaseguroOpciones,
  getTopeCoaseguroRango
} from '../lib/gmmCalculationEngineV2';
import { generateUnifiedQuotePDF } from '../lib/gmmPdfUnified';
import { getCoverageHelpText, COVERAGE_LABELS } from '../lib/gmmCoverageHelp';
import { formatMoneySafe } from '../lib/gmmParsingUtils';
import { getEffectiveUserLogo } from '../lib/logoUtils';
import type {
  QuoteInput,
  QuoteInputInsured,
  QuoteCalculationResult,
  TariffTables,
  GMMQuote,
  GMMQuoteInsured,
  QuoteInputMultiOption,
  QuoteOption,
  QuoteOptionPlan,
  QuoteOptionCoberturas,
  QuoteOptionResult,
  QuoteCalculationMultiResult
} from '../lib/gmmTypes';

interface GMMQuotation {
  id: string;
  folio: string;
  usuario_id: string;
  estado: string;
  producto: string;
  cliente_nombre: string | null;
  asegurado_principal: string;
  quote_data: QuoteInput;
  coverage_selections: Record<string, boolean>;
  prima_neta_total: number;
  total_a_pagar: number;
  forma_pago: string;
  pdf_url: string | null;
  editada_desde_cotizacion_id: string | null;
  created_at: string;
  updated_at: string;
}

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function GMMCotizador() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('cotizador');
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [editedFromQuotationId, setEditedFromQuotationId] = useState<string | null>(null);

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
    coberturas: {
      medicamentos_fuera: true,
      eliminacion_deducible_accidente: true,
      multiregion: true,
      vip: true,
      emergencia_medica_extranjero: true,
    },
    montos: {},
  });

  const [result, setResult] = useState<QuoteCalculationResult | null>(null);
  const [multiResult, setMultiResult] = useState<QuoteCalculationMultiResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isComparativeMode, setIsComparativeMode] = useState(false);

  const [quotations, setQuotations] = useState<GMMQuotation[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadActiveTariff();
  }, []);

  useEffect(() => {
    if (location.state?.editQuotation) {
      const quotation = location.state.editQuotation;
      setInput(quotation.quote_data);
      setEditedFromQuotationId(quotation.id);
      setActiveTab('cotizador');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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
        .from('gmm_quotations')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let filtered = data || [];

      if (searchTerm) {
        filtered = filtered.filter(
          q =>
            q.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.asegurado_principal.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.cliente_nombre && q.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      setQuotations(filtered);
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoadingQuotes(false);
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

  function handleCalculateMultiOption(multiInput: QuoteInputMultiOption) {
    if (!tariffTables) {
      alert('Tarifas no cargadas');
      return;
    }

    setCalculating(true);
    try {
      const calculated = calculateQuoteMultiOption(multiInput, tariffTables);
      setMultiResult(calculated);
    } catch (error: any) {
      console.error('Error calculating multi-option:', error);
      const message = error.message || 'Error al calcular las opciones';
      alert(`Error en el cálculo:\n\n${message}`);
    } finally {
      setCalculating(false);
    }
  }

  async function handleDownloadPDF(quotation: GMMQuotation) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('nombre_completo, celular_laboral, web_slug')
        .eq('id', user.id)
        .maybeSingle();

      const asesorInfo = {
        nombre: usuario?.nombre_completo || 'Asesor JIRO',
        celular: usuario?.celular_laboral || '',
        web_slug: usuario?.web_slug || '',
      };

      // Obtener el logo efectivo del usuario
      const logoUrl = await getEffectiveUserLogo(user.id);

      const quoteData = quotation.quote_data as any;

      if (quoteData.multi_option_result) {
        const quoteInfo = {
          folio: quotation.folio,
          created_at: quotation.created_at,
          asegurado_principal: quotation.asegurado_principal,
        };

        const pdfBlob = await generateUnifiedQuotePDF(
          quoteData.multi_option_result.options,
          quoteInfo,
          asesorInfo,
          logoUrl
        );

        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cotizacion_comparativa_${quotation.folio}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const calculationResult = quoteData.calculation_result;

      if (!calculationResult) {
        alert('Esta cotización no tiene datos de cálculo completos. Por favor recalcule y guarde nuevamente.');
        return;
      }

      const planForFormaPago = calculationResult.payment_plans.find(
        (p: any) => p.forma_pago === quotation.forma_pago
      ) || calculationResult.payment_plans[0];

      // Construir opción única en formato QuoteOptionResult
      const singleOption = {
        plan: {
          zona: 'ZONA 1',
          estado: quotation.quote_data.estado,
          nivel_hospitalario: quotation.quote_data.nivel_hospitalario,
          tabulador: quotation.quote_data.tabulador,
          suma_asegurada: quotation.quote_data.suma_asegurada,
          deducible: quotation.quote_data.deducible,
          coaseguro: quotation.quote_data.coaseguro,
          formas_pago: [quotation.forma_pago],
          montos: {}
        },
        cob_medicamentos_fuera: quotation.coverage_selections.medicamentos_fuera || false,
        cob_eliminacion_deducible_accidente: quotation.coverage_selections.eliminacion_deducible_accidente || false,
        cob_multiregion: quotation.coverage_selections.multiregion || false,
        cob_vip: quotation.coverage_selections.vip || false,
        cob_emergencia_medica_extranjero: quotation.coverage_selections.emergencia_medica_extranjero || false,
        cob_reconocimiento_antiguedad: quotation.coverage_selections.reconocimiento_antiguedad || false,
        cob_complicaciones_no_amparadas: quotation.coverage_selections.complicaciones_no_amparadas || false,
        cob_padecimientos_preexistentes: quotation.coverage_selections.padecimientos_preexistentes || false,
        cob_enfermedades_graves_extranjero: quotation.coverage_selections.enfermedades_graves_extranjero || false,
        cob_cobertura_internacional: quotation.coverage_selections.cobertura_internacional || false,
        cob_ampliacion_servicios: quotation.coverage_selections.ampliacion_servicios || false,
        cob_ayuda_diaria: quotation.coverage_selections.ayuda_diaria || false,
        cob_indemnizacion_eg: quotation.coverage_selections.indemnizacion_eg || false,
        cob_maternidad: quotation.coverage_selections.maternidad || false,
        cob_xtensuz: quotation.coverage_selections.xtensuz || false,
        tope_coaseguro: (quotation.quote_data as any).tope_coaseguro_seleccionado || calculationResult.tope_coaseguro,
        insureds: calculationResult.insureds.map((ins: any) => ({
          nombre: ins.nombre,
          sexo: ins.sexo,
          edad: ins.edad,
          prima_base: ins.prima_base || 0,
          prima_adicionales: ins.prima_adicionales || 0,
          prima_neta: ins.prima_total || 0,
          prima_total: ins.prima_total || 0,
          coberturas_adicionales: ins.coberturas_adicionales || ins.adicionales_detalle || null,
        })),
        totales: {
          prima_neta: calculationResult.prima_neta_total,
          recargo: planForFormaPago.recargo,
          gastos_expedicion: planForFormaPago.gastos_expedicion,
          subtotal: planForFormaPago.subtotal,
          iva: planForFormaPago.iva,
          total_pagar: planForFormaPago.total,
          forma_pago: quotation.forma_pago,
          num_recibos: planForFormaPago.num_recibos,
          primer_recibo: planForFormaPago.primer_recibo,
          recibos_subsecuentes: planForFormaPago.recibos_subsecuentes,
        },
        coberturas: {}
      };

      const quoteInfo = {
        folio: quotation.folio,
        created_at: quotation.created_at,
        asegurado_principal: quotation.asegurado_principal,
      };

      const pdfBlob = await generateUnifiedQuotePDF(
        [singleOption],
        quoteInfo,
        asesorInfo,
        logoUrl
      );

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cotizacion_${quotation.folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Error al generar PDF: ${error.message}`);
    }
  }

  function handleEdit(quotation: GMMQuotation) {
    setInput(quotation.quote_data);
    setEditedFromQuotationId(quotation.id);
    setActiveTab('cotizador');
  }

  async function handleDelete(quotation: GMMQuotation) {
    if (!confirm(`¿Está seguro de eliminar la cotización ${quotation.folio}?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('soft_delete_gmm_quotation', {
        p_quotation_id: quotation.id
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Error al eliminar la cotización');
      }

      alert('Cotización eliminada exitosamente');
      loadQuotes();
    } catch (error: any) {
      console.error('Error deleting quotation:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleSave() {
    if (!result) {
      alert('Calcule la cotización primero');
      return;
    }

    if (!input.insureds[0].nombre) {
      alert('Ingrese el nombre del asegurado principal');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const firstPlan = result.payment_plans?.[0];
      if (!firstPlan) {
        throw new Error('No se generaron planes de pago. Verifique que haya seleccionado al menos una forma de pago.');
      }

      const quotationData = {
        usuario_id: user.id,
        estado: 'active',
        producto: 'GMM BX+',
        cliente_nombre: null,
        asegurado_principal: input.insureds[0].nombre,
        quote_data: {
          ...input,
          tope_coaseguro_seleccionado: input.tope_coaseguro_seleccionado || result.tope_coaseguro,
          calculation_result: result,
        },
        coverage_selections: input.coberturas,
        prima_neta_total: result.prima_neta_total,
        total_a_pagar: firstPlan.total,
        forma_pago: input.formas_pago[0] || 'ANUAL',
        editada_desde_cotizacion_id: editedFromQuotationId || null,
      };

      const { data: quotation, error: quotationError } = await supabase
        .from('gmm_quotations')
        .insert(quotationData)
        .select()
        .single();

      if (quotationError) throw quotationError;

      alert(`Cotización guardada: ${quotation.folio}${editedFromQuotationId ? ' (editada)' : ''}`);

      setEditedFromQuotationId(null);
      setActiveTab('cotizaciones');
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMultiOption(multiResult: QuoteCalculationMultiResult) {
    if (!multiResult || !multiResult.options || multiResult.options.length === 0) {
      alert('Calcule las opciones primero');
      return;
    }

    if (!input.insureds[0].nombre) {
      alert('Ingrese el nombre del asegurado principal');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Usar la primera opción como base para datos principales
      const firstOption = multiResult.options[0];

      const quotationData = {
        usuario_id: user.id,
        estado: 'active',
        producto: 'GMM BX+ Comparativa',
        cliente_nombre: null,
        asegurado_principal: input.insureds[0].nombre,
        quote_data: {
          insureds: input.insureds,
          multi_option_result: multiResult,
        },
        coverage_selections: firstOption.coberturas,
        prima_neta_total: firstOption.prima_neta_total,
        total_a_pagar: firstOption.totales.total_pagar,
        forma_pago: firstOption.totales.forma_pago,
        editada_desde_cotizacion_id: null,
      };

      const { data: quotation, error: quotationError } = await supabase
        .from('gmm_quotations')
        .insert(quotationData)
        .select()
        .single();

      if (quotationError) throw quotationError;

      alert(`Cotización comparativa guardada: ${quotation.folio}`);
      setActiveTab('cotizaciones');
      loadQuotes();
    } catch (error: any) {
      console.error('Error saving multi-option:', error);
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
            <div className="mb-6 flex justify-end">
              <Button
                onClick={() => {
                  setIsComparativeMode(!isComparativeMode);
                  setResult(null);
                  setMultiResult(null);
                }}
                variant={isComparativeMode ? "default" : "outline"}
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                {isComparativeMode ? 'Modo Comparativo' : 'Modo Simple'}
              </Button>
            </div>

            {!isComparativeMode ? (
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
                          <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium text-gray-900">
                            {formatMoneySafe(valorActual)}
                          </div>
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
                              className="rounded border-gray-300 text-primary-600 focus:ring-blue-500"
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
                      'maternidad',
                      'xtensuz'
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
                          className="rounded border-gray-300 text-primary-600 focus:ring-blue-500 flex-shrink-0"
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
                        <h3 className="text-lg font-semibold mb-4 text-primary-600">{plan.forma_pago}</h3>
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
                            <span className="font-bold text-lg text-primary-600">${plan.total.toFixed(2)}</span>
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
            ) : (
              <MultiOptionQuote
                tariffTables={tariffTables}
                insureds={input.insureds}
                onInsuredsChange={(insureds) => setInput({ ...input, insureds })}
                onCalculate={handleCalculateMultiOption}
                result={multiResult}
                calculating={calculating}
                onSave={handleSaveMultiOption}
              />
            )}
          </TabsContent>

          <TabsContent value="cotizaciones">
            <Card className="p-6 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por folio, cliente o asegurado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyUp={() => loadQuotes()}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </Card>

            {loadingQuotes ? (
              <Card className="p-12 text-center">
                <p className="text-gray-500">Cargando cotizaciones...</p>
              </Card>
            ) : quotations.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No hay cotizaciones guardadas</p>
                <Button onClick={() => setActiveTab('cotizador')}>
                  Crear Primera Cotización
                </Button>
              </Card>
            ) : (
              <>
                <div className="hidden md:block">
                  <Card className="overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Folio
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente / Asegurado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {quotations.map((q) => (
                          <tr key={q.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                              {q.folio}
                              {q.editada_desde_cotizacion_id && (
                                <span className="ml-2 text-xs text-gray-400">(Editada)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="font-medium">{q.asegurado_principal}</div>
                              {q.cliente_nombre && (
                                <div className="text-gray-500 text-xs">{q.cliente_nombre}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(q.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              {formatCurrency(q.total_a_pagar)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadPDF(q)}
                                  title="Descargar PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(q)}
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(q)}
                                  title="Eliminar"
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>

                <div className="md:hidden space-y-4">
                  {quotations.map((q) => (
                    <Card key={q.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-primary-600">{q.folio}</div>
                          <div className="text-sm text-gray-500">{formatDate(q.created_at)}</div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Asegurado:</span>{' '}
                          <span className="text-gray-900">{q.asegurado_principal}</span>
                        </div>
                        {q.cliente_nombre && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Cliente:</span>{' '}
                            <span className="text-gray-900">{q.cliente_nombre}</span>
                          </div>
                        )}
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Total:</span>{' '}
                          <span className="text-gray-900 font-semibold">
                            {formatCurrency(q.total_a_pagar)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(q)} className="flex-1">
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(q)} className="flex-1">
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(q)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
