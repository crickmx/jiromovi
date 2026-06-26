import { useState } from 'react';
import { Trash2, Copy, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type {
  ProductId, MultiGmmOption,
  BnvQuoteInput, BnpQuoteInput, BxplusQuoteInput, BxplusCoverages,
} from '../../lib/multicotizadorGmm/types';
import { PRODUCT_LABELS, PRODUCT_COLORS, BXPLUS_COVERAGE_LABELS, DEFAULT_BXPLUS_COVERAGES } from '../../lib/multicotizadorGmm/types';
import { COVERAGE_HELP_TEXTS } from '../../lib/gmmCoverageHelp';

interface OptionConfiguratorProps {
  option: MultiGmmOption;
  onUpdate: (option: MultiGmmOption) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const DEFAULT_BNV_INPUT: BnvQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 100, deducible: 35, coaseguro: 10,
  tope_coaseguro: 30000, client_type: 'Normal', asistencia_extranjero: true, forma_pago: 'Anual',
};

const DEFAULT_BNP_INPUT: BnpQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 50, deducible: 35, coaseguro: 10,
  client_type: 'Normal', maternidad_titular: false, maternidad_conyuge: false,
  asistencia_extranjero: true, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual',
};

const DEFAULT_BXPLUS_INPUT: BxplusQuoteInput = {
  estado: 'CIUDAD DE MEXICO', nivel_hospitalario: 'Alto', tabulador: 'PALADIO-60,000',
  suma_asegurada: '5000000', deducible: '17000', coaseguro: '0.1', forma_pago: 'Anual',
  coverages: { ...DEFAULT_BXPLUS_COVERAGES },
};

function getDefaultInput(product: ProductId): BnvQuoteInput | BnpQuoteInput | BxplusQuoteInput {
  if (product === 'BNV') return { ...DEFAULT_BNV_INPUT };
  if (product === 'BNP') return { ...DEFAULT_BNP_INPUT };
  return { ...DEFAULT_BXPLUS_INPUT, coverages: { ...DEFAULT_BXPLUS_COVERAGES } };
}

export function OptionConfigurator({ option, onUpdate, onRemove, onDuplicate, canRemove, isExpanded, onToggleExpand }: OptionConfiguratorProps) {
  const color = PRODUCT_COLORS[option.product_id];

  const updateInput = (partial: any) => {
    onUpdate({ ...option, input: { ...option.input, ...partial } });
  };

  const handleProductChange = (newProduct: ProductId) => {
    if (newProduct === option.product_id) return;
    onUpdate({ ...option, product_id: newProduct, input: getDefaultInput(newProduct) });
  };

  const toggleCoverage = (key: keyof BxplusCoverages) => {
    const current = (option.input as BxplusQuoteInput).coverages || {};
    onUpdate({
      ...option,
      input: { ...option.input, coverages: { ...DEFAULT_BXPLUS_COVERAGES, ...current, [key]: !current[key] } } as BxplusQuoteInput,
    });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={onToggleExpand}>
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <input
          type="text"
          value={option.label}
          onChange={e => { e.stopPropagation(); onUpdate({ ...option, label: e.target.value }); }}
          onClick={e => e.stopPropagation()}
          className="text-sm font-semibold text-neutral-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 w-32"
        />
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}15`, color }}>
          {PRODUCT_LABELS[option.product_id]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 rounded-lg text-neutral-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors" title="Duplicar">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-neutral-100 dark:border-white/[0.04] px-5 py-4 space-y-4">
          {/* Product picker */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Producto</label>
            <div className="flex gap-2">
              {(['BXPLUS', 'BNV', 'BNP'] as ProductId[]).map(pid => (
                <button
                  key={pid}
                  onClick={() => handleProductChange(pid)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    option.product_id === pid
                      ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                  }`}
                >
                  {PRODUCT_LABELS[pid]}
                </button>
              ))}
            </div>
          </div>

          {/* Product-specific parameters */}
          {option.product_id === 'BNV' && <BnvParams input={option.input as BnvQuoteInput} onChange={updateInput} />}
          {option.product_id === 'BNP' && <BnpParams input={option.input as BnpQuoteInput} onChange={updateInput} />}
          {option.product_id === 'BXPLUS' && <BxplusParams input={option.input as BxplusQuoteInput} onChange={updateInput} />}

          {/* BX+ Coverages */}
          {option.product_id === 'BXPLUS' && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">Coberturas Opcionales</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(Object.entries(BXPLUS_COVERAGE_LABELS) as [keyof BxplusCoverages, string][]).map(([key, label]) => {
                  const checked = (option.input as BxplusQuoteInput).coverages?.[key] ?? false;
                  return (
                    <div key={key} className="flex items-center gap-2 py-0.5">
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" checked={checked} onChange={() => toggleCoverage(key)} className="w-3.5 h-3.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500 flex-shrink-0" />
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate">{label}</span>
                      </label>
                      <CoverageHelpIcon coverageKey={key} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BNV/BNP Coverage toggles (already part of input) */}
          {option.product_id === 'BNV' && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">Coberturas Opcionales</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(option.input as BnvQuoteInput).asistencia_extranjero} onChange={e => updateInput({ asistencia_extranjero: e.target.checked })} className="w-3.5 h-3.5 rounded border-neutral-300 text-teal-600" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">Asistencia en el Extranjero</span>
                </label>
              </div>
            </div>
          )}

          {option.product_id === 'BNP' && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">Coberturas Opcionales</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(option.input as BnpQuoteInput).asistencia_extranjero} onChange={e => updateInput({ asistencia_extranjero: e.target.checked })} className="w-3.5 h-3.5 rounded border-neutral-300 text-teal-600" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">Asistencia en el Extranjero</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(option.input as BnpQuoteInput).cobertura_catastrofica_extranjero} onChange={e => updateInput({ cobertura_catastrofica_extranjero: e.target.checked })} className="w-3.5 h-3.5 rounded border-neutral-300 text-teal-600" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">Catastrofica Extranjero</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(option.input as BnpQuoteInput).maternidad_titular} onChange={e => updateInput({ maternidad_titular: e.target.checked })} className="w-3.5 h-3.5 rounded border-neutral-300 text-teal-600" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">Maternidad Titular</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(option.input as BnpQuoteInput).maternidad_conyuge} onChange={e => updateInput({ maternidad_conyuge: e.target.checked })} className="w-3.5 h-3.5 rounded border-neutral-300 text-teal-600" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">Maternidad Conyuge</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========================
