export interface TopKPI {
  nombre: string | null;
  prima: number;
  oficina_id?: string;
  vend_id?: string;
}

export interface DashboardKPIs {
  polizas_emitidas: number;
  fianzas_emitidas: number;
  total_emitidos: number;
  prima_neta_emitida: number;
  prima_total_emitida: number;
  clientes_emision: number;
  ticket_promedio: number;
  documentos_vigentes: number;
  prima_vigente: number;
  clientes_vigentes: number;
  renovaciones_pendientes: number;
  prima_por_renovar: number;
  renovaciones_7dias: number;
  renovaciones_15dias: number;
  renovaciones_30dias: number;
  cancelaciones_periodo: number;
  prima_mes_anterior: number;
  prima_mismo_mes_ant: number;
  variacion_mes_anterior: number;
  variacion_interanual: number;
  acumulado_ytd: number;
  acumulado_ytd_anterior: number;
  crecimiento_ytd: number;
  top_cliente: TopKPI;
  top_aseguradora: TopKPI;
  top_ramo: TopKPI;
  top_oficina: TopKPI;
  top_vendedor: TopKPI;
  concentracion_top5_clientes: number;
  concentracion_top3_aseguradoras: number;
  scope: string;
  last_sync: string | null;
}

export interface ChartDataMonth {
  mes: string;
  anio: number;
  mes_num: number;
  emisiones: number;
  prima_neta: number;
  prima_total: number;
  polizas: number;
  fianzas: number;
}

export interface ChartDataDimension {
  nombre: string;
  cantidad: number;
  prima: number;
  ramo?: string;
  oficina_id?: string;
  vend_id?: string;
}

export interface ChartDataRenovaciones {
  periodo: string;
  cantidad: number;
  prima: number;
}

export interface DashboardCharts {
  prima_por_mes: ChartDataMonth[];
  por_aseguradora: ChartDataDimension[];
  por_ramo: ChartDataDimension[];
  por_subramo: ChartDataDimension[];
  por_cliente: ChartDataDimension[];
  por_oficina: ChartDataDimension[];
  por_vendedor: ChartDataDimension[];
  renovaciones_horizonte: ChartDataRenovaciones[];
}

export interface TopItem {
  nombre: string;
  documentos: number;
  prima_neta: number;
  prima_total: number;
  clientes?: number;
  aseguradoras?: number;
  ramos?: number;
  vendedores?: number;
  proxima_renovacion?: string;
  ramo?: string;
  oficina_id?: string;
  vend_id?: string;
}

export interface SicasDocRow {
  id: string;
  id_docto: string;
  poliza: string | null;
  cliente: string | null;
  compania: string | null;
  aseguradora_nombre: string | null;
  ramo: string | null;
  subramo: string | null;
  tipo_documento: string | null;
  subtipo_documento: string | null;
  status_texto: string | null;
  status_codigo: string | null;
  status_cobro: string | null;
  fecha_captura: string | null;
  fecha_emision: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number;
  prima_total: number;
  importe: number;
  derechos: number | null;
  impuestos: number | null;
  recargos: number | null;
  moneda: string | null;
  vend_nombre: string | null;
  vend_id: string | null;
  desp_nombre: string | null;
  desp_id: string | null;
  usuario_id: string | null;
  oficina_id: string | null;
  oficina_nombre: string | null;
  is_poliza: boolean;
  is_fianza: boolean;
  is_vigente: boolean;
  is_cancelada: boolean;
  is_renewable: boolean;
  renewal_days_remaining: number | null;
  agente_nombre: string | null;
  sicas_id_agente: string | null;
  synced_at: string | null;
  raw_data: Record<string, unknown> | null;
}

export type DashboardTab =
  | 'resumen'
  | 'produccion'
  | 'renovaciones'
  | 'clientes'
  | 'aseguradoras'
  | 'ramos'
  | 'documentos'
  | 'comparativos'
  | 'sincronizacion';

