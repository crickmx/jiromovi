import { LayoutDashboard, Briefcase, Palette, TrendingUp, GraduationCap, Settings, ClipboardList, FolderInput as FormInput, Headphones, Trophy, Car, BookOpen, Users, Key, Calendar, ShoppingBag, BookUser, Wallet, Megaphone, Globe, Bot, ChartLine, Video, BadgeCheck, Calculator, Mail, MessageSquare, Bell, Brain, Database, HardDrive, Phone, BrainCircuit, Monitor, Newspaper, PackageCheck, FileSearch, MessageCircle, Building2, House, HeartPulse, SlidersHorizontal, Stethoscope, Cog, Landmark, Paintbrush, Fingerprint, MonitorPlay, UserCheck, Upload, LayoutTemplate, Percent, Receipt, GitBranch, PenLine, ArrowLeftRight, SearchCode, UserCog, LayoutGrid, LibraryBig, Workflow, Clock, Camera, Sparkles, Bookmark, PanelLeft, Bug } from 'lucide-react';
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

export type UserRole = 'Administrador' | 'Gerente' | 'Empleado' | 'Agente';

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
const NOT_AGENT: UserRole[] = ['Administrador', 'Gerente', 'Empleado'];
const ADMIN_ONLY: UserRole[] = ['Administrador'];
const ADMIN_GERENTE: UserRole[] = ['Administrador', 'Gerente'];
const NO_EMPLEADO_AGENTE: UserRole[] = ['Administrador', 'Gerente'];

export const TOP_LEVEL_ITEMS: TopLevelNavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visibleTo: ALL_ROLES },
  { path: '/chava', label: 'Chava', icon: BrainCircuit, visibleTo: ADMIN_ONLY },
  { path: '/centro-digital', label: 'Centro Digital', icon: Monitor, visibleTo: ALL_ROLES },
  { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES },
  { path: '/comunicados', label: 'Comunicados', icon: Newspaper, visibleTo: ALL_ROLES, matchPrefix: true },
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
    { path: '/entrega-polizas', label: 'Entrega Polizas', icon: PackageCheck, visibleTo: NOT_AGENT },
    { path: '/lector-qualitas', label: 'Lector Qualitas', icon: FileSearch, visibleTo: NOT_AGENT },
    { path: '/mi-progreso', label: 'Mi Progreso', icon: Trophy, visibleTo: NO_EMPLEADO_AGENTE },
  ],
};

const WORKSPACE_CENTRO_CONTACTO: WorkspaceDefinition = {
  id: 'centro-contacto',
  label: 'Centro de Contacto',
  icon: Headphones,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/centro-contacto/whatsapp', label: 'WhatsApp', icon: MessageCircle, visibleTo: NOT_AGENT },
    { path: '/centro-contacto/email', label: 'Email', icon: Mail, visibleTo: ALL_ROLES },
    { path: '/centro-contacto/chat', label: 'Chat', icon: MessageSquare, visibleTo: NOT_AGENT },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: Building2, visibleTo: NOT_AGENT },
    { path: '/centro-contacto/notificaciones', label: 'Notificaciones', icon: Bell, visibleTo: ADMIN_ONLY },
  ],
};

const WORKSPACE_COTIZAR: WorkspaceDefinition = {
  id: 'cotizar',
  label: 'Cotizar',
  icon: Calculator,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/cotizar', label: 'Inicio', icon: House, visibleTo: ALL_ROLES },
    { path: '/cotizar/gmm-bx', label: 'GMM BX+', icon: HeartPulse, visibleTo: ADMIN_ONLY },
    { path: '/cotizar/formularios', label: 'Formularios', icon: FormInput, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/cotizar/a-la-medida', label: 'A la Medida', icon: SlidersHorizontal, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/cotizar/multicotizador', label: 'Multicotizador', icon: Car, visibleTo: ALL_ROLES },
    { path: '/cotizar/multicotizador-gmm', label: 'Multicotizador GMM', icon: Stethoscope, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_OPERACIONES: WorkspaceDefinition = {
  id: 'operaciones',
  label: 'Operaciones',
  icon: Cog,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, visibleTo: NOT_AGENT },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: Landmark, visibleTo: ALL_ROLES },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, visibleTo: NOT_AGENT },
  ],
};

