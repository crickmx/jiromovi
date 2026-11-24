import { supabase } from './supabase';

// --- Module constants ---
export const MODULES = {
  AUTH: 'auth',
  PROFILE: 'profile',
  DASHBOARD: 'dashboard',
  PRODUCTION: 'production',
  DOCUMENTS: 'documents',
  PUBLICIDAD: 'publicidad',
  EDUCATION: 'education',
  CRM: 'crm',
  TRAMITES: 'tramites',
  SYSTEM: 'system',
  STORE: 'store',
  COMUNICADOS: 'comunicados',
  ASSISTANT: 'assistant',
  CENTRO_DIGITAL: 'centro_digital',
  COMISIONES: 'comisiones',
  CONFIGURACION: 'configuracion',
} as const;

export type ActivityModule = (typeof MODULES)[keyof typeof MODULES];

// --- Event type constants ---
export const EVENT_TYPES = {
  AUTH: 'auth',
  PROFILE: 'profile',
  NAVIGATION: 'navigation',
  PRODUCTION: 'production',
  PUBLICITY: 'publicity',
  EDUCATION: 'education',
  CRM: 'crm',
  TRAMITES: 'tramites',
  SYSTEM: 'system',
  STORE: 'store',
  COMUNICADOS: 'comunicados',
  ASSISTANT: 'assistant',
  DIGITAL: 'digital',
  COMISIONES: 'comisiones',
  CONFIGURACION: 'configuracion',
} as const;

export type ActivityEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// --- Core interface ---
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

// ============================================================
// AUTH
// ============================================================
export const trackLogin = () => logActivity({
  module: MODULES.AUTH, eventType: EVENT_TYPES.AUTH, action: 'login',
  summary: 'Inicio de sesion',
});

export const trackLogout = () => logActivity({
  module: MODULES.AUTH, eventType: EVENT_TYPES.AUTH, action: 'logout',
  summary: 'Cerro sesion',
});

// ============================================================
// PROFILE
// ============================================================
export const trackProfileUpdate = (field: string) => logActivity({
  module: MODULES.PROFILE, eventType: EVENT_TYPES.PROFILE, action: 'profile_update',
  summary: `Actualizo ${field}`,
  details: { field },
});

// ============================================================
// DASHBOARD (Produccion SICAS)
// ============================================================
export const trackDashboardView = () => logActivity({
  module: MODULES.DASHBOARD, eventType: EVENT_TYPES.NAVIGATION, action: 'dashboard_view',
  summary: 'Abrio el dashboard de Produccion SICAS',
});

export const trackDashboardTabOpened = (tab: string) => logActivity({
  module: MODULES.DASHBOARD, eventType: EVENT_TYPES.PRODUCTION, action: 'dashboard_tab_opened',
  summary: `Abrio pestana: ${tab}`,
  details: { tab },
});

export const trackDashboardFilterApplied = (filters: Record<string, unknown>) => logActivity({
  module: MODULES.DASHBOARD, eventType: EVENT_TYPES.PRODUCTION, action: 'dashboard_filter_applied',
  summary: 'Aplico filtros en dashboard',
  details: filters,
});

export const trackDashboardDrilldown = (dimension: string, entityName: string) => logActivity({
  module: MODULES.DASHBOARD, eventType: EVENT_TYPES.PRODUCTION, action: 'dashboard_drilldown_opened',
  summary: `Abrio detalle de ${dimension}: ${entityName}`,
  entityType: dimension, entityId: entityName,
});

// ============================================================
// DOCUMENTS
// ============================================================
export const trackDocumentView = (docId: string, poliza: string) => logActivity({
  module: MODULES.DOCUMENTS, eventType: EVENT_TYPES.PRODUCTION, action: 'document_view',
  summary: `Abrio documento poliza ${poliza}`,
  entityType: 'document', entityId: docId,
});

export const trackPageView = (module: ActivityModule, pageName: string) => logActivity({
  module, eventType: EVENT_TYPES.NAVIGATION, action: 'page_view',
  summary: `Accedio a ${pageName}`,
});

