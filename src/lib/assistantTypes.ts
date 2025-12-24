export type IntentCode =
  | 'dashboard_summary'
  | 'performance_summary'
  | 'commission_explain'
  | 'commission_anomaly_detect'
  | 'daily_priorities'
  | 'client_outreach_plan'
  | 'cross_sell_opportunities'
  | 'renewals_forecast'
  | 'message_generator'
  | 'tramite_status_helper'
  | 'team_insights_manager'
  | 'navigation_help';

export type ModuleName =
  | 'dashboard'
  | 'comisiones'
  | 'produccion'
  | 'crm'
  | 'tramites'
  | 'notificaciones'
  | 'education'
  | 'general';

export type ActionType =
  | 'navigate'
  | 'navigate-with-id'
  | 'copy'
  | 'execute-intent'
  | 'dismiss'
  | 'download'
  | 'external';

export type ResponseType =
  | 'dashboard_summary'
  | 'performance_summary'
  | 'commission_explain'
  | 'commission_anomaly'
  | 'priority_list'
  | 'outreach_plan'
  | 'cross_sell'
  | 'renewals_forecast'
  | 'message_generator'
  | 'tramite_status'
  | 'team_insights'
  | 'navigation_help'
  | 'text';

export type EventPriority = 'alta' | 'media' | 'baja';

export interface AssistantIntent {
  id: string;
  codigo: IntentCode;
  nombre: string;
  descripcion: string;
  categoria: string;
  prompt_template: string;
  requiere_snapshot: boolean;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface AssistantSnapshot {
  id: string;
  usuario_id: string;
  modulo: ModuleName;
  ruta: string;
  datos_json: SnapshotData;
  expires_at: string;
  created_at: string;
}

export interface SnapshotData {
  usuario: {
    id: string;
    nombre: string;
    rol: string;
    oficina_nombre?: string;
  };
  ruta: string;
  parametros: Record<string, string>;
  modulo: ModuleName;
  timestamp: string;
  datos_especificos?: any;
}

export interface AssistantSuggestion {
  id: string;
  intent_codigo: IntentCode | null;
  ruta_pattern: string;
  rol_requerido: string | null;
  orden: number;
  texto_pregunta: string;
  activo: boolean;
  created_at: string;
}

export interface AssistantEvent {
  id: string;
  usuario_id: string;
  tipo_evento: string;
  titulo: string;
  descripcion: string | null;
  datos_json: any;
  leido: boolean;
  prioridad: EventPriority;
  created_at: string;
}

export interface AssistantAction {
  id: string;
  intent_codigo: IntentCode;
  tipo_accion: ActionType;
  etiqueta: string;
  destino: string;
  icono: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface AssistantConversation {
  id: string;
  usuario_id: string;
  titulo: string;
  es_asistente: boolean;
  modulo_origen: ModuleName | null;
  intent_detectado: IntentCode | null;
  snapshot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessage {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  respuesta_estructurada_json: StructuredResponse | null;
  tiene_acciones: boolean;
  created_at: string;
}

export interface KPICard {
  icon: string;
  value: string | number;
  label: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  data: any;
  labels?: string[];
}

export interface ActionButton {
  type: ActionType;
  label: string;
  destination: string;
  icon?: string;
}

export interface PriorityItem {
  title: string;
  description: string;
  priority: EventPriority;
  action?: ActionButton;
}

export interface OutreachClient {
  name: string;
  reason: string;
  suggested_product?: string;
  last_contact?: string;
  action?: ActionButton;
}

export interface CrossSellOpportunity {
  client: string;
  current_products: string[];
  suggested_products: string[];
  score: number;
  reason: string;
}

export interface RenewalItem {
  client: string;
  policy: string;
  expiry_date: string;
  premium: number;
  action?: ActionButton;
}

export interface TimelineStep {
  step: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

export interface TeamInsightRow {
  agent: string;
  production: number;
  commissions: number;
  efficiency: number;
}

export interface NavigationCategory {
  name: string;
  actions: ActionButton[];
}

export type StructuredResponse =
  | DashboardSummaryResponse
  | PerformanceSummaryResponse
  | CommissionExplainResponse
  | CommissionAnomalyResponse
  | PriorityListResponse
  | OutreachPlanResponse
  | CrossSellResponse
  | RenewalsForecastResponse
  | MessageGeneratorResponse
  | TramiteStatusResponse
  | TeamInsightsResponse
  | NavigationHelpResponse
  | TextResponse;

export interface DashboardSummaryResponse {
  type: 'dashboard_summary';
  kpis: KPICard[];
  actions: ActionButton[];
}

export interface PerformanceSummaryResponse {
  type: 'performance_summary';
  chart?: ChartData;
  table?: TableData;
  insights: string;
  actions: ActionButton[];
}

export interface CommissionExplainResponse {
  type: 'commission_explain';
  table: TableData;
  explanation: string;
  actions: ActionButton[];
}

export interface CommissionAnomalyResponse {
  type: 'commission_anomaly';
  anomalies: Array<{
    commission_id: string;
    amount: number;
    deviation: number;
    reason: string;
  }>;
  actions: ActionButton[];
}

export interface PriorityListResponse {
  type: 'priority_list';
  items: PriorityItem[];
}

export interface OutreachPlanResponse {
  type: 'outreach_plan';
  clients: OutreachClient[];
}

export interface CrossSellResponse {
  type: 'cross_sell';
  opportunities: CrossSellOpportunity[];
  actions: ActionButton[];
}

export interface RenewalsForecastResponse {
  type: 'renewals_forecast';
  renewals: RenewalItem[];
  actions: ActionButton[];
}

export interface MessageGeneratorResponse {
  type: 'message_generator';
  message: string;
  variables: Record<string, string>;
  actions: ActionButton[];
}

export interface TramiteStatusResponse {
  type: 'tramite_status';
  timeline: TimelineStep[];
  next_step: string;
  actions: ActionButton[];
}

export interface TeamInsightsResponse {
  type: 'team_insights';
  table: TableData;
  chart?: ChartData;
  actions: ActionButton[];
}

export interface NavigationHelpResponse {
  type: 'navigation_help';
  categories: NavigationCategory[];
}

export interface TextResponse {
  type: 'text';
  text: string;
  actions?: ActionButton[];
}

export interface SendMessageRequest {
  conversacion_id: string;
  mensaje: string;
  modulo: ModuleName;
  ruta: string;
  parametros?: Record<string, string>;
}

export interface SendMessageResponse {
  conversacion_id: string;
  mensaje_id: string;
  respuesta: string;
  respuesta_estructurada: StructuredResponse | null;
  intent_detectado: IntentCode | null;
}

export interface GetSuggestionsRequest {
  ruta: string;
  rol?: string;
}

export interface GetSuggestionsResponse {
  suggestions: AssistantSuggestion[];
}

export interface GetEventsResponse {
  events: AssistantEvent[];
  unread_count: number;
}

export interface MarkEventsReadRequest {
  event_ids: string[];
}
