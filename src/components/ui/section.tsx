import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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

  const variantStyles: Record<string, string> = {
    default: '',
    card: 'bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
    bordered: 'border-l-4 border-accent pl-4',
  };

  return (
    <div className={cn(
      "space-y-4",
      variantStyles[variant],
      variant === 'card' && 'p-5 sm:p-6',
      className
    )}>
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            {title && (
              <div className="flex items-center gap-2 mb-1">
                {Icon && (
                  <div className="p-1.5 rounded-lg bg-accent/8 dark:bg-accent/15">
                    <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                  </div>
                )}
                <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white tracking-tight truncate">
                  {title}
                </h2>
              </div>
            )}
            {description && (
              <p className="text-sm text-neutral-500 dark:text-white/50 leading-relaxed">
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