// ============================================================
// ASSISTANT (IA)
// ============================================================
export const trackAssistantOpened = () => logActivity({
  module: MODULES.ASSISTANT, eventType: EVENT_TYPES.ASSISTANT, action: 'ai_assistant_opened',
  summary: 'Abrio el asistente IA',
});

export const trackAssistantPromptSent = (promptPreview: string) => logActivity({
  module: MODULES.ASSISTANT, eventType: EVENT_TYPES.ASSISTANT, action: 'ai_prompt_sent',
  summary: `Envio prompt al asistente`,
  details: { preview: promptPreview.substring(0, 100) },
});

export const trackAssistantQuickPrompt = (promptLabel: string) => logActivity({
  module: MODULES.ASSISTANT, eventType: EVENT_TYPES.ASSISTANT, action: 'ai_quick_prompt_used',
  summary: `Uso sugerencia rapida: ${promptLabel}`,
});

export const trackAssistantResponse = () => logActivity({
  module: MODULES.ASSISTANT, eventType: EVENT_TYPES.ASSISTANT, action: 'ai_response_generated',
  summary: 'Recibio respuesta del asistente',
});

// ============================================================
// CENTRO DIGITAL
// ============================================================
export const trackDigitalCenterOpened = () => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_center_opened',
  summary: 'Abrio Centro Digital',
});

export const trackDigitalFolderOpened = (folderName: string) => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_folder_opened',
  summary: `Abrio carpeta: ${folderName}`,
  entityType: 'folder', entityId: folderName,
});

export const trackDigitalFileViewed = (fileName: string) => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_file_viewed',
  summary: `Visualizo archivo: ${fileName}`,
  entityType: 'file', entityId: fileName,
});

export const trackDigitalFileDownloaded = (fileName: string) => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_file_downloaded',
  summary: `Descargo archivo: ${fileName}`,
  entityType: 'file', entityId: fileName,
});

export const trackDigitalFileUploaded = (fileName: string) => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_file_uploaded',
  summary: `Subio archivo: ${fileName}`,
  entityType: 'file', entityId: fileName,
});

export const trackDigitalFileDeleted = (fileName: string) => logActivity({
  module: MODULES.CENTRO_DIGITAL, eventType: EVENT_TYPES.DIGITAL, action: 'digital_file_deleted',
  summary: `Elimino archivo: ${fileName}`,
  entityType: 'file', entityId: fileName,
});

// ============================================================
// COMISIONES
// ============================================================
export const trackCommissionsViewed = () => logActivity({
  module: MODULES.COMISIONES, eventType: EVENT_TYPES.COMISIONES, action: 'commissions_viewed',
  summary: 'Consulto modulo de comisiones',
});

export const trackCommissionsDetailOpened = (batchId: string, period: string) => logActivity({
  module: MODULES.COMISIONES, eventType: EVENT_TYPES.COMISIONES, action: 'commissions_detail_opened',
  summary: `Abrio detalle de comisiones: ${period}`,
  entityType: 'batch', entityId: batchId,
});

export const trackCommissionsPdfDownloaded = (batchId: string) => logActivity({
  module: MODULES.COMISIONES, eventType: EVENT_TYPES.COMISIONES, action: 'commissions_pdf_downloaded',
  summary: 'Descargo PDF de comisiones',
  entityType: 'batch', entityId: batchId,
});

export const trackCommissionsFilterApplied = (filters: Record<string, unknown>) => logActivity({
  module: MODULES.COMISIONES, eventType: EVENT_TYPES.COMISIONES, action: 'commissions_filter_applied',
  summary: 'Aplico filtros en comisiones',
  details: filters,
});

// ============================================================
// COMUNICADOS
// ============================================================
export const trackAnnouncementListViewed = () => logActivity({
  module: MODULES.COMUNICADOS, eventType: EVENT_TYPES.COMUNICADOS, action: 'announcement_list_viewed',
  summary: 'Consulto comunicados',
});

