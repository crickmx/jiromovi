import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { isItemVisible } from '@/lib/workspaceConfig';
import { Breadcrumbs } from './Breadcrumbs';
import { MegaMenu } from './MegaMenu';
import { useSidebarItemsConfig } from '@/hooks/useSidebarItemsConfig';

interface ContextNavProps {
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
}

// Máximo de items a mostrar directamente en pestañas antes de activar el modo "Explorar Secciones"
const MAX_DIRECT_TABS = 8;

export function ContextNav({
  workspace,
  activeItem,
  userRole,
  isModuleVisible,
  oficinaId,
  badgeCounts,
}: ContextNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const { getResolvedItems } = useSidebarItemsConfig();

  // Close switcher on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    if (switcherOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [switcherOpen]);

  // Si no hay workspace activo o es un espacio sin sub-barra (ej. Producción individual)
  if (!workspace || workspace.id === 'produccion') {
    return (
      <div className="h-9 bg-neutral-100/70 dark:bg-[#111114] border-b border-neutral-200/70 dark:border-white/[0.06] px-4 flex items-center justify-between">
        <Breadcrumbs workspace={workspace} activeItem={activeItem} />
      </div>
    );
  }

  // Filtrar items visibles del workspace
  const resolvedGroups = getResolvedItems(workspace).map(g => ({
    ...g,
    items: g.items.filter(entry =>
      entry.kind === 'item' &&
      isItemVisible(entry.item, userRole) &&
      (isModuleVisible ? isModuleVisible(entry.item.path, userRole, oficinaId) : true)
    ),
  })).filter(g => g.items.length > 0);

  const allItems: WorkspaceNavItem[] = [];
  for (const g of resolvedGroups) {
    for (const e of g.items) {
      if (e.kind === 'item') allItems.push(e.item);
    }
  }

  const isExtensive = allItems.length > MAX_DIRECT_TABS;
  // Si es extenso (ej. Admin con 26 items), mostramos los primeros 5 prioritarios + botón Explorar
  const directItems = isExtensive ? allItems.slice(0, 5) : allItems;

  const isSubItemActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  return (
    <>
      <div className="h-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs border-b border-neutral-200/80 dark:border-white/[0.07] px-4 flex items-center justify-between gap-3 select-none">
        {/* Izquierda: Breadcrumbs + Selector rápido de sección */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <Breadcrumbs workspace={workspace} activeItem={activeItem} />

          {/* Selector Contextual Dropdown */}
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              title="Cambiar de sección"
              aria-label="Selector de sección"
              aria-expanded={switcherOpen}
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', switcherOpen && 'rotate-180')} />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 mt-1.5 w-60 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-[#18181c] border border-neutral-200 dark:border-white/10 shadow-xl z-40 p-1 divide-y divide-neutral-100 dark:divide-white/5">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {workspace.label}
                </div>
                <div className="space-y-0.5 pt-1">
                  {allItems.map(item => {
                    const active = isSubItemActive(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={`switcher-${item.path}`}
                        onClick={() => {
                          navigate(item.path);
                          setSwitcherOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
                          active
                            ? 'bg-accent/10 text-accent font-semibold'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate flex-1">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Derecha: Pestañas Contextuales (o Modo Compacto con botón Explorar) */}
        <div className="flex items-center gap-1 overflow-hidden shrink-0">
          {directItems.map(item => {
            const active = isSubItemActive(item);
            const Icon = item.icon;
            const badge = badgeCounts?.[item.path] ?? 0;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all shrink-0',
                  active
                    ? 'bg-accent/10 dark:bg-accent/15 text-accent font-semibold ring-1 ring-accent/25'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', active ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500')} />
                <span className="whitespace-nowrap">{item.label}</span>

                {badge > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-500 text-white text-[8px] font-bold rounded-full">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Botón "Explorar todas" para menús extensos (>8 items) */}
          {isExtensive && (
            <button
              onClick={() => setMegaMenuOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-neutral-100 dark:bg-white/8 text-neutral-800 dark:text-neutral-200 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-all shrink-0"
              title={`Ver todas las ${allItems.length} opciones de ${workspace.label}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Explorar ({allItems.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* MegaMenu Modal */}
      <MegaMenu
        workspace={workspace}
        activeItem={activeItem}
        userRole={userRole}
        isModuleVisible={isModuleVisible}
        oficinaId={oficinaId}
        isOpen={megaMenuOpen}
        onClose={() => setMegaMenuOpen(false)}
        badgeCounts={badgeCounts}
      />
    </>
  );
}
