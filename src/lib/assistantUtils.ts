import type { ModuleName, ActionType, IntentCode } from './assistantTypes';

export function detectModuleFromRoute(pathname: string): ModuleName {
  if (pathname.startsWith('/mis-comisiones') || pathname.startsWith('/comisiones')) {
    return 'comisiones';
  }
  if (pathname.startsWith('/mi-produccion') || pathname.startsWith('/produccion')) {
    return 'produccion';
  }
  if (pathname.startsWith('/mi-crm') || pathname.startsWith('/crm')) {
    return 'crm';
  }
  if (pathname.startsWith('/tramites')) {
    return 'tramites';
  }
  if (pathname.startsWith('/centro-notificaciones') || pathname.startsWith('/notificaciones')) {
    return 'notificaciones';
  }
  if (pathname.startsWith('/seguros-education') || pathname.startsWith('/aula')) {
    return 'education';
  }
  if (pathname === '/dashboard' || pathname === '/') {
    return 'dashboard';
  }
  return 'general';
}

export function extractRouteParams(pathname: string): Record<string, string> {
  const params: Record<string, string> = {};

  const idMatch = pathname.match(/\/([a-f0-9-]{36})(?:\/|$)/);
  if (idMatch) {
    params.id = idMatch[1];
  }

  return params;
}

export function matchRoutePattern(pathname: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const patternRegex = pattern
    .replace(/:[^/]+/g, '[^/]+')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${patternRegex}$`);
  return regex.test(pathname);
}

export function getModuleDisplayName(modulo: ModuleName): string {
  const names: Record<ModuleName, string> = {
    dashboard: 'Dashboard',
    comisiones: 'Comisiones',
    produccion: 'Producción',
    crm: 'CRM',
    tramites: 'Trámites',
    notificaciones: 'Notificaciones',
    education: 'Academia',
    general: 'General',
  };
  return names[modulo] || 'General';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-MX').format(num);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getPriorityColor(priority: 'alta' | 'media' | 'baja'): string {
  const colors = {
    alta: 'text-red-600 bg-red-50 border-red-200',
    media: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    baja: 'text-blue-600 bg-blue-50 border-blue-200',
  };
  return colors[priority];
}

export function getTrendIcon(direction: 'up' | 'down' | 'neutral'): string {
  const icons = {
    up: 'TrendingUp',
    down: 'TrendingDown',
    neutral: 'Minus',
  };
  return icons[direction];
}

export function getTrendColor(direction: 'up' | 'down' | 'neutral'): string {
  const colors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };
  return colors[direction];
}

const keywordToIntentMap: Record<string, IntentCode> = {
  'resumen': 'dashboard_summary',
  'dashboard': 'dashboard_summary',
  'hoy': 'daily_priorities',
  'prioridades': 'daily_priorities',
  'pendientes': 'daily_priorities',
  'tareas': 'daily_priorities',
  'comision': 'commission_explain',
  'comisiones': 'commission_explain',
  'explica': 'commission_explain',
  'calculo': 'commission_explain',
  'anomalia': 'commission_anomaly_detect',
  'atipica': 'commission_anomaly_detect',
  'error': 'commission_anomaly_detect',
  'produccion': 'performance_summary',
  'desempeño': 'performance_summary',
  'tendencia': 'performance_summary',
  'ventas': 'performance_summary',
  'contactar': 'client_outreach_plan',
  'llamar': 'client_outreach_plan',
  'clientes': 'client_outreach_plan',
  'renovacion': 'renewals_forecast',
  'renovar': 'renewals_forecast',
  'vencer': 'renewals_forecast',
  'venta cruzada': 'cross_sell_opportunities',
  'vender': 'cross_sell_opportunities',
  'oportunidades': 'cross_sell_opportunities',
  'mensaje': 'message_generator',
  'whatsapp': 'message_generator',
  'email': 'message_generator',
  'tramite': 'tramite_status_helper',
  'estado': 'tramite_status_helper',
  'siguiente paso': 'tramite_status_helper',
  'equipo': 'team_insights_manager',
  'agentes': 'team_insights_manager',
  'comparar': 'team_insights_manager',
  'navegar': 'navigation_help',
  'como': 'navigation_help',
  'donde': 'navigation_help',
};

export function detectIntentFromKeywords(
  mensaje: string,
  modulo: ModuleName
): IntentCode | null {
  const mensajeNormalizado = mensaje.toLowerCase();

  for (const [keyword, intent] of Object.entries(keywordToIntentMap)) {
    if (mensajeNormalizado.includes(keyword)) {
      return intent;
    }
  }

  if (modulo === 'comisiones') {
    if (mensajeNormalizado.includes('explica') || mensajeNormalizado.includes('por que')) {
      return 'commission_explain';
    }
  }

  if (modulo === 'crm') {
    if (mensajeNormalizado.includes('contacto') || mensajeNormalizado.includes('cliente')) {
      return 'client_outreach_plan';
    }
  }

  if (modulo === 'tramites') {
    return 'tramite_status_helper';
  }

  return null;
}

export function compressSnapshot(data: any): any {
  const compressed = JSON.parse(JSON.stringify(data));

  function removeNulls(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(removeNulls);
    }
    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
          result[key] = removeNulls(value);
        }
      }
      return result;
    }
    return obj;
  }

  const cleaned = removeNulls(compressed);

  const jsonString = JSON.stringify(cleaned);
  if (jsonString.length > 30000) {
    console.warn('Snapshot muy grande, aplicando compresión adicional');
  }

  return cleaned;
}

export function isSnapshotExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function generateSnapshotTTL(minutes: number = 5): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now.toISOString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function parseStructuredResponseSafely(json: any): any {
  try {
    if (typeof json === 'string') {
      return JSON.parse(json);
    }
    return json;
  } catch (error) {
    console.error('Error parsing structured response:', error);
    return null;
  }
}

export function validateActionType(type: string): type is ActionType {
  const validTypes: ActionType[] = [
    'navigate',
    'navigate-with-id',
    'copy',
    'execute-intent',
    'dismiss',
    'download',
    'external',
  ];
  return validTypes.includes(type as ActionType);
}

export function generateConversationTitle(firstMessage: string, modulo: ModuleName): string {
  const truncated = truncateText(firstMessage, 50);
  const moduleName = getModuleDisplayName(modulo);
  return truncated || `Conversación en ${moduleName}`;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

export function shouldUseCache(lastFetchTime: number | null, ttlMinutes: number = 5): boolean {
  if (!lastFetchTime) return false;
  const now = Date.now();
  const diffMs = now - lastFetchTime;
  const diffMinutes = diffMs / 60000;
  return diffMinutes < ttlMinutes;
}
