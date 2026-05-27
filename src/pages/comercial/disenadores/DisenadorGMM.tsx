import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, X, ChevronDown, ChevronUp, BarChart3, Table2,
  Building2, Stethoscope, Baby, Smile, Globe, Heart, Info, RotateCcw,
  Award, Building, UserRound, MapPin, Search, Cross, AlertTriangle
} from 'lucide-react';
import {
  GMM_COVERAGES, GMM_CATEGORY_LABELS, DEFAULT_GMM_COVERAGES,
  SUM_ASSURED_OPTIONS, DEDUCTIBLE_OPTIONS, COINSURANCE_OPTIONS,
  HOSPITAL_LEVELS,
  type GmmCoverageCategory, type HospitalLevel
} from '../../../data/insuranceDesigner/gmmCoverages';
import {
  GMM_HOSPITALS, MEXICAN_STATES, INSURER_LEVEL_NAMES,
  type GmmHospital, type InsurerId,
  numericToHospitalLevel,
} from '../../../data/insuranceDesigner/gmmHospitals';
import {
  calculateGmmMatch, getGmmStatusLabel, getGmmStatusColor,
  getHospitalStatusLabel, getHospitalStatusColor,
  type GmmMatchResult,
} from '../../../lib/insuranceDesigner/calculateGmmMatch';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Building2, Stethoscope, Baby, Smile, Globe, Heart,
};

