import { Fragment, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LayoutGrid, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isWorkspaceVisible,
  isTopLevelItemVisible,
  isItemVisible,
  type WorkspaceDefinition,
  type WorkspaceNavItem,
  type UserRole,
  type NavEntry,
} from '@/lib/workspaceConfig';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarItemsConfig } from '@/hooks/useSidebarItemsConfig';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { NavigationPanel } from '../navigation/NavigationPanel';

const BADGE_COLORS: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
};

const TOOLTIP_CLS = "text-xs font-semibold bg-slate-900 text-white border-slate-700/60 shadow-xl rounded-xl px-2.5 py-1.5";

const MAX_SIDEBAR_ITEMS = 8;

interface DesktopSidebarProps {
  expanded: boolean;
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
  topLevelBadges?: Record<string, number>;
}

export function DesktopSidebar({
  expanded,
  workspace,
  activeItem: _activeItem,
  userRole,
  isModuleVisible,
  oficinaId,
  badgeCounts,
  topLevelBadges,
}: DesktopSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved } = useSidebarConfig();
  const { getResolvedItems } = useSidebarItemsConfig();

  // Estado de acordeones abiertos
  const [openWorkspaces, setOpenWorkspaces] = useState<Record<string, boolean>>(() => {
    if (workspace) return { [workspace.id]: true };
    return {};
  });

  // Panel lateral flyout para workspaces extensos
  const [panelWorkspace, setPanelWorkspace] = useState<WorkspaceDefinition | null>(null);

  // Mantener automáticamente abierto el workspace activo
  useEffect(() => {
    if (workspace) {
      setOpenWorkspaces(prev => ({ ...prev, [workspace.id]: true }));
    }
  }, [workspace]);

  const toggleWorkspaceAccordion = (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenWorkspaces(prev => ({ ...prev, [wsId]: !prev[wsId] }));
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

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        aria-label="Barra lateral de navegación"
        className={cn(
          'hidden md:flex flex-col bg-white dark:bg-[#111114] border-r border-neutral-200/90 dark:border-white/[0.08] select-none shrink-0 transition-[width] duration-200 ease-in-out z-30',
          expanded ? 'w-[264px]' : 'w-[72px]'
        )}
      >
        {/* Lista de Navegación con Scroll Interno Suave */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {resolved.map(({ entry, separadorAntes, badge }, idx) => {
            const customBadgeEl = badge ? (
              <span
                className={cn(
                  'px-1.5 py-[1px] rounded-full text-[8px] font-bold leading-none whitespace-nowrap shrink-0',
                  BADGE_COLORS[badge.color] ?? BADGE_COLORS.amber
                )}
              >
                {badge.texto}
              </span>
            ) : null;

            // ── Enlace Directo (Dashboard, Trámites, etc.) ──
            if (entry.type === 'link') {
              const item = entry.item;
              if (!isTopLevelItemVisible(item, userRole)) return null;
              if (isModuleVisible && !isModuleVisible(item.path, userRole, oficinaId)) return null;
              const Icon = item.icon;
              const isActive = isTopLevelActive(item.path, item.matchPrefix);
              const tlBadge = topLevelBadges?.[item.path] ?? 0;

              const badgeEl = tlBadge > 0 ? (
                <span className="relative flex items-center justify-center shrink-0">
                  <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
                  <span className="relative min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {tlBadge > 99 ? '99+' : tlBadge}
                  </span>
                </span>
              ) : null;

              if (!expanded) {
                return (
                  <Fragment key={`link-${idx}`}>
                    {separadorAntes && <div className="w-8 h-px bg-neutral-200 dark:bg-white/10 mx-auto my-1.5" />}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => navigate(item.path)}
                          className={cn(
                            'w-11 h-11 mx-auto rounded-xl flex items-center justify-center relative transition-all active:scale-95',
                            isActive
                              ? 'bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-2xs'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {badgeEl}
                          {isActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12} className={TOOLTIP_CLS}>
                        {badge ? `${item.label} · ${badge.texto}` : item.label}
                      </TooltipContent>
                    </Tooltip>
                  </Fragment>
                );
              }

              return (
                <Fragment key={`link-${idx}`}>
                  {separadorAntes && <div className="h-px bg-neutral-100 dark:bg-white/5 my-1.5 mx-2" />}
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left relative group active:scale-[0.98]',
                      isActive
                        ? 'bg-accent/10 dark:bg-accent/15 text-accent font-semibold shadow-2xs'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200')} />
                    <span className="truncate flex-1">{item.label}</span>
                    {badgeEl}
                    {customBadgeEl}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                    )}
                  </button>
                </Fragment>
              );
            }

            // ── Workspace Acordeón (Herramientas, Cotizar, Admin, etc.) ──
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
            const isWsActive = ws.id === (workspace?.id ?? null);
            const isOpen = openWorkspaces[ws.id] ?? isWsActive;

            // Resuelve items del workspace
            const resolvedGroups = getResolvedItems(ws).map(g => ({
              ...g,
              items: g.items.filter(e =>
                e.kind === 'item' &&
                isItemVisible(e.item, userRole) &&
                (isModuleVisible ? isModuleVisible(e.item.path, userRole, oficinaId) : true)
              ),
            })).filter(g => g.items.length > 0);

            const allWsItems: WorkspaceNavItem[] = [];
            for (const g of resolvedGroups) {
              for (const e of g.items) {
                if (e.kind === 'item') allWsItems.push(e.item);
              }
            }

            const firstPath = allWsItems[0]?.path || '/dashboard';
            const isExtensive = allWsItems.length > MAX_SIDEBAR_ITEMS;
            const visibleSubItems = isExtensive ? allWsItems.slice(0, MAX_SIDEBAR_ITEMS) : allWsItems;

            if (!expanded) {
              return (
                <Fragment key={ws.id}>
                  {separadorAntes && <div className="w-8 h-px bg-neutral-200 dark:bg-white/10 mx-auto my-1.5" />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(firstPath)}
                        className={cn(
                          'w-11 h-11 mx-auto rounded-xl flex items-center justify-center relative transition-all active:scale-95',
                          isWsActive
                            ? 'bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-2xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {isWsActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12} className={TOOLTIP_CLS}>
                      {badge ? `${ws.label} · ${badge.texto}` : ws.label}
                    </TooltipContent>
                  </Tooltip>
                </Fragment>
              );
            }

            return (
              <div key={ws.id} className="space-y-0.5">
                {separadorAntes && <div className="h-px bg-neutral-100 dark:bg-white/5 my-1.5 mx-2" />}

                {/* Encabezado Acordeón */}
                <div
                  onClick={() => navigate(firstPath)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left relative group cursor-pointer active:scale-[0.98]',
                    isWsActive
                      ? 'bg-accent/10 dark:bg-accent/15 text-accent font-semibold shadow-2xs'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isWsActive ? 'text-accent' : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200')} />
                    <span className="truncate">{ws.label}</span>
                    {customBadgeEl}
                  </div>

                  {allWsItems.length > 0 && (
                    <button
                      onClick={(e) => toggleWorkspaceAccordion(ws.id, e)}
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors ml-1"
                      aria-label={isOpen ? `Colapsar ${ws.label}` : `Expandir ${ws.label}`}
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {isWsActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                  )}
                </div>

                {/* Sub-Items Expandidos con Indentación */}
                {isOpen && allWsItems.length > 0 && (
                  <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l-2 border-neutral-100 dark:border-white/5 ml-4">
                    {visibleSubItems.map(item => {
                      const active = isSubItemActive(item);
                      const SubIcon = item.icon;
                      const badge = badgeCounts?.[item.path] ?? 0;

                      return (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors text-left group',
                            active
                              ? 'bg-accent/10 dark:bg-accent/20 text-accent font-semibold'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <SubIcon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', active ? 'text-accent' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300')} />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {badge > 0 && (
                            <span className="px-1.5 py-0.2 bg-red-500 text-white text-[8px] font-bold rounded-full shrink-0">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Botón "Ver todas las opciones" para menús extensos */}
                    {isExtensive && (
                      <button
                        onClick={() => setPanelWorkspace(ws)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent/10 transition-colors text-left"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                        <span>Ver todas ({allWsItems.length}) ▾</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Flyout Panel para Menús Extensos */}
      {panelWorkspace && (
        <NavigationPanel
          workspace={panelWorkspace}
          activeItem={_activeItem}
          userRole={userRole}
          isModuleVisible={isModuleVisible}
          oficinaId={oficinaId}
          isOpen={!!panelWorkspace}
          onClose={() => setPanelWorkspace(null)}
          badgeCounts={badgeCounts}
        />
      )}
    </TooltipProvider>
  );
}