export interface DashboardScope {
  scope: 'admin' | 'office' | 'self';
  rol: string;
  oficina_id: string | null;
}

export interface GlobalFilters {
  periodo: string;
  fechaDesde: string;
  fechaHasta: string;
  usuario: string;
  oficina: string;
  vendedor: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  subramo: string;
  tipo: string;
  status: string;
  moneda: string;
  search: string;
}

function currentMonthRange(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    desde: `${y}-${m}-01`,
    hasta: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

const { desde: _defaultDesde, hasta: _defaultHasta } = currentMonthRange();

export const DEFAULT_FILTERS: GlobalFilters = {
  periodo: 'este_mes',
  fechaDesde: _defaultDesde,
  fechaHasta: _defaultHasta,
  usuario: '',
  oficina: '',
  vendedor: '',
  cliente: '',
  aseguradora: '',
  ramo: '',
  subramo: '',
  tipo: '',
  status: '',
  moneda: '',
  search: '',
};

export type DashboardDimension = 'cliente' | 'aseguradora' | 'ramo' | 'subramo' | 'oficina' | 'vendedor';

export interface OficinaOption {
  id: string;
  nombre: string;
  documentos: number;
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function monthLabel(mes: string): string {
  const [y, m] = mes.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function daysUntilRenewal(vigenciaHasta: string | null): number | null {
  if (!vigenciaHasta) return null;
  const hasta = new Date(vigenciaHasta);
  const now = new Date();
  return Math.ceil((hasta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function renewalUrgencyColor(days: number | null): string {
  if (days === null) return 'text-gray-400';
  if (days <= 0) return 'text-red-600 dark:text-red-400';
  if (days <= 7) return 'text-red-500 dark:text-red-400';
  if (days <= 15) return 'text-orange-500 dark:text-orange-400';
  if (days <= 30) return 'text-amber-500 dark:text-amber-400';
  return 'text-blue-500 dark:text-blue-400';
}

export function renewalUrgencyBg(days: number | null): string {
  if (days === null) return 'bg-gray-50 dark:bg-gray-800';
  if (days <= 0) return 'bg-red-50 dark:bg-red-900/20';
  if (days <= 7) return 'bg-red-50 dark:bg-red-900/20';
  if (days <= 15) return 'bg-orange-50 dark:bg-orange-900/20';
  if (days <= 30) return 'bg-amber-50 dark:bg-amber-900/20';
  return 'bg-blue-50 dark:bg-blue-900/20';
}

export interface PeriodMetrics {
  prima_neta: number;
  prima_total: number;
  polizas: number;
  fianzas: number;
  total_docs: number;
  clientes: number;
  fecha_desde: string;
  fecha_hasta: string;
}

export interface YTDMetrics {
  prima_neta: number;
  polizas: number;
  total_docs: number;
  fecha_desde: string;
  fecha_hasta: string;
}

export interface GoalMetrics {
  prima_neta: number;
  polizas: number;
  total_docs: number;
}

export interface GrowthMetrics {
  prima_vs_anterior: number;
  polizas_vs_anterior: number;
  prima_delta: number;
  polizas_delta: number;
  avance_meta_prima_pct: number;
  avance_meta_polizas_pct: number;
  falta_prima: number;
  falta_polizas: number;
  ytd_prima_vs_anterior: number;
  ytd_polizas_vs_anterior: number;
  avance_meta_anual_prima_pct: number;
  avance_meta_anual_polizas_pct: number;
}

export interface AvanceComercialData {
  periodo_actual: PeriodMetrics;
  periodo_anterior: PeriodMetrics;
  ytd_actual: YTDMetrics;
  ytd_anterior: YTDMetrics;
  anual_anterior_completo: YTDMetrics;
  meta_anual: GoalMetrics;
  meta_mensual: { prima_neta: number; polizas: number };
  crecimiento: GrowthMetrics;
  scope: string;
  dia_del_mes: number;
  mes_actual: number;
}
