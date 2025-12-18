import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
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
    <div className={cn(
      "flex flex-col gap-4 sm:gap-6",
      className
    )}>
      {/* Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {Icon && (
              <div className="flex-shrink-0 p-2 bg-primary-50 rounded-lg">
                <Icon className="w-6 h-6 text-primary-600" />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-600 tracking-tight truncate">
              {title}
            </h1>
          </div>
          {description && (
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {/* Acciones */}
        {actions && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3">
            {actions}
          </div>
        )}
      </div>

      {/* Contenido adicional */}
      {children}
    </div>
  );
}
