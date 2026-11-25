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

/**
 * Encabezado de página del lenguaje «Tarjeta con zócalo»: sin tarjeta, sin
 * esquinas, sin luces de fondo ni degradados. Migas discretas, título en peso
 * 600 con letter-spacing negativo, subtítulo en gris medio y las acciones al
 * lado derecho. El icono del módulo, cuando se pasa, va suelto (sin recuadro).
 */
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
        'flex flex-col gap-3.5 animate-fade-in',
        sticky && 'sticky top-0 z-30 bg-surface-canvas pb-3',
        className
      )}
    >
      {breadcrumb && (
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 px-0.5"
        >
          {breadcrumb}
        </nav>
      )}

      {showBack && (
        <button
          onClick={handleBack}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-fast group-hover:-translate-x-0.5" strokeWidth={1.5} />
          <span>{backLabel || 'Regresar'}</span>
        </button>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        {/* Lado izquierdo: icono suelto + título + etiqueta + descripción.
            Apilado hasta xl para que un bloque de muchas acciones no aplaste
            el título; cuando van al lado, las acciones no pasan del 62%. */}
        <div className="flex items-start gap-3.5 min-w-0">
          {Icon && (
            <Icon
              className="mt-1 h-7 w-7 shrink-0 text-neutral-400 dark:text-white/45"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900 dark:text-white sm:text-[34px]">
                {title}
              </h1>
              {badge && (
                typeof badge === 'string' ? (
                  <span className="border border-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-neutral-600 dark:text-neutral-300">
                    {badge}
                  </span>
                ) : badge
              )}
            </div>
            {desc && (
              <p className="mt-2.5 max-w-3xl text-[14px] leading-[1.6] text-neutral-500 dark:text-neutral-400">
                {desc}
              </p>
            )}
          </div>
        </div>

        {/* Lado Derecho: Botones / Acciones */}
        {(actions || action) && (
          <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:max-w-[62%] xl:flex-shrink-0 xl:justify-end">
            {action && typeof action === 'object' && 'label' in action ? (
              <button
                onClick={action.onClick}
                className={buttonVariants({ variant: action.variant === 'outline' ? 'outline' : 'default', size: 'sm' })}
              >
                {action.icon && <action.icon className="w-4 h-4" strokeWidth={1.5} />}
                <span>{action.label}</span>
              </button>
            ) : action}
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="border-t border-soft pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
