import { LayoutDashboard, Briefcase, Palette, TrendingUp, Brain, GraduationCap, Settings, ClipboardList, FormInput, Headphones, Send, DollarSign, Activity, Building, Trophy, FileText, MapPin, Car, FolderOpen, BookOpen, Users, CreditCard, Key, Calendar, ShoppingBag, BookUser, Wallet, Megaphone, Globe, Mail, Bot, BarChart3, Video, BookMarked, BadgeCheck, Zap, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WorkspaceId =
  | 'comercial'
  | 'mercadotecnia'
  | 'operaciones'
  | 'ia-automatizacion'
  | 'seguros-education'
  | 'administracion';

export type UserRole = 'Administrador' | 'Gerente' | 'Empleado' | 'Agente' | 'Ejecutivo';

export interface WorkspaceNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  visibleTo: UserRole[];
  matchPrefix?: boolean;
  excludePrefixes?: string[];
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  icon: LucideIcon;
  visibleTo: UserRole[];
  items: WorkspaceNavItem[];
}

export interface TopLevelNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  visibleTo: UserRole[];
  matchPrefix?: boolean;
}

export type NavEntry =
  | { type: 'link'; item: TopLevelNavItem }
  | { type: 'workspace'; workspace: WorkspaceDefinition };

const ALL_ROLES: UserRole[] = [];
const NOT_AGENT: UserRole[] = ['Administrador', 'Gerente', 'Empleado', 'Ejecutivo'];
const ADMIN_ONLY: UserRole[] = ['Administrador'];
const ADMIN_GERENTE: UserRole[] = ['Administrador', 'Gerente'];
const NO_EMPLEADO_AGENTE: UserRole[] = ['Administrador', 'Gerente', 'Ejecutivo'];

export const TOP_LEVEL_ITEMS: TopLevelNavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visibleTo: ALL_ROLES },
  { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES },
  { path: '/comunicados', label: 'Comunicados', icon: FileText, visibleTo: ALL_ROLES, matchPrefix: true },
];

const WORKSPACE_COMERCIAL: WorkspaceDefinition = {
  id: 'comercial',
  label: 'Comercial',
  icon: Briefcase,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/mi-crm', label: 'CRM', icon: Users, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/tramites', label: 'Tramites', icon: ClipboardList, visibleTo: ALL_ROLES, matchPrefix: true, excludePrefixes: ['/tramites/formularios'] },
    { path: '/tramites/formularios', label: 'Formularios', icon: FormInput, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/centro-contacto', label: 'Centro de Contacto', icon: Headphones, visibleTo: NOT_AGENT, matchPrefix: true, excludePrefixes: ['/centro-contacto/mi-whatsapp'] },
    { path: '/centro-contacto/mi-whatsapp', label: 'Mi WhatsApp', icon: Smartphone, visibleTo: ALL_ROLES },
    { path: '/multicotizador-digital', label: 'Multicotizador', icon: Car, visibleTo: ALL_ROLES },
    { path: '/entrega-polizas', label: 'Entrega Polizas', icon: Send, visibleTo: NOT_AGENT },
    { path: '/mis-polizas', label: 'Mis Polizas', icon: FileText, visibleTo: ALL_ROLES },
    { path: '/lector-qualitas', label: 'Lector Qualitas', icon: BookOpen, visibleTo: NOT_AGENT },
    { path: '/mi-progreso', label: 'Mi Progreso', icon: Trophy, visibleTo: NO_EMPLEADO_AGENTE },
    { path: '/gmm/cotizador', label: 'GMM BX+', icon: Activity, visibleTo: ADMIN_ONLY },
    { path: '/seguwallet-admin', label: 'Seguwallet', icon: Wallet, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_OPERACIONES: WorkspaceDefinition = {
  id: 'operaciones',
  label: 'Operaciones',
  icon: TrendingUp,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/mi-produccion-sicas-live', label: 'Produccion SICAS', icon: BarChart3, visibleTo: ALL_ROLES },
    { path: '/produccion/total', label: 'Produccion Oficina', icon: Building, visibleTo: ADMIN_GERENTE },
    { path: '/produccion/convenio', label: 'Produccion Convenio', icon: TrendingUp, visibleTo: ADMIN_GERENTE },
    { path: '/mis-comisiones', label: 'Mis Comisiones', icon: DollarSign, visibleTo: NO_EMPLEADO_AGENTE },
    { path: '/comisiones', label: 'Comisiones Admin', icon: CreditCard, visibleTo: ADMIN_ONLY, matchPrefix: true, excludePrefixes: ['/comisiones/regimen-fiscal', '/comisiones/mapeo-vendedores'] },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, visibleTo: ALL_ROLES },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, visibleTo: NOT_AGENT },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, visibleTo: NOT_AGENT },
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, visibleTo: NOT_AGENT },
  ],
};

