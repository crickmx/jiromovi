import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, X, Shield, Wrench, FileText, Truck, User, Star, Plus,
  ChevronDown, ChevronUp, BarChart3, Table2, Info, RotateCcw
} from 'lucide-react';
import { AUTO_COVERAGES, CATEGORY_LABELS, DEFAULT_SELECTED_COVERAGES, type CoverageCategory } from '../../../data/insuranceDesigner/autoCoverages';
import { calculateAutoMatch, getStatusLabel, getStatusColor, type AutoMatchResult } from '../../../lib/insuranceDesigner/calculateAutoMatch';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Shield, Wrench, FileText, Truck, User, Star, Plus,
};

type ViewMode = 'cards' | 'table';

export default function DisenadorAuto() {
  const navigate = useNavigate();
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>(DEFAULT_SELECTED_COVERAGES);
  const [expandedCategories, setExpandedCategories] = useState<CoverageCategory[]>(
    Object.keys(CATEGORY_LABELS) as CoverageCategory[]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [detailInsurer, setDetailInsurer] = useState<string | null>(null);

  const results = useMemo(() => calculateAutoMatch(selectedCoverages), [selectedCoverages]);

  const toggleCoverage = (id: string) => {
    setSelectedCoverages(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleCategory = (cat: CoverageCategory) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selectAllInCategory = (cat: CoverageCategory) => {
    const catIds = AUTO_COVERAGES.filter(c => c.category === cat).map(c => c.id);
    const allSelected = catIds.every(id => selectedCoverages.includes(id));
    if (allSelected) {
      setSelectedCoverages(prev => prev.filter(id => !catIds.includes(id)));
    } else {
      setSelectedCoverages(prev => [...new Set([...prev, ...catIds])]);
    }
  };

  const resetSelections = () => setSelectedCoverages(DEFAULT_SELECTED_COVERAGES);

  const coveragesByCategory = useMemo(() => {
    const groups: Record<CoverageCategory, typeof AUTO_COVERAGES> = {} as any;
    for (const cov of AUTO_COVERAGES) {
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
            Disenador de Seguro de Auto
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecciona coberturas y compara aseguradoras
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Left Panel - Coverage Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedCoverages.length} de {AUTO_COVERAGES.length} coberturas
            </span>
            <button
              onClick={resetSelections}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-2 pr-1">
            {(Object.entries(coveragesByCategory) as [CoverageCategory, typeof AUTO_COVERAGES][]).map(([cat, coverages]) => {
              const catLabel = CATEGORY_LABELS[cat];
              const IconComp = ICON_MAP[catLabel.icon] || Shield;
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
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1 ml-1"
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
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                            }`}
                          >
                            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600'
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
              <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Selecciona al menos una cobertura para ver resultados
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <CardsView results={results} detailInsurer={detailInsurer} setDetailInsurer={setDetailInsurer} selectedCoverages={selectedCoverages} />
          ) : (
            <TableView results={results} selectedCoverages={selectedCoverages} />
          )}
        </div>
      </div>
    </div>
  );
}

function CardsView({ results, detailInsurer, setDetailInsurer, selectedCoverages }: {
  results: AutoMatchResult[];
  detailInsurer: string | null;
  setDetailInsurer: (id: string | null) => void;
  selectedCoverages: string[];
}) {
  return (
    <div className="space-y-3">
      {results.map((result, idx) => {
        const isExpanded = detailInsurer === result.insurer.id;
        const isTop = idx === 0;

        return (
          <div
            key={result.insurer.id}
            className={`rounded-xl border transition-all duration-200 ${
              isTop
                ? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 shadow-md'
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      Mejor match
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {result.coveredCount} de {result.totalSelected} coberturas cubiertas
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-xl font-bold ${
                    result.matchPercent >= 80 ? 'text-emerald-600' :
                    result.matchPercent >= 60 ? 'text-blue-600' :
                    result.matchPercent >= 40 ? 'text-amber-600' :
                    'text-gray-400'
                  }`}>
                    {result.matchPercent}%
                  </span>
                </div>
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
                    result.matchPercent >= 60 ? 'bg-blue-500' :
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.breakdown.map(item => {
                    const coverage = AUTO_COVERAGES.find(c => c.id === item.coverageId);
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {result.insurer.packages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Paquetes disponibles:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {result.insurer.packages.map(pkg => (
                        <span key={pkg} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          {pkg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableView({ results, selectedCoverages }: {
  results: AutoMatchResult[];
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
              const coverage = AUTO_COVERAGES.find(c => c.id === covId);
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
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${getStatusColor(status)}`}>
                            {getStatusLabel(status).slice(0, 3)}
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
