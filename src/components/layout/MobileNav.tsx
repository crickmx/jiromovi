import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';

interface MobileNavProps {
  onOpenDrawer: () => void;
}

const LEFT_NAV = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard', matchPrefix: false },
  { icon: Users, label: 'CRM', href: '/crm-contactos', matchPrefix: true },
];

const RIGHT_NAV = [
  { icon: FileText, label: 'Trámites', href: '/tramites', matchPrefix: true },
];

export function MobileNav({ onOpenDrawer }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string, matchPrefix: boolean) => {
    if (matchPrefix) return location.pathname.startsWith(href);
    return location.pathname === href;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111113] border-t border-neutral-200 dark:border-white/[0.06] flex items-center justify-around px-2 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_12px_rgba(0,0,0,0.3)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* Left items */}
      {LEFT_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.matchPrefix);
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors active:scale-95',
              active
                ? 'text-accent'
                : 'text-neutral-400 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </button>
        );
      })}

      {/* Center: Chava AI */}
      <button
        onClick={() => navigate('/chava')}
        className="relative -mt-5 flex flex-col items-center gap-1 group active:scale-95 transition-transform"
        aria-label="Chava AI"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-900/90 to-blue-900/90 border border-sky-700/40 flex items-center justify-center shadow-lg shadow-sky-900/30 dark:shadow-sky-900/50 group-hover:shadow-sky-700/30 transition-shadow">
          <ChavaOrbIcon size="sm" animate />
        </div>
        <span className={cn(
          'text-[10px] font-semibold leading-none',
          location.pathname.startsWith('/chava')
            ? 'text-sky-400'
            : 'text-neutral-400 dark:text-white/50 group-hover:text-sky-400'
        )}>
          Chava
        </span>
      </button>

      {/* Right items */}
      {RIGHT_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.matchPrefix);
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors active:scale-95',
              active
                ? 'text-accent'
                : 'text-neutral-400 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </button>
        );
      })}

      {/* Menu — opens the right-side MobileDrawer */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl transition-colors active:scale-95 text-neutral-400 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-semibold leading-none">Menú</span>
      </button>
    </nav>
  );
}
