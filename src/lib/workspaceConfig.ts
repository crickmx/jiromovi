import { LayoutDashboard, Briefcase, Palette, TrendingUp, GraduationCap, Settings, ClipboardList, FolderInput as FormInput, Headphones, Send, DollarSign, Activity, Trophy, FileText, MapPin, Car, FolderOpen, BookOpen, Users, CreditCard, Key, Calendar, ShoppingBag, BookUser, Wallet, Megaphone, Globe, Bot, ChartBar as BarChart3, Video, BookMarked, BadgeCheck, Compass, Calculator, Smartphone, Mail, MessageSquare, Bell, Sparkles, Brain, Database, Eye, Image as ImageIcon, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WorkspaceId =
  | 'comercial'
  | 'centro-contacto'
  | 'cotizar'
  | 'produccion'
  | 'mercadotecnia'
  | 'operaciones'
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
  { path: '/chava', label: 'Chava', icon: Sparkles, visibleTo: ALL_ROLES },
  { path: '/centro-digital', label: 'Centro Digital', icon: FolderOpen, visibleTo: ALL_ROLES },
  { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES },
  { path: '/comunicados', label: 'Comunicados', icon: FileText, visibleTo: ALL_ROLES, matchPrefix: true },
];

const WORKSPACE_COMERCIAL: WorkspaceDefinition = {
  id: 'comercial',
  label: 'Comercial',
  icon: Briefcase,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/tramites', label: 'Tramites', icon: ClipboardList, visibleTo: ALL_ROLES, matchPrefix: true, excludePrefixes: ['/tramites/formularios'] },
    { path: '/contactos', label: 'Contactos', icon: BookUser, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/mi-crm', label: 'CRM', icon: Users, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/entrega-polizas', label: 'Entrega Polizas', icon: Send, visibleTo: NOT_AGENT },
    { path: '/lector-qualitas', label: 'Lector Qualitas', icon: BookOpen, visibleTo: NOT_AGENT },
    { path: '/mi-progreso', label: 'Mi Progreso', icon: Trophy, visibleTo: NO_EMPLEADO_AGENTE },
  ],
};

const WORKSPACE_CENTRO_CONTACTO: WorkspaceDefinition = {
  id: 'centro-contacto',
  label: 'Centro de Contacto',
  icon: Headphones,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/centro-contacto/whatsapp', label: 'WhatsApp', icon: Smartphone, visibleTo: NOT_AGENT },
    { path: '/centro-contacto/email', label: 'Email', icon: Mail, visibleTo: ALL_ROLES },
    { path: '/centro-contacto/chat', label: 'Chat', icon: MessageSquare, visibleTo: NOT_AGENT },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, visibleTo: NOT_AGENT },
    { path: '/centro-contacto/notificaciones', label: 'Notificaciones', icon: Bell, visibleTo: ADMIN_ONLY },
  ],
};

const WORKSPACE_COTIZAR: WorkspaceDefinition = {
  id: 'cotizar',
  label: 'Cotizar',
  icon: Calculator,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/cotizar', label: 'Inicio', icon: LayoutDashboard, visibleTo: ALL_ROLES },
    { path: '/cotizar/gmm-bx', label: 'GMM BX+', icon: Activity, visibleTo: ADMIN_ONLY },
    { path: '/cotizar/formularios', label: 'Formularios', icon: FormInput, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/cotizar/a-la-medida', label: 'A la Medida', icon: Compass, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/cotizar/multicotizador', label: 'Multicotizador', icon: Car, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_OPERACIONES: WorkspaceDefinition = {
  id: 'operaciones',
  label: 'Operaciones',
  icon: TrendingUp,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, visibleTo: NOT_AGENT },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, visibleTo: ALL_ROLES },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, visibleTo: NOT_AGENT },
  ],
};

