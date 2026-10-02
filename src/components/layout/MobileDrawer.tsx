import { Fragment, useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, LogOut, User, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWorkspaceVisible, isTopLevelItemVisible, isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { Usuario } from '@/contexts/MoviAuthContext';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { getForegroundColor, hexToRgb } from '@/lib/themeUtils';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import { useSidebarItemsConfig } from '../../hooks/useSidebarItemsConfig';

// Mismos colores de badge de texto que PrimarySidebar / SecondarySidebar (Editor de Sidebar)
const BADGE_COLORS: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
};

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10.5px] font-bold rounded-full flex items-center justify-center leading-none">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function TextBadge({ badge }: { badge: { texto: string; color: string } | null }) {
  if (!badge) return null;
  return (
    <span className={cn('flex-shrink-0 px-1.5 py-[2px] rounded-full text-[9.5px] font-bold leading-none whitespace-nowrap', BADGE_COLORS[badge.color] ?? BADGE_COLORS.amber)}>
      {badge.texto}
    </span>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceDefinition | null | undefined;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: Usuario | null;
  onSignOut: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  /** Contadores de atención por path de item (mismos que SecondarySidebar) */
  badgeCounts?: Record<string, number>;
  /** Contadores por workspace (mismos que PrimarySidebar) */
  workspaceBadges?: Partial<Record<string, number>>;
  /** Contadores por link de primer nivel (mismos que PrimarySidebar) */
  topLevelBadges?: Record<string, number>;
}

