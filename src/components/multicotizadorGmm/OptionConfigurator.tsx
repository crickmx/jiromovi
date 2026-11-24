import { useState } from 'react';
import { Trash2, Copy, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type {
  ProductId, MultiGmmOption, OpcionesGmm, OpcionesProducto,
  BnvQuoteInput, BnpQuoteInput, BxplusQuoteInput, BxplusCoverages,
} from '../../lib/multicotizadorGmm/types';
import { PRODUCT_LABELS, PRODUCT_COLORS, PRODUCT_LOGOS, BXPLUS_COVERAGE_LABELS, DEFAULT_BXPLUS_COVERAGES } from '../../lib/multicotizadorGmm/types';
import { COVERAGE_HELP_TEXTS } from '../../lib/gmmCoverageHelp';

interface OptionConfiguratorProps {
  option: MultiGmmOption;
  onUpdate: (option: MultiGmmOption) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Listas reales del Excel cargado (sumas, deducibles, coaseguros, topes, estados). */
  opciones?: OpcionesGmm;
}

const DEFAULT_BNV_INPUT: BnvQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 10, deducible: 15, coaseguro: 10,
  tope_coaseguro: 30000, client_type: 'Normal', asistencia_extranjero: false, forma_pago: 'Anual',
};

const DEFAULT_BNP_INPUT: BnpQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 50, deducible: 35, coaseguro: 20,
  client_type: 'Nuevo negocio', maternidad_titular: false, maternidad_conyuge: false,
  asistencia_extranjero: false, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual',
};

const DEFAULT_BXPLUS_INPUT: BxplusQuoteInput = {
  // Valores por omisión del propio cotizador Excel (hoja Cotizador, E37:E41).
  estado: 'CIUDAD DE MEXICO', nivel_hospitalario: 'PLUS', tabulador: 'PALADIO-60,000',
  suma_asegurada: '5000000', deducible: '17000', coaseguro: '0.1', forma_pago: 'Anual',
  coverages: { ...DEFAULT_BXPLUS_COVERAGES },
};

function getDefaultInput(product: ProductId): BnvQuoteInput | BnpQuoteInput | BxplusQuoteInput {
  if (product === 'BNV') return { ...DEFAULT_BNV_INPUT };
  if (product === 'BNP') return { ...DEFAULT_BNP_INPUT };
  return { ...DEFAULT_BXPLUS_INPUT, coverages: { ...DEFAULT_BXPLUS_COVERAGES } };
}

export function OptionConfigurator({ option, onUpdate, onRemove, onDuplicate, canRemove, isExpanded, onToggleExpand, opciones }: OptionConfiguratorProps) {
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
    <div className="bg-surface-card dark:bg-neutral-900 rounded-2xl border border-soft dark:border-white/[0.06] overflow-hidden transition-all">
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
        <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}15`, color }}>
          <img src={PRODUCT_LOGOS[option.product_id]} alt="" className="w-3.5 h-3.5 object-contain" />
          {PRODUCT_LABELS[option.product_id]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 rounded-lg text-neutral-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors" title="Duplicar">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    option.product_id === pid
                      ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                  }`}
                >
                  <img src={PRODUCT_LOGOS[pid]} alt="" className="w-4 h-4 object-contain" />
                  {PRODUCT_LABELS[pid]}
                </button>
              ))}
            </div>
          </div>

          {/* Product-specific parameters */}
          {option.product_id === 'BNV' && <BnvParams input={option.input as BnvQuoteInput} onChange={updateInput} opciones={opciones?.BNV} />}
          {option.product_id === 'BNP' && <BnpParams input={option.input as BnpQuoteInput} onChange={updateInput} opciones={opciones?.BNP} />}
          {option.product_id === 'BXPLUS' && <BxplusParams input={option.input as BxplusQuoteInput} onChange={updateInput} opciones={opciones?.BXPLUS} />}

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

