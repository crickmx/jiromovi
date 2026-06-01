import type {
  StructuredResponse,
  ResponseType,
  DashboardSummaryResponse,
  PerformanceSummaryResponse,
  CommissionExplainResponse,
  CommissionAnomalyResponse,
  PriorityListResponse,
  OutreachPlanResponse,
  CrossSellResponse,
  RenewalsForecastResponse,
  MessageGeneratorResponse,
  TramiteStatusResponse,
  TeamInsightsResponse,
  NavigationHelpResponse,
  TextResponse,
} from './assistantTypes';

export function parseStructuredResponse(data: any): StructuredResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const type = data.type as ResponseType;

  if (!type) {
    console.warn('Response missing type, attempting to extract text');
    const text = data.text || data.message || data.contenido || '';
    return {
      type: 'text',
      text: text || 'Respuesta recibida.',
      actions: parseActions(data.actions),
    };
  }

  let parsedResponse: StructuredResponse | null = null;

  switch (type) {
    case 'dashboard_summary':
      parsedResponse = parseDashboardSummary(data);
      break;
    case 'performance_summary':
      parsedResponse = parsePerformanceSummary(data);
      break;
    case 'commission_explain':
      parsedResponse = parseCommissionExplain(data);
      break;
    case 'commission_anomaly':
      parsedResponse = parseCommissionAnomaly(data);
      break;
    case 'priority_list':
      parsedResponse = parsePriorityList(data);
      break;
    case 'outreach_plan':
      parsedResponse = parseOutreachPlan(data);
      break;
    case 'cross_sell':
      parsedResponse = parseCrossSell(data);
      break;
    case 'renewals_forecast':
      parsedResponse = parseRenewalsForecast(data);
      break;
    case 'message_generator':
      parsedResponse = parseMessageGenerator(data);
      break;
    case 'tramite_status':
      parsedResponse = parseTramiteStatus(data);
      break;
    case 'team_insights':
      parsedResponse = parseTeamInsights(data);
      break;
    case 'navigation_help':
      parsedResponse = parseNavigationHelp(data);
      break;
    case 'text':
      parsedResponse = parseTextResponse(data);
      break;
    default:
      console.warn('Unknown response type, falling back to text:', type);
      return {
        type: 'text',
        text: data.text || data.message || data.contenido || 'Respuesta recibida.',
        actions: parseActions(data.actions),
      };
  }

  // If parsing failed, fall back to text
  if (!parsedResponse) {
    console.warn(`Failed to parse ${type} response, falling back to text`);
    return {
      type: 'text',
      text: data.text || data.message || data.contenido || `Error al procesar respuesta de tipo ${type}`,
      actions: parseActions(data.actions),
    };
  }

  return parsedResponse;
}

function parseDashboardSummary(data: any): DashboardSummaryResponse | null {
  if (!Array.isArray(data.kpis)) return null;

  return {
    type: 'dashboard_summary',
    kpis: data.kpis.map((kpi: any) => ({
      icon: kpi.icon || 'Activity',
      value: kpi.value || 0,
      label: kpi.label || '',
      trend: kpi.trend
        ? {
            value: kpi.trend.value || '0%',
            direction: kpi.trend.direction || 'neutral',
          }
        : undefined,
    })),
    actions: parseActions(data.actions),
  };
}

function parsePerformanceSummary(data: any): PerformanceSummaryResponse | null {
  return {
    type: 'performance_summary',
    chart: data.chart
      ? {
          type: data.chart.type || 'line',
          data: data.chart.data || [],
          labels: data.chart.labels,
        }
      : undefined,
    table: data.table
      ? {
          headers: data.table.headers || [],
          rows: data.table.rows || [],
        }
      : undefined,
    insights: data.insights || '',
    actions: parseActions(data.actions),
  };
}

function parseCommissionExplain(data: any): CommissionExplainResponse | null {
  if (!data.table || !Array.isArray(data.table.headers)) return null;

  return {
    type: 'commission_explain',
    table: {
      headers: data.table.headers,
      rows: data.table.rows || [],
    },
    explanation: data.explanation || '',
    actions: parseActions(data.actions),
  };
}

