import { useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, LogOut, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-2.5 py-1";

interface DesktopHeaderProps {
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  userRole: string;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  onOpenQuickSearch?: () => void;
}

export function DesktopHeader({
  sidebarExpanded,
  onToggleSidebar,
  userRole,
  usuario,
  onSignOut,
  onOpenQuickSearch,
}: DesktopHeaderProps) {
  const navigate = useNavigate();

  const getInitials = () => {
    const n = usuario?.nombre?.[0] || '';
    const a = usuario?.apellidos?.[0] || '';
    return `${n}${a}`.toUpperCase();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <header className="hidden md:flex h-[52px] w-full bg-white dark:bg-[#111114] border-b border-neutral-200/90 dark:border-white/[0.08] px-4 items-center justify-between gap-4 select-none shrink-0 z-40 shadow-2xs">
        
        {/* Izquierda: Toggle Sidebar + Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Botón Colapsar/Expandir Barra Lateral */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleSidebar}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all"
                aria-label={sidebarExpanded ? 'Colapsar barra lateral' : 'Expandir barra lateral'}
              >
                {sidebarExpanded ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={TOOLTIP_CLS}>
              {sidebarExpanded ? 'Colapsar menú (264px → 72px)' : 'Expandir menú lateral'}
            </TooltipContent>
          </Tooltip>

          {/* Logo MOVI Oficial */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 py-1 px-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all group"
            title="Ir al Dashboard"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-6 w-6 object-contain dark:brightness-0 dark:invert group-hover:scale-105 transition-transform"
            />
            <span className="font-extrabold text-sm tracking-tight text-neutral-900 dark:text-white">
              MOVI
            </span>
          </button>
        </div>

        {/* Centro: Buscador Global Rápido */}
        <div className="flex-1 max-w-md mx-auto hidden lg:flex">
          <button
            onClick={onOpenQuickSearch}
            className="w-full h-8 px-3 rounded-xl bg-neutral-100/80 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/15 flex items-center justify-between text-neutral-400 dark:text-neutral-400 transition-colors group text-xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200" />
              <span>Buscar sección, trámite o contacto...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-neutral-800 rounded border border-neutral-200 dark:border-white/10 text-neutral-500 shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Derecha: Utilidades Globales */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Chava IA — Solo Administrador */}
          {userRole === 'Administrador' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/chava')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-90 transition-transform"
                >
                  <ChavaOrbIcon size="sm" sidebarVariant />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                Chava IA
              </TooltipContent>
            </Tooltip>
          )}

          {/* Notificaciones */}
          <NotificationBell compact fixedPanel />

          {/* Toggle de Tema */}
          <ThemeToggle compact />

          <div className="w-px h-5 bg-neutral-200 dark:bg-white/10 mx-0.5" />

          {/* Perfil Usuario Capsule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/perfil')}
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all text-left"
              >
                <Avatar className="h-7 w-7 rounded-lg ring-1 ring-neutral-200 dark:ring-white/10">
                  <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-lg" />
                  <AvatarFallback className="text-[10px] font-bold rounded-lg bg-accent text-accent-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[110px] leading-tight">
                    {usuario?.nombre}
                  </span>
                  <span className="text-[10px] text-neutral-400 capitalize truncate">
                    {usuario?.rol || 'Usuario'}
                  </span>
                </div>
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
                className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-90 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={TOOLTIP_CLS}>
              Cerrar Sesión
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