// Las listas de sumas / deducibles / coaseguros / topes salen del EXCEL CARGADO
// (paquete activo de tarifas). Lo de abajo es solo el respaldo por si todavía no hay
// paquete activo en la base.
const BNV_FALLBACK: OpcionesProducto = {
  sumas_aseguradas: [1, 2, 3, 4, 5, 10],
  deducibles: [0, 10, 15, 20, 30, 50, 100],
  coaseguros: [0, 5, 10, 20],
  topes_coaseguro: [20000, 30000, 40000],
};

const BNP_FALLBACK: OpcionesProducto = {
  sumas_aseguradas: [5, 10, 20, 50],
  deducibles: [9, 14, 17, 35, 55, 75, 115, 200],
  coaseguros: [0, 10, 20],
};

function conOpciones(op: OpcionesProducto | undefined, fallback: OpcionesProducto): OpcionesProducto {
  return {
    sumas_aseguradas: op?.sumas_aseguradas?.length ? op.sumas_aseguradas : fallback.sumas_aseguradas,
    deducibles: op?.deducibles?.length ? op.deducibles : fallback.deducibles,
    coaseguros: op?.coaseguros?.length ? op.coaseguros : fallback.coaseguros,
    topes_coaseguro: op?.topes_coaseguro?.length ? op.topes_coaseguro : fallback.topes_coaseguro,
    estados: op?.estados ?? [],
    zonas: op?.zonas ?? [],
    client_types: op?.client_types ?? [],
  };
}

const selectClass = 'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30';

function BnvParams({ input, onChange, opciones }: { input: BnvQuoteInput; onChange: (p: Partial<BnvQuoteInput>) => void; opciones?: OpcionesProducto }) {
  const op = conOpciones(opciones, BNV_FALLBACK);
  // El tope solo tiene sentido con coaseguro > 0 (el Excel lo limpia en ese caso).
  const topes = op.topes_coaseguro ?? [];
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Region">
        <select value={input.region_zone} onChange={e => onChange({ region_zone: e.target.value as any })} className={selectClass}>
          <option value="Zona 1">Zona 1 (CDMX, Area Metropolitana y Monterrey)</option>
          <option value="Zona 2">Zona 2 (resto del pais)</option>
        </select>
      </Field>
      <Field label="Suma Asegurada (MDP)">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: Number(e.target.value) })} className={selectClass}>
          {op.sumas_aseguradas.map(v => <option key={v} value={v}>${v} MDP</option>)}
        </select>
      </Field>
      <Field label="Deducible (miles)">
        <select value={input.deducible} onChange={e => onChange({ deducible: Number(e.target.value) })} className={selectClass}>
          {op.deducibles.map(v => <option key={v} value={v}>${(v * 1000).toLocaleString()}</option>)}
        </select>
      </Field>
      <Field label="Coaseguro (%)">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: Number(e.target.value) })} className={selectClass}>
          {op.coaseguros.map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </Field>
      <Field label="Tope Coaseguro">
        <select
          value={input.coaseguro > 0 ? input.tope_coaseguro : 0}
          disabled={input.coaseguro === 0}
          onChange={e => onChange({ tope_coaseguro: Number(e.target.value) })}
          className={`${selectClass} disabled:opacity-50`}
        >
          {input.coaseguro === 0
            ? <option value={0}>No aplica (coaseguro 0%)</option>
            : topes.map(v => <option key={v} value={v}>${v.toLocaleString()}</option>)}
        </select>
      </Field>
    </div>
  );
}

