import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ORDER, isWorkspaceVisible, isTopLevelItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceId, UserRole } from '@/lib/workspaceConfig';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface Props {
  activeWorkspaceId: WorkspaceId | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
}

export function PrimarySidebar({ activeWorkspaceId, userRole, usuario, onSignOut }: Props) {
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full w-[72px] items-center bg-[#0f1117] dark:bg-[#0a0a0c]">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 w-full">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-11 h-11 rounded-2xl bg-white/[0.06] flex items-center justify-center transition-all duration-200 hover:bg-white/[0.1] hover:scale-105 active:scale-95"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-6 w-6 object-contain brightness-0 invert opacity-90"
            />
          </button>
        </div>

        {/* Separator */}
        <div className="w-8 h-px bg-white/[0.06] mb-2" />

        {/* Navigation - ordered list */}
        <div className="flex-1 flex flex-col items-center gap-1.5 py-2 overflow-y-auto w-full px-2.5">
          {NAV_ORDER.map((entry, idx) => {
            if (entry.type === 'link') {
              const item = entry.item;
              if (!isTopLevelItemVisible(item, userRole)) return null;
              const Icon = item.icon;
              const isActive = isTopLevelActive(item.path, item.matchPrefix);

              return (
                <Tooltip key={`link-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200",
                        "hover:bg-white/[0.08] active:scale-90",
                        isActive
                          ? "bg-accent/20 text-accent shadow-[0_0_12px_rgba(var(--movi-accent-rgb)/0.2)] ring-1 ring-accent/30"
                          : "text-neutral-500 hover:text-white"
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-xs font-medium bg-neutral-800 border-neutral-700">
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

            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(firstPath)}
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200",
                      "hover:bg-white/[0.08] active:scale-90",
                      isActive
                        ? "bg-accent/20 text-accent shadow-[0_0_12px_rgba(var(--movi-accent-rgb)/0.2)] ring-1 ring-accent/30"
                        : "text-neutral-500 hover:text-white"
                    )}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs font-medium bg-neutral-800 border-neutral-700">
                  {ws.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Profile */}
        <div className="flex flex-col items-center gap-2.5 pb-4 pt-3 w-full">
          <div className="w-8 h-px bg-white/[0.06] mb-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/perfil')}
                className="rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 ring-2 ring-white/[0.06] hover:ring-accent/30"
              >
                <Avatar className="h-9 w-9 rounded-xl">
                  <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} className="rounded-xl" />
                  <AvatarFallback className="bg-accent/20 text-accent text-xs font-bold rounded-xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="text-xs bg-neutral-800 border-neutral-700">
              {usuario?.nombre} {usuario?.apellidos}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSignOut}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="text-xs bg-neutral-800 border-neutral-700">
              Cerrar Sesion
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
