import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';
import { ClipboardList, Users, Palette, Menu } from 'lucide-react';

interface MobileNavProps {
  className?: string;
  onOpenDrawer?: () => void;
}

const NAV_ITEMS = [
  { icon: ClipboardList, label: 'Tramites', href: '/tramites' },
  { icon: Users, label: 'CRM', href: '/mi-crm' },
  // Chava AI goes in center (rendered separately)
  { icon: Palette, label: 'MKT', href: '/mercadotecnia/publicidad' },
];

export function MobileNav({ className, onOpenDrawer }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string) => {
    if (location.pathname === href) return true;
    if (href === '/tramites' && location.pathname.startsWith('/tramites')) return true;
    if (href === '/mi-crm' && location.pathname.startsWith('/mi-crm')) return true;
    if (href === '/mercadotecnia/publicidad' && location.pathname.startsWith('/mercadotecnia')) return true;
    return false;
  };

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50',
        'bg-white/95 dark:bg-[#111113]/95 backdrop-blur-xl',
        'border-t border-neutral-200 dark:border-white/[0.08]',
        'flex items-end justify-around px-2',
        className
      )}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* Tramites */}
      <NavButton
        icon={NAV_ITEMS[0].icon}
        label={NAV_ITEMS[0].label}
        active={isActive(NAV_ITEMS[0].href)}
        onClick={() => navigate(NAV_ITEMS[0].href)}
      />

      {/* CRM */}
      <NavButton
        icon={NAV_ITEMS[1].icon}
        label={NAV_ITEMS[1].label}
        active={isActive(NAV_ITEMS[1].href)}
        onClick={() => navigate(NAV_ITEMS[1].href)}
      />

      {/* Center: Chava AI featured button */}
      <button
        onClick={() => navigate('/chava')}
        className="relative -mt-5 flex flex-col items-center gap-0.5 group outline-none"
        aria-label="Abrir Chava AI"
      >
        <div className="relative w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-sky-950 to-slate-900 border border-sky-700/40 flex items-center justify-center shadow-lg shadow-sky-900/30 group-active:scale-95 transition-transform">
          <div className="absolute inset-0 rounded-2xl bg-sky-500/10 animate-pulse" />
          <ChavaOrbIcon size="sm" animate />
        </div>
        <span className="text-[10px] text-sky-500 dark:text-sky-400 font-semibold tracking-tight">Chava AI</span>
      </button>

      {/* Mercadotecnia */}
      <NavButton
        icon={NAV_ITEMS[2].icon}
        label={NAV_ITEMS[2].label}
        active={isActive(NAV_ITEMS[2].href)}
        onClick={() => navigate(NAV_ITEMS[2].href)}
      />

      {/* Menu */}
      <NavButton
        icon={Menu}
        label="Menu"
        active={false}
        onClick={onOpenDrawer}
      />
    </nav>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors min-w-[56px] outline-none active:scale-95',
        active
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-neutral-400 dark:text-neutral-500'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className={cn(
        'text-[10px] leading-tight',
        active ? 'font-semibold' : 'font-medium'
      )}>{label}</span>
      {active && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-sky-500" />
      )}
    </button>
  );
}
