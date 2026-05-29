import { useState, useMemo, Fragment } from 'react';
import { Check, X, Plus, Trash2, Shield, Award, Clock, Building, Heart } from 'lucide-react';
import { GMM_INSURERS, type GmmInsurer } from '../../../../data/insuranceDesigner/gmmInsurers';
import { GMM_COVERAGES, GMM_CATEGORY_LABELS, type GmmCoverageCategory } from '../../../../data/insuranceDesigner/gmmCoverages';
import { INSURER_LEVEL_NAMES, type InsurerId } from '../../../../data/insuranceDesigner/gmmHospitals';
import { getGmmStatusLabel, getGmmStatusColor } from '../../../../lib/insuranceDesigner/calculateGmmMatch';

const INSURER_LOGOS: Record<string, string> = {
  gnp: '/gnp-seguros.png',
  axa: '/allianz-seguros-logo-png_seeklogo-179147.png',
  bupa: '/logo-bupa.png',
  metlife: '/seguros-atlas-logo-png_seeklogo-251455.png',
  mapfre: '/mapfre-seguros-logo-png_seeklogo-225013.png',
  bxplus: '/logo-bx.png',
  planseguro: '/plan-seguro-logo.png',
};

export default function TabComparador() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['gnp', 'bupa', 'planseguro']);

  const selectedInsurers = useMemo(
    () => selectedIds.map(id => GMM_INSURERS.find(i => i.id === id)).filter(Boolean) as GmmInsurer[],
    [selectedIds]
  );

  const availableInsurers = GMM_INSURERS.filter(i => !selectedIds.includes(i.id));

  const addInsurer = (id: string) => {
    if (selectedIds.length < 4) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const removeInsurer = (id: string) => {
    setSelectedIds(selectedIds.filter(i => i !== id));
  };

  const categories = Object.keys(GMM_CATEGORY_LABELS) as GmmCoverageCategory[];

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Comparador de Aseguradoras
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Selecciona hasta 4 aseguradoras para comparar planes, coberturas y beneficios lado a lado
        </p>
      </div>

      {/* Insurer selection */}
      <div className="flex items-center flex-wrap gap-2">
        {selectedIds.map(id => {
          const ins = GMM_INSURERS.find(i => i.id === id);
          if (!ins) return null;
          const logo = INSURER_LOGOS[id];
          return (
            <div
              key={id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                {logo ? (
                  <img src={logo} alt={ins.name} className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold rounded-lg" style={{ backgroundColor: ins.color }}>
                    {ins.shortName.slice(0, 2)}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{ins.shortName}</span>
              <button
                onClick={() => removeInsurer(id)}
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          );
        })}

        {selectedIds.length < 4 && availableInsurers.length > 0 && (
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-600 dark:hover:text-teal-400 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Agregar</span>
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 hidden group-hover:block min-w-[180px]">
              {availableInsurers.map(ins => (
                <button
                  key={ins.id}
                  onClick={() => addInsurer(ins.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="w-5 h-5 rounded bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                    {INSURER_LOGOS[ins.id] ? (
                      <img src={INSURER_LOGOS[ins.id]} alt="" className="w-4 h-4 object-contain" />
                    ) : (
                      <span className="text-[7px] font-bold" style={{ color: ins.color }}>{ins.shortName.slice(0, 2)}</span>
                    )}
                  </div>
                  {ins.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedInsurers.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Selecciona al menos 2 aseguradoras para comparar
          </p>
        </div>
      ) : (
        <>
          {/* General comparison */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[160px] sticky left-0 bg-gray-50 dark:bg-gray-750 z-10">
                      Caracteristica
                    </th>
                    {selectedInsurers.map(ins => (
                      <th key={ins.id} className="text-center px-4 py-3 min-w-[140px]">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                            {INSURER_LOGOS[ins.id] ? (
                              <img src={INSURER_LOGOS[ins.id]} alt={ins.name} className="w-7 h-7 object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs rounded-lg" style={{ backgroundColor: ins.color }}>
                                {ins.shortName.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{ins.shortName}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  <ComparisonRow label="Suma Asegurada max" values={selectedInsurers.map(i => i.maxSumAssured >= 999_000_000 ? 'Ilimitada' : `$${(i.maxSumAssured / 1_000_000).toLocaleString('en-US')} MDP`)} />
                  <ComparisonRow label="Edad max ingreso" values={selectedInsurers.map(i => i.maxAge >= 99 ? 'Sin limite' : `${i.maxAge} anos`)} />
                  <ComparisonRow label="Deducible min" values={selectedInsurers.map(i => i.deducibleMin)} />
                  <ComparisonRow label="Coaseguro" values={selectedInsurers.map(i => i.coaseguro)} />
                  <ComparisonRow label="Espera preexistentes" values={selectedInsurers.map(i => `${i.waitingPeriodMonths} meses`)} />
                  <ComparisonRow label="Renovacion vitalicia" values={selectedInsurers.map(i => i.renovacionVitalicia ? 'Si' : 'No')} highlight />
                  <ComparisonRow label="Programa fidelidad" values={selectedInsurers.map(i => i.fidelidad?.nombre || 'No')} />
                  <ComparisonRow label="Planes" values={selectedInsurers.map(i => i.plans.map(p => p.name).join(', '))} />
                  <ComparisonRow
                    label="Niveles hospitalarios"
                    values={selectedInsurers.map(i => {
                      const id = i.id as InsurerId;
                      const names = INSURER_LEVEL_NAMES[id];
                      const maxLevel = Object.keys(names).length;
                      return `${maxLevel} niveles`;
                    })}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Coverage comparison */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-500" />
                Comparativa de Coberturas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[200px] sticky left-0 bg-white dark:bg-gray-800 z-10">
                      Cobertura
                    </th>
                    {selectedInsurers.map(ins => (
                      <th key={ins.id} className="text-center px-3 py-2.5 min-w-[100px]">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ins.shortName}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => {
                    const catLabel = GMM_CATEGORY_LABELS[cat];
                    const catCoverages = GMM_COVERAGES.filter(c => c.category === cat);
                    return (
                      <Fragment key={cat}>
                        <tr className="bg-gray-50/50 dark:bg-gray-750/50">
                          <td colSpan={1 + selectedInsurers.length} className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50/50 dark:bg-gray-750/50 z-10">
                            {catLabel.label}
                          </td>
                        </tr>
                        {catCoverages.map(cov => (
                          <tr key={cov.id} className="border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50/30 dark:hover:bg-gray-750/30 transition-colors">
                            <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">
                              {cov.name}
                            </td>
                            {selectedInsurers.map(ins => {
                              const data = ins.data[cov.id];
                              const status = data?.s || 'no';
                              return (
                                <td key={ins.id} className="px-3 py-2 text-center">
                                  {status === 'no' ? (
                                    <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                                  ) : status === 'base' ? (
                                    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                  ) : (
                                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${getGmmStatusColor(status)}`}>
                                      {getGmmStatusLabel(status)}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fidelity comparison */}
          {selectedInsurers.some(i => i.fidelidad) && (
            <div className="rounded-xl border border-amber-100 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800/30">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Programas de Fidelidad
                </h3>
              </div>
              <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${selectedInsurers.length}, 1fr)` }}>
                {selectedInsurers.map(ins => (
                  <div key={ins.id} className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{ins.shortName}</h4>
                    {ins.fidelidad ? (
                      <>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 block">{ins.fidelidad.nombre}</span>
                        <ul className="space-y-1">
                          {ins.fidelidad.beneficios.map((b, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                              <Check className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin programa de fidelidad</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ComparisonRow({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
  return (
    <tr className={`${highlight ? 'bg-teal-50/30 dark:bg-teal-900/5' : ''} hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors`}>
      <td className="px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800 z-10">
        {label}
      </td>
      {values.map((val, i) => (
        <td key={i} className="px-4 py-2.5 text-center text-xs text-gray-800 dark:text-gray-200">
          {val === 'Si' ? (
            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
          ) : val === 'No' ? (
            <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
          ) : (
            <span className="font-medium">{val}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
