import { supabase } from './supabase';
import type {
  CommissionAgent,
  CommissionBusinessRule,
  CommissionFiscalRegime,
  CommissionDetail,
  WeekSummary,
  BatchSummary,
  AgentSummary
} from './commissionTypes';

export async function loadAgents(): Promise<CommissionAgent[]> {
  const { data, error } = await supabase
    .from('commission_agents')
    .select(`
      *,
      office:office_id(*),
      fiscal_regime:fiscal_regime_id(*)
    `)
    .order('name');

  if (error) {
    console.error('Error loading agents:', error);
    return [];
  }

  return data || [];
}

export async function loadBusinessRules(): Promise<CommissionBusinessRule[]> {
  const { data, error } = await supabase
    .from('commission_business_rules')
    .select('*')
    .order('prioridad', { ascending: false });

  if (error) {
    console.error('Error loading business rules:', error);
    return [];
  }

  return data || [];
}

export async function loadFiscalRegimes(): Promise<CommissionFiscalRegime[]> {
  const { data, error } = await supabase
    .from('commission_fiscal_regimes')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading fiscal regimes:', error);
    return [];
  }

  return data || [];
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

export function groupByWeek(rows: any[], dateField: string): WeekSummary[] {
  const weeks = new Map<string, { dates: Date[], count: number }>();

  rows.forEach(row => {
    const date = new Date(row[dateField]);
    const monday = getMondayOfWeek(date);
    const sunday = getSundayOfWeek(date);
    const key = `${monday.toISOString().split('T')[0]}_${sunday.toISOString().split('T')[0]}`;

    if (!weeks.has(key)) {
      weeks.set(key, { dates: [monday, sunday], count: 0 });
    }

    const week = weeks.get(key)!;
    week.count++;
  });

  const weekSummaries: WeekSummary[] = [];
  weeks.forEach((value, key) => {
    const [monday, sunday] = value.dates;
    weekSummaries.push({
      weekNumber: getWeekNumber(monday),
      dateFrom: monday.toISOString().split('T')[0],
      dateTo: sunday.toISOString().split('T')[0],
      count: value.count,
      selected: false
    });
  });

  return weekSummaries.sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
}

export function findBusinessRule(
  rules: CommissionBusinessRule[],
  ramo: string,
  aseguradora: string,
  officeId: string | null
): CommissionBusinessRule | null {
  const matchingRules = rules.filter(rule => {
    const ramoMatch = rule.ramo.toLowerCase() === ramo.toLowerCase();
    const asegMatch = rule.aseguradora.toLowerCase() === aseguradora.toLowerCase();
    const officeMatch = !rule.office_id || rule.office_id === officeId;

    const now = new Date();
    const validFrom = new Date(rule.valid_from);
    const validTo = rule.valid_to ? new Date(rule.valid_to) : null;
    const dateValid = now >= validFrom && (!validTo || now <= validTo);

    return ramoMatch && asegMatch && officeMatch && dateValid;
  });

  if (matchingRules.length === 0) return null;

  return matchingRules.sort((a, b) => b.prioridad - a.prioridad)[0];
}

export function calculateCommissionBruta(
  primaBase: number,
  rule: CommissionBusinessRule
): number {
  switch (rule.tipo_calculo) {
    case '%_sobre_base':
      return primaBase * (rule.porcentaje || 0) / 100;

    case 'monto_fijo':
      return rule.monto_fijo || 0;

    case '%_con_min_max': {
      let commission = primaBase * (rule.porcentaje || 0) / 100;
      if (rule.minimo !== null && commission < rule.minimo) {
        commission = rule.minimo;
      }
      if (rule.maximo !== null && commission > rule.maximo) {
        commission = rule.maximo;
      }
      return commission;
    }

    default:
      return 0;
  }
}


export function calculateBatchSummary(details: CommissionDetail[]): BatchSummary {
  const summary: BatchSummary = {
    total_bruta: 0,
    total_impuestos: 0,
    total_neta: 0,
    total_polizas: details.length,
    by_ramo: {},
    by_aseguradora: {}
  };

  details.forEach(detail => {
    const bruta = detail.is_manual_adjusted && detail.adjusted_commission_bruta !== null
      ? detail.adjusted_commission_bruta
      : detail.commission_bruta;

    const neta = detail.is_manual_adjusted && detail.adjusted_commission_neta !== null
      ? detail.adjusted_commission_neta
      : detail.commission_neta;

    const impuestos = bruta - neta;

    summary.total_bruta += bruta;
    summary.total_neta += neta;
    summary.total_impuestos += impuestos;

    if (!summary.by_ramo[detail.ramo]) {
      summary.by_ramo[detail.ramo] = { bruta: 0, impuestos: 0, neta: 0, count: 0 };
    }
    summary.by_ramo[detail.ramo].bruta += bruta;
    summary.by_ramo[detail.ramo].impuestos += impuestos;
    summary.by_ramo[detail.ramo].neta += neta;
    summary.by_ramo[detail.ramo].count++;

    if (!summary.by_aseguradora[detail.aseguradora]) {
      summary.by_aseguradora[detail.aseguradora] = { bruta: 0, impuestos: 0, neta: 0, count: 0 };
    }
    summary.by_aseguradora[detail.aseguradora].bruta += bruta;
    summary.by_aseguradora[detail.aseguradora].impuestos += impuestos;
    summary.by_aseguradora[detail.aseguradora].neta += neta;
    summary.by_aseguradora[detail.aseguradora].count++;
  });

  return summary;
}

export function calculateAgentSummaries(details: CommissionDetail[]): AgentSummary[] {
  const agentMap = new Map<string, AgentSummary>();

  details.forEach(detail => {
    if (!detail.agent) return;

    const commission = detail.is_manual_adjusted
      ? (detail.adjusted_commission_neta || 0)
      : detail.commission_neta;

    if (!agentMap.has(detail.usuario_id)) {
      agentMap.set(detail.usuario_id, {
        agent_id: detail.usuario_id,
        agent_name: `${detail.agent.nombre || ''} ${detail.agent.apellidos || ''}`.trim(),
        agent_email: detail.agent.email_laboral,
        office_name: (detail.agent as any).oficina?.nombre || null,
        regime_name: detail.agent.regimen_fiscal?.name || null,
        total_commission: 0,
        total_polizas: 0
      });
    }

    const agentSummary = agentMap.get(detail.usuario_id)!;
    agentSummary.total_commission += commission;
    agentSummary.total_polizas++;
  });

  return Array.from(agentMap.values()).sort((a, b) => a.agent_name.localeCompare(b.agent_name));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
