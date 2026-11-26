import { Fragment, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  LogOut,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isWorkspaceVisible,
  isTopLevelItemVisible,
  isItemVisible,
  type WorkspaceDefinition,
  type WorkspaceNavItem,
  type UserRole,
} from '@/lib/workspaceConfig';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarItemsConfig } from '@/hooks/useSidebarItemsConfig';
import { useMenuFavoritos } from '@/hooks/useMenuFavoritos';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
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

const TOOLTIP_CLS = "text-xs font-semibold bg-neutral-900 text-white border-0 rounded-none shadow-e1 px-2.5 py-1.5";
const FAVORITOS_ABIERTO_KEY = 'movi:favoritos_abierto';

const WORKSPACE_HUB_ROUTES: Record<string, string> = {
  herramientas: '/herramientas',
  'centro-contacto': '/centro-contacto',
  cotizar: '/cotizar',
  produccion: '/produccion',
  administracion: '/admin',
  mercadotecnia: '/mercadotecnia/publicidad',
  'seguros-education': '/seguros-education',
};

interface DesktopSidebarProps {
  isPinned: boolean;
  onTogglePin: () => void;
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
  topLevelBadges?: Record<string, number>;
}

export function DesktopSidebar({
  isPinned,
  onTogglePin,
  workspace,
  userRole,
  usuario,
  onSignOut,
  isModuleVisible,
  oficinaId,
  badgeCounts,
  topLevelBadges,
}: DesktopSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved } = useSidebarConfig();
  const { getResolvedItems } = useSidebarItemsConfig();
  const { favoritos, esFavorito, alternarFavorito } = useMenuFavoritos();

  // Estado de hover inteligente
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La barra está expandida si está fijada por el usuario O si tiene el mouse encima
  const isExpanded = isPinned || isHovered;

  // Panel flotante (flyout) que se abre a la DERECHA de la barra al pasar el cursor
  // sobre una sección. Sustituye —solo para probar— al acordeón que empujaba hacia abajo
  // los renglones de abajo. El estado es temporal: vive mientras dura el cursor.
  const [flyout, setFlyout] = useState<{ ws: WorkspaceDefinition; top: number; alto: number } | null>(null);
  const [flyoutFijo, setFlyoutFijo] = useState(false);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cancelarCierreFlyout = () => {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null; }
  };

  const abrirFlyout = (ws: WorkspaceDefinition) => (e: React.MouseEvent<HTMLElement>) => {
    cancelarCierreFlyout();
    const caja = contenedorRef.current;
    const fila = (e.currentTarget as HTMLElement).closest('[data-ws-row]') as HTMLElement | null;
    const r = (fila ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    const top = caja ? r.top - caja.getBoundingClientRect().top : r.top;
    const vh = window.innerHeight || 800;
    // Nunca se sale por abajo: el alto se recorta a lo que queda de pantalla.
    const alto = Math.max(220, Math.min(vh * 0.72, vh - Math.max(8, top) - 16));
    setFlyout({ ws, top: Math.max(8, top), alto });
  };

  const cerrarFlyoutAhora = () => { cancelarCierreFlyout(); setFlyout(null); setFlyoutFijo(false); };

  const programarCierreFlyout = () => {
    cancelarCierreFlyout();
    if (flyoutFijo) return;
    flyoutTimer.current = setTimeout(() => setFlyout(null), 140);
  };

  // Esc cierra el panel fijado; un clic fuera también.
  useEffect(() => {
    if (!flyout) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); setFlyout(null); setFlyoutFijo(false); } };
    const onDown = (e: MouseEvent) => {
      const caja = contenedorRef.current;
      if (caja && !caja.contains(e.target as Node)) { setFlyout(null); setFlyoutFijo(false); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [flyout]);

  // Favoritos: abierto siempre por default; si el usuario lo cierra, se respeta hasta que lo reabra.
  const [favoritosAbierto, setFavoritosAbierto] = useState<boolean>(() => {
    try { return localStorage.getItem(FAVORITOS_ABIERTO_KEY) !== '0'; } catch { return true; }
  });

  // Manejadores de hover con debounce suave para evitar parpadeos
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  // Navegar y colapsar automáticamente el menú
  const handleNav = (path: string) => {
    navigate(path);
    if (!isPinned) {
      setIsHovered(false);
    }
  };

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

  const isSubItemActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  // Sub-items visibles de un workspace (mismo filtro de rol y Control de Módulos que el acordeón).
  const itemsVisiblesDe = (ws: WorkspaceDefinition): WorkspaceNavItem[] => {
    const out: WorkspaceNavItem[] = [];
    for (const g of getResolvedItems(ws)) {
      for (const e of g.items) {
        if (
          e.kind === 'item' &&
          isItemVisible(e.item, userRole) &&
          (isModuleVisible ? isModuleVisible(e.item.path, userRole, oficinaId) : true)
        ) out.push(e.item);
      }
    }
    return out;
  };

  // Los mismos items, pero conservando los grupos (para el panel flotante).
  const gruposVisiblesDe = (ws: WorkspaceDefinition) =>
    getResolvedItems(ws)
      .map(g => ({
        id: g.grupo?.id ?? null,
        nombre: g.grupo?.nombre ?? null,
        items: g.items
          .filter(e => e.kind === 'item')
          .map(e => (e.kind === 'item' ? e.item : null))
          .filter((x): x is WorkspaceNavItem => !!x)
          .filter(item => isItemVisible(item, userRole) && (isModuleVisible ? isModuleVisible(item.path, userRole, oficinaId) : true)),
      }))
      .filter(g => g.items.length > 0);

  // Favoritos que este usuario sí puede ver, en el orden en que los marcó.
  // Un favorito de un módulo al que ya no tiene acceso simplemente no aparece.
  const itemsFavoritos: WorkspaceNavItem[] = (() => {
    if (favoritos.length === 0) return [];
    const porPath = new Map<string, WorkspaceNavItem>();
    for (const { entry } of resolved) {
      if (entry.type !== 'workspace' || !isWorkspaceVisible(entry.workspace, userRole)) continue;
      for (const item of itemsVisiblesDe(entry.workspace)) {
        if (!porPath.has(item.path)) porPath.set(item.path, item);
      }
    }
    return favoritos.map(p => porPath.get(p)).filter((x): x is WorkspaceNavItem => !!x);
  })();

  // La sección va justo después de Dashboard (o arriba de todo si Dashboard no está).
  const idxDashboard = resolved.findIndex(({ entry }) => entry.type === 'link' && entry.item.path === '/dashboard');

  // Renglón de sub-item con estrella para marcar/desmarcar favorito.
  // La estrella es un botón hermano (no anidado) del botón de navegación.
  const renderSubItem = (item: WorkspaceNavItem, keyPrefix = '') => {
    const active = isSubItemActive(item);
    const SubIcon = item.icon;
    const badgeCount = badgeCounts?.[item.path] ?? 0;
    const fav = esFavorito(item.path);

    return (
      <div key={keyPrefix + item.path} className="relative group/sub">
        <button
          onClick={() => handleNav(item.path)}
          className={cn(
            'w-full flex items-center justify-between gap-2 pl-2.5 pr-8 py-1.5 rounded-none text-[11.5px] font-medium transition-colors text-left group',
            active
              ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
              : fav
                ? 'text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SubIcon className={cn('w-3.5 h-3.5 shrink-0 transition-colors', active ? 'text-accent-ink' : fav ? 'text-amber-500' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300')} />
            <span className="truncate">{item.label}</span>
          </div>

          {badgeCount > 0 && (
            <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9.5px] font-bold rounded-none shrink-0">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); alternarFavorito(item.path); }}
          aria-label={fav ? `Quitar ${item.label} de favoritos` : `Agregar ${item.label} a favoritos`}
          aria-pressed={fav}
          title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-none flex items-center justify-center transition-colors',
            fav
              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              : 'text-neutral-300 hover:text-amber-500 hover:bg-surface-muted dark:hover:bg-white/10 opacity-0 group-hover/sub:opacity-100 focus-visible:opacity-100'
          )}
        >
          <Star className={cn('w-3.5 h-3.5', fav && 'fill-amber-400')} />
        </button>
      </div>
    );
  };

  const toggleFavoritos = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavoritosAbierto(prev => {
      const next = !prev;
      try { localStorage.setItem(FAVORITOS_ABIERTO_KEY, next ? '1' : '0'); } catch { /* sin almacenamiento */ }
      return next;
    });
  };

  // Favoritos es su propia lista corta: se abre/cierra solo con clic (no empuja por hover).
  const favoritosVisibles = favoritosAbierto;

  const seccionFavoritos = itemsFavoritos.length === 0 ? null : !isExpanded ? (
    // Menú angosto: la estrella abre/cierra, y abierto muestra el ícono de cada favorito.
    <div key="favoritos" className="space-y-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => toggleFavoritos()}
            className="w-11 h-11 mx-auto rounded-none flex items-center justify-center relative transition-colors text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            aria-label={favoritosAbierto ? 'Cerrar favoritos' : 'Abrir favoritos'}
            aria-expanded={favoritosAbierto}
          >
            <Star className="w-4 h-4 fill-amber-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className={TOOLTIP_CLS}>
          Favoritos · {itemsFavoritos.length}
        </TooltipContent>
      </Tooltip>
      {favoritosAbierto && itemsFavoritos.map(item => {
        const FavIcon = item.icon;
        const active = isSubItemActive(item);
        return (
          <Tooltip key={`fav-rail-${item.path}`}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-9 h-9 mx-auto rounded-none flex items-center justify-center transition-colors',
                  active
                    ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink'
                    : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                )}
                aria-label={item.label}
              >
                <FavIcon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className={TOOLTIP_CLS}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  ) : (
    <div
      key="favoritos"
      className="space-y-0.5"
    >
      <div
        onClick={toggleFavoritos}
        aria-expanded={favoritosVisibles}
        className="w-full flex items-center justify-between px-3 py-2 rounded-none text-xs font-medium transition-colors text-left relative group cursor-pointer text-neutral-700 dark:text-neutral-300 hover:bg-surface-muted dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Star className="w-4 h-4 shrink-0 text-amber-500 fill-amber-400" />
          <span className="truncate">Favoritos</span>
          <span className="px-1.5 py-[1px] rounded-none text-[9.5px] font-bold leading-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 shrink-0">
            {itemsFavoritos.length}
          </span>
        </div>
        <span className="p-1 rounded-none text-neutral-400 ml-1" aria-hidden="true">
          {favoritosVisibles ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </div>

      {favoritosVisibles && (
        <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l-2 border-amber-200/70 dark:border-amber-500/20 ml-4">
          {itemsFavoritos.map(item => renderSubItem(item, 'fav-'))}
        </div>
      )}
    </div>
  );

  // Una entrada del menú principal: link directo (Dashboard, Trámites…) o workspace en acordeón.
  const renderEntrada = (
    entry: (typeof resolved)[number]['entry'],
    separadorAntes: boolean,
    badge: (typeof resolved)[number]['badge'],
    idx: number,
  ) => {
    const customBadgeEl = badge ? (
      <span
        className={cn(
          'px-1.5 py-[1px] rounded-none text-[9.5px] font-bold leading-none whitespace-nowrap shrink-0',
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
          <span className="relative min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-none flex items-center justify-center leading-none">
            {tlBadge > 99 ? '99+' : tlBadge}
          </span>
        </span>
      ) : null;

      if (!isExpanded) {
        return (
          <Fragment key={`link-${idx}`}>
            {separadorAntes && <div className="w-8 h-px bg-neutral-200 dark:bg-white/10 mx-auto my-1.5" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNav(item.path)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'w-11 h-11 mx-auto rounded-none flex items-center justify-center relative transition-colors',
                    isActive
                      ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {badgeEl}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-accent" />
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
            onClick={() => handleNav(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-none text-xs font-medium transition-colors text-left relative group',
              isActive
                ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-surface-muted dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-accent-ink' : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200')} />
            <span className="truncate flex-1">{item.label}</span>
            {badgeEl}
            {customBadgeEl}
            {isActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent" />
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
    const hubRoute = WORKSPACE_HUB_ROUTES[ws.id] || ws.items[0]?.path || '/dashboard';
    const isWsActive = ws.id === (workspace?.id ?? null) || location.pathname === hubRoute;

    // Sub-items del workspace
    const allWsItems = itemsVisiblesDe(ws);

    if (!isExpanded) {
      return (
        <Fragment key={ws.id}>
          {separadorAntes && <div className="w-8 h-px bg-neutral-200 dark:bg-white/10 mx-auto my-1.5" />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNav(hubRoute)}
                aria-label={ws.label}
                aria-current={isWsActive ? 'page' : undefined}
                className={cn(
                  'w-11 h-11 mx-auto rounded-none flex items-center justify-center relative transition-colors',
                  isWsActive
                    ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4" />
                {isWsActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-accent" />
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
      <div
        key={ws.id}
        data-ws-row={ws.id}
        className="space-y-0.5"
        onMouseEnter={abrirFlyout(ws)}
        onMouseLeave={programarCierreFlyout}
      >
        {separadorAntes && <div className="h-px bg-neutral-100 dark:bg-white/5 my-1.5 mx-2" />}

        {/* Encabezado Acordeón: Clic navega a la página de sección (Hub).
            El contenido también se abre solo mientras el cursor está encima. */}
        <div
          onClick={() => handleNav(hubRoute)}
          aria-expanded={flyout?.ws.id === ws.id}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-none text-xs font-medium transition-colors text-left relative group cursor-pointer',
            isWsActive
              ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-surface-muted dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isWsActive ? 'text-accent-ink' : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200')} />
            <span className="truncate">{ws.label}</span>
            {customBadgeEl}
          </div>

          {allWsItems.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (flyout?.ws.id === ws.id && flyoutFijo) cerrarFlyoutAhora();
                else { setFlyoutFijo(true); abrirFlyout(ws)(e); }
              }}
              className="p-1 rounded-none text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors ml-1"
              aria-label={`Abrir el panel flotante de ${ws.label}`}
              aria-expanded={flyout?.ws.id === ws.id && flyoutFijo}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isWsActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent" />
          )}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={contenedorRef}
        className={cn(
          'hidden md:block shrink-0 relative transition-[width] duration-200 ease-out z-40 select-none',
          isPinned ? 'w-[264px]' : 'w-[72px]'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <aside
          aria-label="Menú lateral inteligente"
          className={cn(
            'relative flex flex-col h-full font-display bg-surface-card dark:bg-[#111114] border-r border-soft transition-[width] duration-200 ease-out',
            isExpanded
              ? 'w-[264px]'
              : 'w-[72px]',
            !isPinned && isExpanded ? 'absolute top-0 left-0 bottom-0' : 'relative'
          )}
        >
          {/* Velo de marca muy sutil (decorativo) */}
          
          
          {/* ── TOP: Logo Oficial + Botón Pin / Fijar ── */}
          <div className="relative h-[60px] px-3.5 flex items-center justify-between border-b border-soft shrink-0">
            {isExpanded ? (
              <>
                <button
                  onClick={() => handleNav('/dashboard')}
                  className="flex items-center gap-2.5 py-1 px-1 rounded-none hover:bg-surface-muted dark:hover:bg-white/5 transition-colors group"
                  title="MOVI Mi Oficina Virtual · Ir al Dashboard"
                >
                  <span
                    className="grid place-items-center w-9 h-9 rounded-none group-hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="/movirecurso_7.png"
                      alt="MOVI"
                      className="h-6 w-6 object-contain"
                    />
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-display font-semibold text-[14px] tracking-[-0.01em] text-neutral-900 dark:text-white leading-tight">
                      MOVI
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Mi Oficina Virtual
                    </span>
                  </div>
                </button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onTogglePin}
                      className={cn(
                        'w-8 h-8 rounded-none flex items-center justify-center transition-colors',
                        isPinned
                          ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold'
                          : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5'
                      )}
                      aria-label={isPinned ? 'Desfijar menú (hover automático)' : 'Fijar menú siempre abierto'}
                    >
                      {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={TOOLTIP_CLS}>
                    {isPinned ? 'Desfijar menú (se abre al acercar el cursor)' : 'Fijar menú siempre abierto'}
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <div className="w-full flex items-center justify-center">
                <button
                  onClick={() => handleNav('/dashboard')}
                  className="w-10 h-10 rounded-none flex items-center justify-center hover:bg-surface-muted dark:hover:bg-white/5 transition-colors group"
                  title="MOVI Mi Oficina Virtual"
                >
                  <span
                    className="grid place-items-center w-9 h-9 rounded-none group-hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="/movirecurso_7.png"
                      alt="MOVI"
                      className="h-6 w-6 object-contain"
                    />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ── CUERPO: Módulos y Acordeones ── */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {idxDashboard === -1 && seccionFavoritos}
            {resolved.map(({ entry, separadorAntes, badge }, idx) => (
              <Fragment key={`entry-${idx}`}>
                {renderEntrada(entry, separadorAntes, badge, idx)}
                {idx === idxDashboard && seccionFavoritos}
              </Fragment>
            ))}
          </div>

          {/* ── FOOTER: Perfil + Utilidades ── */}
          <div className="p-3 border-t border-soft bg-surface-muted/60 dark:bg-white/[0.015] shrink-0 space-y-2">
            {isExpanded ? (
              <button
                onClick={() => handleNav('/perfil')}
                className="w-full flex items-center gap-2.5 p-2 rounded-none hover:bg-neutral-200/60 dark:hover:bg-white/5 transition-colors text-left group"
              >
                <Avatar className="h-8 w-8 rounded-none border border-soft shrink-0">
                  <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-none" />
                  <AvatarFallback className="text-[11px] font-bold rounded-none bg-accent text-accent-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate leading-tight group-hover:text-accent">
                    {usuario?.nombre} {usuario?.apellidos}
                  </span>
                  <span className="text-[10px] text-neutral-400 capitalize truncate mt-0.5">
                    {usuario?.rol || 'Usuario'}
                  </span>
                </div>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNav('/perfil')}
                    aria-label="Mi Perfil"
                    className="w-10 h-10 mx-auto rounded-none flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-white/5 transition-colors"
                  >
                    <Avatar className="h-7 w-7 rounded-none border border-soft">
                      <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} crossOrigin="anonymous" className="rounded-none" />
                      <AvatarFallback className="text-[10px] font-bold rounded-none bg-accent text-accent-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className={TOOLTIP_CLS}>
                  {usuario?.nombre} {usuario?.apellidos} · Mi Perfil
                </TooltipContent>
              </Tooltip>
            )}

            <div className={cn(
              'flex items-center gap-1.5',
              isExpanded ? 'justify-between px-1' : 'flex-col justify-center'
            )}>
              {userRole === 'Administrador' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav('/chava')}
                      className="w-7 h-7 rounded-none flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors"
                    >
                      <ChavaOrbIcon size="sm" sidebarVariant />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side={isExpanded ? 'top' : 'right'} className={TOOLTIP_CLS}>
                    Chava IA
                  </TooltipContent>
                </Tooltip>
              )}

              <NotificationBell compact fixedPanel />
              <ThemeToggle compact />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSignOut}
                    aria-label="Cerrar Sesión"
                    className="w-7 h-7 rounded-none flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={isExpanded ? 'top' : 'right'} className={TOOLTIP_CLS}>
                  Cerrar Sesión
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* ── PANEL FLOTANTE A LA DERECHA (prueba) ──
            Muestra los módulos de la sección mientras el cursor está sobre ella,
            sin abrir el acordeón hacia abajo ni recorrer los renglones de abajo. */}
        {flyout && (
          <div
            role="menu"
            aria-label={`Módulos de ${flyout.ws.label}`}
            onMouseEnter={cancelarCierreFlyout}
            onMouseLeave={programarCierreFlyout}
            style={{ top: flyout.top, left: isExpanded ? 272 : 80, maxHeight: flyout.alto }}
            className={cn(
              'absolute z-50 w-[292px] overflow-y-auto',
              'bg-surface-card dark:bg-[#111114] border border-soft shadow-e1',
              'animate-in fade-in slide-in-from-left-1 duration-150'
            )}
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-soft">
              <flyout.ws.icon className="w-4 h-4 shrink-0 text-accent-ink" />
              <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-neutral-900 dark:text-white">
                {flyout.ws.label}
              </span>
              <button
                onClick={() => { handleNav(WORKSPACE_HUB_ROUTES[flyout.ws.id] || flyout.ws.items[0]?.path || '/dashboard'); cerrarFlyoutAhora(); }}
                className="px-2 py-1 rounded-none text-[10.5px] font-semibold text-accent-ink hover:bg-accent-softer transition-colors"
              >
                Ver sección
              </button>
              <button
                onClick={cerrarFlyoutAhora}
                aria-label="Cerrar panel"
                className="p-1 rounded-none text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-1.5">
              {(() => {
                const grupos = gruposVisiblesDe(flyout.ws);
                const total = grupos.reduce((n, g) => n + g.items.length, 0);
                if (total === 0) {
                  return (
                    <p className="px-2 py-3 text-[11.5px] text-neutral-500 dark:text-neutral-400">
                      Sin módulos disponibles.
                    </p>
                  );
                }
                return grupos.map(g => (
                  <div key={g.id ?? '_sin_grupo'} className="mb-1 last:mb-0">
                    {g.nombre && (
                      <p className="px-2 pt-1.5 pb-1 movi-eyebrow !text-[10px] text-neutral-500 dark:text-white/45">
                        {g.nombre}
                      </p>
                    )}
                    {g.items.map(item => renderSubItem(item, `fly-${flyout.ws.id}-`))}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        </div>
    </TooltipProvider>
  );
}
