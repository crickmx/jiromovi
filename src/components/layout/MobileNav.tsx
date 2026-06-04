import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Megaphone, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';

interface MobileNavProps {
  onOpenDrawer: () => void;
}

const LEFT_NAV = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard', matchPrefix: false },
  { icon: FileText, label: 'Trámites', href: '/tramites', matchPrefix: true },
];

const RIGHT_NAV = [
  { icon: Megaphone, label: 'Marketing', href: '/mercadotecnia', matchPrefix: true },
];

export function MobileNav({ onOpenDrawer }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string, matchPrefix: boolean) => {
    if (matchPrefix) return location.pathname.startsWith(href);
    return location.pathname === href;
  };

  const chavaActive = location.pathname.startsWith('/chava');

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111113] border-t border-neutral-200 dark:border-white/[0.06] flex items-center justify-around px-1 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_12px_rgba(0,0,0,0.3)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* Left: Inicio, Trámites */}
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

      {/* Center: Chava AI — elevated, prominent */}
      <button
        onClick={() => navigate('/chava')}
        className="relative -mt-6 flex flex-col items-center gap-1 group active:scale-95 transition-transform"
        aria-label="Chava AI"
      >
        {/* Glow ring behind the button */}
        <span
          className={cn(
            'absolute inset-0 -top-1 rounded-full transition-opacity duration-300',
            chavaActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          )}
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.35) 0%, transparent 70%)',
            filter: 'blur(6px)',
          }}
        />
        <div
          className={cn(
            'relative w-14 h-14 rounded-[18px] flex items-center justify-center transition-all duration-300',
            'bg-gradient-to-br from-[#06213a] via-[#0a2d54] to-[#061830]',
            'shadow-lg',
            chavaActive
              ? 'shadow-sky-500/40 border border-sky-500/50'
              : 'shadow-sky-900/40 border border-sky-800/40 group-hover:shadow-sky-600/30 group-hover:border-sky-600/40'
          )}
        >
          <ChavaOrbIcon size="sm" animate />
        </div>
        <span
          className={cn(
            'text-[10px] font-bold leading-none tracking-wide',
            chavaActive
              ? 'text-sky-400'
              : 'text-neutral-400 dark:text-white/50 group-hover:text-sky-400'
          )}
        >
          Chava AI
        </span>
      </button>

      {/* Right: Mercadotecnia */}
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