const WORKSPACE_PRODUCCION: WorkspaceDefinition = {
  id: 'produccion',
  label: 'Central Produccion',
  icon: TrendingUp,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/produccion', label: 'Central Produccion', icon: TrendingUp, visibleTo: ALL_ROLES },
  ],
};

const WORKSPACE_MERCADOTECNIA: WorkspaceDefinition = {
  id: 'mercadotecnia',
  label: 'Mercadotecnia',
  icon: Palette,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/mercadotecnia/publicidad', label: 'Publicidad', icon: Megaphone, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mis-disenos', label: 'Mis Diseños', icon: Paintbrush, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mi-pagina-web', label: 'Mi Página Web', icon: Globe, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/mi-marca', label: 'Mi Marca', icon: Fingerprint, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/fotos-estudio', label: 'Mis Fotos de Estudio', icon: Camera, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/recursos-marca', label: 'Jiro Brand Kit', icon: Bookmark, visibleTo: ALL_ROLES },
    { path: '/mercadotecnia/admin', label: 'Marketing Admin', icon: LayoutGrid, visibleTo: ADMIN_ONLY },
  ],
};

const WORKSPACE_SEGUROS_EDUCATION: WorkspaceDefinition = {
  id: 'seguros-education',
  label: 'Seguros Education',
  icon: GraduationCap,
  visibleTo: ALL_ROLES,
  items: [
    { path: '/seguros-education', label: 'Inicio', icon: House, visibleTo: ALL_ROLES },
    { path: '/seguros-education/on-demand', label: 'On Demand', icon: Video, visibleTo: ALL_ROLES },
    { path: '/seguros-education/aula-virtual', label: 'Aula Virtual', icon: MonitorPlay, visibleTo: ALL_ROLES },
    { path: '/seguros-education/cedula-a', label: 'Cedula A', icon: BadgeCheck, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/manuales', label: 'Manuales', icon: BookOpen, visibleTo: ALL_ROLES, matchPrefix: true },
    { path: '/seguros-education/analytics', label: 'Analytics', icon: ChartLine, visibleTo: ADMIN_GERENTE },
  ],
};

const WORKSPACE_ADMIN: WorkspaceDefinition = {
  id: 'administracion',
  label: 'Admin',
  icon: Settings,
  visibleTo: ADMIN_GERENTE,
  items: [
    { path: '/directorio', label: 'Usuarios', icon: Users, visibleTo: ADMIN_GERENTE },
    { path: '/configuracion', label: 'Configuracion', icon: SlidersHorizontal, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/actividad-usuarios', label: 'Actividad', icon: UserCheck, visibleTo: ADMIN_ONLY },
    { path: '/carga-masiva-usuarios', label: 'Carga Masiva', icon: Upload, visibleTo: ADMIN_ONLY },
    { path: '/admin-digital', label: 'Admin Digital', icon: LayoutTemplate, visibleTo: ADMIN_ONLY },
    { path: '/admin/importacion-masiva', label: 'Importación Masiva', icon: Database, visibleTo: ADMIN_ONLY },
    { path: '/admin/base-datos', label: 'Base de Datos', icon: HardDrive, visibleTo: ADMIN_ONLY },
    { path: '/admin/tramites', label: 'Trámites', icon: ClipboardList, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/admin/dias-no-habiles', label: 'Días No Hábiles', icon: Calendar, visibleTo: ADMIN_ONLY },
    { path: '/admin/config-jornada', label: 'Jornada Laboral', icon: Clock, visibleTo: ADMIN_ONLY },
    { path: '/comisiones', label: 'Comisiones Admin', icon: Percent, visibleTo: ADMIN_ONLY, matchPrefix: true, excludePrefixes: ['/comisiones/regimen-fiscal', '/comisiones/mapeo-vendedores'] },
    { path: '/comisiones/regimen-fiscal', label: 'Regimen Fiscal', icon: Receipt, visibleTo: ADMIN_ONLY, matchPrefix: true },
    { path: '/comisiones/mapeo-vendedores', label: 'Mapeo Vendedores', icon: GitBranch, visibleTo: ADMIN_ONLY },
    { path: '/sicas/salud', label: 'SICAS Salud', icon: HeartPulse, visibleTo: ADMIN_ONLY },
    { path: '/seguwallet-admin', label: 'Seguwallet', icon: Wallet, visibleTo: ADMIN_ONLY },
    { path: '/firmas-email', label: 'Firmas Email', icon: PenLine, visibleTo: ADMIN_ONLY },
    { path: '/admin/transaccionales', label: 'Transaccionales', icon: ArrowLeftRight, visibleTo: ADMIN_ONLY },
    { path: '/admin/diagnostico', label: 'Diagnostico', icon: SearchCode, visibleTo: ADMIN_ONLY },
    { path: '/admin/mascara', label: 'Mascara de Usuario', icon: UserCog, visibleTo: ADMIN_ONLY },
    { path: '/admin/telefonia', label: 'Telefonía', icon: Phone, visibleTo: ADMIN_ONLY },
    { path: '/admin/modulos', label: 'Control de Módulos', icon: LayoutGrid, visibleTo: ADMIN_ONLY },
    { path: '/admin/sidebar-editor', label: 'Editor de Sidebar', icon: PanelLeft, visibleTo: ADMIN_ONLY },
    { path: '/admin/dashboard-editor', label: 'Editor de Dashboard', icon: LayoutDashboard, visibleTo: ADMIN_ONLY },
    { path: '/admin/reportes-bugs', label: 'Reportes de Bugs', icon: Bug, visibleTo: ADMIN_ONLY },
    // Inteligencia Artificial
    { path: '/admin/chava-inteligencia', label: 'Dashboard IA', icon: BrainCircuit, visibleTo: ADMIN_ONLY },
    { path: '/admin/base-conocimiento', label: 'Base Conocimiento', icon: LibraryBig, visibleTo: ADMIN_ONLY },
    { path: '/admin/asistentes', label: 'Entrenamiento IA', icon: Bot, visibleTo: ADMIN_GERENTE, matchPrefix: true },
    { path: '/admin/automatizacion-ia', label: 'Robots IA', icon: Workflow, visibleTo: ADMIN_ONLY, matchPrefix: true },
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
  { type: 'link', item: { path: '/centro-digital', label: 'Centro Digital', icon: Monitor, visibleTo: ALL_ROLES } },
  { type: 'workspace', workspace: WORKSPACE_COMERCIAL },
  { type: 'workspace', workspace: WORKSPACE_CENTRO_CONTACTO },
  { type: 'workspace', workspace: WORKSPACE_COTIZAR },
  { type: 'workspace', workspace: WORKSPACE_PRODUCCION },
  { type: 'workspace', workspace: WORKSPACE_ADMIN },
  { type: 'workspace', workspace: WORKSPACE_OPERACIONES },
  { type: 'workspace', workspace: WORKSPACE_MERCADOTECNIA },
  { type: 'workspace', workspace: WORKSPACE_SEGUROS_EDUCATION },
  { type: 'link', item: { path: '/store', label: 'MOVI Store', icon: ShoppingBag, visibleTo: ALL_ROLES } },
  { type: 'link', item: { path: '/comunicados', label: 'Comunicados', icon: Newspaper, visibleTo: ALL_ROLES, matchPrefix: true } },
];

// ── Editor de Sidebar: orden/separadores/badges configurables desde Admin ──────
// No cambia rutas ni permisos — solo decora/reordena los NavEntry de arriba.

export interface SidebarConfigRow {
  entry_key: string;
  orden: number;
  separador_antes: boolean;
  badge_texto: string | null;
  badge_color: string;
}

export interface ResolvedNavEntry {
  entry: NavEntry;
  orden: number;
  separadorAntes: boolean;
  badge: { texto: string; color: string } | null;
}

/** Identificador estable de un NavEntry: el path del link, o el id del workspace. */
export function getEntryKey(entry: NavEntry): string {
  return entry.type === 'link' ? entry.item.path : entry.workspace.id;
}

/** Combina el orden fijo de NAV_ORDER con la config editable (orden/separador/badge) guardada en BD. */
export function resolveNavOrder(configRows: SidebarConfigRow[]): ResolvedNavEntry[] {
  const configByKey = new Map(configRows.map(c => [c.entry_key, c]));
  return NAV_ORDER
    .map((entry, idx) => {
      const key = getEntryKey(entry);
      const cfg = configByKey.get(key);
      return {
        entry,
        orden: cfg?.orden ?? idx,
        separadorAntes: cfg?.separador_antes ?? false,
        badge: cfg?.badge_texto ? { texto: cfg.badge_texto, color: cfg.badge_color } : null,
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

// ── Editor de Sidebar: grupos colapsables + orden/badge de items del panel blanco ──

export interface SidebarGrupo {
  id: string;
  workspace_id: string;
  nombre: string;
  orden: number;
  colapsado_default: boolean;
}

export interface SidebarItemConfigRow {
  item_path: string;
  orden: number;
  grupo_id: string | null;
  badge_texto: string | null;
  badge_color: string;
}

export interface SidebarSeparadorRow {
  id: string;
  workspace_id: string;
  grupo_id: string | null;
  orden: number;
}

export type ResolvedSidebarEntry =
  | { kind: 'item'; item: WorkspaceNavItem; badge: { texto: string; color: string } | null }
  | { kind: 'separador'; id: string };

export interface ResolvedItemGroup {
  grupo: SidebarGrupo | null; // null = sin grupo (se muestran primero, sin encabezado)
  items: ResolvedSidebarEntry[];
}

/** Agrupa y ordena los items (+ separadores independientes) de UN workspace según la config editable — retrocompatible: sin config, todo queda "sin grupo" en su orden original. */
export function resolveWorkspaceItems(
  workspace: WorkspaceDefinition,
  grupos: SidebarGrupo[],
  itemConfigs: SidebarItemConfigRow[],
  separadores: SidebarSeparadorRow[] = []
): ResolvedItemGroup[] {
  const configByPath = new Map(itemConfigs.map(c => [c.item_path, c]));
  const gruposDeEsteWorkspace = grupos
    .filter(g => g.workspace_id === workspace.id)
    .sort((a, b) => a.orden - b.orden);
  const gruposIds = new Set(gruposDeEsteWorkspace.map(g => g.id));

  type Entrada =
    | { kind: 'item'; orden: number; grupoId: string | null; item: WorkspaceNavItem; badge: { texto: string; color: string } | null }
    | { kind: 'separador'; orden: number; grupoId: string | null; id: string };

  const itemsConMeta: Entrada[] = workspace.items.map((item, idx) => {
    const cfg = configByPath.get(item.path);
    const grupoId = cfg?.grupo_id && gruposIds.has(cfg.grupo_id) ? cfg.grupo_id : null;
    return {
      kind: 'item',
      item,
      orden: cfg?.orden ?? idx,
      grupoId,
      badge: cfg?.badge_texto ? { texto: cfg.badge_texto, color: cfg.badge_color } : null,
    };
  });

  const separadoresConMeta: Entrada[] = separadores
    .filter(s => s.workspace_id === workspace.id)
    .map(s => ({
      kind: 'separador',
      id: s.id,
      orden: s.orden,
      grupoId: s.grupo_id && gruposIds.has(s.grupo_id) ? s.grupo_id : null,
    }));

  const todas = [...itemsConMeta, ...separadoresConMeta].sort((a, b) => a.orden - b.orden);
  const toResolved = (e: Entrada): ResolvedSidebarEntry =>
    e.kind === 'item' ? { kind: 'item', item: e.item, badge: e.badge } : { kind: 'separador', id: e.id };

  const resultado: ResolvedItemGroup[] = [];
  const sinGrupo = todas.filter(e => !e.grupoId);
  if (sinGrupo.length > 0) {
    resultado.push({ grupo: null, items: sinGrupo.map(toResolved) });
  }
  for (const g of gruposDeEsteWorkspace) {
    const items = todas.filter(e => e.grupoId === g.id);
    resultado.push({ grupo: g, items: items.map(toResolved) });
  }
  return resultado;
}

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
