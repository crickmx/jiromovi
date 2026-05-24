import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACES, isWorkspaceVisible } from '@/lib/workspaceConfig';
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

  const getInitials = () => {
    const n = usuario?.nombre?.[0] || '';
    const a = usuario?.apellidos?.[0] || '';
    return `${n}${a}`.toUpperCase();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full w-[68px] items-center bg-neutral-900 dark:bg-neutral-950 border-r border-neutral-800 dark:border-white/5">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 w-full border-b border-neutral-800 dark:border-white/5">
          <button
            onClick={() => navigate('/dashboard')}
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-7 w-7 object-contain brightness-0 invert opacity-90"
            />
          </button>
        </div>

        {/* Workspace Icons */}
        <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
          {WORKSPACES.filter(ws => isWorkspaceVisible(ws, userRole)).map((ws) => {
            const Icon = ws.icon;
            const isActive = ws.id === activeWorkspaceId;
            const firstPath = ws.items[0]?.path || '/dashboard';

            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(firstPath)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                      "hover:bg-white/10 active:scale-95",
                      isActive
                        ? "bg-white/15 text-white shadow-sm shadow-white/5"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">
                  {ws.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Profile */}
        <div className="flex flex-col items-center gap-2 pb-3 pt-2 border-t border-neutral-800 dark:border-white/5 w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/perfil')}
                className="rounded-full transition-transform hover:scale-105 active:scale-95"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} />
                  <AvatarFallback className="bg-white/10 text-white text-xs font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {usuario?.nombre} {usuario?.apellidos}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSignOut}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Cerrar Sesion
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
