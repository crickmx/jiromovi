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

const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '-';
  return mxn.format(n);
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '-';
  // If the value looks like a decimal fraction (0.1 = 10%), multiply by 100
  const pct = n <= 1 ? n * 100 : n;
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

// ─── Data extraction ──────────────────────────────────────────────────────────

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
  bxCoverages: string[];
}

function extractPlan(r: OptionResult): PlanSummary {
  const res = r.result;

  if (res.product === 'BXPLUS') {
    const bx = res as BxplusCalculationResult;
    const input = (r as any).__input as BxplusQuoteInput | undefined;
    const coverages = (r as any).__coverages as Record<string, boolean> | undefined;

    const chips: string[] = [];
    if (coverages) {
      const labels: Record<string, string> = {
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
      Object.entries(labels).forEach(([k, v]) => { if (coverages[k]) chips.push(v); });
    }

    const totals: PlanSummary['totals'] = {};
    if (bx.totals) {
      (Object.keys(bx.totals) as FormaPago[]).forEach(fp => {
        const t = bx.totals[fp];
        totals[fp] = { total: t.total, primer_pago: t.primer_pago, pagos_sub: t.pagos_subsecuentes, num_recibos: t.num_recibos };
      });
    }

    const saRaw = parseFloat(String(input?.suma_asegurada ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const dedRaw = parseFloat(String(input?.deducible ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const coas = parseFloat(String(input?.coaseguro ?? '0').replace(/[^0-9.]/g, '')) || 0;

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
      bxCoverages: chips,
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
      bxCoverages: [],
    };
  }

  const bnp = res as BnpCalculationResult;
  const inp = (r as any).__input as BnpQuoteInput | undefined;
  const totals: PlanSummary['totals'] = {};
  if (bnp.totals) {
    (Object.keys(bnp.totals) as FormaPago[]).forEach(fp => {
      const t = bnp.totals[fp];
      totals[fp] = { total: t.total, primer_pago: t.primer_pago, pagos_sub: t.pagos_subsecuentes, num_recibos: t.num_recibos };
    });
  }
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
    bxCoverages: [],
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

// ─── Color palette per product ────────────────────────────────────────────────

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

  const priceScore     = rank(prices, plan.prima_anual, false);
  const sumScore       = rank(sas, plan.suma_asegurada, true);
  const dedScore       = rank(deds, plan.deducible, false);
  const coasScore      = rank(coas, plan.coaseguro, false);
  const coverageScore  = plan.bxCoverages.length > 0 ? Math.min(1, plan.bxCoverages.length / 8) : 0.5;

  return priceScore * 0.35 + sumScore * 0.25 + dedScore * 0.15 + coasScore * 0.10 + coverageScore * 0.15;
}

// ─── React component tree (rendered off-screen to DOM) ────────────────────────

interface QuoteTemplateProps {
  clientName: string;
  folio: string;
  today: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  agentWeb: string;
  accentColor: string;
  logoUrl: string | null;
  people: QuotePerson[];
  plans: PlanSummary[];
  results: OptionResult[];
  bestIdx: number;
}

function QuoteTemplate(props: QuoteTemplateProps) {
  const { clientName, folio, today, agentName, agentEmail, agentPhone, agentWeb,
          accentColor, people, plans, results, bestIdx } = props;

  const best = plans[bestIdx];
  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

  return h('div', {
    id: 'gmm-pdf-root',
    style: {
      width: '816px',
      fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      background: '#ffffff',
      color: '#1a1d2e',
    }
  },

    // ══════ PAGE 1 ══════
    h('div', { id: 'gmm-page-1', style: { width: '816px', minHeight: '1056px', background: '#fff', position: 'relative', pageBreakAfter: 'always' } },

      // Header
      h('div', { style: { background: accentColor, padding: '24px 32px 20px', position: 'relative', overflow: 'hidden' } },
        // Decorative stripe
        h('div', { style: { position: 'absolute', top: 0, right: 0, width: '180px', height: '100%', background: 'rgba(255,255,255,0.06)', clipPath: 'polygon(40% 0, 100% 0, 100% 100%, 0% 100%)' } }),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 } },
          // Left: brand
          h('div', null,
            h('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' } }, agentWeb || 'Agente Autorizado'),
            h('div', { style: { fontSize: '18px', color: '#ffffff', fontWeight: 700, lineHeight: 1.1 } }, agentName || 'Cotizacion GMM'),
            agentEmail && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.72)', marginTop: '3px' } }, agentEmail),
          ),
          // Right: title block
          h('div', { style: { textAlign: 'right' } },
            h('div', { style: { fontSize: '22px', color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em' } }, 'COTIZACION GMM'),
            h('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.72)', marginTop: '4px' } }, 'Gastos Medicos Mayores'),
            h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.60)', marginTop: '2px' } }, today),
            folio && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' } }, `Folio: ${folio}`),
          ),
        ),
      ),

      // Client strip
      h('div', { style: { background: '#f4f6fb', borderBottom: '1px solid #e2e6f0', padding: '10px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('div', { style: { width: '3px', height: '28px', background: accentColor, borderRadius: '2px' } }),
          h('div', null,
            h('div', { style: { fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Prospecto'),
            h('div', { style: { fontSize: '14px', fontWeight: 700, color: '#1a1d2e' } }, clientName),
          ),
        ),
        (() => {
          const titular = people.find(p => p.relation === 'Titular') ?? people[0];
          return titular ? h('div', { style: { textAlign: 'right', fontSize: '10px', color: '#6b7280' } },
            h('div', null, `Titular: ${titular.name}`),
            h('div', null, `${titular.age} anos · ${titular.gender}`),
          ) : null;
        })(),
      ),

      // Hero recommendation banner
      h('div', { style: { margin: '16px 32px 0', background: accentColor, borderRadius: '10px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', null,
          h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' } }, 'Opcion recomendada'),
          h('div', { style: { fontSize: '15px', fontWeight: 700, color: '#ffffff' } }, best.nombre),
          h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.72)', marginTop: '3px' } },
            `${best.aseguradora}  ·  SA: ${fmtMoney(best.suma_asegurada)}  ·  Ded: ${fmtMoney(best.deducible)}  ·  Coas: ${formatPercent(best.coaseguro)}`
          ),
        ),
        h('div', { style: { textAlign: 'right' } },
          h('div', { style: { fontSize: '24px', fontWeight: 800, color: '#ffffff', lineHeight: 1 } }, fmtMoney(best.prima_anual)),
          h('div', { style: { fontSize: '9px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' } }, 'Prima anual con IVA'),
        ),
      ),

      // Option cards
      h('div', { style: { margin: '16px 32px 0', display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`, gap: '12px' } },
        ...plans.slice(0, 3).map((plan, i) => {
          const isBest = i === bestIdx;
          const pc = PROD_COLOR[plan.product_id] ?? accentColor;
          const pl = PROD_LIGHT[plan.product_id] ?? '#f0f4ff';
          return h('div', {
            key: plan.option_id,
            style: {
              border: isBest ? `2px solid ${pc}` : '1px solid #e2e6f0',
              borderRadius: '10px',
              overflow: 'hidden',
              background: isBest ? '#ffffff' : '#fafbff',
              boxShadow: isBest ? `0 4px 16px rgba(0,0,0,0.10)` : 'none',
              position: 'relative',
            }
          },
            // Top color bar
            h('div', { style: { background: pc, height: '5px' } }),

            // Best badge
            isBest && h('div', { style: { position: 'absolute', top: '8px', right: '8px', background: '#10b981', color: '#fff', fontSize: '8px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em' } }, 'MEJOR PRECIO'),

            h('div', { style: { padding: '12px 14px 14px' } },
              // Product tag
              h('div', { style: { fontSize: '9px', color: pc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' } }, PRODUCT_LABELS[plan.product_id as keyof typeof PRODUCT_LABELS] ?? plan.product_id),
              // Plan name
              h('div', { style: { fontSize: '12px', fontWeight: 700, color: '#1a1d2e', lineHeight: 1.3, marginBottom: '10px', minHeight: '32px' } }, plan.nombre),

              // Specs grid
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' } },
                ...[
                  ['Suma Aseg.', fmtMoney(plan.suma_asegurada)],
                  ['Deducible', fmtMoney(plan.deducible)],
                  ['Coaseguro', formatPercent(plan.coaseguro)],
                  ['Tope Coas.', plan.tope_coaseguro ? fmtMoney(plan.tope_coaseguro) : plan.product_id === 'BNP' ? '-' : '-'],
                ].map(([lbl, val]) =>
                  h('div', { key: lbl, style: { background: pl, borderRadius: '6px', padding: '5px 7px' } },
                    h('div', { style: { fontSize: '8px', color: '#6b7280', marginBottom: '1px' } }, lbl),
                    h('div', { style: { fontSize: '10px', fontWeight: 700, color: '#1a1d2e' } }, val),
                  )
                ),
              ),

              // BX+ coverage chips
              plan.bxCoverages.length > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' } },
                ...plan.bxCoverages.slice(0, 8).map(chip =>
                  h('span', { key: chip, style: { background: pl, border: `1px solid ${pc}30`, color: pc, fontSize: '8px', padding: '1px 5px', borderRadius: '10px', fontWeight: 500 } }, chip)
                ),
              ),

              // Price
              h('div', { style: { borderTop: '1px solid #e2e6f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
                h('div', { style: { fontSize: '8px', color: '#6b7280' } }, 'Prima anual c/IVA'),
                h('div', { style: { fontSize: '18px', fontWeight: 800, color: pc, lineHeight: 1 } }, fmtMoney(plan.prima_anual)),
              ),
            ),
          );
        }),
      ),

      // KPI strip
      h('div', { style: { margin: '16px 32px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' } },
        ...[
          { lbl: 'Opciones cotizadas', val: String(plans.length), color: accentColor },
          { lbl: 'Asegurados',         val: String(people.length), color: '#0891b2' },
          { lbl: 'Mejor precio anual', val: fmtMoney(best.prima_anual), color: '#10b981' },
          { lbl: 'Menor deducible',    val: fmtMoney(Math.min(...plans.filter(p => p.deducible > 0).map(p => p.deducible))), color: '#f59e0b' },
        ].map(k =>
          h('div', { key: k.lbl, style: { background: k.color + '12', border: `1px solid ${k.color}30`, borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${k.color}` } },
            h('div', { style: { fontSize: '8px', color: '#6b7280', marginBottom: '4px' } }, k.lbl),
            h('div', { style: { fontSize: '14px', fontWeight: 800, color: k.color } }, k.val),
          )
        ),
      ),

      // Insured table
      h('div', { style: { margin: '16px 32px 0' } },
        h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, 'Asegurados cotizados'),
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '10px' } },
          h('thead', null,
            h('tr', { style: { background: accentColor } },
              ...['Nombre', 'Parentesco', 'Genero', 'Edad', ...results.slice(0, 3).map((r, i) => r.option_label ?? `Op. ${i+1}`)].map(col =>
                h('th', { key: col, style: { padding: '6px 8px', color: '#fff', fontWeight: 600, fontSize: '9px', textAlign: 'left', whiteSpace: 'nowrap' } }, col)
              ),
            ),
          ),
          h('tbody', null,
            ...people.map((p, pi) =>
              h('tr', { key: p.id, style: { background: pi % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                h('td', { style: { padding: '5px 8px', fontWeight: 600, color: '#1a1d2e', fontSize: '10px' } }, p.name),
                h('td', { style: { padding: '5px 8px', color: '#374151', fontSize: '10px' } }, p.relation),
                h('td', { style: { padding: '5px 8px', color: '#374151', fontSize: '10px' } }, p.gender),
                h('td', { style: { padding: '5px 8px', color: '#374151', fontSize: '10px' } }, `${p.age} a.`),
                ...results.slice(0, 3).map((r2, ri) => {
                  const prima = personPrima(p, r2);
                  const isBestCol = ri === bestIdx;
                  return h('td', { key: ri, style: { padding: '5px 8px', fontSize: '10px', fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#374151', background: isBestCol ? accentColor + '12' : 'transparent' } }, prima > 0 ? fmtMoney(prima) : '-');
                }),
              )
            ),
          ),
        ),
      ),

      // Footer p1
      h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, background: '#f4f6fb', borderTop: '1px solid #e2e6f0', padding: '7px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { fontSize: '8px', color: '#9ca3af' } }, 'Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion. Documento ilustrativo, no contractual.'),
        h('div', { style: { fontSize: '8px', color: '#6b7280', fontWeight: 600 } }, 'Pagina 1 / 2'),
      ),
    ),

    // ══════ PAGE 2 ══════
    h('div', { id: 'gmm-page-2', style: { width: '816px', minHeight: '1056px', background: '#fff', position: 'relative' } },

      // Mini header
      h('div', { style: { background: accentColor, padding: '8px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { fontSize: '11px', fontWeight: 700, color: '#ffffff' } }, `Cotizacion GMM - ${clientName}`),
        h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.70)' } }, folio ? `Folio: ${folio}` : today),
      ),

      h('div', { style: { padding: '16px 32px 80px' } },

        // Comparison table
        h('div', { style: { marginBottom: '20px' } },
          h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, 'Comparativo de planes'),
          h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '10px' } },
            h('thead', null,
              h('tr', { style: { background: accentColor } },
                h('th', { style: { padding: '6px 10px', color: '#fff', fontWeight: 600, fontSize: '9px', textAlign: 'left', width: '140px' } }, 'Caracteristica'),
                ...plans.slice(0, 3).map((plan, i) =>
                  h('th', { key: i, style: { padding: '6px 10px', color: '#fff', fontWeight: 600, fontSize: '9px', textAlign: 'left', background: i === bestIdx ? 'rgba(255,255,255,0.15)' : undefined } }, plan.nombre)
                ),
              ),
            ),
            h('tbody', null,
              ...[
                ['Aseguradora',    (p: PlanSummary) => p.aseguradora],
                ['Zona / Region',  (p: PlanSummary) => p.zona],
                ['Nivel hosp.',    (p: PlanSummary) => p.nivel],
                ['Suma Asegurada', (p: PlanSummary) => fmtMoney(p.suma_asegurada)],
                ['Deducible',      (p: PlanSummary) => fmtMoney(p.deducible)],
                ['Coaseguro',      (p: PlanSummary) => formatPercent(p.coaseguro)],
                ['Tope Coaseguro', (p: PlanSummary) => p.tope_coaseguro ? fmtMoney(p.tope_coaseguro) : '-'],
                ['Prima anual c/IVA', (p: PlanSummary) => fmtMoney(p.prima_anual)],
              ].map(([lbl, fn], ri) =>
                h('tr', { key: lbl as string, style: { background: ri % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                  h('td', { style: { padding: '5px 10px', fontWeight: 600, color: '#374151', fontSize: '10px' } }, lbl as string),
                  ...plans.slice(0, 3).map((plan, ci) => {
                    const isBestCol = ci === bestIdx;
                    return h('td', { key: ci, style: { padding: '5px 10px', fontSize: '10px', fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#1a1d2e', background: isBestCol ? accentColor + '12' : 'transparent' } }, (fn as Function)(plan));
                  }),
                )
              ),
            ),
          ),
        ),

        // Payment forms table
        h('div', { style: { marginBottom: '20px' } },
          h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, 'Formas de pago - Prima total c/IVA'),
          h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '10px' } },
            h('thead', null,
              h('tr', { style: { background: '#374151' } },
                h('th', { style: { padding: '6px 10px', color: '#fff', fontWeight: 600, fontSize: '9px', textAlign: 'left', width: '140px' } }, 'Forma de pago'),
                ...plans.slice(0, 3).map((plan, i) =>
                  h('th', { key: i, style: { padding: '6px 10px', color: '#fff', fontWeight: 600, fontSize: '9px', textAlign: 'left', background: i === bestIdx ? 'rgba(255,255,255,0.12)' : undefined } }, plan.nombre)
                ),
              ),
            ),
            h('tbody', null,
              ...formasPago.map((fp, ri) =>
                h('tr', { key: fp, style: { background: ri % 2 === 0 ? '#f8f9fc' : '#ffffff', borderBottom: '1px solid #e8eaf0' } },
                  h('td', { style: { padding: '5px 10px', fontWeight: 600, color: '#374151', fontSize: '10px' } }, fp),
                  ...plans.slice(0, 3).map((plan, ci) => {
                    const t = plan.totals[fp];
                    const isBestCol = ci === bestIdx;
                    return h('td', { key: ci, style: { padding: '5px 10px', fontSize: '10px', fontWeight: isBestCol ? 700 : 400, color: isBestCol ? accentColor : '#1a1d2e', background: isBestCol ? accentColor + '12' : 'transparent' } },
                      t ? h('div', null,
                        h('div', null, fmtMoney(t.total)),
                        t.num_recibos > 1 && h('div', { style: { fontSize: '8px', color: '#9ca3af', marginTop: '1px' } }, `1er pago: ${fmtMoney(t.primer_pago)} + ${t.num_recibos - 1} x ${fmtMoney(t.pagos_sub)}`),
                      ) : '-'
                    );
                  }),
                )
              ),
            ),
          ),
        ),

        // Two-column glossary + recommendation
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' } },
          // Glossary
          h('div', null,
            h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, 'Glosario'),
            ...[
              ['Suma Asegurada', 'Monto maximo que cubre la aseguradora por evento o anualidad.'],
              ['Deducible', 'Cantidad a cargo del asegurado antes de activar la cobertura.'],
              ['Coaseguro', 'Porcentaje del gasto a cargo del asegurado tras cubrir el deducible.'],
              ['Tope Coaseguro', 'Limite maximo del coaseguro por evento.'],
              ['Prima', 'Costo total del seguro incluyendo IVA.'],
              ['Nivel hospitalario', 'Categoria de hospitales incluidos en la red medica.'],
            ].map(([term, def]) =>
              h('div', { key: term, style: { marginBottom: '6px', display: 'flex', gap: '6px' } },
                h('span', { style: { fontSize: '9px', fontWeight: 700, color: '#374151', minWidth: '90px', flexShrink: 0 } }, term + ':'),
                h('span', { style: { fontSize: '9px', color: '#6b7280', lineHeight: 1.4 } }, def),
              )
            ),
          ),
          // Recommendation box
          h('div', null,
            h('div', { style: { fontSize: '9px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', borderBottom: `2px solid ${accentColor}`, paddingBottom: '3px' } }, 'Nuestra recomendacion'),
            h('div', { style: { background: accentColor + '10', border: `1px solid ${accentColor}30`, borderRadius: '8px', padding: '12px', borderLeft: `4px solid ${accentColor}` } },
              h('div', { style: { fontSize: '12px', fontWeight: 700, color: '#1a1d2e', marginBottom: '6px' } }, best.nombre),
              h('div', { style: { fontSize: '9px', color: '#374151', lineHeight: 1.6 } },
                `Recomendamos ${best.nombre} (${best.aseguradora}) por ofrecer la mejor relacion precio-cobertura para ${clientName}. ` +
                `Con una suma asegurada de ${fmtMoney(best.suma_asegurada)}, deducible de ${fmtMoney(best.deducible)} y coaseguro de ${formatPercent(best.coaseguro)}, ` +
                `la prima anual es de ${fmtMoney(best.prima_anual)} con IVA incluido.`
              ),
              h('div', { style: { marginTop: '10px', display: 'flex', gap: '8px' } },
                ...(['Anual', 'Mensual'] as FormaPago[]).filter(fp => best.totals[fp]).map(fp => {
                  const t = best.totals[fp]!;
                  return h('div', { key: fp, style: { background: '#ffffff', border: `1px solid ${accentColor}30`, borderRadius: '6px', padding: '6px 10px', textAlign: 'center' } },
                    h('div', { style: { fontSize: '8px', color: '#6b7280' } }, fp),
                    h('div', { style: { fontSize: '12px', fontWeight: 700, color: accentColor } }, fmtMoney(t.total)),
                  );
                }),
              ),
            ),
          ),
        ),

        // Advisor card
        h('div', { style: { background: '#1a1d2e', borderRadius: '12px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
            // Avatar
            h('div', { style: { width: '44px', height: '44px', borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0 } },
              agentName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'A'
            ),
            h('div', null,
              h('div', { style: { fontSize: '14px', fontWeight: 700, color: '#ffffff' } }, agentName || 'Tu asesor'),
              agentEmail && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.60)', marginTop: '2px' } }, agentEmail),
              agentPhone && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.60)', marginTop: '1px' } }, agentPhone),
            ),
          ),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            agentWeb && h('div', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.50)', marginRight: '8px' } }, agentWeb),
            h('div', { style: { background: accentColor, color: '#ffffff', fontSize: '11px', fontWeight: 700, padding: '10px 20px', borderRadius: '8px', letterSpacing: '0.02em' } }, 'Solicitar poliza'),
          ),
        ),
      ),

      // Footer p2
      h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, background: '#f4f6fb', borderTop: '1px solid #e2e6f0', padding: '7px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('div', { style: { fontSize: '8px', color: '#9ca3af' } }, 'Cotizacion valida 15 dias naturales. Aceptacion sujeta a politicas de suscripcion. Documento ilustrativo, no contractual.'),
        h('div', { style: { fontSize: '8px', color: '#6b7280', fontWeight: 600 } }, 'Pagina 2 / 2'),
      ),
    ),
  );
}

