import { ReactNode } from 'react';
import { Video as LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:gap-5", className)}>
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
          </div>
          {description && (
            <p className={cn(
              "text-sm text-neutral-500 dark:text-white/50 leading-relaxed max-w-3xl",
              Icon && "ml-[44px]"
            )}>
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

      {children}
    </div>
  );
}