function BnpParams({ input, onChange, opciones }: { input: BnpQuoteInput; onChange: (p: Partial<BnpQuoteInput>) => void; opciones?: OpcionesProducto }) {
  const op = conOpciones(opciones, BNP_FALLBACK);
  const estados = op.estados ?? [];
  const zona = estados.find(e => e.estado.toLowerCase() === String(input.estado ?? '').toLowerCase())?.zona;
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Lugar de residencia">
        <select
          value={input.estado ?? ''}
          onChange={e => onChange({ estado: e.target.value })}
          className={selectClass}
        >
          <option value="">Seleccione una opcion</option>
          {estados.map(e => <option key={e.estado} value={e.estado}>{e.estado}</option>)}
        </select>
      </Field>
      <Field label="Zona (se deriva del lugar)">
        <div className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/[0.06] text-sm text-neutral-600 dark:text-neutral-300">
          {zona ?? input.region_zone}
        </div>
      </Field>
      <Field label="Suma Asegurada (MDP)">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: Number(e.target.value) })} className={selectClass}>
          {op.sumas_aseguradas.map(v => <option key={v} value={v}>${v} MDP</option>)}
        </select>
      </Field>
      <Field label="Deducible (miles)">
        <select value={input.deducible} onChange={e => onChange({ deducible: Number(e.target.value) })} className={selectClass}>
          {op.deducibles.map(v => <option key={v} value={v}>${(v * 1000).toLocaleString()}</option>)}
        </select>
      </Field>
      <Field label="Coaseguro (%)">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: Number(e.target.value) })} className={selectClass}>
          {op.coaseguros.map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </Field>
      <Field label="Tipo de cliente">
        <select value={input.client_type} onChange={e => onChange({ client_type: e.target.value })} className={selectClass}>
          {(op.client_types ?? []).map(ct => <option key={ct.label} value={ct.label}>{ct.label}</option>)}
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

function BxplusParams({ input, onChange, opciones }: { input: BxplusQuoteInput; onChange: (p: Partial<BxplusQuoteInput>) => void; opciones?: OpcionesProducto }) {
  const estados = opciones?.estados_bx?.length ? opciones.estados_bx : BXPLUS_ESTADOS;
  const niveles = opciones?.niveles?.length ? opciones.niveles : ['ELITE', 'PLUS', 'ESTANDAR'];
  const tabuladores = opciones?.tabuladores?.length ? opciones.tabuladores : BXPLUS_TABULADORES.map(t => t.value);
  const sumas = opciones?.sumas_aseguradas?.length ? opciones.sumas_aseguradas.map(String) : BXPLUS_SUMAS_ASEGURADAS.map(s => s.value);
  const deducibles = opciones?.deducibles?.length ? opciones.deducibles.map(String) : BXPLUS_DEDUCIBLES.map(d => d.value);
  const coaseguros = opciones?.coaseguros?.length ? opciones.coaseguros.map(String) : BXPLUS_COASEGUROS.map(c => c.value);
  const etiquetaTabulador = (v: string) => BXPLUS_TABULADORES.find(t => t.value === v)?.label ?? v;
  const money = (v: string) => `$${Number(v).toLocaleString('es-MX')}`;
  const pct = (v: string) => `${Math.round(Number(v) * 100)}%`;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Estado">
        <select value={input.estado} onChange={e => onChange({ estado: e.target.value })} className={selectClass}>
          {estados.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Nivel Hospitalario">
        <select value={input.nivel_hospitalario} onChange={e => onChange({ nivel_hospitalario: e.target.value })} className={selectClass}>
          {niveles.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Tabulador">
        <select value={input.tabulador} onChange={e => onChange({ tabulador: e.target.value })} className={selectClass}>
          {tabuladores.map(v => <option key={v} value={v}>{etiquetaTabulador(v)}</option>)}
        </select>
      </Field>
      <Field label="Suma Asegurada">
        <select value={input.suma_asegurada} onChange={e => onChange({ suma_asegurada: e.target.value })} className={selectClass}>
          {sumas.map(v => <option key={v} value={v}>{money(v)}</option>)}
        </select>
      </Field>
      <Field label="Deducible">
        <select value={input.deducible} onChange={e => onChange({ deducible: e.target.value })} className={selectClass}>
          {deducibles.map(v => <option key={v} value={v}>{money(v)}</option>)}
        </select>
      </Field>
      <Field label="Coaseguro">
        <select value={input.coaseguro} onChange={e => onChange({ coaseguro: e.target.value })} className={selectClass}>
          {coaseguros.map(v => <option key={v} value={v}>{pct(v)}</option>)}
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
        className="p-0.5 rounded-full text-neutral-500 hover:text-sky-500 dark:text-neutral-500 dark:hover:text-sky-400 transition-colors"
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
