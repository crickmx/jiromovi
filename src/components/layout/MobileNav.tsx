import { useNavigate, useLocation } from 'react-router-dom';
import { Hop as Home, ClipboardList, Megaphone, Menu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onOpenDrawer: () => void;
}

export function MobileNav({ onOpenDrawer }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const sideItems = [
    { path: '/dashboard', label: 'Inicio', icon: Home },
    { path: '/tramites', label: 'Trámite', icon: ClipboardList },
  ];

  const rightItems = [
    { path: '/mercadotecnia/publicidad', label: 'Marketing', icon: Megaphone },
  ];

  const chavaActive = isActive('/chava');

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="bg-white dark:bg-[#111113] border-t border-neutral-200 dark:border-white/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch h-14">
          {/* Left items */}
          {sideItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all active:scale-95',
                  active
                    ? 'text-accent'
                    : 'text-neutral-400 dark:text-neutral-500'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* Central Chava AI button */}
          <div className="flex items-center justify-center w-16 relative -mt-4">
            {/* Glow ring */}
            <div className={cn(
              'absolute inset-0 rounded-full transition-opacity duration-500',
              chavaActive
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-60'
            )} />
            <button
              onClick={() => navigate('/chava')}
              className="relative flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-90"
              style={{
                background: chavaActive
                  ? 'linear-gradient(135deg, #0066ff 0%, #0044cc 100%)'
                  : 'linear-gradient(135deg, #1a7aff 0%, #0055ee 100%)',
                boxShadow: chavaActive
                  ? '0 0 0 3px rgba(26,122,255,0.3), 0 8px 24px rgba(0,85,238,0.5)'
                  : '0 0 0 2px rgba(26,122,255,0.15), 0 6px 20px rgba(0,85,238,0.35)',
              }}
            >
              {/* Pulse ring */}
              {!chavaActive && (
                <span className="absolute inset-0 rounded-full animate-[chava-pulse_2.5s_ease-in-out_infinite]"
                  style={{
                    background: 'radial-gradient(circle, rgba(26,122,255,0.25) 0%, transparent 70%)',
                  }}
                />
              )}
              <Sparkles className="w-6 h-6 text-white" />
              <span className="text-[9px] font-bold text-white/90 leading-none mt-0.5">Chava</span>
            </button>
          </div>

          {/* Right items */}
          {rightItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all active:scale-95',
                  active
                    ? 'text-accent'
                    : 'text-neutral-400 dark:text-neutral-500'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* Menu/drawer button */}
          <button
            onClick={onOpenDrawer}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all active:scale-95"
          >
            <Menu className="w-5 h-5" />
            <span className="leading-none">Menú</span>
          </button>
        </div>
      </div>
    </div>
  );
}
