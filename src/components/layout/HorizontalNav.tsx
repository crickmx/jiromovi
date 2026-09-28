import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWorkspaceVisible, isTopLevelItemVisible, isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
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
};

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-2.5 py-1";

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
      <header className="hidden md:flex flex-col w-full shrink-0 z-30 select-none shadow-xs">
        {/* ── TIER 1: Barra Principal Superior Compacta (Tema Dinámico MOVI) ── */}
        <div className="h-12 bg-white dark:bg-[#111113] border-b border-neutral-200/80 dark:border-white/[0.08] px-3.5 flex items-center justify-between gap-3">
          
          {/* Logo MOVI */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all group"
              title="Dashboard"
            >
              <img
                src="/movirecurso_7.png"
                alt="MOVI"
                className="h-5 w-5 object-contain dark:brightness-0 dark:invert group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-xs tracking-tight text-neutral-900 dark:text-white hidden lg:inline">
                MOVI
              </span>
            </button>
            <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 hidden sm:block" />
          </div>

          {/* Menú Principal Horizontal (Compacto sin scroll forzado) */}
          <nav className="flex items-center gap-0.5 justify-center flex-1 min-w-0 flex-wrap">
            {resolved.map(({ entry, separadorAntes, badge }, idx) => {
              const customBadgeEl = badge ? (
                <span
                  className={cn(
                    'px-1 py-[0.5px] rounded-full text-[8px] font-bold leading-none whitespace-nowrap',
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
                    {separadorAntes && <div className="w-px h-3.5 bg-neutral-200 dark:bg-white/10 mx-0.5 shrink-0" />}
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium shrink-0 transition-all duration-150 relative',
                        isActive
                          ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15'
                          : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95'
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                      <span className="whitespace-nowrap">{item.label}</span>

                      {/* Attention Badge */}
                      {tlBadge > 0 && (
                        <span className="relative flex items-center justify-center shrink-0">
                          <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                          <span className="relative min-w-[14px] h-3.5 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                            {tlBadge > 99 ? '99+' : tlBadge}
                          </span>
                        </span>
                      )}

                      {customBadgeEl}

                      {/* Active line indicator */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full" />
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
                  {separadorAntes && <div className="w-px h-3.5 bg-neutral-200 dark:bg-white/10 mx-0.5 shrink-0" />}
                  <button
                    onClick={() => navigate(firstPath)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium shrink-0 transition-all duration-150 relative',
                      isActive
                        ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95'
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                    <span className="whitespace-nowrap">{ws.label}</span>
                    {customBadgeEl}

                    {/* Active line indicator */}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full" />
                    )}
                  </button>
                </Fragment>
              );
            })}
          </nav>

          {/* Utilidades Derecha Compactas (Chava, Alertas, Tema, Perfil, Salir) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Chava IA — Admin only */}
            {userRole === 'Administrador' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/chava')}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-90 transition-transform"
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

            <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 mx-0.5" />

            {/* Perfil Usuario Capsule */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/perfil')}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all text-left"
                >
                  <Avatar className="h-6 w-6 rounded-md ring-1 ring-neutral-200 dark:ring-white/10">
                    <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-md" />
                    <AvatarFallback className="text-[9px] font-bold rounded-md bg-accent text-accent-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11.5px] font-semibold text-neutral-700 dark:text-neutral-200 truncate max-w-[90px] hidden xl:inline">
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
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-90 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                Cerrar Sesión
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── TIER 2: Sub-Barra Contextual Compacta (34px de altura) ── */}
        {hasSubNav && (
          <div className="h-[34px] bg-neutral-50/90 dark:bg-[#0a0a0c] border-b border-neutral-200/80 dark:border-white/[0.06] px-3.5 flex items-center gap-1.5 justify-center flex-wrap">
            {/* Workspace Label Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-200/70 dark:bg-white/10 text-neutral-700 dark:text-neutral-200 font-bold text-[10px] uppercase tracking-wider shrink-0">
              <workspace.icon className="w-3 h-3 text-accent" />
              <span>{workspace.label}</span>
            </div>

            <div className="w-px h-3.5 bg-neutral-300 dark:bg-white/10 shrink-0 mx-0.5" />

            {/* Sub-Items Tabs */}
            <div className="flex items-center gap-0.5 flex-wrap">
              {gruposResueltos.map(({ grupo, items }) => (
                <div key={grupo?.id ?? '_sin_grupo'} className="flex items-center gap-0.5 shrink-0">
                  {grupo && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1 shrink-0">
                      {grupo.nombre}:
                    </span>
                  )}
                  {items.map((entry) => {
                    if (entry.kind === 'separador') {
                      return <div key={`sep-${entry.id}`} className="w-px h-3 bg-neutral-200 dark:bg-white/10 mx-0.5 shrink-0" />;
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
                          'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium shrink-0 transition-all duration-150',
                          active
                            ? 'bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-xs ring-1 ring-accent/30'
                            : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                        )}
                      >
                        <Icon className={cn('w-3 h-3 shrink-0 transition-colors', active ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                        <span className="whitespace-nowrap">{item.label}</span>

                        {badge > 0 && (
                          <span className="relative flex items-center justify-center shrink-0">
                            <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                            <span className="relative min-w-[13px] h-3 px-1 bg-red-500 text-white text-[7.5px] font-bold rounded-full flex items-center justify-center leading-none">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          </span>
                        )}

                        {customBadge && (
                          <span className={cn('px-1 py-[0.5px] rounded-full text-[7.5px] font-bold leading-none whitespace-nowrap', BADGE_COLORS[customBadge.color] ?? BADGE_COLORS.amber)}>
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
