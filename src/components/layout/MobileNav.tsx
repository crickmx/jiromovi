import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, MessageCircle, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileNavProps {
  onOpenDrawer?: () => void;
  className?: string;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: ClipboardList, label: 'Tramites', href: '/tramites' },
  { icon: MessageCircle, label: 'Contactos', href: '/contactos' },
];

export function MobileNav({ onOpenDrawer, className }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-40',
        'bg-white/95 dark:bg-[#111113]/95 backdrop-blur-md',
        'border-t border-neutral-200/80 dark:border-white/[0.06]',
        'flex items-center',
        className
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Quick nav items */}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 px-2 transition-colors',
              active
                ? 'text-[rgb(var(--movi-accent-rgb))]'
                : 'text-neutral-400 dark:text-white/35 active:text-neutral-600 dark:active:text-white/60'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-px h-8 bg-neutral-200 dark:bg-white/[0.06] mx-1 flex-shrink-0" />

      {/* Menu button — opens MobileDrawer */}
      <button
        onClick={onOpenDrawer}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 px-2 text-neutral-400 dark:text-white/35 active:text-neutral-600 dark:active:text-white/60 transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-medium">Menu</span>
      </button>
    </nav>
  );
}
