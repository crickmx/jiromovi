import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ORDER, isWorkspaceVisible, isTopLevelItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceId, UserRole } from '@/lib/workspaceConfig';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';

interface Props {
  activeWorkspaceId: WorkspaceId | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  mobileMode?: boolean;
  onMobileClose?: () => void;
}

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-3 py-1.5";

export function PrimarySidebar({ activeWorkspaceId, userRole, usuario, onSignOut, mobileMode, onMobileClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

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
      <div className="sidebar-rail flex flex-col h-full w-[72px] items-center">

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
        <div className="flex-1 flex flex-col items-center gap-1.5 py-2 overflow-y-auto w-full px-2.5">
          {NAV_ORDER.map((entry, idx) => {
            if (entry.type === 'link') {
              const item = entry.item;
              if (!isTopLevelItemVisible(item, userRole)) return null;
              const Icon = item.icon;
              const isActive = isTopLevelActive(item.path, item.matchPrefix);

              if (mobileMode) {
                return (
                  <button
                    key={`link-${idx}`}
                    onClick={() => handleNav(item.path)}
                    className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90', isActive && 'active')}
                    title={item.label}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </button>
                );
              }

              return (
                <Tooltip key={`link-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav(item.path)}
                      className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90', isActive && 'active')}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            const ws = entry.workspace;
            if (!isWorkspaceVisible(ws, userRole)) return null;
            const Icon = ws.icon;
            const isActive = ws.id === activeWorkspaceId;
            const firstPath = ws.items[0]?.path || '/dashboard';

            if (mobileMode) {
              return (
                <button
                  key={ws.id}
                  onClick={() => handleNav(firstPath)}
                  className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90', isActive && 'active')}
                  title={ws.label}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </button>
              );
            }

            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNav(firstPath)}
                    className={cn('sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90', isActive && 'active')}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className={TOOLTIP_CLS}>
                  {ws.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Profile + Controls */}
        <div className="flex flex-col items-center gap-2.5 pb-4 pt-3 w-full">
          <div className="sidebar-rail-sep w-8 h-px mb-1" />

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
