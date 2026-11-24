import type { UserRole } from './workspaceConfig';

export type WidgetWidth = 'full' | 'half' | 'third';

export interface WidgetDefinition {
  id: string;
  label: string;
  description: string;
  allowedRoles: UserRole[];
  defaultWidth: WidgetWidth;
  allowedWidths: WidgetWidth[];
  icon: string; // lucide icon name
  category: 'kpi' | 'list' | 'chart' | 'actions' | 'ai';
}

export interface WidgetConfig {
  widget_id: string;
  visible: boolean;
  position: number;
  width: WidgetWidth;
  custom_settings: Record<string, any>;
}

const ALL_ROLES: UserRole[] = ['Administrador', 'Gerente', 'Empleado', 'Agente', 'Ejecutivo'];
const ADMIN_ONLY: UserRole[] = ['Administrador'];
const ADMIN_GERENTE: UserRole[] = ['Administrador', 'Gerente'];

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ── AI ──
  { id: 'chava_insights', label: 'Chava IA', description: 'Análisis inteligente y recomendaciones de Chava', allowedRoles: ALL_ROLES, defaultWidth: 'full', allowedWidths: ['full'], icon: 'Sparkles', category: 'ai' },

  // ── KPIs ──
  { id: 'tramites_pendientes', label: 'Trámites Pendientes', description: 'Trámites activos y pendientes de atención', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'ClipboardList', category: 'kpi' },
  { id: 'crm_tareas', label: 'Tareas CRM', description: 'Tareas abiertas del CRM personal', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Target', category: 'kpi' },
  { id: 'contactos', label: 'Mis Contactos', description: 'Total de contactos en la cartera', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Phone', category: 'kpi' },
  { id: 'polizas_vigentes', label: 'Pólizas Vigentes', description: 'Total de pólizas activas', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Shield', category: 'kpi' },
  { id: 'notificaciones_sin_leer', label: 'Notificaciones', description: 'Alertas y notificaciones pendientes', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Bell', category: 'kpi' },
  { id: 'agentes_activos', label: 'Agentes Activos', description: 'Número de agentes activos en la oficina', allowedRoles: ADMIN_GERENTE, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Users', category: 'kpi' },
  { id: 'usuarios_activos', label: 'Usuarios Activos', description: 'Total de usuarios activos en la plataforma', allowedRoles: ADMIN_ONLY, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'UserCheck', category: 'kpi' },

  // ── LISTS ──
  { id: 'tramites_recientes', label: 'Trámites Recientes', description: 'Últimos trámites creados o actualizados', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'ClipboardList', category: 'list' },
  { id: 'comunicados_recientes', label: 'Comunicados', description: 'Últimos comunicados publicados', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Bell', category: 'list' },

  // ── ACTIONS ──
  { id: 'accesos_rapidos', label: 'Accesos Rápidos', description: 'Atajos a los módulos más usados', allowedRoles: ALL_ROLES, defaultWidth: 'full', allowedWidths: ['full'], icon: 'Zap', category: 'actions' },
  { id: 'diagnostico_sistema', label: 'Diagnóstico Sistema', description: 'Estado de sincronizaciones y errores', allowedRoles: ADMIN_ONLY, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Activity', category: 'kpi' },
];

// ── Default layouts per role ────────────────────────────────────────────────

export const DEFAULT_LAYOUT: Record<UserRole, WidgetConfig[]> = {
  Administrador: [
    { widget_id: 'chava_insights',          visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',     visible: true, position: 1,  width: 'third', custom_settings: {} },
    { widget_id: 'agentes_activos',         visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'usuarios_activos',        visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'notificaciones_sin_leer', visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'crm_tareas',             visible: true, position: 5,  width: 'third', custom_settings: {} },
    { widget_id: 'polizas_vigentes',       visible: true, position: 6,  width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',      visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',   visible: true, position: 8,  width: 'half',  custom_settings: {} },
    { widget_id: 'diagnostico_sistema',     visible: true, position: 9,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',         visible: true, position: 10, width: 'full',  custom_settings: {} },
  ],
  Gerente: [
    { widget_id: 'chava_insights',          visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',     visible: true, position: 1,  width: 'third', custom_settings: {} },
    { widget_id: 'agentes_activos',         visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'crm_tareas',             visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'polizas_vigentes',       visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'notificaciones_sin_leer', visible: true, position: 5,  width: 'third', custom_settings: {} },
    { widget_id: 'contactos',              visible: true, position: 6,  width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',      visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',   visible: true, position: 8,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',         visible: true, position: 9,  width: 'full',  custom_settings: {} },
  ],
  Empleado: [
    { widget_id: 'chava_insights',          visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',     visible: true, position: 1,  width: 'third', custom_settings: {} },
    { widget_id: 'crm_tareas',             visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'contactos',              visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'notificaciones_sin_leer', visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'polizas_vigentes',       visible: true, position: 5,  width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',      visible: true, position: 6,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',   visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',         visible: true, position: 8,  width: 'full',  custom_settings: {} },
  ],
  Agente: [
    { widget_id: 'chava_insights',          visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',     visible: true, position: 1,  width: 'third', custom_settings: {} },
    { widget_id: 'polizas_vigentes',       visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'crm_tareas',             visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'contactos',              visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'notificaciones_sin_leer', visible: true, position: 5,  width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',      visible: true, position: 6,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',   visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',         visible: true, position: 8,  width: 'full',  custom_settings: {} },
  ],
  Ejecutivo: [
    { widget_id: 'chava_insights',          visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',     visible: true, position: 1,  width: 'third', custom_settings: {} },
    { widget_id: 'crm_tareas',             visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'contactos',              visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'polizas_vigentes',       visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'notificaciones_sin_leer', visible: true, position: 5,  width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',      visible: true, position: 6,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',   visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',         visible: true, position: 8,  width: 'full',  custom_settings: {} },
  ],
};

export function getWidgetsForRole(role: UserRole): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.allowedRoles.length === 0 || w.allowedRoles.includes(role));
}

export function getDefaultLayout(role: UserRole): WidgetConfig[] {
  return DEFAULT_LAYOUT[role] || DEFAULT_LAYOUT['Agente'];
}