// ─── html2canvas → jsPDF ─────────────────────────────────────────────────────

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

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateMultiGmmPdf(
  results: OptionResult[],
  people: QuotePerson[],
  clientName: string,
  usuario: any,
  optionDefs?: MultiGmmOption[],
  _logoUrl?: string,
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

  const plans = results.map(r => extractPlan(r));
  const scores = plans.map(p => scoreOption(p, plans));
  const bestIdx = scores.reduce((bi, s, i) => s > scores[bi] ? i : bi, 0);

  const accentColor = usuario?.oficina?.accent_color ?? '#1B4FD8';
  const agentName  = usuario?.nombre_completo ?? usuario?.nombre ?? '';
  const agentEmail = usuario?.email ?? '';
  const agentPhone = usuario?.telefono ?? usuario?.phone ?? '';
  const agentWeb   = usuario?.oficina?.website ?? usuario?.oficina?.nombre ?? '';
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // Mount component off-screen
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
          accentColor,
          logoUrl: null,
          people,
          plans,
          results,
          bestIdx,
        })
      )
    );
    // Allow React to flush
    setTimeout(resolve, 200);
  });

  const page1El = container.querySelector('#gmm-page-1') as HTMLElement | null;
  const page2El = container.querySelector('#gmm-page-2') as HTMLElement | null;

  if (!page1El || !page2El) {
    root.unmount();
    document.body.removeChild(container);
    throw new Error('PDF template elements not found');
  }

  const [canvas1, canvas2] = await Promise.all([
    captureElement(page1El),
    captureElement(page2El),
  ]);

  root.unmount();
  document.body.removeChild(container);

  // Letter: 8.5" × 11" = 215.9mm × 279.4mm
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW = 215.9;
  const PH = 279.4;

  const addCanvasToPage = (canvas: HTMLCanvasElement) => {
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const aspect  = canvas.width / canvas.height;
    const imgH    = PW / aspect;
    const yOffset = imgH < PH ? (PH - imgH) / 2 : 0;
    doc.addImage(imgData, 'JPEG', 0, yOffset, PW, Math.min(imgH, PH));
  };

  addCanvasToPage(canvas1);
  doc.addPage();
  addCanvasToPage(canvas2);

  return doc.output('blob');
}
