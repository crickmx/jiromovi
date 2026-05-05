import { supabase } from './supabase';

export type ActivityModule =
  | 'auth' | 'profile' | 'production' | 'publicidad'
  | 'education' | 'crm' | 'tramites' | 'system'
  | 'documents' | 'store' | 'comunicados' | 'dashboard'
  | 'assistant' | 'centro_digital' | 'comisiones';

export type ActivityEventType =
  | 'auth' | 'profile' | 'production' | 'publicity'
  | 'education' | 'crm' | 'tramites' | 'system' | 'navigation';

interface LogActivityParams {
  module: ActivityModule;
  eventType: ActivityEventType;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'error' | 'warning';
}

let currentUserId: string | null = null;

export function setActivityUserId(userId: string | null) {
  currentUserId = userId;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  if (!currentUserId) return;

  try {
    const metadata: Record<string, string> = {};
    if (typeof navigator !== 'undefined') {
      metadata.user_agent = navigator.userAgent;
      metadata.platform = navigator.platform;
      metadata.language = navigator.language;
    }

    await supabase.rpc('log_user_activity', {
      p_user_id: currentUserId,
      p_module: params.module,
      p_event_type: params.eventType,
      p_action: params.action,
      p_summary: params.summary,
      p_entity_type: params.entityType || null,
      p_entity_id: params.entityId || null,
      p_details: params.details || {},
      p_metadata: metadata,
      p_status: params.status || 'success',
    });
  } catch {
    // Silent fail - activity logging should never break the app
  }
}

// Convenience functions for common events
export const trackLogin = () => logActivity({
  module: 'auth', eventType: 'auth', action: 'login',
  summary: 'Inicio de sesion',
});

export const trackLogout = () => logActivity({
  module: 'auth', eventType: 'auth', action: 'logout',
  summary: 'Cerro sesion',
});

export const trackProfileUpdate = (field: string) => logActivity({
  module: 'profile', eventType: 'profile', action: 'profile_update',
  summary: `Actualizo ${field}`,
  details: { field },
});

export const trackPageView = (module: ActivityModule, pageName: string) => logActivity({
  module, eventType: 'navigation', action: 'page_view',
  summary: `Accedio a ${pageName}`,
});

export const trackCourseStart = (courseId: string, courseName: string) => logActivity({
  module: 'education', eventType: 'education', action: 'course_start',
  summary: `Inicio curso: ${courseName}`,
  entityType: 'course', entityId: courseId,
});

export const trackCourseComplete = (courseId: string, courseName: string) => logActivity({
  module: 'education', eventType: 'education', action: 'course_complete',
  summary: `Completo curso: ${courseName}`,
  entityType: 'course', entityId: courseId,
});

export const trackPublicityCreated = (name: string) => logActivity({
  module: 'publicidad', eventType: 'publicity', action: 'publicity_create',
  summary: `Creo publicidad: ${name}`,
});

export const trackTramiteAction = (action: string, tramiteId: string, summary: string) => logActivity({
  module: 'tramites', eventType: 'tramites', action,
  summary, entityType: 'tramite', entityId: tramiteId,
});

export const trackDocumentView = (docId: string, poliza: string) => logActivity({
  module: 'documents', eventType: 'production', action: 'document_view',
  summary: `Abrio documento poliza ${poliza}`,
  entityType: 'document', entityId: docId,
});

export const trackCrmAction = (action: string, entityType: string, entityId: string, summary: string) => logActivity({
  module: 'crm', eventType: 'crm', action,
  summary, entityType, entityId,
});
