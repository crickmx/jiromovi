import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Palette, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';

interface MobileNavProps {
  onChavaClick?: () => void;
  onOpenDrawer?: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: ClipboardList, label: 'Trámites', href: '/tramites' },
] as const;

const NAV_ITEMS_RIGHT = [
  { icon: Palette, label: 'Marketing', href: '/mercadotecnia/publicidad' },
] as const;

export function MobileNav({ onChavaClick, onOpenDrawer }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50',
        'bg-white/95 dark:bg-[#111113]/95 backdrop-blur-xl',
        'border-t border-neutral-200/60 dark:border-white/[0.06]',
        'flex items-end justify-around px-2',
        'shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]'
      )}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      {/* Inicio */}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              'flex flex-col items-center gap-1 pt-2.5 pb-0.5 px-4 min-w-[56px] rounded-xl transition-all active:scale-95',
              active
                ? 'text-accent'
                : 'text-neutral-500 dark:text-white/40 hover:text-neutral-800 dark:hover:text-white/70'
            )}
          >
            <Icon className={cn('w-[22px] h-[22px] transition-transform', active && 'scale-105')} strokeWidth={active ? 2.2 : 1.8} />
            <span className={cn('text-[10px] font-medium tracking-tight', active && 'font-semibold')}>{item.label}</span>
            {active && <span className="absolute bottom-[calc(env(safe-area-inset-bottom,10px)+2px)] w-4 h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}

      {/* Center: Chava AI featured */}
      <button
        onClick={onChavaClick}
        className="relative flex flex-col items-center gap-1 pt-0 pb-0.5 px-3 group"
        aria-label="Abrir Chava AI"
      >
        <div className={cn(
          'relative -mt-5 w-[54px] h-[54px] rounded-2xl flex items-center justify-center',
          'bg-gradient-to-br from-[#0a1628] to-[#061020]',
          'border border-sky-500/30',
          'shadow-lg shadow-sky-900/40',
          'group-active:scale-95 transition-all duration-150',
        )}>
          <ChavaOrbIcon size="sm" animate />
        </div>
        <span className="text-[10px] font-semibold text-sky-400 tracking-tight mt-0.5">Chava AI</span>
      </button>

      {/* Mercadotecnia */}
      {NAV_ITEMS_RIGHT.map((item) => {
        const Icon = item.icon;
        const active = location.pathname.startsWith('/mercadotecnia');
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              'relative flex flex-col items-center gap-1 pt-2.5 pb-0.5 px-4 min-w-[56px] rounded-xl transition-all active:scale-95',
              active
                ? 'text-accent'
                : 'text-neutral-500 dark:text-white/40 hover:text-neutral-800 dark:hover:text-white/70'
            )}
          >
            <Icon className={cn('w-[22px] h-[22px] transition-transform', active && 'scale-105')} strokeWidth={active ? 2.2 : 1.8} />
            <span className={cn('text-[10px] font-medium tracking-tight', active && 'font-semibold')}>{item.label}</span>
            {active && <span className="absolute bottom-[calc(env(safe-area-inset-bottom,10px)+2px)] w-4 h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}

      {/* Menu — opens right drawer */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center gap-1 pt-2.5 pb-0.5 px-4 min-w-[56px] rounded-xl text-neutral-500 dark:text-white/40 hover:text-neutral-800 dark:hover:text-white/70 transition-all active:scale-95"
        aria-label="Abrir menú"
      >
        <Menu className="w-[22px] h-[22px]" strokeWidth={1.8} />
        <span className="text-[10px] font-medium tracking-tight">Menú</span>
      </button>
    </nav>
  );
}