function parseCommissionAnomaly(data: any): CommissionAnomalyResponse | null {
  if (!Array.isArray(data.anomalies)) return null;

  return {
    type: 'commission_anomaly',
    anomalies: data.anomalies.map((anomaly: any) => ({
      commission_id: anomaly.commission_id || '',
      amount: anomaly.amount || 0,
      deviation: anomaly.deviation || 0,
      reason: anomaly.reason || '',
    })),
    actions: parseActions(data.actions),
  };
}

function parsePriorityList(data: any): PriorityListResponse | null {
  if (!Array.isArray(data.items)) return null;

  return {
    type: 'priority_list',
    items: data.items.map((item: any) => ({
      title: item.title || '',
      description: item.description || '',
      priority: item.priority || 'media',
      action: item.action
        ? {
            type: item.action.type,
            label: item.action.label,
            destination: item.action.destination,
            icon: item.action.icon,
          }
        : undefined,
    })),
  };
}

function parseOutreachPlan(data: any): OutreachPlanResponse | null {
  if (!Array.isArray(data.clients)) return null;

  return {
    type: 'outreach_plan',
    clients: data.clients.map((client: any) => ({
      name: client.name || '',
      reason: client.reason || '',
      suggested_product: client.suggested_product,
      last_contact: client.last_contact,
      action: client.action
        ? {
            type: client.action.type,
            label: client.action.label,
            destination: client.action.destination,
            icon: client.action.icon,
          }
        : undefined,
    })),
  };
}

function parseCrossSell(data: any): CrossSellResponse | null {
  if (!Array.isArray(data.opportunities)) return null;

  return {
    type: 'cross_sell',
    opportunities: data.opportunities.map((opp: any) => ({
      client: opp.client || '',
      current_products: opp.current_products || [],
      suggested_products: opp.suggested_products || [],
      score: opp.score || 0,
      reason: opp.reason || '',
    })),
    actions: parseActions(data.actions),
  };
}

function parseRenewalsForecast(data: any): RenewalsForecastResponse | null {
  if (!Array.isArray(data.renewals)) return null;

  return {
    type: 'renewals_forecast',
    renewals: data.renewals.map((renewal: any) => ({
      client: renewal.client || '',
      policy: renewal.policy || '',
      expiry_date: renewal.expiry_date || '',
      premium: renewal.premium || 0,
      action: renewal.action
        ? {
            type: renewal.action.type,
            label: renewal.action.label,
            destination: renewal.action.destination,
            icon: renewal.action.icon,
          }
        : undefined,
    })),
    actions: parseActions(data.actions),
  };
}

function parseMessageGenerator(data: any): MessageGeneratorResponse | null {
  if (!data.message) return null;

  return {
    type: 'message_generator',
    message: data.message,
    variables: data.variables || {},
    actions: parseActions(data.actions),
  };
}

function parseTramiteStatus(data: any): TramiteStatusResponse | null {
  if (!Array.isArray(data.timeline)) return null;

  return {
    type: 'tramite_status',
    timeline: data.timeline.map((step: any) => ({
      step: step.step || '',
      status: step.status || 'pending',
      date: step.date,
    })),
    next_step: data.next_step || '',
    actions: parseActions(data.actions),
  };
}

function parseTeamInsights(data: any): TeamInsightsResponse | null {
  if (!data.table || !Array.isArray(data.table.headers)) return null;

  return {
    type: 'team_insights',
    table: {
      headers: data.table.headers,
      rows: data.table.rows || [],
    },
    chart: data.chart
      ? {
          type: data.chart.type || 'bar',
          data: data.chart.data || [],
          labels: data.chart.labels,
        }
      : undefined,
    actions: parseActions(data.actions),
  };
}

function parseNavigationHelp(data: any): NavigationHelpResponse | null {
  if (!Array.isArray(data.categories)) return null;

  return {
    type: 'navigation_help',
    categories: data.categories.map((cat: any) => ({
      name: cat.name || '',
      actions: parseActions(cat.actions),
    })),
  };
}

function parseTextResponse(data: any): TextResponse {
  return {
    type: 'text',
    text: data.text || data.message || '',
    actions: parseActions(data.actions),
  };
}

function parseActions(actions: any): any[] {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter((action: any) => action && action.type && action.label)
    .map((action: any) => ({
      type: action.type,
      label: action.label,
      destination: action.destination || '',
      icon: action.icon,
    }));
}

export function isStructuredResponse(response: string): boolean {
  try {
    const parsed = JSON.parse(response);
    return parsed && typeof parsed === 'object' && 'type' in parsed;
  } catch {
    return false;
  }
}

