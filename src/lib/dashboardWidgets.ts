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
const NOT_AGENT: UserRole[] = ['Administrador', 'Gerente', 'Empleado', 'Ejecutivo'];

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ── AI ──
  { id: 'chava_insights', label: 'Chava IA', description: 'Análisis inteligente y recomendaciones de Chava', allowedRoles: ALL_ROLES, defaultWidth: 'full', allowedWidths: ['full'], icon: 'Sparkles', category: 'ai' },

  // ── KPIs ──
  { id: 'produccion_personal', label: 'Mi Producción', description: 'Producción personal del período actual', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'TrendingUp', category: 'kpi' },
  { id: 'comisiones_personal', label: 'Mis Comisiones', description: 'Comisiones del período actual', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'DollarSign', category: 'kpi' },
  { id: 'tramites_pendientes', label: 'Trámites Pendientes', description: 'Trámites activos y pendientes de atención', allowedRoles: ALL_ROLES, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'ClipboardList', category: 'kpi' },
  { id: 'produccion_oficina', label: 'Producción Oficina', description: 'Producción global de la oficina', allowedRoles: ADMIN_GERENTE, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Building2', category: 'kpi' },
  { id: 'agentes_activos', label: 'Agentes Activos', description: 'Número de agentes activos en la oficina', allowedRoles: ADMIN_GERENTE, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'Users', category: 'kpi' },
  { id: 'usuarios_activos', label: 'Usuarios Activos', description: 'Total de usuarios activos en la plataforma', allowedRoles: ADMIN_ONLY, defaultWidth: 'third', allowedWidths: ['third', 'half'], icon: 'UserCheck', category: 'kpi' },

  // ── LISTS ──
  { id: 'tramites_recientes', label: 'Trámites Recientes', description: 'Últimos trámites creados o actualizados', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'ClipboardList', category: 'list' },
  { id: 'polizas_por_vencer', label: 'Pólizas por Vencer', description: 'Pólizas próximas a renovar en 30 días', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'FileText', category: 'list' },
  { id: 'comunicados_recientes', label: 'Comunicados', description: 'Últimos comunicados publicados', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Bell', category: 'list' },
  { id: 'actividad_reciente', label: 'Actividad Reciente', description: 'Últimas acciones del equipo', allowedRoles: ADMIN_GERENTE, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Activity', category: 'list' },
  { id: 'produccion_por_agente', label: 'Producción por Agente', description: 'Ranking de producción del equipo', allowedRoles: ADMIN_GERENTE, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'BarChart3', category: 'list' },

  // ── CHARTS ──
  { id: 'produccion_mensual', label: 'Producción Mensual', description: 'Gráfica de producción por mes', allowedRoles: ALL_ROLES, defaultWidth: 'full', allowedWidths: ['half', 'full'], icon: 'TrendingUp', category: 'chart' },

  // ── ACTIONS ──
  { id: 'accesos_rapidos', label: 'Accesos Rápidos', description: 'Atajos a los módulos más usados', allowedRoles: ALL_ROLES, defaultWidth: 'full', allowedWidths: ['full'], icon: 'Zap', category: 'actions' },
  { id: 'gamificacion', label: 'Mi Progreso', description: 'Puntos, nivel y logros de gamificación', allowedRoles: ALL_ROLES, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Trophy', category: 'actions' },
  { id: 'diagnostico_sistema', label: 'Diagnóstico Sistema', description: 'Estado de sincronizaciones y errores', allowedRoles: ADMIN_ONLY, defaultWidth: 'half', allowedWidths: ['half', 'full'], icon: 'Activity', category: 'kpi' },
];

// ── Default layouts per role ────────────────────────────────────────────────

export const DEFAULT_LAYOUT: Record<UserRole, WidgetConfig[]> = {
  Administrador: [
    { widget_id: 'chava_insights',       visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_oficina',   visible: true, position: 1,  width: 'half',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',  visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'agentes_activos',      visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'usuarios_activos',     visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'produccion_mensual',   visible: true, position: 5,  width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_por_agente',visible: true, position: 6,  width: 'half',  custom_settings: {} },
    { widget_id: 'actividad_reciente',   visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'tramites_recientes',   visible: true, position: 8,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes',visible: true, position: 9,  width: 'half',  custom_settings: {} },
    { widget_id: 'diagnostico_sistema',  visible: true, position: 10, width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',      visible: true, position: 11, width: 'full',  custom_settings: {} },
  ],
  Gerente: [
    { widget_id: 'chava_insights',        visible: true, position: 0,  width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_oficina',    visible: true, position: 1,  width: 'half',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',   visible: true, position: 2,  width: 'third', custom_settings: {} },
    { widget_id: 'agentes_activos',       visible: true, position: 3,  width: 'third', custom_settings: {} },
    { widget_id: 'produccion_personal',   visible: true, position: 4,  width: 'third', custom_settings: {} },
    { widget_id: 'produccion_mensual',    visible: true, position: 5,  width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_por_agente', visible: true, position: 6,  width: 'half',  custom_settings: {} },
    { widget_id: 'tramites_recientes',    visible: true, position: 7,  width: 'half',  custom_settings: {} },
    { widget_id: 'polizas_por_vencer',    visible: true, position: 8,  width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes', visible: true, position: 9,  width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',       visible: true, position: 10, width: 'full',  custom_settings: {} },
  ],
  Empleado: [
    { widget_id: 'chava_insights',        visible: true, position: 0, width: 'full',  custom_settings: {} },
    { widget_id: 'tramites_pendientes',   visible: true, position: 1, width: 'third', custom_settings: {} },
    { widget_id: 'produccion_personal',   visible: true, position: 2, width: 'third', custom_settings: {} },
    { widget_id: 'comisiones_personal',   visible: true, position: 3, width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',    visible: true, position: 4, width: 'half',  custom_settings: {} },
    { widget_id: 'polizas_por_vencer',    visible: true, position: 5, width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes', visible: true, position: 6, width: 'half',  custom_settings: {} },
    { widget_id: 'gamificacion',          visible: true, position: 7, width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',       visible: true, position: 8, width: 'full',  custom_settings: {} },
  ],
  Agente: [
    { widget_id: 'chava_insights',        visible: true, position: 0, width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_personal',   visible: true, position: 1, width: 'third', custom_settings: {} },
    { widget_id: 'comisiones_personal',   visible: true, position: 2, width: 'third', custom_settings: {} },
    { widget_id: 'tramites_pendientes',   visible: true, position: 3, width: 'third', custom_settings: {} },
    { widget_id: 'produccion_mensual',    visible: true, position: 4, width: 'full',  custom_settings: {} },
    { widget_id: 'polizas_por_vencer',    visible: true, position: 5, width: 'half',  custom_settings: {} },
    { widget_id: 'tramites_recientes',    visible: true, position: 6, width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes', visible: true, position: 7, width: 'half',  custom_settings: {} },
    { widget_id: 'gamificacion',          visible: true, position: 8, width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',       visible: true, position: 9, width: 'full',  custom_settings: {} },
  ],
  Ejecutivo: [
    { widget_id: 'chava_insights',        visible: true, position: 0, width: 'full',  custom_settings: {} },
    { widget_id: 'produccion_personal',   visible: true, position: 1, width: 'third', custom_settings: {} },
    { widget_id: 'comisiones_personal',   visible: true, position: 2, width: 'third', custom_settings: {} },
    { widget_id: 'tramites_pendientes',   visible: true, position: 3, width: 'third', custom_settings: {} },
    { widget_id: 'tramites_recientes',    visible: true, position: 4, width: 'half',  custom_settings: {} },
    { widget_id: 'polizas_por_vencer',    visible: true, position: 5, width: 'half',  custom_settings: {} },
    { widget_id: 'comunicados_recientes', visible: true, position: 6, width: 'half',  custom_settings: {} },
    { widget_id: 'gamificacion',          visible: true, position: 7, width: 'half',  custom_settings: {} },
    { widget_id: 'accesos_rapidos',       visible: true, position: 8, width: 'full',  custom_settings: {} },
  ],
};

export function getWidgetsForRole(role: UserRole): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.allowedRoles.length === 0 || w.allowedRoles.includes(role));
}

export function getDefaultLayout(role: UserRole): WidgetConfig[] {
  return DEFAULT_LAYOUT[role] || DEFAULT_LAYOUT['Agente'];
}