export function MobileDrawer({ open, onClose, workspace, activeItem, userRole, usuario, onSignOut, isModuleVisible, oficinaId, badgeCounts, workspaceBadges, topLevelBadges }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  // Orden / separadores / badges configurados en el Editor de Sidebar (igual que escritorio)
  const { resolved } = useSidebarConfig();
  const { getResolvedItems } = useSidebarItemsConfig();
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});

  // Touch-to-swipe-right-to-close
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchCurrentX.current = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    const delta = touchCurrentX.current - touchStartX.current;
    if (delta > 60) {
      onClose();
    }
  }

  const getInitials = () => {
    const n = usuario?.nombre?.[0] || '';
    const a = usuario?.apellidos?.[0] || '';
    return `${n}${a}`.toUpperCase();
  };

  const fullName = [usuario?.nombre, usuario?.apellidos].filter(Boolean).join(' ');
  const oficinaNombre = usuario?.oficina?.nombre || '';
  const rolLabel = usuario?.rol || '';

  const accentStyle = useMemo(() => {
    const hex = (usuario?.oficina as any)?.accent_color as string | undefined;
    if (!hex) return null;
    const fgRgb = getForegroundColor(hex);
    const bgRgb = hexToRgb(hex);
    return { hex, fgRgb, bgRgb };
  }, [(usuario?.oficina as any)?.accent_color]);

  const isActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  const isTopLevelActive = (path: string, matchPrefix?: boolean) => {
    if (location.pathname === path) return true;
    if (matchPrefix && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden transition-all duration-300',
          open ? 'bg-neutral-950/45 backdrop-blur-[3px] pointer-events-auto' : 'bg-transparent pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer — slides from right */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'app-shell fixed top-0 right-0 z-50 md:hidden flex flex-col',
          'w-[300px] max-w-[85vw]',
          'bg-surface-card dark:bg-[#111113]',
          'shadow-[-8px_0_40px_rgba(0,0,0,0.18)] rounded-l-[24px] overflow-hidden',
          'transition-transform duration-slow ease-smooth will-change-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* ── Profile header ── (gradiente de marca + formas orgánicas; texto con contraste AA calculado) */}
        <div
          className="relative isolate overflow-hidden pt-10 pb-5 px-5"
          style={accentStyle
            ? {
                background: `radial-gradient(90% 120% at 100% 0%, rgb(var(--movi-accent-2-rgb) / 0.5) 0%, transparent 60%), linear-gradient(135deg, ${accentStyle.hex} 0%, rgb(var(--movi-accent-deep-rgb)) 100%)`,
                color: `rgb(${accentStyle.fgRgb})`,
              }
            : { color: '#ffffff' }}
        >
          {!accentStyle && (
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-[#0a0a0d] dark:to-[#141417]" />
          )}
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 w-56 h-56 -z-10 rounded-[58%_42%_46%_54%/47%_52%_48%_53%] bg-white/10" />
          <span aria-hidden="true" className="pointer-events-none absolute right-10 -bottom-24 w-40 h-40 -z-10 rounded-[50%_50%_38%_62%/60%_44%_56%_40%] bg-white/[0.07]" />
          <div className="relative z-10">
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              className="absolute -top-6 -right-1 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 opacity-90" />
            </button>

            {/* Avatar + name */}
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => handleNav('/perfil')}
                aria-label="Mi perfil"
                className="flex-shrink-0 ring-2 ring-white/25 hover:ring-white/50 rounded-2xl transition-all"
              >
                <Avatar className="h-14 w-14 rounded-2xl">
                  <AvatarImage src={usuario?.imagen_perfil_url || undefined} alt={fullName} crossOrigin="anonymous" className="rounded-2xl" />
                  <AvatarFallback className="rounded-2xl bg-white/20 text-current text-lg font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <p className="font-display font-semibold text-[16px] leading-tight truncate">{fullName || 'Usuario'}</p>
                {oficinaNombre && (
                  <p className="opacity-80 text-[12.5px] mt-0.5 truncate">{oficinaNombre}</p>
                )}
                {rolLabel && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/15 text-[10.5px] font-semibold">
                    {rolLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Quick profile action — only Mi Perfil */}
            <div className="mt-4">
              <button
                onClick={() => handleNav('/perfil')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 font-display text-[12.5px] font-semibold transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Mi Perfil
              </button>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Current workspace items */}
          {workspace && (
            <div className="px-3 pt-4 pb-2">
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-accent-soft dark:bg-accent/15 flex items-center justify-center">
                  <workspace.icon className="w-3.5 h-3.5 text-accent-ink" />
                </div>
                <p className="movi-eyebrow text-neutral-600 dark:text-white/60">
                  {workspace.label}
                </p>
              </div>
              <div className="space-y-0.5">
                {getResolvedItems(workspace)
                  .map(g => ({
                    ...g,
                    items: g.items.filter(entry =>
                      entry.kind === 'separador' ||
                      (isItemVisible(entry.item, userRole) &&
                        (isModuleVisible ? isModuleVisible(entry.item.path, userRole, oficinaId) : true))
                    ),
                  }))
                  .filter(g => g.items.some(entry => entry.kind === 'item'))
                  .map(({ grupo, items }) => {
                    const colapsado = grupo ? (gruposColapsados[grupo.id] ?? grupo.colapsado_default) : false;
                    return (
                      <div key={grupo?.id ?? '_sin_grupo'} className={grupo ? 'pt-2 first:pt-0' : ''}>
                        {grupo && (
                          <button
                            onClick={() => setGruposColapsados(prev => ({ ...prev, [grupo.id]: !colapsado }))}
                            aria-expanded={!colapsado}
                            className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg movi-eyebrow !text-[10.5px] text-neutral-500 dark:text-white/50"
                          >
                            {colapsado ? <ChevronRight className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{grupo.nombre}</span>
                          </button>
                        )}
                        {!colapsado && items.map((entry) => {
                          if (entry.kind === 'separador') {
                            return <div key={`sep-${entry.id}`} className="my-2 mx-3 border-t border-soft" />;
                          }
                          const { item, badge: customBadge } = entry;
                          const active = isActive(item);
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.path}
                              onClick={() => handleNav(item.path)}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-[14px] font-medium transition-colors text-left active:scale-[0.98]',
                                active
                                  ? 'bg-accent-soft text-accent-ink dark:bg-accent/15 font-semibold'
                                  : 'text-neutral-700 dark:text-white/70 hover:bg-surface-muted dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                              )}
                            >
                              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-accent-ink' : 'text-neutral-500 dark:text-white/45')} />
                              <span className="flex-1 min-w-0 truncate">{item.label}</span>
                              <TextBadge badge={customBadge} />
                              <CountBadge n={badgeCounts?.[item.path] ?? 0} />
                              {active && <ChevronRight className="w-3.5 h-3.5 text-accent-ink/60 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Divider */}
          {workspace && (
            <div className="mx-4 h-px bg-[var(--border-soft)] my-1" />
          )}

          {/* All workspaces / top-level links */}
          <div className="px-3 pt-2 pb-4">
            <p className="movi-eyebrow text-neutral-600 dark:text-white/60 px-2 mb-2">
              Módulos
            </p>
            <div className="space-y-0.5">
              {resolved.map(({ entry, separadorAntes, badge }, idx) => {
                const separatorEl = separadorAntes ? <div className="my-2 mx-3 border-t border-soft" /> : null;
                if (entry.type === 'link') {
                  const item = entry.item;
                  if (!isTopLevelItemVisible(item, userRole)) return null;
                  if (isModuleVisible && !isModuleVisible(item.path, userRole, oficinaId)) return null;
                  const Icon = item.icon;
                  const active = isTopLevelActive(item.path, item.matchPrefix);
                  return (
                    <Fragment key={`link-${idx}`}>
                    {separatorEl}
                    <button
                      onClick={() => handleNav(item.path)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium transition-colors text-left active:scale-[0.98]',
                        active
                          ? 'bg-accent-soft text-accent-ink dark:bg-accent/15 font-semibold'
                          : 'text-neutral-700 dark:text-white/70 hover:bg-surface-muted dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      <TextBadge badge={badge} />
                      <CountBadge n={topLevelBadges?.[item.path] ?? 0} />
                    </button>
                    </Fragment>
                  );
                }

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
                const active = ws.id === (workspace?.id ?? null);
                const firstVisibleItem = ws.items.find(item =>
                  isItemVisible(item, userRole) &&
                  (!isModuleVisible || isModuleVisible(item.path, userRole, oficinaId))
                );
                const firstPath = firstVisibleItem?.path || '/dashboard';

                return (
                  <Fragment key={ws.id}>
                  {separatorEl}
                  <button
                    onClick={() => handleNav(firstPath)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium transition-colors text-left active:scale-[0.98]',
                      active
                        ? 'bg-accent-soft text-accent-ink dark:bg-accent/15 font-semibold'
                        : 'text-neutral-700 dark:text-white/70 hover:bg-surface-muted dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{ws.label}</span>
                    <TextBadge badge={badge} />
                    <CountBadge n={workspaceBadges?.[ws.id] ?? 0} />
                    {active && <ChevronRight className="w-3.5 h-3.5 text-accent-ink/60 flex-shrink-0" />}
                  </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer: Controls + Sign out ── */}
        <div className="border-t border-soft px-3 py-3 space-y-1" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Notification bell + theme toggle row */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-[13px] font-medium text-neutral-700 dark:text-white/70">Apariencia y alertas</span>
            <NotificationBell dropdownSide="bottom" fixedPanel />
            <ThemeToggle dropdownSide="bottom" fixedPanel />
          </div>
          <button
            onClick={() => { onClose(); onSignOut(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.98] text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}
