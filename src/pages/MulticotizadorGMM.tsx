import { useState, useEffect, useCallback } from 'react';
import { Heart, Calculator, History, Settings, Plus, Trash2, Users, FileDown, Save, Loader, CircleAlert as AlertCircle } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { calculateBnv, calculateBxplus, calculateBnp } from '../lib/multicotizadorGmm';
import type { ProductId, QuotePerson, FormaPago, CarrierResult, MultiGmmOption, BnvQuoteInput, BnpQuoteInput, BxplusQuoteInput, SavedMultiGmmQuote } from '../lib/multicotizadorGmm/types';
import { PRODUCT_LABELS, PRODUCT_COLORS } from '../lib/multicotizadorGmm/types';
import { TarifasAdminPanel } from '../components/multicotizadorGmm/TarifasAdminPanel';
import { ComparisonResults } from '../components/multicotizadorGmm/ComparisonResults';
import { generateMultiGmmPdf } from '../lib/multicotizadorGmm/pdfGenerator';

const TABS = [
  { id: 'cotizador', label: 'Cotizador', icon: Calculator },
  { id: 'historial', label: 'Cotizaciones', icon: History },
  { id: 'tarifas', label: 'Tarifas', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

const DEFAULT_PERSON: () => QuotePerson = () => ({
  id: crypto.randomUUID(),
  name: '',
  relation: 'Titular',
  gender: 'Masculino',
  age: 30,
});

const DEFAULT_BNV_INPUT: BnvQuoteInput = {
  region_zone: 'Zona 1',
  suma_asegurada: 100,
  deducible: 35,
  coaseguro: 10,
  tope_coaseguro: 30000,
  client_type: 'Normal',
  asistencia_extranjero: true,
  forma_pago: 'Anual',
};

const DEFAULT_BNP_INPUT: BnpQuoteInput = {
  region_zone: 'Zona 1',
  suma_asegurada: 50,
  deducible: 35,
  coaseguro: 10,
  client_type: 'Normal',
  maternidad_titular: false,
  maternidad_conyuge: false,
  asistencia_extranjero: true,
  cobertura_catastrofica_extranjero: false,
  forma_pago: 'Anual',
};

const DEFAULT_BXPLUS_INPUT: BxplusQuoteInput = {
  estado: 'CDMX',
  nivel_hospitalario: 'Alto',
  tabulador: 'A',
  suma_asegurada: '500',
  deducible: '20000',
  coaseguro: '10%',
  forma_pago: 'Anual',
};

export default function MulticotizadorGMM() {
  const { usuario } = useMoviAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [activeTab, setActiveTab] = useState<TabId>('cotizador');

  const [clientName, setClientName] = useState('');
  const [people, setPeople] = useState<QuotePerson[]>([DEFAULT_PERSON()]);
  const [enabledProducts, setEnabledProducts] = useState<Record<ProductId, boolean>>({ BXPLUS: true, BNV: true, BNP: true });
  const [bnvInput, setBnvInput] = useState<BnvQuoteInput>(DEFAULT_BNV_INPUT);
  const [bnpInput, setBnpInput] = useState<BnpQuoteInput>(DEFAULT_BNP_INPUT);
  const [bxplusInput, setBxplusInput] = useState<BxplusQuoteInput>(DEFAULT_BXPLUS_INPUT);

  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<CarrierResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedMultiGmmQuote[]>([]);

  const loadSavedQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('multicotizador_gmm_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setSavedQuotes(data as any);
  }, []);

  useEffect(() => {
    if (activeTab === 'historial') loadSavedQuotes();
  }, [activeTab, loadSavedQuotes]);

  const addPerson = () => setPeople(prev => [...prev, { ...DEFAULT_PERSON(), relation: prev.length === 0 ? 'Titular' : 'Dependiente' }]);
  const removePerson = (id: string) => setPeople(prev => prev.filter(p => p.id !== id));
  const updatePerson = (id: string, field: keyof QuotePerson, value: any) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleCalculate = async () => {
    if (people.length === 0 || people.some(p => !p.name.trim())) {
      setError('Agrega al menos un asegurado con nombre');
      return;
    }
    const activeProducts = (Object.entries(enabledProducts) as [ProductId, boolean][]).filter(([, v]) => v).map(([k]) => k);
    if (activeProducts.length === 0) {
      setError('Selecciona al menos un producto para cotizar');
      return;
    }

    setCalculating(true);
    setError(null);
    setResults(null);

    try {
      const carrierResults: CarrierResult[] = [];

      if (enabledProducts.BNV) {
        const { data: pkg } = await supabase
          .from('multicotizador_gmm_packages')
          .select('*')
          .eq('product', 'BNV')
          .eq('status', 'active')
          .single();
        if (pkg) {
          const { data: rates } = await supabase
            .from('multicotizador_gmm_rates')
            .select('lookup_key, region, age, rate, rate_type')
            .eq('package_id', pkg.id);
          if (rates) {
            const result = calculateBnv(bnvInput, people, {
              package_id: pkg.id,
              derecho_poliza: pkg.derecho_poliza,
              asistencia_extranjero: pkg.asistencia_extranjero,
              client_types: pkg.client_types || [],
              internal_factors: pkg.internal_factors || [],
              rates: rates as any,
            });
            carrierResults.push(result);
          }
        } else {
          carrierResults.push({ product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any, tariff_package_id: '', error: 'No hay tarifa BNV activa. Sube una tarifa en la pestana Tarifas.' });
        }
      }

      if (enabledProducts.BNP) {
        const { data: pkg } = await supabase
          .from('multicotizador_gmm_packages')
          .select('*')
          .eq('product', 'BNP')
          .eq('status', 'active')
          .single();
        if (pkg) {
          const { data: rates } = await supabase
            .from('multicotizador_gmm_rates')
            .select('lookup_key, plan_name, region, age, rate, rate_type')
            .eq('package_id', pkg.id);
          if (rates) {
            const result = calculateBnp(bnpInput, people, {
              package_id: pkg.id,
              derecho_poliza: pkg.derecho_poliza,
              asistencia_extranjero: pkg.asistencia_extranjero,
              costo_catastrofica_extranjero: pkg.costo_catastrofica_extranjero || 5800,
              client_types: pkg.client_types || [],
              internal_factors: pkg.internal_factors || [],
              rates: rates as any,
            });
            carrierResults.push(result);
          }
        } else {
          carrierResults.push({ product: 'BNP', people_results: [], prima_anual_total: 0, totals: {} as any, tariff_package_id: '', error: 'No hay tarifa BNP activa. Sube una tarifa en la pestana Tarifas.' });
        }
      }

      if (enabledProducts.BXPLUS) {
        const { data: pkg } = await supabase
          .from('tariff_packages')
          .select('id')
          .eq('status', 'active')
          .single();
        if (pkg) {
          const { data: tables } = await supabase
            .from('tariff_tables')
            .select('table_key, data_json')
            .eq('tariff_package_id', pkg.id);
          if (tables) {
            const result = calculateBxplus(bxplusInput, people, tables, pkg.id);
            carrierResults.push(result);
          }
        } else {
          carrierResults.push({ product: 'BXPLUS', people_results: [], prima_anual_total: 0, totals: {} as any, tariff_package_id: '', error: 'No hay tarifa BX+ activa.' });
        }
      }

      setResults(carrierResults);
    } catch (err: any) {
      setError(err.message || 'Error al calcular');
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!results || !clientName.trim()) return;
    setSaving(true);
    try {
      const options: MultiGmmOption[] = [];
      if (enabledProducts.BNV) options.push({ product_id: 'BNV', enabled: true, input: bnvInput });
      if (enabledProducts.BNP) options.push({ product_id: 'BNP', enabled: true, input: bnpInput });
      if (enabledProducts.BXPLUS) options.push({ product_id: 'BXPLUS', enabled: true, input: bxplusInput });

      await supabase.from('multicotizador_gmm_quotes').insert({
        client_name: clientName,
        people_json: people,
        options_json: options,
        results_json: results,
        status: 'calculated',
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!results) return;
    try {
      const blob = await generateMultiGmmPdf(results, people, clientName, usuario);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multicotizador-gmm-${clientName || 'cotizacion'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Error generando PDF: ' + err.message);
    }
  };

  const visibleTabs = TABS.filter(t => t.id !== 'tarifas' || isAdmin);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30">
          <Heart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Multicotizador GMM</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Compara BX+, Bupa Nacional Vital y Bupa Nacional Plus</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl w-fit">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'cotizador' && (
        <div className="space-y-6">
          {/* Client Name */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Nombre del Cliente</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nombre completo del titular o empresa"
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          {/* Insureds */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Asegurados</h3>
              </div>
              <button onClick={addPerson} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="space-y-3">
              {people.map((person, idx) => (
                <div key={person.id} className="grid grid-cols-[1fr_120px_110px_80px_36px] gap-3 items-center">
                  <input
                    type="text"
                    value={person.name}
                    onChange={e => updatePerson(person.id, 'name', e.target.value)}
                    placeholder={`Asegurado ${idx + 1}`}
                    className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                  <select
                    value={person.relation}
                    onChange={e => updatePerson(person.id, 'relation', e.target.value)}
                    className="px-2 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none"
                  >
                    <option value="Titular">Titular</option>
                    <option value="Conyuge">Conyuge</option>
                    <option value="Hijo">Hijo(a)</option>
                    <option value="Dependiente">Dependiente</option>
                  </select>
                  <select
                    value={person.gender}
                    onChange={e => updatePerson(person.id, 'gender', e.target.value)}
                    className="px-2 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={person.age}
                    onChange={e => updatePerson(person.id, 'age', Number(e.target.value))}
                    className="px-2 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                  <button
                    onClick={() => removePerson(person.id)}
                    disabled={people.length <= 1}
                    className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Product Selection */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Productos a Comparar</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {(['BXPLUS', 'BNV', 'BNP'] as ProductId[]).map(pid => (
                <label
                  key={pid}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    enabledProducts[pid]
                      ? 'border-teal-300 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-900/10'
                      : 'border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabledProducts[pid]}
                    onChange={e => setEnabledProducts(prev => ({ ...prev, [pid]: e.target.checked }))}
                    className="w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{PRODUCT_LABELS[pid]}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* BNV Parameters */}
          {enabledProducts.BNV && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={{ color: PRODUCT_COLORS.BNV }}>Bupa Nacional Vital - Parametros</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Region</label>
                  <select value={bnvInput.region_zone} onChange={e => setBnvInput(prev => ({ ...prev, region_zone: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    <option value="Zona 1">Zona 1 (CDMX, ZM, MTY)</option>
                    <option value="Zona 2">Zona 2 (Resto)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Suma Asegurada (MMDP)</label>
                  <select value={bnvInput.suma_asegurada} onChange={e => setBnvInput(prev => ({ ...prev, suma_asegurada: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[3, 5, 10, 15, 20, 30, 50, 75, 100].map(v => <option key={v} value={v}>{v} MDP</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Deducible (miles)</label>
                  <select value={bnvInput.deducible} onChange={e => setBnvInput(prev => ({ ...prev, deducible: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[5, 10, 15, 20, 25, 30, 35, 40, 50, 100].map(v => <option key={v} value={v}>${v},000</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Coaseguro (%)</label>
                  <select value={bnvInput.coaseguro} onChange={e => setBnvInput(prev => ({ ...prev, coaseguro: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[0, 10, 20, 30].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Tope Coaseguro</label>
                  <select value={bnvInput.tope_coaseguro} onChange={e => setBnvInput(prev => ({ ...prev, tope_coaseguro: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[0, 30000, 40000, 50000, 60000].map(v => <option key={v} value={v}>{v === 0 ? 'Sin tope' : `$${v.toLocaleString()}`}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bnvInput.asistencia_extranjero} onChange={e => setBnvInput(prev => ({ ...prev, asistencia_extranjero: e.target.checked }))} className="w-4 h-4 rounded border-neutral-300 text-teal-600" />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Asistencia Extranjero</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* BNP Parameters */}
          {enabledProducts.BNP && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={{ color: PRODUCT_COLORS.BNP }}>Bupa Nacional Plus - Parametros</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Region</label>
                  <select value={bnpInput.region_zone} onChange={e => setBnpInput(prev => ({ ...prev, region_zone: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    <option value="Zona 1">Zona 1 (CDMX, ZM, MTY)</option>
                    <option value="Zona 2">Zona 2 (Resto)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Suma Asegurada (MDP)</label>
                  <select value={bnpInput.suma_asegurada} onChange={e => setBnpInput(prev => ({ ...prev, suma_asegurada: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[5, 10, 15, 20, 30, 50, 75, 100].map(v => <option key={v} value={v}>{v} MDP</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Deducible (miles)</label>
                  <select value={bnpInput.deducible} onChange={e => setBnpInput(prev => ({ ...prev, deducible: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[5, 10, 15, 20, 25, 30, 35, 50].map(v => <option key={v} value={v}>${v},000</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Coaseguro (%)</label>
                  <select value={bnpInput.coaseguro} onChange={e => setBnpInput(prev => ({ ...prev, coaseguro: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {[0, 10, 20, 30].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bnpInput.asistencia_extranjero} onChange={e => setBnpInput(prev => ({ ...prev, asistencia_extranjero: e.target.checked }))} className="w-4 h-4 rounded border-neutral-300 text-teal-600" />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Asistencia Ext.</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bnpInput.cobertura_catastrofica_extranjero} onChange={e => setBnpInput(prev => ({ ...prev, cobertura_catastrofica_extranjero: e.target.checked }))} className="w-4 h-4 rounded border-neutral-300 text-teal-600" />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Catastrofica Ext.</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* BX+ Parameters */}
          {enabledProducts.BXPLUS && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={{ color: PRODUCT_COLORS.BXPLUS }}>BX+ - Parametros</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Estado</label>
                  <select value={bxplusInput.estado} onChange={e => setBxplusInput(prev => ({ ...prev, estado: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['CDMX', 'JALISCO', 'NUEVO LEON', 'ESTADO DE MEXICO', 'PUEBLA', 'QUERETARO', 'GUANAJUATO', 'SONORA', 'CHIHUAHUA', 'YUCATAN'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Nivel Hospitalario</label>
                  <select value={bxplusInput.nivel_hospitalario} onChange={e => setBxplusInput(prev => ({ ...prev, nivel_hospitalario: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['Alto', 'Medio', 'Basico'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Tabulador</label>
                  <select value={bxplusInput.tabulador} onChange={e => setBxplusInput(prev => ({ ...prev, tabulador: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['A', 'B', 'C'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Suma Asegurada</label>
                  <select value={bxplusInput.suma_asegurada} onChange={e => setBxplusInput(prev => ({ ...prev, suma_asegurada: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['200', '300', '400', '500', '750', '1000'].map(v => <option key={v} value={v}>${v} MDP</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Deducible</label>
                  <select value={bxplusInput.deducible} onChange={e => setBxplusInput(prev => ({ ...prev, deducible: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['10000', '15000', '20000', '25000', '30000', '40000', '50000'].map(v => <option key={v} value={v}>${Number(v).toLocaleString()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Coaseguro</label>
                  <select value={bxplusInput.coaseguro} onChange={e => setBxplusInput(prev => ({ ...prev, coaseguro: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white">
                    {['0%', '10%', '20%', '30%'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {calculating ? <Loader className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {calculating ? 'Calculando...' : 'Calcular Cotizacion'}
            </button>
            {results && (
              <>
                <button onClick={handleSave} disabled={saving || !clientName.trim()} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
                <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 font-medium text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors">
                  <FileDown className="w-4 h-4" />
                  Descargar PDF
                </button>
              </>
            )}
          </div>

          {/* Results */}
          {results && <ComparisonResults results={results} selectedFormaPago={bnvInput.forma_pago} />}
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
          {savedQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
              <History className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No hay cotizaciones guardadas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Folio</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQuotes.map(q => (
                    <tr key={q.id} className="border-b border-neutral-50 dark:border-white/[0.03] hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-mono text-xs text-teal-600 dark:text-teal-400">{q.folio}</td>
                      <td className="px-5 py-3 text-neutral-900 dark:text-white">{q.client_name}</td>
                      <td className="px-5 py-3 text-neutral-500">{new Date(q.created_at).toLocaleDateString('es-MX')}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300">{q.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tarifas' && isAdmin && <TarifasAdminPanel />}
    </div>
  );
}