export function extractTextFromResponse(response: StructuredResponse): string {
  switch (response.type) {
    case 'dashboard_summary':
      return `Resumen con ${response.kpis.length} KPIs`;
    case 'performance_summary':
      return response.insights;
    case 'commission_explain':
      return response.explanation;
    case 'commission_anomaly':
      return `Se detectaron ${response.anomalies.length} comisiones atípicas`;
    case 'priority_list':
      return `${response.items.length} prioridades identificadas`;
    case 'outreach_plan':
      return `${response.clients.length} clientes para contactar`;
    case 'cross_sell':
      return `${response.opportunities.length} oportunidades de venta cruzada`;
    case 'renewals_forecast':
      return `${response.renewals.length} renovaciones próximas`;
    case 'message_generator':
      return response.message;
    case 'tramite_status':
      return `Siguiente paso: ${response.next_step}`;
    case 'team_insights':
      return `Análisis del equipo`;
    case 'navigation_help':
      return `Navegación organizada en ${response.categories.length} categorías`;
    case 'text':
      return response.text;
    default:
      return '';
  }
}

export function hasActions(response: StructuredResponse): boolean {  switch (response.type) {
    case 'dashboard_summary':
    case 'performance_summary':
    case 'commission_explain':
    case 'commission_anomaly':
    case 'cross_sell':
    case 'renewals_forecast':
    case 'message_generator':
    case 'tramite_status':
    case 'team_insights':
      return response.actions && response.actions.length > 0;
    case 'priority_list':
      return response.items.some((item) => item.action);
    case 'outreach_plan':
      return response.clients.some((client) => client.action);
    case 'navigation_help':
      return response.categories.some((cat) => cat.actions.length > 0);
    case 'text':
      return response.actions ? response.actions.length > 0 : false;
    default:
      return false;
  }
}

// ── Internal prompt detection ─────────────────────────────────────────────────
const INTERNAL_PROMPT_MARKERS = [
  'Eres Chava',
  'Genera un análisis JSON',
  'Responde SOLO con el JSON',
  'CTAs válidos',
  'formato EXACTO',
  'sin markdown, solo JSON',
  'solo JSON',
  'sin markdown',
  'formato JSON',
  'Eres un asistente virtual',
  'Eres el asistente',
  'system prompt',
  'You are Chava',
  'You are an assistant',
];

export function isInternalPrompt(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return INTERNAL_PROMPT_MARKERS.some(marker => lower.includes(marker.toLowerCase()));
}

export function isRawJson(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'));
}

/**
 * Normalizes any Chava AI response before rendering to the user.
 * - Blocks internal prompts from being shown
 * - Parses and validates structured JSON responses
 * - Returns safe displayable text or a structured response object
 */
export function normalizeChavaResponse(
  contenido: string,
  respuestaEstructurada?: any
): { safe: true; text: string; structured?: any } | { safe: false; error: string } {
  // Block internal prompts
  if (isInternalPrompt(contenido)) {
    console.error('[Chava] Internal prompt leaked to UI. Blocking display.');
    return {
      safe: false,
      error: 'Tuve un problema al preparar la respuesta. Ya lo registré para revisión. Intenta nuevamente.',
    };
  }

  // If there's a structured response, try to parse and validate it
  if (respuestaEstructurada) {
    try {
      const parsed = typeof respuestaEstructurada === 'string'
        ? JSON.parse(respuestaEstructurada)
        : respuestaEstructurada;
      // Validate it has a type field (our known schema)
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return { safe: true, text: contenido || '', structured: parsed };
      }
    } catch {
      // Malformed JSON in structured field — ignore, fall through to text
    }
  }

  // If the contenido itself is raw JSON that looks like an internal schema, parse it visually
  if (isRawJson(contenido)) {
    try {
      const parsed = JSON.parse(contenido);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return { safe: true, text: '', structured: parsed };
      }
      // It's JSON but not a known structured response — block it
      console.warn('[Chava] Raw JSON in contenido without type field. Blocking display.');
      return {
        safe: false,
        error: 'Tuve un problema al preparar la respuesta. Ya lo registré para revisión. Intenta nuevamente.',
      };
    } catch {
      // Not valid JSON, treat as text
    }
  }

  return { safe: true, text: contenido || '' };
}