export const trackAnnouncementOpened = (title: string, id: string) => logActivity({
  module: MODULES.COMUNICADOS, eventType: EVENT_TYPES.COMUNICADOS, action: 'announcement_opened',
  summary: `Abrio comunicado: ${title}`,
  entityType: 'comunicado', entityId: id,
});

export const trackAnnouncementAttachmentDownloaded = (title: string) => logActivity({
  module: MODULES.COMUNICADOS, eventType: EVENT_TYPES.COMUNICADOS, action: 'announcement_attachment_downloaded',
  summary: `Descargo adjunto de comunicado: ${title}`,
});

// ============================================================
// STORE
// ============================================================
export const trackStoreOpened = () => logActivity({
  module: MODULES.STORE, eventType: EVENT_TYPES.STORE, action: 'store_opened',
  summary: 'Abrio MOVI Store',
});

export const trackStoreProductViewed = (productName: string, productId: string) => logActivity({
  module: MODULES.STORE, eventType: EVENT_TYPES.STORE, action: 'store_product_viewed',
  summary: `Vio producto: ${productName}`,
  entityType: 'product', entityId: productId,
});

export const trackStorePurchaseStarted = (productName: string) => logActivity({
  module: MODULES.STORE, eventType: EVENT_TYPES.STORE, action: 'store_purchase_started',
  summary: `Inicio compra: ${productName}`,
});

export const trackStorePurchaseCompleted = (orderId: string) => logActivity({
  module: MODULES.STORE, eventType: EVENT_TYPES.STORE, action: 'store_purchase_completed',
  summary: 'Completo compra en Store',
  entityType: 'order', entityId: orderId,
});

// ============================================================
// CONFIGURACION
// ============================================================
export const trackSettingsOpened = () => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'settings_opened',
  summary: 'Abrio configuracion',
});

export const trackBrandingUpdated = (field: string) => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'branding_updated',
  summary: `Actualizo branding: ${field}`,
  details: { field },
});

export const trackLogoUpdated = () => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'logo_updated',
  summary: 'Actualizo logotipo',
});

export const trackProfileImageUpdated = () => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'profile_image_updated',
  summary: 'Actualizo foto de perfil',
});

export const trackWebsiteSettingsUpdated = () => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'website_settings_updated',
  summary: 'Actualizo configuracion de pagina web',
});

export const trackSettingsSaved = (section: string) => logActivity({
  module: MODULES.CONFIGURACION, eventType: EVENT_TYPES.CONFIGURACION, action: 'settings_saved',
  summary: `Guardo configuracion: ${section}`,
  details: { section },
});

// ============================================================
// EDUCATION (extended)
// ============================================================
export const trackCourseStart = (courseId: string, courseName: string) => logActivity({
  module: MODULES.EDUCATION, eventType: EVENT_TYPES.EDUCATION, action: 'course_start',
  summary: `Inicio curso: ${courseName}`,
  entityType: 'course', entityId: courseId,
});

export const trackCourseComplete = (courseId: string, courseName: string) => logActivity({
  module: MODULES.EDUCATION, eventType: EVENT_TYPES.EDUCATION, action: 'course_complete',
  summary: `Completo curso: ${courseName}`,
  entityType: 'course', entityId: courseId,
});

// ============================================================
// PUBLICIDAD
// ============================================================
export const trackPublicityCreated = (name: string) => logActivity({
  module: MODULES.PUBLICIDAD, eventType: EVENT_TYPES.PUBLICITY, action: 'publicity_create',
  summary: `Creo publicidad: ${name}`,
});

// ============================================================
// TRAMITES
// ============================================================
export const trackTramiteAction = (action: string, tramiteId: string, summary: string) => logActivity({
  module: MODULES.TRAMITES, eventType: EVENT_TYPES.TRAMITES, action,
  summary, entityType: 'tramite', entityId: tramiteId,
});

// ============================================================
// CRM
// ============================================================
export const trackCrmAction = (action: string, entityType: string, entityId: string, summary: string) => logActivity({
  module: MODULES.CRM, eventType: EVENT_TYPES.CRM, action,
  summary, entityType, entityId,
});
