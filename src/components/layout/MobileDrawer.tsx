import { useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, LogOut, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ORDER, isWorkspaceVisible, isTopLevelItemVisible, isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { Usuario } from '@/contexts/MoviAuthContext';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { getForegroundColor, hexToRgb } from '@/lib/themeUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceDefinition | null | undefined;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: Usuario | null;
  onSignOut: () => void;
}

export function MobileDrawer({ open, onClose, workspace, activeItem, userRole, usuario, onSignOut }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

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
          open ? 'bg-black/50 backdrop-blur-sm pointer-events-auto' : 'bg-transparent pointer-events-none'
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
          'fixed inset-y-0 right-0 z-50 md:hidden flex flex-col',
          'w-[300px] max-w-[85vw]',
          'bg-white dark:bg-[#111113]',
          'shadow-[-8px_0_40px_rgba(0,0,0,0.18)]',
          'transition-transform duration-300 ease-in-out will-change-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* ── Profile header ── */}
        <div
          className="relative pt-10 pb-5 px-5"
          style={accentStyle ? { background: accentStyle.hex } : undefined}
        >
          {!accentStyle && (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-[#0a0a0d] dark:to-[#141417]" />
          )}
          <div className="relative z-10">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>

            {/* Avatar + name */}
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => handleNav('/perfil')}
                className="flex-shrink-0 ring-2 ring-white/20 hover:ring-white/40 rounded-2xl transition-all"
              >
                <Avatar className="h-14 w-14 rounded-2xl">
                  <AvatarImage src={usuario?.imagen_perfil_url || undefined} alt={fullName} className="rounded-2xl" />
                  <AvatarFallback className="rounded-2xl bg-white/20 text-white text-lg font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <p className="text-white font-semibold text-[15px] leading-tight truncate">{fullName || 'Usuario'}</p>
                {oficinaNombre && (
                  <p className="text-white/70 text-[12px] mt-0.5 truncate">{oficinaNombre}</p>
                )}
                {rolLabel && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-medium">
                    {rolLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Quick profile action — only Mi Perfil */}
            <div className="mt-4">
              <button
                onClick={() => handleNav('/perfil')}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-[12px] font-medium transition-colors"
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
                <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
                  <workspace.icon className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-[11px] font-bold text-neutral-500 dark:text-white/60 uppercase tracking-widest">
                  {workspace.label}
                </p>
              </div>
              <div className="space-y-0.5">
                {workspace.items.filter(item => isItemVisible(item, userRole)).map((item) => {
                  const active = isActive(item);
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13.5px] font-medium transition-all text-left active:scale-[0.98]',
                        active
                          ? 'bg-accent/8 text-accent dark:bg-accent/12 font-semibold'
                          : 'text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 w-1.5 h-1.5 rounded-full',
                        active ? 'bg-accent' : 'bg-neutral-200 dark:bg-white/20'
                      )} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-accent/60 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {workspace && (
            <div className="mx-4 h-px bg-neutral-100 dark:bg-white/[0.05] my-1" />
          )}

          {/* All workspaces / top-level links */}
          <div className="px-3 pt-2 pb-4">
            <p className="text-[11px] font-bold text-neutral-500 dark:text-white/60 uppercase tracking-widest px-2 mb-2">
              Módulos
            </p>
            <div className="space-y-0.5">
              {NAV_ORDER.map((entry, idx) => {
                if (entry.type === 'link') {
                  const item = entry.item;
                  if (!isTopLevelItemVisible(item, userRole)) return null;
                  const Icon = item.icon;
                  const active = isTopLevelActive(item.path, item.matchPrefix);
                  return (
                    <button
                      key={`link-${idx}`}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all text-left active:scale-[0.98]',
                        active
                          ? 'bg-accent/8 text-accent dark:bg-accent/12 font-semibold'
                          : 'text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                }

                const ws = entry.workspace;
                if (!isWorkspaceVisible(ws, userRole)) return null;
                const Icon = ws.icon;
                const active = ws.id === (workspace?.id ?? null);
                const firstPath = ws.items[0]?.path || '/dashboard';

                return (
                  <button
                    key={ws.id}
                    onClick={() => handleNav(firstPath)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all text-left active:scale-[0.98]',
                      active
                        ? 'bg-accent/8 text-accent dark:bg-accent/12 font-semibold'
                        : 'text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{ws.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-accent/60 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer: Controls + Sign out ── */}
        <div className="border-t border-neutral-100 dark:border-white/[0.06] px-3 py-3 space-y-1">
          {/* Notification bell + theme toggle row */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-[12px] font-medium text-neutral-600 dark:text-white/70">Apariencia y alertas</span>
            <NotificationBell dropdownSide="bottom" fixedPanel />
            <ThemeToggle dropdownSide="bottom" fixedPanel />
          </div>
          <button
            onClick={() => { onClose(); onSignOut(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[13.5px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.98] text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}
