import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWorkspaceVisible, isTopLevelItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceId, UserRole } from '@/lib/workspaceConfig';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
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

interface Props {
  activeWorkspaceId: WorkspaceId | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  mobileMode?: boolean;
  onMobileClose?: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  workspaceBadges?: Partial<Record<WorkspaceId, number>>;
  topLevelBadges?: Record<string, number>;
}

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-3 py-1.5";

export function PrimarySidebar({ activeWorkspaceId, userRole, usuario, onSignOut, mobileMode, onMobileClose, isModuleVisible, oficinaId, workspaceBadges, topLevelBadges }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved } = useSidebarConfig();

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

  const handleNav = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="sidebar-rail flex flex-col h-full w-[84px] items-center">

        {/* Logo / Close button on mobile */}
        <div className="flex items-center justify-center h-16 w-full relative">
          {mobileMode && (
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-1 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleNav('/dashboard')}
            className="sidebar-rail-logo-btn w-11 h-11 rounded-2xl flex items-center justify-center"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-6 w-6 object-contain brightness-0 invert"
            />
          </button>
        </div>

        {/* Separator */}
        <div className="sidebar-rail-sep w-8 h-px mb-2" />

        {/* Navigation */}
        <div className="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto w-full px-1.5">
          {resolved.map(({ entry, separadorAntes, badge }, idx) => {
            const separatorEl = separadorAntes ? (
              <div key={`sep-${idx}`} className="sidebar-rail-sep w-8 h-px my-1" />
            ) : null;

            const customBadgeEl = badge ? (
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 px-1 py-[1px] rounded-full text-[7px] font-bold leading-none whitespace-nowrap',
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

              const tlBadgeEl = tlBadge > 0 ? (
                <span className="absolute -top-1 -right-1 flex items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  <span className="relative min-w-[16px] h-4 px-[3px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {tlBadge > 99 ? '99+' : tlBadge}
                  </span>
                </span>
              ) : null;

              if (mobileMode) {
                return (
                  <Fragment key={`link-${idx}`}>
                    {separatorEl}
                    <button
                      onClick={() => handleNav(item.path)}
                      className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 relative', isActive && 'active')}
                      title={badge ? `${item.label} · ${badge.texto}` : item.label}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                      {tlBadgeEl}
                      {customBadgeEl}
                    </button>
                  </Fragment>
                );
              }

              return (
                <Fragment key={`link-${idx}`}>
                  {separatorEl}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNav(item.path)}
                        className={cn('sidebar-rail-btn w-full py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-90', isActive && 'active')}
                      >
                        <span className="relative flex items-center justify-center w-[18px] h-[18px]">
                          <Icon className="w-[18px] h-[18px]" />
                          {tlBadgeEl}
                          {customBadgeEl}
                        </span>
                        <span className="text-[8.5px] leading-[1.15] font-semibold uppercase tracking-wide text-center line-clamp-2 px-0.5">
                          {item.label}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                      {badge ? `${item.label} · ${badge.texto}` : item.label}
                    </TooltipContent>
                  </Tooltip>
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
            const isActive = ws.id === activeWorkspaceId;
            const firstVisibleItem = ws.items.find(item =>
              isTopLevelItemVisible(item as any, userRole) &&
              (!isModuleVisible || isModuleVisible(item.path, userRole, oficinaId))
            );
            const firstPath = firstVisibleItem?.path || '/dashboard';
            const wsBadge = workspaceBadges?.[ws.id] ?? 0;

            const wsBadgeEl = wsBadge > 0 ? (
              <span className="absolute -top-1 -right-1 flex items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <span className="relative min-w-[16px] h-4 px-[3px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {wsBadge > 99 ? '99+' : wsBadge}
                </span>
              </span>
            ) : null;

            if (mobileMode) {
              const wsButton = (
                <button
                  onClick={() => handleNav(firstPath)}
                  className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 relative', isActive && 'active')}
                  title={badge ? `${ws.label} · ${badge.texto}` : ws.label}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {wsBadgeEl}
                  {customBadgeEl}
                </button>
              );
              return <Fragment key={ws.id}>{separatorEl}<div>{wsButton}</div></Fragment>;
            }

            return (
              <Fragment key={ws.id}>
                {separatorEl}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav(firstPath)}
                      className={cn('sidebar-rail-btn w-full py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-90', isActive && 'active')}
                    >
                      <span className="relative flex items-center justify-center w-[18px] h-[18px]">
                        <Icon className="w-[18px] h-[18px]" />
                        {wsBadgeEl}
                        {customBadgeEl}
                      </span>
                      <span className="text-[8.5px] leading-[1.15] font-semibold uppercase tracking-wide text-center line-clamp-2 px-0.5">
                        {ws.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                    {badge ? `${ws.label} · ${badge.texto}` : ws.label}
                  </TooltipContent>
                </Tooltip>
              </Fragment>
            );
          })}
        </div>

        {/* Profile + Controls */}
        <div className="flex flex-col items-center gap-2.5 pb-4 pt-3 w-full">
          <div className="sidebar-rail-sep w-8 h-px mb-1" />

          {/* Chava AI — admin only */}
          {userRole === 'Administrador' && (mobileMode ? (
            <button
              onClick={() => handleNav('/chava')}
              className="sidebar-rail-chava-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90"
              title="Chava IA"
            >
              <ChavaOrbIcon size="sm" sidebarVariant />
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNav('/chava')}
                  className="sidebar-rail-chava-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90"
                >
                  <ChavaOrbIcon size="sm" sidebarVariant />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                Chava IA
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Notification Bell */}
          <div className="flex items-center justify-center w-11">
            <NotificationBell compact fixedPanel />
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-center w-11">
            <ThemeToggle compact />
          </div>

          {mobileMode ? (
            <button
              onClick={() => handleNav('/perfil')}
              className="sidebar-rail-avatar-ring rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Avatar className="h-9 w-9 rounded-xl">
                <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-xl" />
                <AvatarFallback className="sidebar-rail-avatar-fallback text-xs font-bold rounded-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNav('/perfil')}
                  className="sidebar-rail-avatar-ring rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Avatar className="h-9 w-9 rounded-xl">
                    <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-xl" />
                    <AvatarFallback className="sidebar-rail-avatar-fallback text-xs font-bold rounded-xl">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                {usuario?.nombre} {usuario?.apellidos}
              </TooltipContent>
            </Tooltip>
          )}

          {mobileMode ? (
            <button
              onClick={onSignOut}
              className="sidebar-rail-signout w-9 h-9 rounded-xl flex items-center justify-center active:scale-90"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSignOut}
                  className="sidebar-rail-signout w-9 h-9 rounded-xl flex items-center justify-center active:scale-90"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                Cerrar Sesión
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
