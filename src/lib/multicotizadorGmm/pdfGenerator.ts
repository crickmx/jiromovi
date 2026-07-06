import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement as h, StrictMode } from 'react';
import type {
  OptionResult,
  QuotePerson,
  MultiGmmOption,
  BnvCalculationResult,
  BnpCalculationResult,
  BxplusCalculationResult,
  BxplusQuoteInput,
  BnvQuoteInput,
  BnpQuoteInput,
  FormaPago,
} from './types';
import { PRODUCT_LABELS } from './types';

// ─── Formatting ───────────────────────────────────────────────────────────────

const mxnFull = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// For tables — always 2 decimal places, never truncated
function formatMoneyFull(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '-';
  return mxnFull.format(n as number);
}

// For cards/badges — compact: $50 M for millions, $35,000 for thousands
function formatMoneyCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n as number) || (n as number) === 0) return '-';
  const v = n as number;
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} M`;
  }
  if (v >= 1_000) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }
  return mxnFull.format(v);
}

// For nullable fields — 'No cotizado' when null/undefined/0
function formatNullableMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n as number) || (n as number) === 0) return 'No cotizado';
  return formatMoneyFull(n);
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '-';
  const raw = n as number;
  // Handle string-encoded percentages like "10%" already sanitized to number
  const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

// ─── Coverage flags per plan ──────────────────────────────────────────────────

interface CoverageFlags {
  // Universal (shown for all — null = not applicable to this product)
  asistencia_extranjero: boolean | null;
  // BNP / BX+ shared
  maternidad_titular: boolean | null;
  maternidad_conyuge: boolean | null;
  cobertura_catastrofica_extranjero: boolean | null;
  // BX+ specific
  reconocimiento_antiguedad: boolean | null;
  medicamentos_fuera: boolean | null;
  complicaciones_no_amparadas: boolean | null;
  padecimientos_preexistentes: boolean | null;
  eliminacion_deducible_accidente: boolean | null;
  multiregion: boolean | null;
  vip: boolean | null;
  enfermedades_graves_extranjero: boolean | null;
  cobertura_internacional: boolean | null;
  ampliacion_servicios: boolean | null;
  ayuda_diaria: boolean | null;
  indemnizacion_eg: boolean | null;
  xtensuz: boolean | null;
}

// ─── Plan summary ─────────────────────────────────────────────────────────────

interface PlanSummary {
  option_id: string;
  nombre: string;
  product_id: string;
  aseguradora: string;
  zona: string;
  nivel: string;
  suma_asegurada: number;
  deducible: number;
  coaseguro: number;
  tope_coaseguro: number | null;
  prima_anual: number;
  totals: Partial<Record<FormaPago, { total: number; primer_pago: number; pagos_sub: number; num_recibos: number }>>;
  bxCoverageChips: string[];
  coverageFlags: CoverageFlags;
}

function extractPlan(r: OptionResult): PlanSummary {
  const res = r.result;

  if (res.product === 'BXPLUS') {
    const bx = res as BxplusCalculationResult;
    const input = (r as any).__input as BxplusQuoteInput | undefined;
    const cov = (r as any).__coverages as Record<string, boolean> | undefined;

    const chips: string[] = [];
    const chipLabels: Record<string, string> = {
      reconocimiento_antiguedad: 'Reconoc. antiguedad',
      medicamentos_fuera: 'Medicamentos ext.',
      complicaciones_no_amparadas: 'Complicaciones',
      padecimientos_preexistentes: 'Preexistentes',
      eliminacion_deducible_accidente: 'Sin ded. accidente',
      multiregion: 'Multiregion',
      vip: 'Beneficio VIP',
      emergencia_medica_extranjero: 'Emergencias ext.',
      enfermedades_graves_extranjero: 'Enf. graves ext.',
      cobertura_internacional: 'Internacional',
      ampliacion_servicios: 'Ampliacion',
      ayuda_diaria: 'Ayuda diaria',
      indemnizacion_eg: 'Indemn. EG',
      maternidad: 'Maternidad',
      xtensuz: 'Xtensuz',
    };
    if (cov) {
      Object.entries(chipLabels).forEach(([k, v]) => { if (cov[k]) chips.push(v); });
    }

    const totals: PlanSummary['totals'] = {};
    if (bx.totals) {
      (Object.keys(bx.totals) as FormaPago[]).forEach(fp => {
        const t = bx.totals[fp];
        totals[fp] = { total: t.total, primer_pago: t.primer_pago, pagos_sub: t.pagos_subsecuentes, num_recibos: t.num_recibos };
      });
    }

    const saRaw  = parseFloat(String(input?.suma_asegurada ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const dedRaw = parseFloat(String(input?.deducible     ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const coas   = parseFloat(String(input?.coaseguro     ?? '0').replace(/[^0-9.]/g, '')) || 0;

    const flags: CoverageFlags = {
      asistencia_extranjero:          cov?.emergencia_medica_extranjero      ?? false,
      maternidad_titular:             cov?.maternidad                         ?? false,
      maternidad_conyuge:             null, // BX+ has single maternidad flag
      cobertura_catastrofica_extranjero: null, // Not in BX+
      reconocimiento_antiguedad:      cov?.reconocimiento_antiguedad          ?? false,
      medicamentos_fuera:             cov?.medicamentos_fuera                 ?? false,
      complicaciones_no_amparadas:    cov?.complicaciones_no_amparadas        ?? false,
      padecimientos_preexistentes:    cov?.padecimientos_preexistentes        ?? false,
      eliminacion_deducible_accidente: cov?.eliminacion_deducible_accidente   ?? false,
      multiregion:                    cov?.multiregion                        ?? false,
      vip:                            cov?.vip                                ?? false,
      enfermedades_graves_extranjero: cov?.enfermedades_graves_extranjero     ?? false,
      cobertura_internacional:        cov?.cobertura_internacional            ?? false,
      ampliacion_servicios:           cov?.ampliacion_servicios               ?? false,
      ayuda_diaria:                   cov?.ayuda_diaria                       ?? false,
      indemnizacion_eg:               cov?.indemnizacion_eg                   ?? false,
      xtensuz:                        cov?.xtensuz                            ?? false,
    };

    return {
      option_id: r.option_id,
      nombre: r.option_label ?? PRODUCT_LABELS.BXPLUS,
      product_id: 'BXPLUS',
      aseguradora: 'GNP Seguros',
      zona: input?.estado ?? '-',
      nivel: input?.nivel_hospitalario ?? '-',
      suma_asegurada: saRaw,
      deducible: dedRaw,
      coaseguro: coas,
      tope_coaseguro: input?.tope_coaseguro_seleccionado ?? null,
      prima_anual: bx.prima_anual_total,
      totals,
      bxCoverageChips: chips,
      coverageFlags: flags,
    };
  }

  if (res.product === 'BNV') {
    const bnv = res as BnvCalculationResult;
    const inp = (r as any).__input as BnvQuoteInput | undefined;
    const totals: PlanSummary['totals'] = {};
    if (bnv.totals) {
      (Object.keys(bnv.totals) as FormaPago[]).forEach(fp => {
        const t = bnv.totals[fp];
        totals[fp] = { total: t.total, primer_pago: t.primer_pago, pagos_sub: t.pagos_subsecuentes, num_recibos: t.num_recibos };
      });
    }
    const flags: CoverageFlags = {
      asistencia_extranjero:          inp?.asistencia_extranjero ?? false,
      maternidad_titular:             null,
      maternidad_conyuge:             null,
      cobertura_catastrofica_extranjero: null,
      reconocimiento_antiguedad:      null,
      medicamentos_fuera:             null,
      complicaciones_no_amparadas:    null,
      padecimientos_preexistentes:    null,
      eliminacion_deducible_accidente: null,
      multiregion:                    null,
      vip:                            null,
      enfermedades_graves_extranjero: null,
      cobertura_internacional:        null,
      ampliacion_servicios:           null,
      ayuda_diaria:                   null,
      indemnizacion_eg:               null,
      xtensuz:                        null,
    };
    return {
      option_id: r.option_id,
      nombre: r.option_label ?? PRODUCT_LABELS.BNV,
      product_id: 'BNV',
      aseguradora: 'Bupa Mexico',
      zona: inp?.region_zone ?? '-',
      nivel: '-',
      suma_asegurada: inp?.suma_asegurada ?? 0,
      deducible: inp?.deducible ?? 0,
      coaseguro: inp?.coaseguro ?? 0,
      tope_coaseguro: inp?.tope_coaseguro ?? null,
      prima_anual: bnv.prima_anual_total,
      totals,
      bxCoverageChips: [],
      coverageFlags: flags,
    };
  }

  // BNP
  const bnp = res as BnpCalculationResult;
  const inp = (r as any).__input as BnpQuoteInput | undefined;
  const totals: PlanSummary['totals'] = {};
  if (bnp.totals) {
    (Object.keys(bnp.totals) as FormaPago[]).forEach(fp => {
      const t = bnp.totals[fp];
      totals[fp] = { total: t.total, primer_pago: t.primer_pago, pagos_sub: t.pagos_subsecuentes, num_recibos: t.num_recibos };
    });
  }
  const flags: CoverageFlags = {
    asistencia_extranjero:          inp?.asistencia_extranjero ?? false,
    maternidad_titular:             inp?.maternidad_titular ?? false,
    maternidad_conyuge:             inp?.maternidad_conyuge ?? false,
    cobertura_catastrofica_extranjero: inp?.cobertura_catastrofica_extranjero ?? false,
    reconocimiento_antiguedad:      null,
    medicamentos_fuera:             null,
    complicaciones_no_amparadas:    null,
    padecimientos_preexistentes:    null,
    eliminacion_deducible_accidente: null,
    multiregion:                    null,
    vip:                            null,
    enfermedades_graves_extranjero: null,
    cobertura_internacional:        null,
    ampliacion_servicios:           null,
    ayuda_diaria:                   null,
    indemnizacion_eg:               null,
    xtensuz:                        null,
  };
  return {
    option_id: r.option_id,
    nombre: r.option_label ?? PRODUCT_LABELS.BNP,
    product_id: 'BNP',
    aseguradora: 'Bupa Mexico',
    zona: inp?.region_zone ?? '-',
    nivel: '-',
    suma_asegurada: inp?.suma_asegurada ?? 0,
    deducible: inp?.deducible ?? 0,
    coaseguro: inp?.coaseguro ?? 0,
    tope_coaseguro: null,
    prima_anual: bnp.prima_anual_total,
    totals,
    bxCoverageChips: [],
    coverageFlags: flags,
  };
}

function personPrima(person: QuotePerson, r: OptionResult): number {
  const res = r.result;
  if (res.product === 'BXPLUS') {
    const bx = res as BxplusCalculationResult;
    const match = bx.people_results.find(p => p.person_id === person.id || p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? ''));
    return match?.prima_total ?? 0;
  }
  if (res.product === 'BNV') {
    const bnv = res as BnvCalculationResult;
    const found = bnv.people_results.find(p => p.person_id === person.id || p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? ''));
    return found ? (bnv.totals?.['Anual']?.total ?? 0) / Math.max(1, bnv.people_results.length) : 0;
  }
  const bnp = res as BnpCalculationResult;
  const match = bnp.people_results.find(p => p.person_id === person.id || p.person_name?.toLowerCase().includes(person.name?.toLowerCase().split(' ')[0] ?? ''));
  return match?.annual_premium ?? 0;
}

// ─── Colors per carrier ───────────────────────────────────────────────────────

const PROD_COLOR: Record<string, string> = {
  BXPLUS: '#0284c7',
  BNV:    '#0d9488',
  BNP:    '#7c3aed',
};

const PROD_LIGHT: Record<string, string> = {
  BXPLUS: '#e0f2fe',
  BNV:    '#ccfbf1',
  BNP:    '#ede9fe',
};

// ─── Recommendation score ─────────────────────────────────────────────────────

function scoreOption(plan: PlanSummary, allPlans: PlanSummary[]): number {
  const nonZero = (arr: number[]) => arr.filter(v => v > 0);
  const prices = nonZero(allPlans.map(p => p.prima_anual));
  const sas    = nonZero(allPlans.map(p => p.suma_asegurada));
  const deds   = nonZero(allPlans.map(p => p.deducible));
  const coas   = nonZero(allPlans.map(p => p.coaseguro));

  const rank = (vals: number[], val: number, higher = false) => {
    if (!vals.length || val === 0) return 0.5;
    const sorted = [...vals].sort((a, b) => higher ? b - a : a - b);
    const idx = sorted.indexOf(val);
    return idx === -1 ? 0.5 : 1 - idx / (sorted.length - 1 || 1);
  };

  const coverageCount = Object.values(plan.coverageFlags).filter(v => v === true).length;
  return (
    rank(prices, plan.prima_anual, false)    * 0.35 +
    rank(sas,    plan.suma_asegurada, true)  * 0.25 +
    rank(deds,   plan.deducible, false)      * 0.15 +
    rank(coas,   plan.coaseguro, false)      * 0.10 +
    Math.min(1, coverageCount / 8)           * 0.15
  );
}

// ─── Coverage comparison rows definition ─────────────────────────────────────

interface CoverageRow {
  key: keyof CoverageFlags;
  label: string;
  category: 'basica' | 'opcional';
}

const COVERAGE_ROWS: CoverageRow[] = [
  // Universal
  { key: 'asistencia_extranjero',           label: 'Asistencia medica en extranjero',     category: 'opcional' },
  // BNP / BX+
  { key: 'maternidad_titular',              label: 'Maternidad (titular)',                 category: 'opcional' },
  { key: 'maternidad_conyuge',              label: 'Maternidad (conyuge)',                 category: 'opcional' },
  { key: 'cobertura_catastrofica_extranjero', label: 'Cobertura catastrofica extranjero', category: 'opcional' },
  // BX+ only
  { key: 'multiregion',                     label: 'Multiregion',                          category: 'basica'   },
  { key: 'vip',                             label: 'Beneficio VIP',                        category: 'basica'   },
  { key: 'eliminacion_deducible_accidente', label: 'Eliminacion deducible por accidente',  category: 'basica'   },
  { key: 'medicamentos_fuera',              label: 'Medicamentos fuera del hospital',      category: 'basica'   },
  { key: 'reconocimiento_antiguedad',       label: 'Reconocimiento de antiguedad',         category: 'opcional' },
  { key: 'complicaciones_no_amparadas',     label: 'Complicaciones no amparadas',          category: 'opcional' },
  { key: 'padecimientos_preexistentes',     label: 'Padecimientos preexistentes',          category: 'opcional' },
  { key: 'enfermedades_graves_extranjero',  label: 'Enf. graves en extranjero',            category: 'opcional' },
  { key: 'cobertura_internacional',         label: 'Cobertura internacional',              category: 'opcional' },
  { key: 'ampliacion_servicios',            label: 'Ampliacion de servicios',              category: 'opcional' },
  { key: 'ayuda_diaria',                    label: 'Ayuda diaria por hospitalizacion',     category: 'opcional' },
  { key: 'indemnizacion_eg',                label: 'Indemnizacion por enf. graves',        category: 'opcional' },
  { key: 'xtensuz',                         label: 'Xtensuz',                              category: 'opcional' },
];

// Only show rows where at least one plan has a non-null value
function getVisibleCoverageRows(plans: PlanSummary[]): CoverageRow[] {
  return COVERAGE_ROWS.filter(row =>
    plans.some(p => p.coverageFlags[row.key] !== null)
  );
}

// ─── React template ───────────────────────────────────────────────────────────

interface QuoteTemplateProps {
  clientName: string;
  folio: string;
  today: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  agentWeb: string;
  logoUrl: string | null;
  accentColor: string;
  people: QuotePerson[];
  plans: PlanSummary[];
  results: OptionResult[];
  bestIdx: number;
}

function CoverageCell({ value, accentColor }: { value: boolean | null; accentColor: string }) {
  if (value === null) {
    return h('span', { style: { color: '#d1d5db', fontSize: '10px' } }, '-');
  }
  if (value) {
    return h('span', { style: { color: '#059669', fontWeight: 700, fontSize: '11px' } }, 'Si');
  }
  return h('span', { style: { color: '#9ca3af', fontSize: '10px' } }, 'No');
}

function QuoteTemplate(props: QuoteTemplateProps) {
  const { clientName, folio, today, agentName, agentEmail, agentPhone, agentWeb,
          logoUrl, accentColor, people, plans, results, bestIdx } = props;

  const best = plans[bestIdx];
  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
  const N = plans.length;

  // Font scale for tables based on option count
  const tblFont  = N <= 3 ? 10 : N <= 4 ? 9 : 8;
  const tblHead  = N <= 3 ? 9  : N <= 4 ? 8 : 7.5;
  const tblPad   = N <= 3 ? '5px 8px' : N <= 4 ? '4px 6px' : '3px 5px';
  const headPad  = N <= 3 ? '6px 8px' : N <= 4 ? '5px 6px' : '4px 5px';

  // Columns (options) for cards: 1-3 → single row, 4-6 → 2 rows of 3
  const cardCols = Math.min(N, 3);

  const visibleCovRows = getVisibleCoverageRows(plans);

  const miniHeader = (subtitle: string) =>
    h('div', { style: { background: accentColor, padding: '8px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { fontSize: '11px', fontWeight: 700, color: '#ffffff' } }, `Cotizacion GMM - ${clientName}`),
      h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.70)' } }, subtitle),
    );

  const sectionTitle = (label: string) =>
    h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, label);

  const pageFooter = (pg: number, total: number) =>
    h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, background: '#f4f6fb', borderTop: '1px solid #e2e6f0', padding: '7px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { fontSize: '8px', color: '#9ca3af' } }, 'Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion. Documento ilustrativo, no contractual.'),
      h('div', { style: { fontSize: '8px', color: '#6b7280', fontWeight: 600 } }, `Pagina ${pg} / ${total}`),
    );

  const totalPages = visibleCovRows.length > 0 ? 3 : 2;

  // Option header cells for comparison tables
  const optionHeaderCells = plans.map((plan, i) =>
    h('th', { key: i, style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', background: i === bestIdx ? 'rgba(255,255,255,0.18)' : undefined, minWidth: `${Math.max(80, Math.floor(530 / N))}px` } },
      h('div', { style: { fontSize: `${tblHead - 1}px`, color: 'rgba(255,255,255,0.65)', marginBottom: '1px' } }, PRODUCT_LABELS[plan.product_id as keyof typeof PRODUCT_LABELS] ?? plan.product_id),
      plan.nombre,
    )
  );

  return h('div', {
    id: 'gmm-pdf-root',
    style: { width: '816px', fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif", background: '#ffffff', color: '#1a1d2e' }
  },

    // ══════ PAGE 1 ══════
    h('div', { id: 'gmm-page-1', style: { width: '816px', minHeight: '1056px', background: '#fff', position: 'relative' } },

      // Header
      h('div', { style: { background: accentColor, padding: '22px 32px 18px', position: 'relative', overflow: 'hidden' } },
        h('div', { style: { position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'rgba(255,255,255,0.06)', clipPath: 'polygon(40% 0, 100% 0, 100% 100%, 0% 100%)' } }),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            logoUrl
              ? h('img', { src: logoUrl, alt: 'Logo', style: { maxWidth: '160px', maxHeight: '56px', objectFit: 'contain', display: 'block', marginBottom: '4px' } })
              : h('div', { style: { background: 'rgba(255,255,255,0.15)', borderRadius: '5px', padding: '5px 10px', display: 'inline-block', marginBottom: '4px' } },
                  h('div', { style: { fontSize: '12px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' } }, agentWeb || 'Agente Autorizado'),
                ),
            h('div', { style: { fontSize: '15px', color: '#ffffff', fontWeight: 700, lineHeight: 1.2 } }, agentName || 'Cotizacion GMM'),
            agentEmail && h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.65)', marginTop: '1px' } }, agentEmail),
            agentPhone && h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.55)' } }, agentPhone),
          ),
          h('div', { style: { textAlign: 'right' } },
            h('div', { style: { fontSize: '21px', color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em' } }, 'COTIZACION GMM'),
            h('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.70)', marginTop: '4px' } }, 'Gastos Medicos Mayores'),
            h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' } }, today),
            folio && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.50)', marginTop: '2px' } }, `Folio: ${folio}`),
          ),
        ),
      ),

      // Client strip
      h('div', { style: { background: '#f4f6fb', borderBottom: '1px solid #e2e6f0', padding: '9px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('div', { style: { width: '3px', height: '26px', background: accentColor, borderRadius: '2px' } }),
          h('div', null,
            h('div', { style: { fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Prospecto'),
            h('div', { style: { fontSize: '14px', fontWeight: 700, color: '#1a1d2e' } }, clientName),
          ),
        ),
        (() => {
          const titular = people.find(p => p.relation === 'Titular') ?? people[0];
          return titular ? h('div', { style: { textAlign: 'right', fontSize: '10px', color: '#6b7280' } },
            h('div', null, `Titular: ${titular.name}`),
            h('div', null, `${titular.age} anos  ·  ${titular.gender}`),
          ) : null;
        })(),
      ),

      // Hero banner
      h('div', { style: { margin: '14px 32px 0', background: accentColor, borderRadius: '10px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', null,
          h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' } }, 'Opcion recomendada'),
          h('div', { style: { fontSize: '14px', fontWeight: 700, color: '#ffffff' } }, best.nombre),
          h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.72)', marginTop: '3px' } },
            `${best.aseguradora}  ·  SA: ${formatMoneyCompact(best.suma_asegurada)}  ·  Ded: ${formatMoneyCompact(best.deducible)}  ·  Coas: ${formatPercent(best.coaseguro)}`
          ),
        ),
        h('div', { style: { textAlign: 'right' } },
          h('div', { style: { fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1 } }, formatMoneyCompact(best.prima_anual)),
          h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.60)', marginTop: '2px' } }, 'Prima anual con IVA'),
        ),
      ),

      // Option cards grid (up to 6, 3 per row)
      h('div', { style: { margin: '14px 32px 0', display: 'grid', gridTemplateColumns: `repeat(${cardCols}, 1fr)`, gap: '10px' } },
        ...plans.map((plan, i) => {
          const isBest = i === bestIdx;
          const pc = PROD_COLOR[plan.product_id] ?? accentColor;
          const pl = PROD_LIGHT[plan.product_id] ?? '#f0f4ff';
          return h('div', {
            key: plan.option_id,
            style: { border: isBest ? `2px solid ${pc}` : '1px solid #e2e6f0', borderRadius: '10px', overflow: 'hidden', background: isBest ? '#ffffff' : '#fafbff', boxShadow: isBest ? `0 4px 14px rgba(0,0,0,0.10)` : 'none', position: 'relative' }
          },
            h('div', { style: { background: pc, height: '5px' } }),
            isBest && h('div', { style: { position: 'absolute', top: '8px', right: '8px', background: '#10b981', color: '#fff', fontSize: '7.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', letterSpacing: '0.04em' } }, 'MEJOR PRECIO'),
            h('div', { style: { padding: N <= 3 ? '11px 13px 13px' : '9px 11px 11px' } },
              h('div', { style: { fontSize: '8px', color: pc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' } }, PRODUCT_LABELS[plan.product_id as keyof typeof PRODUCT_LABELS] ?? plan.product_id),
              h('div', { style: { fontSize: N <= 3 ? '12px' : '11px', fontWeight: 700, color: '#1a1d2e', lineHeight: 1.3, marginBottom: '9px', minHeight: '28px' } }, plan.nombre),
              // Specs grid
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '9px' } },
                ...[
                  ['SA', formatMoneyCompact(plan.suma_asegurada)],
                  ['Deducible', formatMoneyCompact(plan.deducible)],
                  ['Coaseguro', formatPercent(plan.coaseguro)],
                  ['Tope Coas.', plan.tope_coaseguro ? formatMoneyCompact(plan.tope_coaseguro) : '-'],
                ].map(([lbl, val]) =>
                  h('div', { key: lbl, style: { background: pl, borderRadius: '5px', padding: '4px 6px' } },
                    h('div', { style: { fontSize: '7px', color: '#6b7280', marginBottom: '1px' } }, lbl),
                    h('div', { style: { fontSize: '9px', fontWeight: 700, color: '#1a1d2e' } }, val),
                  )
                ),
              ),
              // BX+ coverage chips
              plan.bxCoverageChips.length > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '7px' } },
                ...plan.bxCoverageChips.slice(0, 6).map(chip =>
                  h('span', { key: chip, style: { background: pl, border: `1px solid ${pc}30`, color: pc, fontSize: '7px', padding: '1px 4px', borderRadius: '8px', fontWeight: 500 } }, chip)
                ),
              ),
              // Price
              h('div', { style: { borderTop: '1px solid #e8eaf0', paddingTop: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
                h('div', { style: { fontSize: '7px', color: '#6b7280' } }, 'Prima anual c/IVA'),
                h('div', { style: { fontSize: N <= 3 ? '17px' : '15px', fontWeight: 800, color: pc, lineHeight: 1 } }, formatMoneyCompact(plan.prima_anual)),
              ),
            ),
          );
        }),
      ),

      // KPI strip
      h('div', { style: { margin: '14px 32px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '9px' } },
        ...[
          { lbl: 'Opciones cotizadas', val: String(N), color: accentColor },
          { lbl: 'Asegurados', val: String(people.length), color: '#0891b2' },
          { lbl: 'Mejor precio anual', val: formatMoneyCompact(best.prima_anual), color: '#10b981' },
          { lbl: 'Menor deducible', val: formatMoneyCompact(Math.min(...plans.filter(p => p.deducible > 0).map(p => p.deducible))), color: '#f59e0b' },
        ].map(k =>
          h('div', { key: k.lbl, style: { background: k.color + '12', border: `1px solid ${k.color}30`, borderRadius: '7px', padding: '9px 11px', borderLeft: `3px solid ${k.color}` } },
            h('div', { style: { fontSize: '8px', color: '#6b7280', marginBottom: '3px' } }, k.lbl),
            h('div', { style: { fontSize: '13px', fontWeight: 800, color: k.color } }, k.val),
          )
        ),
      ),

      // Insured table
      h('div', { style: { margin: '14px 32px 0' } },
        sectionTitle('Asegurados cotizados'),
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: `${tblFont}px` } },
          h('thead', null,
            h('tr', { style: { background: accentColor } },
              ...['Nombre', 'Parentesco', 'Genero', 'Edad', ...results.map((r, i) => r.option_label ?? `Op. ${i+1}`)].map(col =>
                h('th', { key: col, style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', whiteSpace: 'nowrap' } }, col)
              ),
            ),
          ),
          h('tbody', null,
            ...people.map((p, pi) =>
              h('tr', { key: p.id, style: { background: pi % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                h('td', { style: { padding: tblPad, fontWeight: 600, color: '#1a1d2e' } }, p.name),
                h('td', { style: { padding: tblPad, color: '#374151' } }, p.relation),
                h('td', { style: { padding: tblPad, color: '#374151' } }, p.gender),
                h('td', { style: { padding: tblPad, color: '#374151' } }, `${p.age} a.`),
                ...results.map((r2, ri) => {
                  const prima = personPrima(p, r2);
                  const isBestCol = ri === bestIdx;
                  return h('td', { key: ri, style: { padding: tblPad, fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#374151', background: isBestCol ? accentColor + '12' : 'transparent' } }, prima > 0 ? formatMoneyFull(prima) : 'No cotizado');
                }),
              )
            ),
          ),
        ),
      ),

      pageFooter(1, totalPages),
    ),

    // ══════ PAGE 2 ══════
    h('div', { id: 'gmm-page-2', style: { width: '816px', minHeight: '1056px', background: '#fff', position: 'relative' } },

      miniHeader(folio ? `Folio: ${folio}` : today),

      h('div', { style: { padding: '16px 32px 80px' } },

        // Basic plan comparison
        h('div', { style: { marginBottom: '18px' } },
          sectionTitle('Comparativo de planes'),
          h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: `${tblFont}px` } },
            h('thead', null,
              h('tr', { style: { background: accentColor } },
                h('th', { style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', width: '130px' } }, 'Caracteristica'),
                ...optionHeaderCells,
              ),
            ),
            h('tbody', null,
              ...[
                ['Aseguradora',       (p: PlanSummary) => p.aseguradora],
                ['Zona / Region',     (p: PlanSummary) => p.zona],
                ['Nivel hospitalario',(p: PlanSummary) => p.nivel],
                ['Suma Asegurada',    (p: PlanSummary) => formatNullableMoney(p.suma_asegurada)],
                ['Deducible',         (p: PlanSummary) => formatNullableMoney(p.deducible)],
                ['Coaseguro',         (p: PlanSummary) => formatPercent(p.coaseguro)],
                ['Tope Coaseguro',    (p: PlanSummary) => p.tope_coaseguro ? formatMoneyFull(p.tope_coaseguro) : '-'],
                ['Prima anual c/IVA', (p: PlanSummary) => formatNullableMoney(p.prima_anual)],
              ].map(([lbl, fn], ri) =>
                h('tr', { key: lbl as string, style: { background: ri % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                  h('td', { style: { padding: tblPad, fontWeight: 600, color: '#374151', fontSize: `${tblFont}px` } }, lbl as string),
                  ...plans.map((plan, ci) => {
                    const isBestCol = ci === bestIdx;
                    return h('td', { key: ci, style: { padding: tblPad, fontSize: `${tblFont}px`, fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#1a1d2e', background: isBestCol ? accentColor + '12' : 'transparent' } }, (fn as Function)(plan));
                  }),
                )
              ),
            ),
          ),
        ),

        // Payment table
        h('div', { style: { marginBottom: '18px' } },
          sectionTitle('Formas de pago - Prima total c/IVA'),
          h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: `${tblFont}px` } },
            h('thead', null,
              h('tr', { style: { background: '#374151' } },
                h('th', { style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', width: '100px' } }, 'Forma de pago'),
                ...plans.map((plan, i) =>
                  h('th', { key: i, style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', background: i === bestIdx ? 'rgba(255,255,255,0.12)' : undefined } }, plan.nombre)
                ),
              ),
            ),
            h('tbody', null,
              ...formasPago.map((fp, ri) =>
                h('tr', { key: fp, style: { background: ri % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                  h('td', { style: { padding: tblPad, fontWeight: 600, color: '#374151', fontSize: `${tblFont}px` } }, fp),
                  ...plans.map((plan, ci) => {
                    const t = plan.totals[fp];
                    const isBestCol = ci === bestIdx;
                    return h('td', { key: ci, style: { padding: tblPad, fontSize: `${tblFont}px`, fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#1a1d2e', background: isBestCol ? accentColor + '12' : 'transparent' } },
                      t ? h('div', null,
                        h('div', null, formatMoneyFull(t.total)),
                        t.num_recibos > 1 && h('div', { style: { fontSize: '7.5px', color: '#9ca3af', marginTop: '1px' } }, `1er: ${formatMoneyFull(t.primer_pago)} + ${t.num_recibos - 1} x ${formatMoneyFull(t.pagos_sub)}`),
                      ) : h('span', null, '-')
                    );
                  }),
                )
              ),
            ),
          ),
        ),

        // Glossary + Recommendation
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' } },
          h('div', null,
            sectionTitle('Glosario'),
            ...[
              ['Suma Asegurada', 'Monto maximo cubierto por la aseguradora por evento o anualidad.'],
              ['Deducible', 'Cantidad a cargo del asegurado antes de activar la cobertura.'],
              ['Coaseguro', 'Porcentaje del gasto a cargo del asegurado tras cubrir el deducible.'],
              ['Tope Coaseguro', 'Limite maximo del coaseguro por evento.'],
              ['Prima', 'Costo total del seguro incluyendo IVA.'],
              ['Nivel hosp.', 'Categoria de hospitales incluidos en la red medica.'],
            ].map(([term, def]) =>
              h('div', { key: term, style: { marginBottom: '5px', display: 'flex', gap: '6px' } },
                h('span', { style: { fontSize: '8.5px', fontWeight: 700, color: '#374151', minWidth: '90px', flexShrink: 0 } }, term + ':'),
                h('span', { style: { fontSize: '8.5px', color: '#6b7280', lineHeight: 1.4 } }, def),
              )
            ),
          ),
          h('div', null,
            sectionTitle('Nuestra recomendacion'),
            h('div', { style: { background: accentColor + '10', border: `1px solid ${accentColor}30`, borderRadius: '8px', padding: '12px', borderLeft: `4px solid ${accentColor}` } },
              h('div', { style: { fontSize: '12px', fontWeight: 700, color: '#1a1d2e', marginBottom: '5px' } }, best.nombre),
              h('div', { style: { fontSize: '8.5px', color: '#374151', lineHeight: 1.6 } },
                `Recomendamos ${best.nombre} (${best.aseguradora}) para ${clientName}. ` +
                `Suma asegurada de ${formatMoneyFull(best.suma_asegurada)}, deducible de ${formatMoneyFull(best.deducible)} y coaseguro de ${formatPercent(best.coaseguro)}. ` +
                `Prima anual: ${formatMoneyFull(best.prima_anual)} con IVA incluido.`
              ),
              h('div', { style: { marginTop: '9px', display: 'flex', gap: '7px' } },
                ...(['Anual', 'Mensual'] as FormaPago[]).filter(fp => best.totals[fp]).map(fp => {
                  const t = best.totals[fp]!;
                  return h('div', { key: fp, style: { background: '#ffffff', border: `1px solid ${accentColor}30`, borderRadius: '6px', padding: '5px 9px', textAlign: 'center' } },
                    h('div', { style: { fontSize: '7px', color: '#6b7280' } }, fp),
                    h('div', { style: { fontSize: '11px', fontWeight: 700, color: accentColor } }, formatMoneyFull(t.total)),
                  );
                }),
              ),
            ),
          ),
        ),

        // Advisor card
        h('div', { style: { background: '#1a1d2e', borderRadius: '10px', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
            h('div', { style: { width: '42px', height: '42px', borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', flexShrink: 0 } },
              agentName.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase() || 'A'
            ),
            h('div', null,
              h('div', { style: { fontSize: '13px', fontWeight: 700, color: '#ffffff' } }, agentName || 'Tu asesor'),
              agentEmail && h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' } }, agentEmail),
              agentPhone && h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.55)', marginTop: '1px' } }, agentPhone),
            ),
          ),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            agentWeb && h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginRight: '6px' } }, agentWeb),
            h('div', { style: { background: accentColor, color: '#ffffff', fontSize: '10px', fontWeight: 700, padding: '9px 18px', borderRadius: '7px' } }, 'Solicitar poliza'),
          ),
        ),
      ),

      pageFooter(2, totalPages),
    ),

    // ══════ PAGE 3 — Coverage comparison (only if there are coverage rows) ══════
    visibleCovRows.length > 0 && h('div', { id: 'gmm-page-3', style: { width: '816px', minHeight: '1056px', background: '#fff', position: 'relative' } },

      miniHeader('Comparativo de coberturas'),

      h('div', { style: { padding: '16px 32px 80px' } },

        sectionTitle('Coberturas incluidas y opcionales'),

        // Legend
        h('div', { style: { display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '9px', color: '#6b7280' } },
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            h('span', { style: { color: '#059669', fontWeight: 700 } }, 'Si'), '= Incluida en esta opcion'
          ),
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            h('span', { style: { color: '#9ca3af' } }, 'No'), '= No contratada'
          ),
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            h('span', { style: { color: '#d1d5db' } }, '-'), '= No aplica para este producto'
          ),
        ),

        // Coverage table
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: `${tblFont}px` } },
          h('thead', null,
            h('tr', { style: { background: accentColor } },
              h('th', { style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'left', width: '200px' } }, 'Cobertura'),
              h('th', { style: { padding: headPad, color: 'rgba(255,255,255,0.70)', fontWeight: 500, fontSize: '8px', textAlign: 'center', width: '60px' } }, 'Tipo'),
              ...plans.map((plan, i) =>
                h('th', { key: i, style: { padding: headPad, color: '#fff', fontWeight: 600, fontSize: `${tblHead}px`, textAlign: 'center', background: i === bestIdx ? 'rgba(255,255,255,0.18)' : undefined } },
                  h('div', { style: { fontSize: '7px', color: 'rgba(255,255,255,0.60)', marginBottom: '1px' } }, PRODUCT_LABELS[plan.product_id as keyof typeof PRODUCT_LABELS] ?? plan.product_id),
                  plan.nombre,
                )
              ),
            ),
          ),
          h('tbody', null,
            // Group by category: basica first, then opcional
            ...['basica', 'opcional'].flatMap((cat, catIdx) => {
              const catRows = visibleCovRows.filter(r => r.category === cat);
              if (!catRows.length) return [];
              return [
                // Category header row
                h('tr', { key: `cat-${cat}`, style: { background: cat === 'basica' ? '#1a1d2e' : '#374151' } },
                  h('td', { colSpan: N + 2, style: { padding: '4px 8px', color: '#fff', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' } },
                    cat === 'basica' ? 'Coberturas base incluidas' : 'Coberturas opcionales / adicionales'
                  ),
                ),
                // Data rows
                ...catRows.map((row, ri) =>
                  h('tr', { key: row.key, style: { background: (catIdx * catRows.length + ri) % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                    h('td', { style: { padding: tblPad, fontWeight: 500, color: '#1a1d2e', fontSize: `${tblFont}px` } }, row.label),
                    h('td', { style: { padding: tblPad, textAlign: 'center' } },
                      h('span', { style: { fontSize: '7px', padding: '1px 5px', borderRadius: '8px', fontWeight: 600, background: cat === 'basica' ? '#e0f2fe' : '#fef3c7', color: cat === 'basica' ? '#0369a1' : '#92400e' } },
                        cat === 'basica' ? 'Base' : 'Opcional'
                      )
                    ),
                    ...plans.map((plan, ci) => {
                      const val = plan.coverageFlags[row.key];
                      const isBestCol = ci === bestIdx;
                      return h('td', { key: ci, style: { padding: tblPad, textAlign: 'center', background: isBestCol ? accentColor + '0e' : 'transparent', borderLeft: isBestCol ? `1px solid ${accentColor}30` : undefined, borderRight: isBestCol ? `1px solid ${accentColor}30` : undefined } },
                        h(CoverageCell, { value: val, accentColor })
                      );
                    }),
                  )
                ),
              ];
            }),
          ),
        ),

        // Coverage summary per option
        h('div', { style: { marginTop: '20px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(N, 3)}, 1fr)`, gap: '12px' } },
          ...plans.slice(0, 6).map((plan, i) => {
            const pc = PROD_COLOR[plan.product_id] ?? accentColor;
            const pl = PROD_LIGHT[plan.product_id] ?? '#f0f4ff';
            const includedCount = Object.values(plan.coverageFlags).filter(v => v === true).length;
            return h('div', { key: plan.option_id, style: { background: pl, border: `1px solid ${pc}30`, borderRadius: '8px', padding: '10px 12px' } },
              h('div', { style: { fontSize: '8px', color: pc, fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' } }, PRODUCT_LABELS[plan.product_id as keyof typeof PRODUCT_LABELS] ?? plan.product_id),
              h('div', { style: { fontSize: '11px', fontWeight: 700, color: '#1a1d2e', marginBottom: '6px' } }, plan.nombre),
              h('div', { style: { fontSize: '10px', color: '#374151' } },
                h('span', { style: { fontWeight: 700, color: '#059669', fontSize: '14px' } }, String(includedCount)),
                '  coberturas activas',
              ),
              i === bestIdx && h('div', { style: { marginTop: '4px', fontSize: '8px', color: '#10b981', fontWeight: 600 } }, 'Opcion recomendada'),
            );
          }),
        ),
      ),

      pageFooter(3, totalPages),
    ),
  );
}

