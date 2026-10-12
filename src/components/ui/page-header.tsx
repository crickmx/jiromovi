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
    <div className={cn("flex flex-col gap-3.5 animate-fade-in", className)}>
      {breadcrumb && (
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 px-1"
        >
          {breadcrumb}
        </nav>
      )}

      {showBack && (
        <button
          onClick={handleBack}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent hover:bg-surface-muted dark:hover:bg-white/5 transition-colors w-fit -mb-1"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-fast group-hover:-translate-x-0.5" />
          <span>{backLabel || 'Regresar'}</span>
        </button>
      )}

      {/* ── Tarjeta de Encabezado Premium Unificada para Todo el Sistema ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-surface-card dark:bg-neutral-900/90 border border-soft dark:border-white/10 p-6 sm:p-7 shadow-card backdrop-blur-xl",
          sticky && "sticky top-0 z-30"
        )}
      >
        {/* Luces sutiles de fondo (glow) */}
        <div className="pointer-events-none absolute -right-12 -top-12 w-64 h-64 rounded-full bg-accent/10 dark:bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute right-40 -bottom-10 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Lado Izquierdo: Icono + Título + Badge + Descripción */}
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            {Icon && (
              <div
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgb(var(--movi-accent-rgb)) 0%, rgb(var(--movi-accent-deep-rgb)) 100%)' }}
                aria-hidden="true"
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                  {title}
                </h1>
                {badge && (
                  typeof badge === 'string' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent-ink dark:bg-accent/20">
                      {badge}
                    </span>
                  ) : badge
                )}
              </div>
              {desc && (
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                  {desc}
                </p>
              )}
            </div>
          </div>

          {/* Lado Derecho: Botones / Acciones */}
          {(actions || action) && (
            <div className="flex-shrink-0 flex flex-wrap items-center gap-2.5">
              {action && typeof action === 'object' && 'label' in action ? (
                <button
                  onClick={action.onClick}
                  className={buttonVariants({ variant: action.variant === 'outline' ? 'outline' : 'default', size: 'sm' })}
                >
                  {action.icon && <action.icon className="w-4 h-4" />}
                  <span>{action.label}</span>
                </button>
              ) : action}
              {actions}
            </div>
          )}
        </div>

        {/* Pestañas o navegación secundaria dentro de la tarjeta */}
        {children && (
          <div className="relative z-10 mt-5 pt-4 border-t border-neutral-100 dark:border-white/5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
