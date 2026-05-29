import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Check, X, Shield, Clock, Users, Star,
  Heart, Award, Info, Building
} from 'lucide-react';
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

export default function TabAseguradoras() {
  const [expandedInsurer, setExpandedInsurer] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Aseguradoras de Gastos Medicos Mayores
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Informacion detallada de planes, coberturas, programas de fidelidad y limites de cada aseguradora
        </p>
      </div>

      {GMM_INSURERS.map(insurer => (
        <InsurerCard
          key={insurer.id}
          insurer={insurer}
          isExpanded={expandedInsurer === insurer.id}
          onToggle={() => setExpandedInsurer(expandedInsurer === insurer.id ? null : insurer.id)}
        />
      ))}
    </div>
  );
}

function InsurerCard({ insurer, isExpanded, onToggle }: {
  insurer: GmmInsurer;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const logo = INSURER_LOGOS[insurer.id];
  const insurerId = insurer.id as InsurerId;
  const levelNames = INSURER_LEVEL_NAMES[insurerId];
  const coveredCount = Object.values(insurer.data).filter(d => d.s !== 'no').length;
  const totalCoverages = GMM_COVERAGES.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors"
      >
        <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
          {logo ? (
            <img src={logo} alt={insurer.name} className="w-10 h-10 object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg rounded-xl" style={{ backgroundColor: insurer.color }}>
              {insurer.shortName.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{insurer.name}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {coveredCount}/{totalCoverages} coberturas
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {insurer.plans.length} planes
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {insurer.maxAge >= 99 ? 'Sin limite edad' : `Hasta ${insurer.maxAge} anos`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {insurer.fidelidad && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
              <Star className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Fidelidad</span>
            </div>
          )}
          {insurer.renovacionVitalicia && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
              <Heart className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Vitalicia</span>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Suma Asegurada max" value={insurer.maxSumAssured >= 999_000_000 ? 'Ilimitada' : `$${(insurer.maxSumAssured / 1_000_000).toLocaleString('en-US')} MDP`} />
            <StatBox label="Deducible min" value={insurer.deducibleMin} />
            <StatBox label="Coaseguro" value={insurer.coaseguro} />
            <StatBox label="Espera preex" value={`${insurer.waitingPeriodMonths} meses`} />
          </div>

          {/* Plans */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-500" />
              Planes Disponibles
            </h4>
            <div className="grid sm:grid-cols-3 gap-2">
              {insurer.plans.map(plan => (
                <div
                  key={plan.id}
                  className={`px-3 py-2.5 rounded-lg border transition-colors ${
                    plan.tier === 'premium'
                      ? 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10'
                      : plan.tier === 'intermedio'
                      ? 'border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750'
                  }`}
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">{plan.name}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">{plan.tier}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hospital levels */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-500" />
              Niveles Hospitalarios
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(levelNames).map(([level, name]) => (
                <div key={level} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">Nivel {level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fidelity program */}
          {insurer.fidelidad && (
            <div className="rounded-lg border border-amber-100 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                {insurer.fidelidad.nombre}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{insurer.fidelidad.descripcion}</p>
              <ul className="space-y-1.5">
                {insurer.fidelidad.beneficios.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                    <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional coverages */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-500" />
              Coberturas y Beneficios Adicionales
            </h4>
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {insurer.coberturasAdicionales.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <Check className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Acceptance limits */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Limites de Aceptacion
            </h4>
            <ul className="space-y-1.5">
              {insurer.limitesAceptacion.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Coverage matrix for this insurer */}
          <CoverageMatrix insurer={insurer} />
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
      <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5 font-medium">{label}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}

function CoverageMatrix({ insurer }: { insurer: GmmInsurer }) {
  const categories = Object.keys(GMM_CATEGORY_LABELS) as GmmCoverageCategory[];

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-teal-500" />
        Detalle de Coberturas
      </h4>
      <div className="space-y-3">
        {categories.map(cat => {
          const catLabel = GMM_CATEGORY_LABELS[cat];
          const catCoverages = GMM_COVERAGES.filter(c => c.category === cat);
          return (
            <div key={cat} className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-750">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{catLabel.label}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-750">
                {catCoverages.map(cov => {
                  const data = insurer.data[cov.id];
                  const status = data?.s || 'no';
                  return (
                    <div key={cov.id} className="flex items-center gap-2 px-3 py-2">
                      {status === 'no' ? (
                        <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{cov.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getGmmStatusColor(status)}`}>
                        {getGmmStatusLabel(status)}
                      </span>
                      {data?.note && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline max-w-[150px] truncate">
                          {data.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
