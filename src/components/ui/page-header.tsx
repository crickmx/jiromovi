import type { ReactNode } from 'react';
import { type LucideIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

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
        "flex flex-col gap-4 sm:gap-5 animate-rise",
        sticky &&
          "sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-[color:var(--color-border-subtle)] bg-[var(--color-surface-overlay)] backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-overlay)]",
        className
      )}
    >
      {breadcrumb && (
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-caption font-medium text-neutral-500 dark:text-white/50 -mb-1"
        >
          {breadcrumb}
        </nav>
      )}

      {showBack && (
        <button
          onClick={handleBack}
          className="group inline-flex items-center gap-1.5 -ml-2 px-2 py-1 rounded-lg text-sm font-medium text-neutral-600 dark:text-white/60 hover:text-accent-ink hover:bg-accent-softer dark:hover:text-white dark:hover:bg-white/8 transition-colors w-fit -mb-2"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-fast group-hover:-translate-x-0.5" />
          <span>{backLabel || 'Regresar'}</span>
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {Icon && (
              <div
                className="flex-shrink-0 grid place-items-center w-10 h-10 rounded-2xl text-accent-foreground shadow-accent"
                style={{ background: 'linear-gradient(135deg, rgb(var(--movi-accent-rgb)) 0%, rgb(var(--movi-accent-2-rgb)) 140%)' }}
                aria-hidden="true"
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
            <h1 className="font-display text-title sm:text-title-lg font-semibold text-neutral-900 dark:text-white min-w-0 break-words">
              {title}
            </h1>
            {badge && badge}
          </div>
          {desc && (
            <p className={cn(
              "text-sm text-neutral-600 dark:text-white/60 leading-relaxed max-w-3xl",
              Icon && "sm:ml-[52px]"
            )}>
              {desc}
            </p>
          )}
        </div>

        {(actions || action) && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
            {action && typeof action === 'object' && 'label' in action ? (
              <button onClick={action.onClick} className={buttonVariants({ variant: action.variant === 'outline' ? 'outline' : 'default', size: 'sm' })}>
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
