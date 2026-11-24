import { Fragment, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, MoreHorizontal, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWorkspaceVisible, isTopLevelItemVisible, isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole, NavEntry } from '@/lib/workspaceConfig';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
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

// Cantidad de accesos primarios visibles antes de agrupar en "Más"
const PRIMARY_PRIORITY_COUNT = 7;

interface PrimaryNavProps {
  workspace: WorkspaceDefinition | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  topLevelBadges?: Record<string, number>;
}

export function PrimaryNav({
  workspace,
  userRole,
  usuario,
  onSignOut,
  isModuleVisible,
  oficinaId,
  topLevelBadges,
}: PrimaryNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved } = useSidebarConfig();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowSearch, setOverflowSearch] = useState('');
  const overflowRef = useRef<HTMLDivElement>(null);

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

  // Close overflow on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    if (overflowOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [overflowOpen]);

  // Filtrar elementos visibles
  const visibleEntries = resolved.filter(({ entry }) => {
    if (entry.type === 'link') {
      if (!isTopLevelItemVisible(entry.item, userRole)) return false;
      if (isModuleVisible && !isModuleVisible(entry.item.path, userRole, oficinaId)) return false;
      return true;
    }
    const ws = entry.workspace;
    if (!isWorkspaceVisible(ws, userRole)) return false;
    if (isModuleVisible) {
      const anyVisible = ws.items.some(item =>
        isTopLevelItemVisible(item as any, userRole) &&
        isModuleVisible(item.path, userRole, oficinaId)
      );
      if (!anyVisible) return false;
    }
    return true;
  });

  const primaryItems = visibleEntries.slice(0, PRIMARY_PRIORITY_COUNT);
  const overflowItems = visibleEntries.slice(PRIMARY_PRIORITY_COUNT);

  // Filtrar items del overflow por búsqueda
  const filteredOverflow = overflowItems.filter(({ entry }) => {
    const label = entry.type === 'link' ? entry.item.label : entry.workspace.label;
    return label.toLowerCase().includes(overflowSearch.toLowerCase());
  });

  const isEntryActive = (entry: NavEntry) => {
    if (entry.type === 'link') return isTopLevelActive(entry.item.path, entry.item.matchPrefix);
    return entry.workspace.id === (workspace?.id ?? null);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-12 bg-white dark:bg-[#111114] border-b border-neutral-200/90 dark:border-white/[0.08] px-4 flex items-center justify-between gap-3 select-none">
        
        {/* Izquierda: Logo MOVI */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 active:scale-95 transition-all group"
            title="Ir al Dashboard"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-5 w-5 object-contain dark:brightness-0 dark:invert group-hover:scale-105 transition-transform"
            />
            <span className="font-extrabold text-xs tracking-tight text-neutral-900 dark:text-white hidden lg:inline">
              MOVI
            </span>
          </button>
          <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 hidden sm:block" />
        </div>

        {/* Centro: Elementos Primarios Prioritarios */}
        <nav aria-label="Navegación principal" className="flex items-center gap-1 flex-1 min-w-0 justify-center">
          {primaryItems.map(({ entry, badge }, idx) => {
            const isActive = isEntryActive(entry);
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
              const Icon = item.icon;
              const tlBadge = topLevelBadges?.[item.path] ?? 0;

              return (
                <button
                  key={`prim-link-${idx}`}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all shrink-0 relative',
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                  <span className="whitespace-nowrap">{item.label}</span>

                  {tlBadge > 0 && (
                    <span className="relative flex items-center justify-center shrink-0">
                      <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                      <span className="relative min-w-[14px] h-3.5 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {tlBadge > 99 ? '99+' : tlBadge}
                      </span>
                    </span>
                  )}
                  {customBadgeEl}
                  {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full" />}
                </button>
              );
            }

            const ws = entry.workspace;
            const Icon = ws.icon;
            const firstVisibleItem = ws.items.find(item =>
              isTopLevelItemVisible(item as any, userRole) &&
              (!isModuleVisible || isModuleVisible(item.path, userRole, oficinaId))
            );
            const firstPath = firstVisibleItem?.path || '/dashboard';

            return (
              <button
                key={`prim-ws-${ws.id}`}
                onClick={() => navigate(firstPath)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all shrink-0 relative',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                <span className="whitespace-nowrap">{ws.label}</span>
                {customBadgeEl}
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full" />}
              </button>
            );
          })}

          {/* Botón "Más" (Overflow Dropdown) */}
          {overflowItems.length > 0 && (
            <div className="relative" ref={overflowRef}>
              <button
                onClick={() => setOverflowOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium transition-colors',
                  overflowItems.some(i => isEntryActive(i.entry))
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                )}
                title="Más secciones"
                aria-expanded={overflowOpen}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                <span>Más</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {overflowOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#18181c] border border-neutral-200 dark:border-white/10 shadow-xl z-50 p-2 divide-y divide-neutral-100 dark:divide-white/5">
                  {overflowItems.length > 5 && (
                    <div className="pb-1.5">
                      <div className="relative">
                        <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={overflowSearch}
                          onChange={e => setOverflowSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="w-full pl-6 pr-2 py-1 text-xs bg-neutral-100 dark:bg-white/5 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-1 space-y-0.5 max-h-60 overflow-y-auto">
                    {filteredOverflow.map(({ entry }, idx) => {
                      const isActive = isEntryActive(entry);
                      const label = entry.type === 'link' ? entry.item.label : entry.workspace.label;
                      const Icon = entry.type === 'link' ? entry.item.icon : entry.workspace.icon;
                      const path = entry.type === 'link' ? entry.item.path : (entry.workspace.items[0]?.path || '/dashboard');

                      return (
                        <button
                          key={`overflow-${idx}`}
                          onClick={() => {
                            navigate(path);
                            setOverflowOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
                            isActive
                              ? 'bg-accent/10 text-accent font-semibold'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate flex-1">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Derecha: Utilidades del Usuario */}
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

          {/* Notificaciones */}
          <NotificationBell compact fixedPanel />

          {/* Toggle de Tema */}
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
    </TooltipProvider>
  );
}
