import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'default' | 'card' | 'bordered';
}

export function Section({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
  variant = 'default'
}: SectionProps) {
  const hasHeader = title || description || actions || Icon;

  const variantStyles = {
    default: '',
    card: 'bg-white rounded-lg border border-neutral-200 shadow-ios',
    bordered: 'border-l-4 border-primary-500 pl-4'
  };

  return (
    <div className={cn(
      "space-y-4",
      variantStyles[variant],
      variant === 'card' && 'p-4 sm:p-6',
      className
    )}>
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            {title && (
              <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />}
                <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 tracking-tight truncate">
                  {title}
                </h2>
              </div>
            )}
            {description && (
              <p className="text-sm text-neutral-600 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={cn(contentClassName)}>
        {children}
      </div>
    </div>
  );
}
