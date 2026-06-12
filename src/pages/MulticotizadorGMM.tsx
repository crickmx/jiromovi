import { useState, useEffect, useCallback } from 'react';
import { Heart, Calculator, History, Settings, Plus, Trash2, Users, FileDown, Save, Loader, CircleAlert as AlertCircle } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { calculateBnv, calculateBxplus, calculateBnp } from '../lib/multicotizadorGmm';
import type {
  ProductId, QuotePerson, FormaPago, MultiGmmOption, OptionResult,
  BnvQuoteInput, BnpQuoteInput, BxplusQuoteInput, SavedMultiGmmQuote,
} from '../lib/multicotizadorGmm/types';
import { DEFAULT_BXPLUS_COVERAGES } from '../lib/multicotizadorGmm/types';
import { TarifasAdminPanel } from '../components/multicotizadorGmm/TarifasAdminPanel';
import { ComparisonResults } from '../components/multicotizadorGmm/ComparisonResults';
import { OptionConfigurator } from '../components/multicotizadorGmm/OptionConfigurator';
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

function createDefaultOption(index: number): MultiGmmOption {
  return {
    id: crypto.randomUUID(),
    label: `Opcion ${index}`,
    product_id: 'BXPLUS',
    input: {
      estado: 'CDMX',
      nivel_hospitalario: 'Alto',
      tabulador: 'A',
      suma_asegurada: '500',
      deducible: '20000',
      coaseguro: '10%',
      forma_pago: 'Anual',
      coverages: { ...DEFAULT_BXPLUS_COVERAGES },
    } as BxplusQuoteInput,
  };
}

export default function MulticotizadorGMM() {
  const { usuario } = useMoviAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [activeTab, setActiveTab] = useState<TabId>('cotizador');

  const [clientName, setClientName] = useState('');
  const [people, setPeople] = useState<QuotePerson[]>([DEFAULT_PERSON()]);
  const [options, setOptions] = useState<MultiGmmOption[]>([
    createDefaultOption(1),
    createDefaultOption(2),
    createDefaultOption(3),
  ]);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set([options[0].id]));

  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<OptionResult[] | null>(null);
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

  const addOption = () => {
    const newOpt = createDefaultOption(options.length + 1);
    setOptions(prev => [...prev, newOpt]);
    setExpandedOptions(prev => new Set([...prev, newOpt.id]));
  };

  const removeOption = (id: string) => {
    setOptions(prev => prev.filter(o => o.id !== id));
    setExpandedOptions(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const duplicateOption = (id: string) => {
    const source = options.find(o => o.id === id);
    if (!source) return;
    const newOpt: MultiGmmOption = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      label: `${source.label} (copia)`,
    };
    const idx = options.findIndex(o => o.id === id);
    const updated = [...options];
    updated.splice(idx + 1, 0, newOpt);
    setOptions(updated);
    setExpandedOptions(prev => new Set([...prev, newOpt.id]));
  };

  const updateOption = (updated: MultiGmmOption) => {
    setOptions(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const toggleExpand = (id: string) => {
    setExpandedOptions(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleCalculate = async () => {
    if (people.length === 0 || people.some(p => !p.name.trim())) {
      setError('Agrega al menos un asegurado con nombre');
      return;
    }
    if (options.length === 0) {
      setError('Agrega al menos una opcion para cotizar');
      return;
    }

    setCalculating(true);
    setError(null);
    setResults(null);

    try {
      const optionResults: OptionResult[] = [];

      // Preload tariff data per product to avoid redundant fetches
      const productTariffs: Record<string, any> = {};

      const needsBnv = options.some(o => o.product_id === 'BNV');
      const needsBnp = options.some(o => o.product_id === 'BNP');
      const needsBxplus = options.some(o => o.product_id === 'BXPLUS');

      if (needsBnv) {
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
          productTariffs.BNV = { pkg, rates };
        } else {
          productTariffs.BNV = { error: 'No hay tarifa BNV activa. Sube una tarifa en la pestana Tarifas.' };
        }
      }

      if (needsBnp) {
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
          productTariffs.BNP = { pkg, rates };
        } else {
          productTariffs.BNP = { error: 'No hay tarifa BNP activa. Sube una tarifa en la pestana Tarifas.' };
        }
      }

      if (needsBxplus) {
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
          productTariffs.BXPLUS = { pkg, tables };
        } else {
          productTariffs.BXPLUS = { error: 'No hay tarifa BX+ activa.' };
        }
      }

      // Calculate each option
      for (const opt of options) {
        const tariff = productTariffs[opt.product_id];

        if (!tariff || tariff.error) {
          optionResults.push({
            option_id: opt.id,
            option_label: opt.label,
            product_id: opt.product_id,
            result: {
              product: opt.product_id,
              people_results: [],
              prima_anual_total: 0,
              totals: {} as any,
              tariff_package_id: '',
              error: tariff?.error || 'Tarifa no disponible',
            } as any,
          });
          continue;
        }

        if (opt.product_id === 'BNV') {
          const { pkg, rates } = tariff;
          const result = calculateBnv(opt.input as BnvQuoteInput, people, {
            package_id: pkg.id,
            derecho_poliza: pkg.derecho_poliza,
            asistencia_extranjero: pkg.asistencia_extranjero,
            client_types: pkg.client_types || [],
            internal_factors: pkg.internal_factors || [],
            rates,
          });
          optionResults.push({ option_id: opt.id, option_label: opt.label, product_id: 'BNV', result });
        } else if (opt.product_id === 'BNP') {
          const { pkg, rates } = tariff;
          const result = calculateBnp(opt.input as BnpQuoteInput, people, {
            package_id: pkg.id,
            derecho_poliza: pkg.derecho_poliza,
            asistencia_extranjero: pkg.asistencia_extranjero,
            costo_catastrofica_extranjero: pkg.costo_catastrofica_extranjero || 5800,
            client_types: pkg.client_types || [],
            internal_factors: pkg.internal_factors || [],
            rates,
          });
          optionResults.push({ option_id: opt.id, option_label: opt.label, product_id: 'BNP', result });
        } else if (opt.product_id === 'BXPLUS') {
          const { pkg, tables } = tariff;
          const result = calculateBxplus(opt.input as BxplusQuoteInput, people, tables, pkg.id);
          optionResults.push({ option_id: opt.id, option_label: opt.label, product_id: 'BXPLUS', result });
        }
      }

      setResults(optionResults);
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
      await supabase.from('multicotizador_gmm_quotes').insert({
        client_name: clientName,
        people_json: people,
        options_json: options,
        results_json: results,
        selected_formas_pago: ['Anual', 'Semestral', 'Trimestral', 'Mensual'],
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

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Opciones de Cotizacion</h3>
              <button onClick={addOption} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar Opcion
              </button>
            </div>
            <div className="space-y-3">
              {options.map(opt => (
                <OptionConfigurator
                  key={opt.id}
                  option={opt}
                  onUpdate={updateOption}
                  onRemove={() => removeOption(opt.id)}
                  onDuplicate={() => duplicateOption(opt.id)}
                  canRemove={options.length > 1}
                  isExpanded={expandedOptions.has(opt.id)}
                  onToggleExpand={() => toggleExpand(opt.id)}
                />
              ))}
            </div>
          </div>

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
          {results && <ComparisonResults results={results} selectedFormaPago="Anual" />}
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
