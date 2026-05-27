import { useState, useMemo } from 'react';
import { Search, MapPin, Building, Filter, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  GMM_HOSPITALS, MEXICAN_STATES, INSURER_LEVEL_NAMES,
  type InsurerId, type GmmHospital,
} from '../../../../data/insuranceDesigner/gmmHospitals';
import { GMM_INSURERS } from '../../../../data/insuranceDesigner/gmmInsurers';

const INSURER_LOGOS: Record<string, string> = {
  gnp: '/gnp-seguros.png',
  axa: '/allianz-seguros-logo-png_seeklogo-179147.png',
  bupa: '/logo-bupa.png',
  metlife: '/seguros-atlas-logo-png_seeklogo-251455.png',
  mapfre: '/mapfre-seguros-logo-png_seeklogo-225013.png',
  bxplus: '/logo-bx.png',
  planseguro: '/plan-seguro-logo.png',
};

function getLevelColor(level: number): string {
  if (level >= 5) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (level === 4) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
  if (level === 3) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (level === 2) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (level === 1) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return 'bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-400';
}

export default function TabHospitales() {
  const [selectedState, setSelectedState] = useState<string>('CDMX');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInsurer, setFilterInsurer] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<number>(0);

  const statesWithHospitals = useMemo(() =>
    MEXICAN_STATES.filter(s => GMM_HOSPITALS.some(h => h.estado === s)),
    []
  );

  const filteredHospitals = useMemo(() => {
    let hospitals = GMM_HOSPITALS;

    if (selectedState) {
      hospitals = hospitals.filter(h => h.estado === selectedState);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      hospitals = hospitals.filter(h =>
        h.nombre.toLowerCase().includes(q) ||
        h.ciudad.toLowerCase().includes(q)
      );
    }

    if (filterInsurer !== 'all' && filterLevel > 0) {
      hospitals = hospitals.filter(h => {
        const level = h.niveles[filterInsurer as InsurerId];
        return level !== undefined && level >= filterLevel;
      });
    }

    return hospitals;
  }, [selectedState, searchQuery, filterInsurer, filterLevel]);

  const hospitalCountByState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of GMM_HOSPITALS) {
      counts[h.estado] = (counts[h.estado] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Red Hospitalaria
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Explora {GMM_HOSPITALS.length} hospitales en {statesWithHospitals.length} estados con niveles por aseguradora
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-0.5">Directorio referencial</p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            La informacion de redes hospitalarias puede contener errores u omisiones. Los niveles y la disponibilidad de hospitales cambian periodicamente. Verifica el directorio actualizado directamente en el sitio oficial de cada aseguradora antes de contratar o emitir una poliza.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="relative">
          <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none"
          >
            <option value="">Todos los estados</option>
            {statesWithHospitals.map(state => (
              <option key={state} value={state}>{state} ({hospitalCountByState[state] || 0})</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar hospital..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 placeholder:text-gray-400"
          />
        </div>

        <div className="relative">
          <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={filterInsurer}
            onChange={(e) => setFilterInsurer(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none"
          >
            <option value="all">Todas las aseguradoras</option>
            {GMM_INSURERS.map(ins => (
              <option key={ins.id} value={ins.id}>{ins.shortName}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <Building className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(Number(e.target.value))}
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none"
          >
            <option value={0}>Todos los niveles</option>
            <option value={3}>Nivel 3+</option>
            <option value={4}>Nivel 4+</option>
            <option value={5}>Nivel 5 (Premium)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredHospitals.length}</span> hospitales encontrados
        </span>
      </div>

      {/* Hospital table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-750 z-10 min-w-[220px]">
                  Hospital
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                  Ciudad
                </th>
                {GMM_INSURERS.map(ins => (
                  <th key={ins.id} className="text-center px-2 py-3 min-w-[70px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                        {INSURER_LOGOS[ins.id] ? (
                          <img src={INSURER_LOGOS[ins.id]} alt={ins.shortName} className="w-5 h-5 object-contain" />
                        ) : (
                          <span className="text-[8px] font-bold" style={{ color: ins.color }}>{ins.shortName.slice(0, 2)}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400">{ins.shortName}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={2 + GMM_INSURERS.length} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron hospitales con los filtros aplicados
                  </td>
                </tr>
              ) : (
                filteredHospitals.map(hospital => (
                  <HospitalRow key={hospital.id} hospital={hospital} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-3 px-2">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Niveles:</span>
        {[5, 4, 3, 2, 1].map(level => (
          <div key={level} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${getLevelColor(level)}`}>
              {level}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {level === 5 ? 'Premium' : level === 4 ? 'Alto' : level === 3 ? 'Medio-Alto' : level === 2 ? 'Medio' : 'Basico'}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center bg-gray-50 text-gray-300 dark:bg-gray-700 dark:text-gray-600">-</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">No disponible</span>
        </div>
      </div>
    </div>
  );
}

function HospitalRow({ hospital }: { hospital: GmmHospital }) {
  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors">
      <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-800 z-10">
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 block truncate">{hospital.nombre}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">{hospital.ciudad}</span>
      </td>
      {GMM_INSURERS.map(ins => {
        const insurerId = ins.id as InsurerId;
        const level = hospital.niveles[insurerId];
        const levelName = level ? (INSURER_LEVEL_NAMES[insurerId]?.[level] || `N${level}`) : null;

        return (
          <td key={ins.id} className="px-2 py-2.5 text-center">
            {level ? (
              <div className="flex flex-col items-center gap-0.5" title={levelName || undefined}>
                <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${getLevelColor(level)}`}>
                  {level}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-gray-300 dark:text-gray-600">-</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
