import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, X, ChevronDown, ChevronUp, BarChart3, Table2,
  Building2, Stethoscope, Baby, Smile, Globe, Heart, Info, RotateCcw
} from 'lucide-react';
import {
  GMM_COVERAGES, GMM_CATEGORY_LABELS, DEFAULT_GMM_COVERAGES,
  SUM_ASSURED_OPTIONS, DEDUCTIBLE_OPTIONS, COINSURANCE_OPTIONS,
  type GmmCoverageCategory
} from '../../../data/insuranceDesigner/gmmCoverages';
import { calculateGmmMatch, getGmmStatusLabel, getGmmStatusColor, type GmmMatchResult } from '../../../lib/insuranceDesigner/calculateGmmMatch';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Building2, Stethoscope, Baby, Smile, Globe, Heart,
};

type ViewMode = 'cards' | 'table';

export default function DisenadorGMM() {
  const navigate = useNavigate();
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>(DEFAULT_GMM_COVERAGES);
  const [expandedCategories, setExpandedCategories] = useState<GmmCoverageCategory[]>(
    Object.keys(GMM_CATEGORY_LABELS) as GmmCoverageCategory[]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [detailInsurer, setDetailInsurer] = useState<string | null>(null);
  const [sumAssured, setSumAssured] = useState(10_000_000);
  const [deductible, setDeductible] = useState(10_000);
  const [coinsurance, setCoinsurance] = useState(10);
  const [age, setAge] = useState(35);

  const results = useMemo(() => calculateGmmMatch(selectedCoverages), [selectedCoverages]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (age > r.insurer.maxAge || age < r.insurer.minAge) return false;
      if (sumAssured > r.insurer.maxSumAssured) return false;
      return true;
    });
  }, [results, age, sumAssured]);

  const toggleCoverage = (id: string) => {
    setSelectedCoverages(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleCategory = (cat: GmmCoverageCategory) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selectAllInCategory = (cat: GmmCoverageCategory) => {
    const catIds = GMM_COVERAGES.filter(c => c.category === cat).map(c => c.id);
    const allSelected = catIds.every(id => selectedCoverages.includes(id));
    if (allSelected) {
      setSelectedCoverages(prev => prev.filter(id => !catIds.includes(id)));
    } else {
      setSelectedCoverages(prev => [...new Set([...prev, ...catIds])]);
    }
  };

  const resetSelections = () => {
    setSelectedCoverages(DEFAULT_GMM_COVERAGES);
    setSumAssured(10_000_000);
    setDeductible(10_000);
    setCoinsurance(10);
    setAge(35);
  };

  const coveragesByCategory = useMemo(() => {
    const groups: Record<GmmCoverageCategory, typeof GMM_COVERAGES> = {} as any;
    for (const cov of GMM_COVERAGES) {
      if (!groups[cov.category]) groups[cov.category] = [];
      groups[cov.category].push(cov);
    }
    return groups;
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/a-la-medida')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Disenador de Gastos Medicos Mayores
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configura el perfil y compara aseguradoras
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Left Panel */}
        <div className="space-y-4">
          {/* Profile Configuration */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Perfil del Asegurado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Edad</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  min={0}
                  max={99}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Suma Asegurada</label>
                <select
                  value={sumAssured}
                  onChange={(e) => setSumAssured(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  {SUM_ASSURED_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Deducible</label>
                <select
                  value={deductible}
                  onChange={(e) => setDeductible(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  {DEDUCTIBLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Coaseguro</label>
                <select
                  value={coinsurance}
                  onChange={(e) => setCoinsurance(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  {COINSURANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Coverage Selection */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedCoverages.length} de {GMM_COVERAGES.length} coberturas
            </span>
            <button
              onClick={resetSelections}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="max-h-[calc(100vh-480px)] overflow-y-auto space-y-2 pr-1">
            {(Object.entries(coveragesByCategory) as [GmmCoverageCategory, typeof GMM_COVERAGES][]).map(([cat, coverages]) => {
              const catLabel = GMM_CATEGORY_LABELS[cat];
              const IconComp = ICON_MAP[catLabel.icon] || Heart;
              const isExpanded = expandedCategories.includes(cat);
              const selectedInCat = coverages.filter(c => selectedCoverages.includes(c.id)).length;

              return (
                <div key={cat} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <IconComp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 text-left">
                      {catLabel.label}
                    </span>
                    <span className="text-xs text-gray-400 mr-2">
                      {selectedInCat}/{coverages.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-1">
                      <button
                        onClick={() => selectAllInCategory(cat)}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline mb-1 ml-1"
                      >
                        {coverages.every(c => selectedCoverages.includes(c.id)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      </button>
                      {coverages.map(cov => {
                        const isSelected = selectedCoverages.includes(cov.id);
                        return (
                          <button
                            key={cov.id}
                            onClick={() => toggleCoverage(cov.id)}
                            className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
                              isSelected
                                ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                            }`}
                          >
                            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-teal-600 text-white' : 'border border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm text-gray-800 dark:text-gray-200 block leading-tight">
                                {cov.name}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                                {cov.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Compatibilidad de Aseguradoras
              {filteredResults.length < results.length && (
                <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                  ({results.length - filteredResults.length} excluidas por perfil)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
              >
                <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
              >
                <Table2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {selectedCoverages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Selecciona al menos una cobertura para ver resultados
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Info className="w-12 h-12 text-amber-300 dark:text-amber-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Ninguna aseguradora cumple los criterios del perfil. Ajusta la edad o suma asegurada.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <GmmCardsView results={filteredResults} detailInsurer={detailInsurer} setDetailInsurer={setDetailInsurer} />
          ) : (
            <GmmTableView results={filteredResults} selectedCoverages={selectedCoverages} />
          )}
        </div>
      </div>
    </div>
  );
}

function GmmCardsView({ results, detailInsurer, setDetailInsurer }: {
  results: GmmMatchResult[];
  detailInsurer: string | null;
  setDetailInsurer: (id: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {results.map((result, idx) => {
        const isExpanded = detailInsurer === result.insurer.id;
        const isTop = idx === 0;
        const bestPlanObj = result.insurer.plans.find(p => p.id === result.bestPlan);

        return (
          <div
            key={result.insurer.id}
            className={`rounded-xl border transition-all duration-200 ${
              isTop
                ? 'border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-800 shadow-md'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="px-5 py-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: result.insurer.color }}
              >
                {result.insurer.shortName.slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    {result.insurer.name}
                  </span>
                  {isTop && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded">
                      Mejor match
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{result.coveredCount}/{result.totalSelected} cubiertas</span>
                  {bestPlanObj && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>Plan recomendado: {bestPlanObj.name}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xl font-bold ${
                  result.matchPercent >= 80 ? 'text-emerald-600' :
                  result.matchPercent >= 60 ? 'text-teal-600' :
                  result.matchPercent >= 40 ? 'text-amber-600' :
                  'text-gray-400'
                }`}>
                  {result.matchPercent}%
                </span>
                <button
                  onClick={() => setDetailInsurer(isExpanded ? null : result.insurer.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-3">
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    result.matchPercent >= 80 ? 'bg-emerald-500' :
                    result.matchPercent >= 60 ? 'bg-teal-500' :
                    result.matchPercent >= 40 ? 'bg-amber-500' :
                    'bg-gray-300'
                  }`}
                  style={{ width: `${result.matchPercent}%` }}
                />
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Edad max</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.insurer.maxAge} anos</span>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">SA max</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">${(result.insurer.maxSumAssured / 1_000_000)}M</span>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Espera</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.insurer.waitingPeriodMonths} meses</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.breakdown.map(item => {
                    const coverage = GMM_COVERAGES.find(c => c.id === item.coverageId);
                    if (!coverage) return null;
                    return (
                      <div key={item.coverageId} className="flex items-center gap-2 py-1.5">
                        {item.status === 'no' ? (
                          <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
                          {coverage.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getGmmStatusColor(item.status)}`}>
                          {getGmmStatusLabel(item.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Planes disponibles:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {result.insurer.plans.map(plan => (
                      <span
                        key={plan.id}
                        className={`text-xs px-2 py-0.5 rounded ${
                          plan.id === result.bestPlan
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {plan.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GmmTableView({ results, selectedCoverages }: {
  results: GmmMatchResult[];
  selectedCoverages: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-750 z-10 min-w-[180px]">
                Cobertura
              </th>
              {results.map(r => (
                <th key={r.insurer.id} className="text-center px-3 py-3 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: r.insurer.color }}
                    >
                      {r.insurer.shortName.slice(0, 2)}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {r.matchPercent}%
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {selectedCoverages.map(covId => {
              const coverage = GMM_COVERAGES.find(c => c.id === covId);
              if (!coverage) return null;
              return (
                <tr key={covId} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                  <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{coverage.name}</span>
                      <div className="group relative">
                        <Info className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-lg">
                          {coverage.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  {results.map(r => {
                    const item = r.breakdown.find(b => b.coverageId === covId);
                    const status = item?.status || 'no';
                    return (
                      <td key={r.insurer.id} className="px-3 py-2.5 text-center">
                        {status === 'no' ? (
                          <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                        ) : status === 'base' ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${getGmmStatusColor(status)}`}>
                            {getGmmStatusLabel(status).slice(0, 3)}
                          </span>
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
  );
}