const INSURER_LOGOS: Record<string, string> = {
  gnp: '/gnp-seguros.png',
  axa: '/allianz-seguros-logo-png_seeklogo-179147.png',
  bupa: '/logo-bupa.png',
  metlife: '/seguros-atlas-logo-png_seeklogo-251455.png',
  mapfre: '/mapfre-seguros-logo-png_seeklogo-225013.png',
  bxplus: '/logo-bx.png',
  planseguro: '/seguwallet-logo.png',
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
  const [hospitalLevel, setHospitalLevel] = useState<HospitalLevel | 'all'>('all');

  // Hospital selection state
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedHospitals, setSelectedHospitals] = useState<GmmHospital[]>([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const hospitalDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (hospitalDropdownRef.current && !hospitalDropdownRef.current.contains(e.target as Node)) {
        setHospitalDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hospitalsInState = useMemo(() => {
    if (!selectedState) return [];
    return GMM_HOSPITALS.filter(h => h.estado === selectedState);
  }, [selectedState]);

  const filteredHospitalOptions = useMemo(() => {
    const available = hospitalsInState.filter(
      h => !selectedHospitals.some(sel => sel.id === h.id)
    );
    if (!hospitalSearch.trim()) return available;
    const q = hospitalSearch.toLowerCase();
    return available.filter(h => h.nombre.toLowerCase().includes(q) || h.ciudad.toLowerCase().includes(q));
  }, [hospitalsInState, selectedHospitals, hospitalSearch]);

  const autoCalculatedLevel = useMemo((): HospitalLevel | null => {
    if (selectedHospitals.length === 0) return null;
    let maxLevel = 0;
    for (const h of selectedHospitals) {
      for (const val of Object.values(h.niveles)) {
        if (val && val > maxLevel) maxLevel = val;
      }
    }
    return numericToHospitalLevel(maxLevel);
  }, [selectedHospitals]);

  const results = useMemo(
    () => calculateGmmMatch(selectedCoverages, selectedHospitals),
    [selectedCoverages, selectedHospitals]
  );

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (age > r.insurer.maxAge || age < r.insurer.minAge) return false;
      if (sumAssured > r.insurer.maxSumAssured) return false;
      if (selectedHospitals.length === 0 && hospitalLevel !== 'all') {
        if (!r.insurer.hospitalLevels.includes(hospitalLevel)) return false;
      }
      return true;
    });
  }, [results, age, sumAssured, hospitalLevel, selectedHospitals.length]);

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

  const addHospital = (hospital: GmmHospital) => {
    setSelectedHospitals(prev => [...prev, hospital]);
    setHospitalSearch('');
    setHospitalDropdownOpen(false);
  };

  const removeHospital = (hospitalId: string) => {
    setSelectedHospitals(prev => prev.filter(h => h.id !== hospitalId));
  };

  const resetSelections = () => {
    setSelectedCoverages(DEFAULT_GMM_COVERAGES);
    setSumAssured(10_000_000);
    setDeductible(10_000);
    setCoinsurance(10);
    setAge(35);
    setHospitalLevel('all');
    setSelectedState('');
    setSelectedHospitals([]);
    setHospitalSearch('');
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/a-la-medida')}
          className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Gastos Medicos Mayores
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configura el perfil de tu cliente y encuentra el plan ideal
          </p>
        </div>
        <div className="hidden sm:flex items-center -space-x-2">
          {Object.entries(INSURER_LOGOS).slice(0, 4).map(([id, logo]) => (
            <div key={id} className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center overflow-hidden">
              <img src={logo} alt="" className="w-5 h-5 object-contain" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Left Panel */}
        <div className="space-y-4">
          {/* Profile Configuration */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                <UserRound className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Perfil del Asegurado
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5 font-medium">Edad</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  min={0}
                  max={99}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5 font-medium">Suma Asegurada</label>
                <select
                  value={sumAssured}
                  onChange={(e) => setSumAssured(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  {SUM_ASSURED_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5 font-medium">Deducible</label>
                <select
                  value={deductible}
                  onChange={(e) => setDeductible(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  {DEDUCTIBLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5 font-medium">Coaseguro</label>
                <select
                  value={coinsurance}
                  onChange={(e) => setCoinsurance(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  {COINSURANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hospital Selection */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Cross className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Red Hospitalaria</label>
              </div>

              {/* State selector */}
              <div className="mb-3">
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedHospitals([]);
                      setHospitalSearch('');
                    }}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all appearance-none"
                  >
                    <option value="">Seleccionar estado...</option>
                    {MEXICAN_STATES.filter(s => GMM_HOSPITALS.some(h => h.estado === s)).map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Hospital multi-select */}
              {selectedState && (
                <div className="mb-3" ref={hospitalDropdownRef}>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hospitalSearch}
                      onChange={(e) => {
                        setHospitalSearch(e.target.value);
                        setHospitalDropdownOpen(true);
                      }}
                      onFocus={() => setHospitalDropdownOpen(true)}
                      placeholder={`Buscar hospital en ${selectedState}...`}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all placeholder:text-gray-400"
                    />
                  </div>

                  {/* Dropdown */}
                  {hospitalDropdownOpen && filteredHospitalOptions.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20 relative">
                      {filteredHospitalOptions.map(h => (
                        <button
                          key={h.id}
                          onClick={() => addHospital(h)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-2 border-b border-gray-50 dark:border-gray-750 last:border-0"
                        >
                          <Cross className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-gray-800 dark:text-gray-200 block truncate">{h.nombre}</span>
                            <span className="text-[10px] text-gray-400">{h.ciudad}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {hospitalDropdownOpen && filteredHospitalOptions.length === 0 && hospitalSearch && (
                    <div className="mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-500">
                      No se encontraron hospitales
                    </div>
                  )}
                </div>
              )}

              {/* Selected hospitals chips */}
              {selectedHospitals.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {selectedHospitals.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/40"
                    >
                      <Cross className="w-3 h-3 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      <span className="text-xs text-teal-800 dark:text-teal-200 flex-1 truncate">{h.nombre}</span>
                      <button
                        onClick={() => removeHospital(h.id)}
                        className="p-0.5 rounded hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
                      >
                        <X className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Auto-calculated level indicator */}
              {autoCalculatedLevel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-800/30">
                  <Building className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <div className="flex-1">
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium block">Nivel requerido (auto)</span>
                    <span className="text-xs font-semibold text-sky-800 dark:text-sky-200 capitalize">{HOSPITAL_LEVELS[autoCalculatedLevel].label}</span>
                  </div>
                </div>
              )}

              {/* Manual level fallback (only when no hospitals selected) */}
              {selectedHospitals.length === 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                      {selectedState ? 'O selecciona nivel manual' : 'Nivel hospitalario'}
                    </label>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      onClick={() => setHospitalLevel('all')}
                      className={`px-2 py-2 rounded-lg text-[11px] font-medium text-center transition-all ${
                        hospitalLevel === 'all'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Todos
                    </button>
                    {(Object.entries(HOSPITAL_LEVELS) as [HospitalLevel, { label: string; description: string }][]).map(([level, info]) => (
                      <button
                        key={level}
                        onClick={() => setHospitalLevel(level)}
                        title={info.description}
                        className={`px-2 py-2 rounded-lg text-[11px] font-medium text-center transition-all ${
                          hospitalLevel === level
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coverage Selection */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedCoverages.length} coberturas
              </span>
            </div>
            <button
              onClick={resetSelections}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 transition-colors px-2 py-1 rounded-md hover:bg-teal-50 dark:hover:bg-teal-900/20"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer
            </button>
          </div>

          <div className="max-h-[calc(100vh-700px)] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {(Object.entries(coveragesByCategory) as [GmmCoverageCategory, typeof GMM_COVERAGES][]).map(([cat, coverages]) => {
              const catLabel = GMM_CATEGORY_LABELS[cat];
              const IconComp = ICON_MAP[catLabel.icon] || Heart;
              const isExpanded = expandedCategories.includes(cat);
              const selectedInCat = coverages.filter(c => selectedCoverages.includes(c.id)).length;
              const allSelected = selectedInCat === coverages.length;

              return (
                <div key={cat} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-shadow hover:shadow-sm">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <IconComp className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 text-left">
                      {catLabel.label}
                    </span>
                    <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      allSelected
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                        : selectedInCat > 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        : 'bg-gray-50 dark:bg-gray-750 text-gray-400 dark:text-gray-500'
                    }`}>
                      {selectedInCat}/{coverages.length}
                    </div>
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
                        className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium mb-1.5 ml-1 transition-colors"
                      >
                        {allSelected ? 'Quitar todas' : 'Agregar todas'}
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
                            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                              isSelected ? 'bg-teal-600 text-white scale-110' : 'border-2 border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0">
                              <span className={`text-sm block leading-tight transition-colors ${
                                isSelected ? 'text-teal-900 dark:text-teal-100 font-medium' : 'text-gray-700 dark:text-gray-300'
                              }`}>
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

          {/* Disclaimer */}
          {selectedHospitals.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                Las redes hospitalarias se actualizan periodicamente. Confirma disponibilidad directamente con cada aseguradora antes de emitir.
              </p>
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resultados
                {filteredResults.length < results.length && (
                  <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                    ({results.length - filteredResults.length} excluidas por filtros)
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedHospitals.length > 0
                  ? `Compatibilidad con ${selectedHospitals.length} hospital${selectedHospitals.length > 1 ? 'es' : ''} seleccionado${selectedHospitals.length > 1 ? 's' : ''}`
                  : 'Ordenados por compatibilidad con tu seleccion'
                }
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}
                title="Vista tarjetas"
              >
                <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}
                title="Vista tabla"
              >
                <Table2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {selectedCoverages.length === 0 && selectedHospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Heart className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Selecciona coberturas o hospitales para ver resultados
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Usa el panel izquierdo para configurar tu busqueda
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
              <Info className="w-12 h-12 text-amber-400 dark:text-amber-600 mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Ninguna aseguradora cumple los filtros actuales
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 max-w-xs">
                Intenta ajustar la edad, suma asegurada o nivel hospitalario para ver mas opciones
              </p>
              <button
                onClick={resetSelections}
                className="mt-4 flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:underline font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restablecer filtros
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <GmmCardsView
              results={filteredResults}
              detailInsurer={detailInsurer}
              setDetailInsurer={setDetailInsurer}
              selectedHospitals={selectedHospitals}
            />
          ) : (
            <GmmTableView results={filteredResults} selectedCoverages={selectedCoverages} />
          )}
        </div>
      </div>
    </div>
  );
}

function GmmCardsView({ results, detailInsurer, setDetailInsurer, selectedHospitals }: {
  results: GmmMatchResult[];
  detailInsurer: string | null;
  setDetailInsurer: (id: string | null) => void;
  selectedHospitals: GmmHospital[];
}) {
  return (
    <div className="space-y-3">
      {results.map((result, idx) => {
        const isExpanded = detailInsurer === result.insurer.id;
        const isTop = idx === 0;
        const bestPlanObj = result.insurer.plans.find(p => p.id === result.bestPlan);
        const logo = INSURER_LOGOS[result.insurer.id];
        const insurerId = result.insurer.id as InsurerId;
        const hasHospitals = selectedHospitals.length > 0;
        const coveredHospitals = result.hospitalDetails.filter(d => d.status === 'cubierto').length;

        return (
          <div
            key={result.insurer.id}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              isTop
                ? 'border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-800 shadow-lg shadow-teal-50 dark:shadow-teal-900/10 ring-1 ring-teal-100 dark:ring-teal-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
            }`}
          >
            {isTop && (
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 px-5 py-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wide">Mejor compatibilidad</span>
              </div>
            )}

            <div className="px-5 py-4 flex items-center gap-4">
              {/* Logo */}
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                {logo ? (
                  <img src={logo} alt={result.insurer.name} className="w-9 h-9 object-contain" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-bold text-sm rounded-xl"
                    style={{ backgroundColor: result.insurer.color }}
                  >
                    {result.insurer.shortName.slice(0, 2)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-white text-sm block">
                  {result.insurer.name}
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                  {result.totalSelected > 0 && (
                    <span>{result.coveredCount}/{result.totalSelected} cubiertas</span>
                  )}
                  {hasHospitals && (
                    <>
                      {result.totalSelected > 0 && <span className="w-1 h-1 rounded-full bg-gray-300" />}
                      <span className={coveredHospitals === selectedHospitals.length ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400'}>
                        {coveredHospitals}/{selectedHospitals.length} hospitales
                      </span>
                    </>
                  )}
                  {bestPlanObj && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-teal-600 dark:text-teal-400 font-medium">{bestPlanObj.name}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${
                  result.matchPercent >= 80 ? 'text-emerald-600' :
                  result.matchPercent >= 60 ? 'text-teal-600' :
                  result.matchPercent >= 40 ? 'text-amber-600' :
                  'text-gray-400'
                }`}>
                  {result.matchPercent}%
                </span>
                <button
                  onClick={() => setDetailInsurer(isExpanded ? null : result.insurer.id)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    result.matchPercent >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                    result.matchPercent >= 60 ? 'bg-gradient-to-r from-teal-500 to-teal-400' :
                    result.matchPercent >= 40 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                    'bg-gray-300'
                  }`}
                  style={{ width: `${result.matchPercent}%` }}
                />
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 animate-in fade-in duration-200">
                {/* Quick stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Edad max</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {result.insurer.maxAge >= 99 ? 'Sin limite' : result.insurer.maxAge}
                    </span>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">SA max</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {result.insurer.maxSumAssured >= 999_000_000 ? 'Ilimitada' : `$${(result.insurer.maxSumAssured / 1_000_000)}M`}
                    </span>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Espera</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.insurer.waitingPeriodMonths}m</span>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Nivel max</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">
                      {result.insurer.hospitalLevels[result.insurer.hospitalLevels.length - 1]}
                    </span>
                  </div>
                </div>

                {/* Hospital coverage details */}
                {hasHospitals && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <Cross className="w-3.5 h-3.5 text-teal-500" />
                      Cobertura Hospitalaria
                    </h4>
                    <div className="space-y-1.5">
                      {result.hospitalDetails.map(detail => {
                        const levelName = INSURER_LEVEL_NAMES[insurerId]?.[detail.requiredLevel] || `Nivel ${detail.requiredLevel}`;
                        return (
                          <div key={detail.hospital.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              detail.status === 'cubierto' ? 'bg-emerald-500' :
                              detail.status === 'requiere_nivel_superior' ? 'bg-amber-500' :
                              detail.status === 'no_cubierto' ? 'bg-red-400' :
                              'bg-gray-400'
                            }`} />
                            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                              {detail.hospital.nombre}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {levelName}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${getHospitalStatusColor(detail.status)}`}>
                              {getHospitalStatusLabel(detail.status)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coverage breakdown */}
                {result.breakdown.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {result.breakdown.map(item => {
                      const coverage = GMM_COVERAGES.find(c => c.id === item.coverageId);
                      if (!coverage) return null;
                      return (
                        <div key={item.coverageId} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-750">
                          {item.status === 'no' ? (
                            <X className="w-3.5 h-3.5 text-red-300 dark:text-red-700 flex-shrink-0" />
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
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Planes disponibles:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {result.insurer.plans.map(plan => (
                      <span
                        key={plan.id}
                        className={`text-xs px-2.5 py-1 rounded-lg ${
                          plan.id === result.bestPlan
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium ring-1 ring-teal-200 dark:ring-teal-800'
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-750 z-10 min-w-[180px]">
                Cobertura
              </th>
              {results.map(r => {
                const logo = INSURER_LOGOS[r.insurer.id];
                return (
                  <th key={r.insurer.id} className="text-center px-3 py-3 min-w-[90px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                        {logo ? (
                          <img src={logo} alt={r.insurer.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold rounded-lg"
                            style={{ backgroundColor: r.insurer.color }}
                          >
                            {r.insurer.shortName.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold ${
                        r.matchPercent >= 80 ? 'text-emerald-600' :
                        r.matchPercent >= 60 ? 'text-teal-600' :
                        'text-gray-500'
                      }`}>
                        {r.matchPercent}%
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {selectedCoverages.map(covId => {
              const coverage = GMM_COVERAGES.find(c => c.id === covId);
              if (!coverage) return null;
              return (
                <tr key={covId} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors">
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
