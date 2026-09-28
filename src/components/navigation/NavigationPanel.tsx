import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, X, Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { isItemVisible } from '@/lib/workspaceConfig';
import { useSidebarItemsConfig } from '@/hooks/useSidebarItemsConfig';

interface NavigationPanelProps {
  workspace: WorkspaceDefinition;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  badgeCounts?: Record<string, number>;
}

const FAVORITES_KEY = 'movi_nav_favorites';
const RECENTS_KEY = 'movi_nav_recents';

export function NavigationPanel({
  workspace,
  activeItem,
  userRole,
  isModuleVisible,
  oficinaId,
  isOpen,
  onClose,
  badgeCounts,
}: NavigationPanelProps) {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { getResolvedItems } = useSidebarItemsConfig();

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const toggleFavorite = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelect = (item: WorkspaceNavItem) => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      const recents: string[] = raw ? JSON.parse(raw) : [];
      const updated = [item.path, ...recents.filter(p => p !== item.path)].slice(0, 5);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    } catch {}

    navigate(item.path);
    onClose();
  };

  const resolvedGroups = useMemo(() => {
    return getResolvedItems(workspace).map(g => ({
      ...g,
      items: g.items.filter(entry =>
        entry.kind === 'item' &&
        isItemVisible(entry.item, userRole) &&
        (isModuleVisible ? isModuleVisible(entry.item.path, userRole, oficinaId) : true)
      ),
    })).filter(g => g.items.length > 0);
  }, [workspace, userRole, isModuleVisible, oficinaId, getResolvedItems]);

  const allVisibleItems = useMemo(() => {
    const items: WorkspaceNavItem[] = [];
    for (const g of resolvedGroups) {
      for (const entry of g.items) {
        if (entry.kind === 'item') items.push(entry.item);
      }
    }
    return items;
  }, [resolvedGroups]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resolvedGroups;

    return resolvedGroups.map(g => ({
      ...g,
      items: g.items.filter(entry =>
        entry.kind === 'item' &&
        (entry.item.label.toLowerCase().includes(q) || entry.item.path.toLowerCase().includes(q))
      ),
    })).filter(g => g.items.length > 0);
  }, [resolvedGroups, search]);

  const favoriteItems = useMemo(() => {
    return allVisibleItems.filter(item => favorites.includes(item.path));
  }, [allVisibleItems, favorites]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Panel de navegación de ${workspace.label}`}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={containerRef}
        className="w-full max-w-2xl bg-white dark:bg-[#16161a] rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col max-h-[78vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Cabecera y Buscador */}
        <div className="p-3.5 border-b border-neutral-100 dark:border-white/10 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar en ${workspace.label}...`}
              className="w-full pl-9 pr-8 py-2 text-sm bg-neutral-100 dark:bg-white/5 border border-transparent rounded-xl focus:outline-none focus:border-accent text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Secciones y Opciones */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Favoritos */}
          {!search && favoriteItems.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-amber-500">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>Favoritos</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {favoriteItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeItem?.path === item.path;
                  return (
                    <button
                      key={`fav-${item.path}`}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border transition-all text-left group',
                        isActive
                          ? 'bg-accent/10 border-accent/30 text-accent font-semibold'
                          : 'bg-neutral-50 dark:bg-white/3 border-neutral-200/80 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/15'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 text-neutral-500 group-hover:text-accent" />
                        <span className="text-xs truncate text-neutral-800 dark:text-neutral-200">{item.label}</span>
                      </div>
                      <Star
                        onClick={e => toggleFavorite(item.path, e)}
                        className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0 hover:scale-125 transition-transform"
                        title="Quitar de favoritos"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grupos organizados */}
          {filteredGroups.map(({ grupo, items }) => (
            <div key={grupo?.id ?? '_sin_grupo'} className="space-y-1.5">
              <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center justify-between">
                <span>{grupo ? grupo.nombre : 'General'}</span>
                <span className="text-[10px] font-normal lowercase text-neutral-400">
                  {items.length} {items.length === 1 ? 'sección' : 'secciones'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map(entry => {
                  if (entry.kind !== 'item') return null;
                  const { item, badge } = entry;
                  const Icon = item.icon;
                  const isActive = activeItem?.path === item.path;
                  const isFav = favorites.includes(item.path);
                  const countBadge = badgeCounts?.[item.path] ?? 0;

                  return (
                    <button
                      key={item.path}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border transition-all text-left group',
                        isActive
                          ? 'bg-accent/10 border-accent/40 text-accent font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#1a1a1e] border-neutral-200/80 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 hover:border-neutral-300 dark:hover:border-white/15'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-neutral-400 group-hover:text-accent')} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-accent">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono truncate">
                            {item.path}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {countBadge > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                            {countBadge}
                          </span>
                        )}
                        {badge && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-neutral-300">
                            {badge.texto}
                          </span>
                        )}
                        <Star
                          onClick={e => toggleFavorite(item.path, e)}
                          className={cn(
                            'w-3.5 h-3.5 transition-colors cursor-pointer',
                            isFav ? 'fill-amber-500 text-amber-500' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-500'
                          )}
                          title={isFav ? 'Quitar de favoritos' : 'Fijar en favoritos'}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="py-12 text-center text-neutral-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No se encontraron opciones para "{search}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 dark:bg-white/3 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>
            {allVisibleItems.length} opciones en <strong>{workspace.label}</strong>
          </span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded text-[10px] font-mono">
              Esc
            </kbd>
            <span>para cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
