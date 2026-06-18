import { useState } from 'react';
import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from '../chava/ChavaOrbIcon';
import { ChavaBrandLogo } from '../chava/ChavaBrandLogo';
import { LayoutDashboard, Users, FileText, ChartBar as BarChart2, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Briefcase } from 'lucide-react';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Clientes', href: '/clients' },
  { icon: FileText, label: 'Pólizas', href: '/policies', badge: 3 },
  { icon: Briefcase, label: 'Cotizaciones', href: '/quotes' },
  { icon: BarChart2, label: 'Reportes', href: '/reports' },
  { icon: Bell, label: 'Notificaciones', href: '/notifications', badge: 5 },
  { icon: Settings, label: 'Configuración', href: '/settings' },
];

interface SidebarProps {
  className?: string;
  onChavaClick?: () => void;
  currentPath?: string;
}

export function Sidebar({ className, onChavaClick, currentPath = '/dashboard' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-surface-950 border-r border-surface-800 transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-16' : 'w-60',
        className
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Logo header */}
      <div className={cn(
        'flex items-center h-16 border-b border-surface-800 flex-shrink-0 overflow-hidden',
        collapsed ? 'justify-center px-0' : 'px-4'
      )}>
        {collapsed ? (
          <ChavaOrbIcon size="sm" />
        ) : (
          <ChavaBrandLogo size="sm" showTagline />
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                    active
                      ? 'bg-brand-600/20 text-brand-300'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800'
                  )}
                >
                  <Icon className={cn('w-4.5 h-4.5 flex-shrink-0', active ? 'text-brand-400' : 'text-surface-500 group-hover:text-surface-200')} />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto text-xs bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center leading-none flex-shrink-0">
                      {item.badge}
                    </span>
                  ) : null}
                  {collapsed && item.badge ? (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full" />
                  ) : null}
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-xs rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section: Chava AI button + profile */}
      <div className="flex-shrink-0 border-t border-surface-800 p-3 space-y-2">
        {/* ── Chava AI featured button (desktop) ── */}
        <button
          onClick={onChavaClick}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl transition-all duration-200',
            'bg-gradient-to-r from-sky-900/60 to-brand-900/60',
            'border border-sky-700/40 hover:border-sky-500/60',
            'hover:from-sky-900/80 hover:to-brand-900/80',
            'hover:shadow-[0_0_16px_rgba(56,189,248,0.15)]',
            'group cursor-pointer',
            collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
          )}
          aria-label="Abrir Chava AI"
        >
          <ChavaOrbIcon
            size="sm"
            animate
            className="flex-shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col items-start leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-200 font-semibold text-sm">Chava AI</span>
                <span className="text-xs bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-medium leading-none border border-sky-500/30">
                  Beta
                </span>
              </div>
              <span className="text-surface-500 text-xs truncate">Tu asistente inteligente</span>
            </div>
          )}
          {collapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-xs rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Chava AI
            </span>
          )}
        </button>

        {/* Profile photo / user section */}
        <div className={cn(
          'flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-surface-800 transition-colors group',
          collapsed && 'justify-center px-0'
        )}>
          {/* Profile photo placeholder */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-surface-600 to-surface-700 flex items-center justify-center flex-shrink-0 ring-2 ring-surface-700 group-hover:ring-surface-600 transition-all">
            <span className="text-white text-xs font-semibold">JA</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">Juan Agente</p>
              <p className="text-surface-500 text-xs truncate">juan@seguros.mx</p>
            </div>
          )}
          {!collapsed && (
            <button
              className="text-surface-500 hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
