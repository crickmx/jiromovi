import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';
import { LayoutDashboard, Users, FileText, Settings } from 'lucide-react';

interface MobileNavProps {
  className?: string;
  onChavaClick?: () => void;
  currentPath?: string;
}

const LEFT_NAV = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: Users, label: 'Clientes', href: '/clients' },
];

const RIGHT_NAV = [
  { icon: FileText, label: 'Pólizas', href: '/policies' },
  { icon: Settings, label: 'Config', href: '/settings' },
];

export function MobileNav({ className, onChavaClick, currentPath = '/dashboard' }: MobileNavProps) {
  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-950/95 backdrop-blur-md border-t border-surface-800',
        'flex items-center justify-around px-4 pb-safe',
        className
      )}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Left items */}
      {LEFT_NAV.map((item) => {
        const Icon = item.icon;
        const active = currentPath === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors',
              active ? 'text-brand-400' : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </a>
        );
      })}

      {/* Center: Chava AI featured button */}
      <button
        onClick={onChavaClick}
        className="relative -mt-6 flex flex-col items-center gap-1 group"
        aria-label="Abrir Chava AI"
      >
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-900 to-brand-900 border border-sky-700/50 flex items-center justify-center shadow-lg shadow-sky-900/40 group-hover:shadow-sky-700/40 transition-shadow">
          <ChavaOrbIcon size="sm" animate />
        </div>
        <span className="text-xs text-sky-300 font-medium">Chava AI</span>
      </button>

      {/* Right items */}
      {RIGHT_NAV.map((item) => {
        const Icon = item.icon;
        const active = currentPath === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors',
              active ? 'text-brand-400' : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