const WORKSPACE_MERCADOTECNIA: WorkspaceDefinition = {
  id: 'mercadotecnia',
  label: 'Mercadotecnia',
  icon: Palette,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/mercadotecnia/mi-marca', label: 'Mi Marca', icon: BadgeCheck, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/publicidad', label: 'Publicidad', icon: Megaphone, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mi-pagina-web', label: 'Mi Pagina Web', icon: Globe, visibleTo: ALL_ROLES },
    { path: '/gestor-emails', label: 'Gestor Emails', icon: Mail, visibleTo: ALL_ROLES },
    { path: '/centro-digital', label: 'Centro Digital', icon: FolderOpen, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_SEGUROS_EDUCATION: WorkspaceDefinition = {
  id: 'seguros-education',
  label: 'Seguros Education',
  icon: GraduationCap,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/seguros-education', label: 'Inicio', icon: LayoutDashboard, visibleTo: ALL_ROLES },
    { path: '/seguros-education/on-demand', label: 'On Demand', icon: Video, visibleTo: ALL_ROLES },
    { path: '/seguros-education/aula-virtual', label: 'Aula Virtual', icon: BookMarked, visibleTo: ALL_ROLES },
    { path: '/seguros-education/cedula-a', label: 'Cedula A', icon: BadgeCheck, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/manuales', label: 'Manuales', icon: BookOpen, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/seguros-education/analytics', label: 'Analytics', icon: BarChart3, visibleTo: ADMIN_GERENTE },
  ],
};

const WORKSPACE_IA: WorkspaceDefinition = {
  id: 'ia-automatizacion',
  label: 'IA',
  icon: Brain,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/centro-contacto/asistentes', label: 'Asistentes IA', icon: Bot, visibleTo: ADMIN_GERENTE, matchPrefix: true },
    { path: '/chatgpt-test', label: 'Asistente', icon: Zap, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_ADMIN: WorkspaceDefinition = {
  id: 'administracion',
  label: 'Admin',
  icon: Settings,
  visibleTo: ADMIN_GERENTE,
  items: [
    { path: '/directorio', label: 'Usuarios', icon: Users, visibleTo: ADMIN_GERENTE },
    { path: '/configuracion', label: 'Configuracion', icon: Settings, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/actividad-usuarios', label: 'Actividad', icon: Activity, visibleTo: ADMIN_ONLY },
    { path: '/carga-masiva-usuarios', label: 'Carga Masiva', icon: Users, visibleTo: ADMIN_ONLY },
    { path: '/admin-digital', label: 'Admin Digital', icon: CreditCard, visibleTo: ADMIN_ONLY },
    { path: '/comisiones/regimen-fiscal', label: 'Regimen Fiscal', icon: DollarSign, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/comisiones/mapeo-vendedores', label: 'Mapeo Vendedores', icon: Users, visibleTo: ADMIN_ONLY },
    { path: '/produccion/configuracion', label: 'Config Produccion', icon: Settings, visibleTo: ADMIN_ONLY },
    { path: '/sicas/salud', label: 'SICAS Salud', icon: Activity, visibleTo: ADMIN_ONLY },
  ],
};

export const WORKSPACES: WorkspaceDefinition[] = [
  WORKSPACE_COMERCIAL,
  WORKSPACE_OPERACIONES,
  WORKSPACE_MERCADOTECNIA,
  WORKSPACE_SEGUROS_EDUCATION,
  WORKSPACE_IA,
  WORKSPACE_ADMIN,
];

// Ordered navigation: Dashboard, Comercial, Operaciones, Mercadotecnia, Seguros Education, MOVI Store, Comunicados, IA, Admin
export const NAV_ORDER: NavEntry[] = [
  { type: 'link', item: { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visibleTo: ALL_ROLES } },
  { type: 'workspace', workspace: WORKSPACE_COMERCIAL },
  { type: 'workspace', workspace: WORKSPACE_OPERACIONES },
  { type: 'workspace', workspace: WORKSPACE_MERCADOTECNIA },
  { type: 'workspace', workspace: WORKSPACE_SEGUROS_EDUCATION },
  { type: 'link', item: { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES } },
  { type: 'link', item: { path: '/comunicados', label: 'Comunicados', icon: FileText, visibleTo: ALL_ROLES, matchPrefix: true } },
  { type: 'workspace', workspace: WORKSPACE_IA },
  { type: 'workspace', workspace: WORKSPACE_ADMIN },
];

export function isWorkspaceVisible(ws: WorkspaceDefinition, userRole: UserRole): boolean {
  if (ws.visibleTo.length === 0) return true;
  return ws.visibleTo.includes(userRole);
}

export function isItemVisible(item: WorkspaceNavItem, userRole: UserRole): boolean {
  if (item.visibleTo.length === 0) return true;
  return item.visibleTo.includes(userRole);
}

export function isTopLevelItemVisible(item: TopLevelNavItem, userRole: UserRole): boolean {
  if (item.visibleTo.length === 0) return true;
  return item.visibleTo.includes(userRole);
}

export function resolveWorkspace(
  pathname: string,
  userRole: UserRole
): { workspace: WorkspaceDefinition | null; activeItem: WorkspaceNavItem | null } {
  for (const ws of WORKSPACES) {
    if (!isWorkspaceVisible(ws, userRole)) continue;
    for (const item of ws.items) {
      if (!isItemVisible(item, userRole)) continue;
      if (pathname === item.path) {
        return { workspace: ws, activeItem: item };
      }
      if (item.matchPrefix) {
        if (item.excludePrefixes?.some(ex => pathname.startsWith(ex))) continue;
        if (pathname.startsWith(item.path)) {
          return { workspace: ws, activeItem: item };
        }
      }
    }
  }
  return { workspace: null, activeItem: null };
}

export function buildBreadcrumbs(
  workspace: WorkspaceDefinition | null,
  activeItem: WorkspaceNavItem | null
): Array<{ label: string; path?: string }> {
  const crumbs: Array<{ label: string; path?: string }> = [];
  if (workspace) {
    crumbs.push({ label: workspace.label });
  }
  if (activeItem) {
    crumbs.push({ label: activeItem.label, path: activeItem.path });
  }
  return crumbs;
}