// ─── html2canvas capture ──────────────────────────────────────────────────────

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: 816,
    windowWidth: 816,
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  optionDefs?: MultiGmmOption[],
  logoUrl?: string,
  folio?: string
): Promise<Blob> {

  // Inject inputs from optionDefs so extractPlan can read them
  if (optionDefs) {
    results.forEach(r => {
      const def = optionDefs.find(d => d.id === r.option_id);
      if (def) {
        (r as any).__input = def.input;
        if (def.product_id === 'BXPLUS') {
          (r as any).__coverages = (def.input as BxplusQuoteInput).coverages;
        }
      }
    });
  }

  const plans  = results.map(r => extractPlan(r));
  const scores = plans.map(p => scoreOption(p, plans));
  const bestIdx = scores.reduce((bi, s, i) => s > scores[bi] ? i : bi, 0);

  const accentColor = usuario?.oficina?.accent_color ?? '#1B4FD8';
  const agentName   = usuario?.nombre_completo ?? usuario?.nombre ?? '';
  const agentEmail  = usuario?.email ?? '';
  const agentPhone  = usuario?.telefono ?? usuario?.phone ?? '';
  const agentWeb    = usuario?.oficina?.website ?? usuario?.oficina?.nombre ?? '';

  // Logo priority chain: caller → agent → brand → office → office.brand → agency → defaultBrand
  const resolvedLogo: string | null =
    logoUrl ||
    usuario?.logo_url ||
    usuario?.brand?.logo_url ||
    usuario?.oficina?.logo_url ||
    usuario?.oficina?.brand?.logo_url ||
    usuario?.agencia?.logo_url ||
    usuario?.default_brand?.logo_url ||
    null;
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;pointer-events:none;';
  document.body.appendChild(container);

  const root = createRoot(container);

  await new Promise<void>(resolve => {
    root.render(
      h(StrictMode, null,
        h(QuoteTemplate, {
          clientName,
          folio: folio ?? '',
          today,
          agentName,
          agentEmail,
          agentPhone,
          agentWeb,
          logoUrl: resolvedLogo,
          accentColor,
          people,
          plans,
          results,
          bestIdx,
        })
      )
    );
    setTimeout(resolve, 250);
  });

  const page1El = container.querySelector('#gmm-page-1') as HTMLElement | null;
  const page2El = container.querySelector('#gmm-page-2') as HTMLElement | null;
  const page3El = container.querySelector('#gmm-page-3') as HTMLElement | null;

  if (!page1El || !page2El) {
    root.unmount();
    document.body.removeChild(container);
    throw new Error('PDF template elements not found');
  }

  const pageEls = [page1El, page2El, ...(page3El ? [page3El] : [])];
  const canvases = await Promise.all(pageEls.map(el => captureElement(el)));

  root.unmount();
  document.body.removeChild(container);

  // Letter: 215.9mm × 279.4mm
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW = 215.9;
  const PH = 279.4;

  canvases.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    const aspect  = canvas.width / canvas.height;
    const imgH    = PW / aspect;
    // If content taller than page, scale to fit (rare but handles overflow gracefully)
    if (imgH > PH) {
      const scale = PH / imgH;
      const drawW = PW * scale;
      doc.addImage(imgData, 'JPEG', (PW - drawW) / 2, 0, drawW, PH);
    } else {
      doc.addImage(imgData, 'JPEG', 0, (PH - imgH) / 2, PW, imgH);
    }
  });

  return doc.output('blob');
}