// Parameter Sub-forms
// ========================

function BnvParams({ input, onChange }: { input: BnvQuoteInput; onChange: (p: Partial<BnvQuoteInput>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Region">
        <select value={input.region_zone} onChange={e => onChange({ region_zone: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          <option value="Zona 1">Zona 1</option>
          <option value="Zona 2">Zona 2</option>
        </select>
      </Field>
      <Field label="Suma Asegurada (MDP)">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[3, 5, 10, 15, 20, 30, 50, 75, 100].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Deducible (miles)">
        <select value={input.deducible} onChange={e => onChange({ deducible: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[5, 10, 15, 20, 25, 30, 35, 40, 50, 100].map(v => <option key={v} value={v}>${v},000</option>)}
        </select>
      </Field>
      <Field label="Coaseguro (%)">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[0, 10, 20, 30].map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </Field>
      <Field label="Tope Coaseguro">
        <select value={input.tope_coaseguro} onChange={e => onChange({ tope_coaseguro: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[0, 30000, 40000, 50000, 60000].map(v => <option key={v} value={v}>{v === 0 ? 'Sin tope' : `$${v.toLocaleString()}`}</option>)}
        </select>
      </Field>
    </div>
  );
}

function BnpParams({ input, onChange }: { input: BnpQuoteInput; onChange: (p: Partial<BnpQuoteInput>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Region">
        <select value={input.region_zone} onChange={e => onChange({ region_zone: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          <option value="Zona 1">Zona 1</option>
          <option value="Zona 2">Zona 2</option>
        </select>
      </Field>
      <Field label="Suma Asegurada (MDP)">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[5, 10, 15, 20, 30, 50, 75, 100].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Deducible (miles)">
        <select value={input.deducible} onChange={e => onChange({ deducible: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[5, 10, 15, 20, 25, 30, 35, 50].map(v => <option key={v} value={v}>${v},000</option>)}
        </select>
      </Field>
      <Field label="Coaseguro (%)">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {[0, 10, 20, 30].map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </Field>
    </div>
  );
}

const BXPLUS_ESTADOS = [
  'CIUDAD DE MEXICO', 'ESTADO DE MEXICO', 'NUEVO LEON', 'PUEBLA', 'QUERETARO',
  'JALISCO 1(GUADALAJARA Y ALEDAÑOS)', 'JALISCO 2 ( RESTO JALISCO)',
  'AGUASCALIENTES', 'BAJA CALIFORNIA NORTE', 'BAJA CALIFORNIA SUR',
  'CAMPECHE', 'CHIAPAS', 'CHIHUAHUA', 'COAHUILA', 'COLIMA', 'DURANGO',
  'GUANAJUATO', 'GUERRERO', 'HIDALGO', 'MICHOACAN', 'MORELOS', 'NAYARIT',
  'OAXACA', 'QUINTANA ROO', 'SAN LUIS POTOSI', 'SINALOA', 'SONORA',
  'TABASCO', 'TAMAULIPAS', 'TLAXCALA', 'VERACRUZ', 'YUCATAN', 'ZACATECAS',
];

const BXPLUS_TABULADORES = [
  { value: 'PLATA- 50,000', label: 'Plata ($50,000)' },
  { value: 'PALADIO-60,000', label: 'Paladio ($60,000)' },
  { value: 'OSMIO-80,000', label: 'Osmio ($80,000)' },
  { value: 'IRIDIO-90,000', label: 'Iridio ($90,000)' },
  { value: 'ORO-110,000', label: 'Oro ($110,000)' },
  { value: 'PLATINO-120,000', label: 'Platino ($120,000)' },
];

const BXPLUS_SUMAS_ASEGURADAS = [
  { value: '2000000', label: '$2 MDP' },
  { value: '5000000', label: '$5 MDP' },
  { value: '10000000', label: '$10 MDP' },
  { value: '30000000', label: '$30 MDP' },
  { value: '50000000', label: '$50 MDP' },
  { value: '125000000', label: '$125 MDP' },
];

const BXPLUS_DEDUCIBLES = [
  { value: '12000', label: '$12,000' },
  { value: '17000', label: '$17,000' },
  { value: '23000', label: '$23,000' },
  { value: '29000', label: '$29,000' },
  { value: '35000', label: '$35,000' },
  { value: '40000', label: '$40,000' },
  { value: '46000', label: '$46,000' },
  { value: '52000', label: '$52,000' },
  { value: '58000', label: '$58,000' },
  { value: '86000', label: '$86,000' },
  { value: '115000', label: '$115,000' },
];

const BXPLUS_COASEGUROS = [
  { value: '0.1', label: '10%' },
  { value: '0.15', label: '15%' },
  { value: '0.2', label: '20%' },
  { value: '0.25', label: '25%' },
  { value: '0.3', label: '30%' },
];

function BxplusParams({ input, onChange }: { input: BxplusQuoteInput; onChange: (p: Partial<BxplusQuoteInput>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Estado">
        <select value={input.estado} onChange={e => onChange({ estado: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {BXPLUS_ESTADOS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Nivel Hospitalario">
        <select value={input.nivel_hospitalario} onChange={e => onChange({ nivel_hospitalario: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {['Alto', 'Medio', 'Basico'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Tabulador">
        <select value={input.tabulador} onChange={e => onChange({ tabulador: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {BXPLUS_TABULADORES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="Suma Asegurada">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {BXPLUS_SUMAS_ASEGURADAS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Deducible">
        <select value={input.deducible} onChange={e => onChange({ deducible: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {BXPLUS_DEDUCIBLES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </Field>
      <Field label="Coaseguro">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
          {BXPLUS_COASEGUROS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function CoverageHelpIcon({ coverageKey }: { coverageKey: string }) {
  const [show, setShow] = useState(false);
  const text = COVERAGE_HELP_TEXTS[coverageKey];
  if (!text) return null;

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.preventDefault(); setShow(!show); }}
        className="p-0.5 rounded-full text-neutral-400 hover:text-sky-500 dark:text-neutral-500 dark:hover:text-sky-400 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full right-0 mb-1.5 w-64 p-2.5 rounded-lg bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] leading-relaxed shadow-lg border border-neutral-700 pointer-events-none">
          {text}
          <div className="absolute top-full right-3 w-2 h-2 bg-neutral-900 dark:bg-neutral-800 rotate-45 -mt-1 border-r border-b border-neutral-700" />
        </div>
      )}
    </div>
  );
}
