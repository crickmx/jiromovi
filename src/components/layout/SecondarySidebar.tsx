import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { useSidebarItemsConfig } from '../../hooks/useSidebarItemsConfig';

const BADGE_COLORS: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
};

interface Props {
  workspace: WorkspaceDefinition;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileMode?: boolean;
  onMobileItemClick?: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
}

export function SecondarySidebar({ workspace, activeItem, userRole, collapsed, onToggleCollapse, mobileMode, onMobileItemClick, isModuleVisible, oficinaId, badgeCounts }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getResolvedItems } = useSidebarItemsConfig();
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});

  const gruposResueltos = getResolvedItems(workspace)
    .map(g => ({
      ...g,
      items: g.items.filter(entry =>
        entry.kind === 'separador' ||
        (isItemVisible(entry.item, userRole) &&
          (isModuleVisible ? isModuleVisible(entry.item.path, userRole, oficinaId) : true))
      ),
    }))
    .filter(g => g.items.some(entry => entry.kind === 'item'));

  const isGrupoColapsado = (grupoId: string, defaultColapsado: boolean) =>
    gruposColapsados[grupoId] ?? defaultColapsado;

  const toggleGrupo = (grupoId: string, defaultColapsado: boolean) =>
    setGruposColapsados(prev => ({ ...prev, [grupoId]: !isGrupoColapsado(grupoId, defaultColapsado) }));

  const isActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  const handleNav = (path: string) => {
    navigate(path);
    onMobileItemClick?.();
  };

  // When collapsed (desktop only): render a slim expand-tab
  if (collapsed && !mobileMode) {
    return (
      <div className="flex flex-col h-full w-[8px] relative group">
        {/* Invisible wider hit area + visible indicator strip */}
        <button
          onClick={onToggleCollapse}
          aria-label="Expandir menú"
          className={cn(
            "absolute inset-y-0 -left-1 w-[18px] flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            "cursor-pointer"
          )}
        >
          <div className="h-10 w-1 rounded-full bg-accent/40 hover:bg-accent transition-colors" />
        </button>
        {/* Floating expand button near the top */}
        <button
          onClick={onToggleCollapse}
          aria-label="Expandir menú"
          className={cn(
            "absolute top-[72px] -right-4 z-10",
            "w-7 h-7 rounded-full flex items-center justify-center shadow-md",
            "bg-white dark:bg-[#1a1a1f] border border-neutral-200 dark:border-white/10",
            "text-neutral-400 hover:text-accent dark:hover:text-accent",
            "transition-all duration-200 hover:scale-110 active:scale-95"
          )}
        >
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-[208px] bg-white dark:bg-[#111113] border-r border-neutral-200 dark:border-white/[0.07] shadow-[1px_0_8px_rgba(0,0,0,0.04)]">
      {/* Workspace header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent/10 dark:bg-accent/15 flex-shrink-0">
            <workspace.icon className="w-4 h-4 text-accent" />
          </div>
          <span className="text-[13px] font-bold text-neutral-900 dark:text-white truncate tracking-tight">
            {workspace.label}
          </span>
        </div>
        {!mobileMode && (
          <button
            onClick={onToggleCollapse}
            aria-label="Colapsar menú"
            className="p-1.5 rounded-xl text-neutral-500 hover:text-accent hover:bg-accent/8 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/10 transition-all flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav items — text only, no icon repetition — agrupados según el Editor de Sidebar */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {gruposResueltos.map(({ grupo, items }) => {
          const colapsado = grupo ? isGrupoColapsado(grupo.id, grupo.colapsado_default) : false;
          return (
            <div key={grupo?.id ?? '_sin_grupo'} className={grupo ? 'pt-2 first:pt-0' : ''}>
              {grupo && (
                <button
                  onClick={() => toggleGrupo(grupo.id, grupo.colapsado_default)}
                  className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-white/40 hover:text-neutral-600 dark:hover:text-white/60 transition-colors"
                >
                  {colapsado ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span className="truncate">{grupo.nombre}</span>
                </button>
              )}
              {!colapsado && items.map((entry) => {
                if (entry.kind === 'separador') {
                  return <div key={`sep-${entry.id}`} className="my-1.5 border-t border-neutral-200 dark:border-white/10" />;
                }
                const { item, badge: customBadge } = entry;
                const active = isActive(item);
                const badge = badgeCounts?.[item.path] ?? 0;

                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={cn(
                      "w-full flex flex-col gap-0.5 px-3 rounded-xl text-[13px] font-medium transition-all duration-200",
                      mobileMode ? "py-3.5" : "py-2.5",
                      "active:scale-[0.97] text-left",
                      active
                        ? "bg-accent/10 text-accent dark:bg-accent/15 font-semibold"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-white"
                    )}
                  >
                    <span className="w-full flex items-center gap-2.5">
                      {/* Active indicator dot */}
                      <span className={cn(
                        "flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all",
                        active ? "bg-accent" : "bg-neutral-300 dark:bg-neutral-600"
                      )} />
                      <span className="truncate flex-1 min-w-0">{item.label}</span>

                      {/* Attention badge */}
                      {badge > 0 && (
                        <span className="relative flex-shrink-0 flex items-center justify-center">
                          <span
                            className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping"
                            style={{ animationDuration: '2s' }}
                          />
                          <span className="relative min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        </span>
                      )}
                    </span>

                    {customBadge && (
                      <span className={cn('ml-4 self-start shrink-0 px-1.5 py-[1px] rounded-full text-[9px] font-bold leading-none whitespace-nowrap', BADGE_COLORS[customBadge.color] ?? BADGE_COLORS.amber)}>
                        {customBadge.texto}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
