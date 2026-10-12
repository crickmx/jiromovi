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
    <div className={cn("flex flex-col gap-2.5 sm:gap-3.5 animate-fade-in w-full", className)}>
      {/* ── Breadcrumb opcional ── */}
      {breadcrumb && (
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 px-1 overflow-x-auto scrollbar-none"
        >
          {breadcrumb}
        </nav>
      )}

      {/* ── Botón Regresar ── */}
      {showBack && (
        <button
          onClick={handleBack}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent hover:bg-surface-muted dark:hover:bg-white/5 transition-colors w-fit -mb-1 active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-fast group-hover:-translate-x-0.5" />
          <span>{backLabel || 'Regresar'}</span>
        </button>
      )}

      {/* ── Tarjeta de Encabezado Premium Ultra-Responsive ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl sm:rounded-3xl bg-surface-card dark:bg-neutral-900/90 border border-soft dark:border-white/10 p-4 sm:p-6 lg:p-7 shadow-card backdrop-blur-xl w-full",
          sticky && "sticky top-0 z-30"
        )}
      >
        {/* Luces sutiles de fondo (glow) adaptadas para móvil y escritorio */}
        <div className="pointer-events-none absolute -right-8 -top-8 sm:-right-12 sm:-top-12 w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-accent/10 dark:bg-accent/15 blur-2xl sm:blur-3xl" />
        <div className="pointer-events-none absolute right-20 sm:right-40 -bottom-8 sm:-bottom-10 w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-blue-500/10 blur-xl sm:blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
          {/* Lado Izquierdo: Icono + Título + Badge + Descripción */}
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            {Icon && (
              <div
                className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md sm:shadow-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgb(var(--movi-accent-rgb)) 0%, rgb(var(--movi-accent-deep-rgb)) 100%)' }}
                aria-hidden="true"
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-display font-bold text-neutral-900 dark:text-white tracking-tight break-words leading-tight sm:leading-normal">
                  {title}
                </h1>
                {badge && (
                  typeof badge === 'string' ? (
                    <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-xs font-bold bg-accent-soft text-accent-ink dark:bg-accent/20 shrink-0">
                      {badge}
                    </span>
                  ) : (
                    <div className="shrink-0">{badge}</div>
                  )
                )}
              </div>
              {desc && (
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed break-words">
                  {desc}
                </p>
              )}
            </div>
          </div>

          {/* Lado Derecho: Botones / Acciones (adaptación responsive completa) */}
          {(actions || action) && (
            <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-white/5">
              {action && typeof action === 'object' && 'label' in action ? (
                <button
                  onClick={action.onClick}
                  className={cn(
                    buttonVariants({ variant: action.variant === 'outline' ? 'outline' : 'default', size: 'sm' }),
                    "w-full sm:w-auto justify-center text-xs sm:text-sm py-2 sm:py-2.5"
                  )}
                >
                  {action.icon && <action.icon className="w-4 h-4" />}
                  <span>{action.label}</span>
                </button>
              ) : action}
              {actions}
            </div>
          )}
        </div>

        {/* Pestañas o navegación secundaria dentro de la tarjeta (con scroll horizontal suave en móvil) */}
        {children && (
          <div className="relative z-10 mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-neutral-100 dark:border-white/5 overflow-x-auto scrollbar-none">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