const WORKSPACE_PRODUCCION: WorkspaceDefinition = {
  id: 'produccion',
  label: 'Central Produccion',
  icon: BarChart3,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/produccion', label: 'Central Produccion', icon: BarChart3, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_MERCADOTECNIA: WorkspaceDefinition = {
  id: 'mercadotecnia',
  label: 'Mercadotecnia',
  icon: Palette,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/mercadotecnia/publicidad', label: 'Publicidad', icon: Megaphone, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mis-disenos', label: 'Mis Diseños', icon: ImageIcon, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mi-pagina-web', label: 'Mi Página Web', icon: Globe, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mi-marca', label: 'Mi Marca', icon: BadgeCheck, visibleTo: ALL_ROLES },
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
    { path: '/admin/importacion-masiva', label: 'Importación Masiva', icon: Database, visibleTo: ADMIN_ONLY },
    { path: '/comisiones', label: 'Comisiones Admin', icon: CreditCard, visibleTo: ADMIN_ONLY, matchPrefix: true, excludePrefixes: ['/comisiones/regimen-fiscal', '/comisiones/mapeo-vendedores'] },
    { path: '/comisiones/regimen-fiscal', label: 'Regimen Fiscal', icon: DollarSign, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/comisiones/mapeo-vendedores', label: 'Mapeo Vendedores', icon: Users, visibleTo: ADMIN_ONLY },
    { path: '/sicas/salud', label: 'SICAS Salud', icon: Activity, visibleTo: ADMIN_ONLY },
    { path: '/seguwallet-admin', label: 'Seguwallet', icon: Wallet, visibleTo: ADMIN_ONLY },
    { path: '/firmas-email', label: 'Firmas Email', icon: FileText, visibleTo: ADMIN_ONLY },
    { path: '/admin/transaccionales', label: 'Transaccionales', icon: Send, visibleTo: ADMIN_ONLY },
    { path: '/admin/diagnostico', label: 'Diagnostico', icon: Activity, visibleTo: ADMIN_ONLY },
    { path: '/admin/mascara', label: 'Mascara de Usuario', icon: Eye, visibleTo: ADMIN_ONLY },
    { path: '/admin/telefonia', label: 'Telefonía', icon: Phone, visibleTo: ADMIN_ONLY },
    { path: '/admin/modulos', label: 'Visibilidad Modulos', icon: Layers, visibleTo: ADMIN_ONLY },
    // Inteligencia Artificial
    { path: '/admin/chava-inteligencia', label: 'Dashboard IA', icon: BarChart3, visibleTo: ADMIN_ONLY },
    { path: '/admin/base-conocimiento', label: 'Base Conocimiento', icon: BookOpen, visibleTo: ADMIN_ONLY },
    { path: '/admin/asistentes', label: 'Entrenamiento IA', icon: Bot, visibleTo: ADMIN_GERENTE, matchPrefix: true },
    { path: '/admin/automatizacion-ia', label: 'Robots IA', icon: Sparkles, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/admin/chava-ia', label: 'Auditoria IA', icon: Brain, visibleTo: ADMIN_ONLY },
  ],
};

export const WORKSPACES: WorkspaceDefinition[] = [
  WORKSPACE_COMERCIAL,
  WORKSPACE_CENTRO_CONTACTO,
  WORKSPACE_COTIZAR,
  WORKSPACE_PRODUCCION,
  WORKSPACE_OPERACIONES,
  WORKSPACE_MERCADOTECNIA,
  WORKSPACE_SEGUROS_EDUCATION,
  WORKSPACE_ADMIN,
];

export const NAV_ORDER: NavEntry[] = [
  { type: 'link', item: { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visibleTo: ALL_ROLES } },
  { type: 'link', item: { path: '/centro-digital', label: 'Centro Digital', icon: FolderOpen, visibleTo: ALL_ROLES } },
  { type: 'workspace', workspace: WORKSPACE_COMERCIAL },
  { type: 'workspace', workspace: WORKSPACE_CENTRO_CONTACTO },
  { type: 'workspace', workspace: WORKSPACE_COTIZAR },
  { type: 'workspace', workspace: WORKSPACE_PRODUCCION },
  { type: 'workspace', workspace: WORKSPACE_ADMIN },
  { type: 'workspace', workspace: WORKSPACE_OPERACIONES },
  { type: 'workspace', workspace: WORKSPACE_MERCADOTECNIA },
  { type: 'workspace', workspace: WORKSPACE_SEGUROS_EDUCATION },
  { type: 'link', item: { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES } },
  { type: 'link', item: { path: '/comunicados', label: 'Comunicados', icon: FileText, visibleTo: ALL_ROLES, matchPrefix: true } },
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
