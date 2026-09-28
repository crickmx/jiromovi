import { Fragment, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWorkspaceVisible, isTopLevelItemVisible, isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, WorkspaceId, UserRole } from '@/lib/workspaceConfig';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useSidebarItemsConfig } from '../../hooks/useSidebarItemsConfig';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';

const BADGE_COLORS: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
  orange: 'bg-orange-500 text-white',
};

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-3 py-1.5";

interface Props {
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
  topLevelBadges?: Record<string, number>;
}

export function HorizontalNav({
  workspace,
  activeItem: _activeItem,
  userRole,
  usuario,
  onSignOut,
  isModuleVisible,
  oficinaId,
  badgeCounts,
  topLevelBadges,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved } = useSidebarConfig();
  const { getResolvedItems } = useSidebarItemsConfig();
  const subNavRef = useRef<HTMLDivElement>(null);

  const getInitials = () => {
    const n = usuario?.nombre?.[0] || '';
    const a = usuario?.apellidos?.[0] || '';
    return `${n}${a}`.toUpperCase();
  };

  const isTopLevelActive = (path: string, matchPrefix?: boolean) => {
    if (location.pathname === path) return true;
    if (matchPrefix && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isSubItemActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  // Submenús del workspace activo
  const gruposResueltos = workspace
    ? getResolvedItems(workspace)
        .map(g => ({
          ...g,
          items: g.items.filter(entry =>
            entry.kind === 'separador' ||
            (isItemVisible(entry.item, userRole) &&
              (isModuleVisible ? isModuleVisible(entry.item.path, userRole, oficinaId) : true))
          ),
        }))
        .filter(g => g.items.some(entry => entry.kind === 'item'))
    : [];

  const hasSubNav = workspace && workspace.id !== 'produccion' && gruposResueltos.length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <header className="hidden md:flex flex-col w-full shrink-0 z-30 select-none shadow-sm">
        {/* ── TIER 1: Barra Principal Superior (Dark Charcoal / Brand Header) ── */}
        <div className="h-14 bg-[#141417] text-white border-b border-white/[0.08] px-4 flex items-center justify-between gap-4">
          
          {/* Logo MOVI */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all group"
              title="Ir al Dashboard"
            >
              <img
                src="/movirecurso_7.png"
                alt="MOVI"
                className="h-6 w-6 object-contain brightness-0 invert group-hover:scale-105 transition-transform"
              />
              <span className="font-extrabold text-sm tracking-tight text-white hidden lg:inline">
                MOVI
              </span>
            </button>
            <div className="w-px h-6 bg-white/10 hidden sm:block" />
          </div>

          {/* Menú Principal Horizontal (Workspaces & Top Links) */}
          <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1">
            {resolved.map(({ entry, separadorAntes, badge }, idx) => {
              const customBadgeEl = badge ? (
                <span
                  className={cn(
                    'px-1.5 py-[1px] rounded-full text-[8px] font-bold leading-none whitespace-nowrap',
                    BADGE_COLORS[badge.color] ?? BADGE_COLORS.amber
                  )}
                >
                  {badge.texto}
                </span>
              ) : null;

              if (entry.type === 'link') {
                const item = entry.item;
                if (!isTopLevelItemVisible(item, userRole)) return null;
                if (isModuleVisible && !isModuleVisible(item.path, userRole, oficinaId)) return null;
                const Icon = item.icon;
                const isActive = isTopLevelActive(item.path, item.matchPrefix);
                const tlBadge = topLevelBadges?.[item.path] ?? 0;

                return (
                  <Fragment key={`link-${idx}`}>
                    {separadorAntes && <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />}
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-medium shrink-0 transition-all duration-150 relative group',
                        isActive
                          ? 'bg-orange-500/20 text-orange-400 font-semibold ring-1 ring-orange-500/40 shadow-sm'
                          : 'text-neutral-300 hover:text-white hover:bg-white/8 active:scale-95'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-orange-400' : 'text-neutral-400 group-hover:text-white')} />
                      <span className="whitespace-nowrap">{item.label}</span>

                      {/* Attention Badge */}
                      {tlBadge > 0 && (
                        <span className="relative flex items-center justify-center shrink-0">
                          <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                          <span className="relative min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                            {tlBadge > 99 ? '99+' : tlBadge}
                          </span>
                        </span>
                      )}

                      {customBadgeEl}

                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-full" />
                      )}
                    </button>
                  </Fragment>
                );
              }

              const ws = entry.workspace;
              if (!isWorkspaceVisible(ws, userRole)) return null;
              if (isModuleVisible) {
                const anyVisible = ws.items.some(item =>
                  isTopLevelItemVisible(item as any, userRole) &&
                  isModuleVisible(item.path, userRole, oficinaId)
                );
                if (!anyVisible) return null;
              }
              const Icon = ws.icon;
              const isActive = ws.id === (workspace?.id ?? null);
              const firstVisibleItem = ws.items.find(item =>
                isTopLevelItemVisible(item as any, userRole) &&
                (!isModuleVisible || isModuleVisible(item.path, userRole, oficinaId))
              );
              const firstPath = firstVisibleItem?.path || '/dashboard';

              return (
                <Fragment key={ws.id}>
                  {separadorAntes && <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />}
                  <button
                    onClick={() => navigate(firstPath)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12.5px] font-medium shrink-0 transition-all duration-150 relative group',
                      isActive
                        ? 'bg-orange-500/20 text-orange-400 font-semibold ring-1 ring-orange-500/40 shadow-sm'
                        : 'text-neutral-300 hover:text-white hover:bg-white/8 active:scale-95'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-orange-400' : 'text-neutral-400 group-hover:text-white')} />
                    <span className="whitespace-nowrap">{ws.label}</span>
                    {customBadgeEl}

                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-full" />
                    )}
                  </button>
                </Fragment>
              );
            })}
          </nav>

          {/* Utilidades Derecha (Chava, Alertas, Tema, Perfil, Salir) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Chava IA — Admin only */}
            {userRole === 'Administrador' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/chava')}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-transform"
                  >
                    <ChavaOrbIcon size="sm" sidebarVariant />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                  Chava IA
                </TooltipContent>
              </Tooltip>
            )}

            {/* Campana de Notificaciones */}
            <NotificationBell compact fixedPanel />

            {/* Toggle Tema */}
            <ThemeToggle compact />

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {/* Perfil Usuario Capsule */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/perfil')}
                  className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-left"
                >
                  <Avatar className="h-7 w-7 rounded-lg ring-1 ring-white/20">
                    <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-lg" />
                    <AvatarFallback className="text-[10px] font-bold rounded-lg bg-orange-500 text-white">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-neutral-200 truncate max-w-[100px] hidden xl:inline">
                    {usuario?.nombre}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                {usuario?.nombre} {usuario?.apellidos} · Mi Perfil
              </TooltipContent>
            </Tooltip>

            {/* Cerrar Sesión */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSignOut}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                Cerrar Sesión
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── TIER 2: Sub-Barra de Navegación del Workspace Activo ── */}
        {hasSubNav && (
          <div
            ref={subNavRef}
            className="h-11 bg-white dark:bg-[#111113] border-b border-neutral-200/90 dark:border-white/[0.07] px-4 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
          >
            {/* Workspace Label Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 font-bold text-[11px] uppercase tracking-wider shrink-0">
              <workspace.icon className="w-3.5 h-3.5 text-orange-500" />
              <span>{workspace.label}</span>
            </div>

            <div className="w-px h-5 bg-neutral-200 dark:bg-white/10 shrink-0 mx-1" />

            {/* Sub-Items Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {gruposResueltos.map(({ grupo, items }) => (
                <div key={grupo?.id ?? '_sin_grupo'} className="flex items-center gap-1 shrink-0">
                  {grupo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1.5 shrink-0">
                      {grupo.nombre}:
                    </span>
                  )}
                  {items.map((entry) => {
                    if (entry.kind === 'separador') {
                      return <div key={`sep-${entry.id}`} className="w-px h-4 bg-neutral-200 dark:bg-white/10 mx-1 shrink-0" />;
                    }

                    const { item, badge: customBadge } = entry;
                    const active = isSubItemActive(item);
                    const badge = badgeCounts?.[item.path] ?? 0;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium shrink-0 transition-all duration-150 relative group',
                          active
                            ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs ring-1 ring-orange-500/30'
                            : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                        )}
                      >
                        <Icon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', active ? 'text-orange-500' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200')} />
                        <span className="whitespace-nowrap">{item.label}</span>

                        {badge > 0 && (
                          <span className="relative flex items-center justify-center shrink-0">
                            <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                            <span className="relative min-w-[15px] h-3.5 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          </span>
                        )}

                        {customBadge && (
                          <span className={cn('px-1.5 py-[1px] rounded-full text-[8px] font-bold leading-none whitespace-nowrap', BADGE_COLORS[customBadge.color] ?? BADGE_COLORS.amber)}>
                            {customBadge.texto}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
    </TooltipProvider>
  );
}
