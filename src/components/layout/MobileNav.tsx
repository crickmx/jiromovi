import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, MessageCircle, Menu, PlusCircle, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';

interface MobileNavProps {
  onOpenDrawer?: () => void;
  className?: string;
  currentPath?: string;
  onChavaClick?: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: ClipboardList, label: 'Trámites', href: '/tramites' },
  { icon: PlusCircle, label: 'Nuevo', href: '/tramites?nuevo=1', isAction: true },
  { icon: Search, label: 'Contactos', href: '/contactos' },
];

export function MobileNav({ onOpenDrawer, className, currentPath, onChavaClick }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-40',
        'bg-white/90 dark:bg-[#111113]/92 backdrop-blur-xl backdrop-saturate-150',
        'border-t border-soft shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.25)]',
        'flex items-center px-1.5 pt-1',
        className
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navegación rápida"
    >
      {/* Quick nav items */}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const pathname = currentPath ?? location.pathname;
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0] + '/'));
        const isAction = (item as any).isAction;

        if (isAction) {
          return (
            <button
              key={item.href}
              onClick={() => {
                if (window.navigator?.vibrate) window.navigator.vibrate(10);
                navigate('/tramites');
              }}
              className="flex-1 flex flex-col items-center justify-center -mt-3 relative group"
            >
              <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/30 group-active:scale-95 transition-transform">
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-display text-[10.5px] font-semibold text-accent-ink mt-0.5">{item.label}</span>
            </button>
          );
        }

        return (
          <button
            key={item.href}
            onClick={() => {
              if (window.navigator?.vibrate) window.navigator.vibrate(5);
              if (item.href === '/chava' && onChavaClick) onChavaClick();
              else navigate(item.href);
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-1.5 px-1 min-h-[52px] transition-colors active:scale-95',
              active
                ? 'text-accent-ink'
                : 'text-neutral-500 dark:text-white/50 active:text-neutral-700 dark:active:text-white/70'
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-fast',
              active && 'bg-accent-soft dark:bg-accent/20'
            )}>
              <Icon className="w-5 h-5" />
            </span>
            <span className={cn('font-display text-[10.5px] leading-none', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-px h-8 bg-[var(--border-soft)] mx-0.5 flex-shrink-0" aria-hidden="true" />

      {/* Menu button — opens MobileDrawer (also surfaces unread notification count) */}
      <button
        onClick={onOpenDrawer}
        className="flex-1 flex flex-col items-center gap-1 py-1.5 px-1 min-h-[52px] text-neutral-500 dark:text-white/50 active:text-neutral-700 dark:active:text-white/70 transition-colors relative active:scale-95"
        aria-label="Abrir menu"
      >
        <span className="relative flex items-center justify-center w-12 h-7">
          <Menu className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        <span className="font-display text-[10.5px] font-medium leading-none">Menú</span>
      </button>
    </nav>
  );
}
