import type { ReactNode } from 'react';
import { type LucideIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  action?: ReactNode | { label: string; onClick: () => void; icon?: LucideIcon; variant?: 'default' | 'outline' };
  children?: ReactNode;
  className?: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  badge?: ReactNode;
  /** Optional breadcrumb row rendered above the title (e.g. Workspace › Section). Pure orientation, adds no routes. */
  breadcrumb?: ReactNode;
  /** When true, the header sticks to the top of the scroll container (desktop long lists). Opt-in. */
  sticky?: boolean;
}

export function PageHeader({
  title,
  description,
  subtitle,
  icon: Icon,
  actions,
  action,
  children,
  className,
  backTo,
  backLabel,
  onBack,
  badge,
  breadcrumb,
  sticky = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    }
  };

  const showBack = backTo || onBack;
  const desc = description ?? subtitle;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:gap-5",
        sticky &&
          "sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-[color:var(--color-border-subtle)] bg-[var(--color-surface-overlay)] backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-overlay)]",
        className
      )}
    >
      {breadcrumb && (
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 dark:text-white/40 -mb-1"
        >
          {breadcrumb}
        </nav>
      )}

      {showBack && (
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70 transition-colors w-fit -mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel || 'Regresar'}</span>
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {Icon && (
              <div className="flex-shrink-0 p-2 bg-accent/8 dark:bg-accent/15 rounded-xl">
                <Icon className="w-5 h-5 text-accent" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight truncate">
              {title}
            </h1>
            {badge && badge}
          </div>
          {desc && (
            <p className={cn(
              "text-sm text-neutral-500 dark:text-white/50 leading-relaxed max-w-3xl",
              Icon && "ml-[44px]"
            )}>
              {desc}
            </p>
          )}
        </div>

        {(actions || action) && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
            {action && typeof action === 'object' && 'label' in action ? (
              <button onClick={action.onClick} className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors', action.variant === 'outline' ? 'border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-700 dark:text-white/80 hover:bg-neutral-50 dark:hover:bg-white/10' : 'bg-accent text-white hover:opacity-90')}>
                {action.icon && <action.icon className="w-4 h-4" />}
                <span>{action.label}</span>
              </button>
            ) : action}
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
