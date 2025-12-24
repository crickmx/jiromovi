import type { IntentCode, ModuleName } from './assistantTypes';
import { detectIntentFromKeywords } from './assistantUtils';

export interface IntentClassificationResult {
  intent: IntentCode | null;
  confidence: 'high' | 'medium' | 'low';
  method: 'explicit' | 'route-keyword' | 'keyword' | 'ai' | 'fallback';
}

export function classifyIntent(
  mensaje: string,
  modulo: ModuleName,
  pathname: string,
  explicitIntent?: IntentCode
): IntentClassificationResult {
  if (explicitIntent) {
    return {
      intent: explicitIntent,
      confidence: 'high',
      method: 'explicit',
    };
  }

  const routeKeywordIntent = classifyByRouteAndKeyword(mensaje, modulo, pathname);
  if (routeKeywordIntent) {
    return {
      intent: routeKeywordIntent,
      confidence: 'high',
      method: 'route-keyword',
    };
  }

  const keywordIntent = detectIntentFromKeywords(mensaje, modulo);
  if (keywordIntent) {
    return {
      intent: keywordIntent,
      confidence: 'medium',
      method: 'keyword',
    };
  }

  const fallbackIntent = getFallbackIntent(modulo);
  return {
    intent: fallbackIntent,
    confidence: 'low',
    method: 'fallback',
  };
}

function classifyByRouteAndKeyword(
  mensaje: string,
  modulo: ModuleName,
  pathname: string
): IntentCode | null {
  const mensajeNorm = mensaje.toLowerCase();

  if (modulo === 'comisiones') {
    if (pathname.includes('/mis-comisiones/') && pathname.split('/').length > 2) {
      if (
        mensajeNorm.includes('explica') ||
        mensajeNorm.includes('detalle') ||
        mensajeNorm.includes('como se calcula')
      ) {
        return 'commission_explain';
      }
    }

    if (mensajeNorm.includes('explica') || mensajeNorm.includes('calculo')) {
      return 'commission_explain';
    }

    if (mensajeNorm.includes('anomal') || mensajeNorm.includes('atipica') || mensajeNorm.includes('error')) {
      return 'commission_anomaly_detect';
    }
  }

  if (modulo === 'produccion') {
    if (
      mensajeNorm.includes('desempeño') ||
      mensajeNorm.includes('tendencia') ||
      mensajeNorm.includes('como voy')
    ) {
      return 'performance_summary';
    }

    if (mensajeNorm.includes('equipo') || mensajeNorm.includes('agentes') || mensajeNorm.includes('comparar')) {
      return 'team_insights_manager';
    }
  }

  if (modulo === 'crm') {
    if (pathname === '/mi-crm/contactos' || pathname.startsWith('/mi-crm/contactos/')) {
      if (mensajeNorm.includes('contactar') || mensajeNorm.includes('llamar') || mensajeNorm.includes('plan')) {
        return 'client_outreach_plan';
      }

      if (
        mensajeNorm.includes('renovar') ||
        mensajeNorm.includes('renovacion') ||
        mensajeNorm.includes('vencer')
      ) {
        return 'renewals_forecast';
      }

      if (
        mensajeNorm.includes('vender') ||
        mensajeNorm.includes('venta cruzada') ||
        mensajeNorm.includes('oportunidad')
      ) {
        return 'cross_sell_opportunities';
      }

      if (
        mensajeNorm.includes('mensaje') ||
        mensajeNorm.includes('whatsapp') ||
        mensajeNorm.includes('email')
      ) {
        return 'message_generator';
      }
    }

    if (pathname === '/mi-crm/tareas') {
      if (
        mensajeNorm.includes('prioridad') ||
        mensajeNorm.includes('pendiente') ||
        mensajeNorm.includes('hoy')
      ) {
        return 'daily_priorities';
      }
    }
  }

  if (modulo === 'tramites') {
    if (pathname.includes('/tramites/') && pathname.split('/').length > 2) {
      return 'tramite_status_helper';
    }
  }

  if (modulo === 'dashboard' || pathname === '/dashboard' || pathname === '/') {
    if (mensajeNorm.includes('resumen') || mensajeNorm.includes('general')) {
      return 'dashboard_summary';
    }

    if (mensajeNorm.includes('prioridad') || mensajeNorm.includes('hoy') || mensajeNorm.includes('primero')) {
      return 'daily_priorities';
    }
  }

  if (
    mensajeNorm.includes('navegar') ||
    mensajeNorm.includes('como') ||
    mensajeNorm.includes('donde') ||
    mensajeNorm.includes('ir a')
  ) {
    return 'navigation_help';
  }

  return null;
}

function getFallbackIntent(modulo: ModuleName): IntentCode | null {
  const fallbackMap: Record<ModuleName, IntentCode> = {
    dashboard: 'dashboard_summary',
    comisiones: 'commission_explain',
    produccion: 'performance_summary',
    crm: 'client_outreach_plan',
    tramites: 'tramite_status_helper',
    notificaciones: 'navigation_help',
    education: 'navigation_help',
    general: 'navigation_help',
  };

  return fallbackMap[modulo] || 'navigation_help';
}

export function shouldUseAIClassifier(result: IntentClassificationResult): boolean {
  return result.confidence === 'low' && result.method === 'fallback';
}

export function getIntentPromptTemplate(intentCode: IntentCode): string {
  const templates: Record<IntentCode, string> = {
    dashboard_summary:
      'Genera un resumen ejecutivo del dashboard con KPIs principales en formato JSON.',
    performance_summary:
      'Analiza el desempeño del agente con tendencias y comparaciones en formato JSON.',
    commission_explain:
      'Explica la comisión en detalle con tabla de conceptos en formato JSON.',
    commission_anomaly_detect:
      'Detecta comisiones atípicas y sus razones en formato JSON.',
    daily_priorities:
      'Crea una lista priorizada de tareas y acciones en formato JSON.',
    client_outreach_plan:
      'Identifica clientes prioritarios para contactar en formato JSON.',
    cross_sell_opportunities:
      'Sugiere oportunidades de venta cruzada en formato JSON.',
    renewals_forecast:
      'Lista pólizas próximas a renovar en formato JSON.',
    message_generator:
      'Genera un mensaje personalizado para el cliente en formato JSON.',
    tramite_status_helper:
      'Explica el estado del trámite y siguientes pasos en formato JSON.',
    team_insights_manager:
      'Compara el desempeño de los agentes del equipo en formato JSON.',
    navigation_help:
      'Muestra opciones de navegación organizadas por categoría en formato JSON.',
  };

  return templates[intentCode] || 'Responde la pregunta del usuario de manera útil.';
}

export function requiresSnapshot(intentCode: IntentCode): boolean {
  return intentCode !== 'navigation_help';
}

export function getIntentCategory(intentCode: IntentCode): string {
  const categories: Record<IntentCode, string> = {
    dashboard_summary: 'general',
    performance_summary: 'produccion',
    commission_explain: 'comisiones',
    commission_anomaly_detect: 'comisiones',
    daily_priorities: 'general',
    client_outreach_plan: 'crm',
    cross_sell_opportunities: 'crm',
    renewals_forecast: 'crm',
    message_generator: 'crm',
    tramite_status_helper: 'tramites',
    team_insights_manager: 'produccion',
    navigation_help: 'general',
  };

  return categories[intentCode] || 'general';
}
