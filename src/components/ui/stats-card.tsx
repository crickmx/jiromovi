import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = 'primary',
  onClick,
  children,
  className
}: StatsCardProps) {
  const colorStyles = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'text-primary-600',
      value: 'text-neutral-900',
      trend: 'text-primary-600'
    },
    success: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-neutral-900',
      trend: 'text-green-600'
    },
    warning: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      value: 'text-neutral-900',
      trend: 'text-orange-600'
    },
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      value: 'text-neutral-900',
      trend: 'text-red-600'
    },
    neutral: {
      bg: 'bg-neutral-100',
      icon: 'text-neutral-600',
      value: 'text-neutral-900',
      trend: 'text-neutral-600'
    }
  };

  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-neutral-200 shadow-ios p-4 sm:p-6',
        'transition-all duration-200 ease-ios-smooth',
        onClick && 'cursor-pointer hover:shadow-ios-md hover:border-primary-300 active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Título */}
          <p className="text-sm font-medium text-neutral-600 mb-1 truncate">
            {title}
          </p>

          {/* Valor principal */}
          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight mb-1',
            styles.value
          )}>
            {value}
          </p>

          {/* Descripción o trend */}
          {(description || trend) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <span className={cn(
                  'text-xs sm:text-sm font-medium',
                  styles.trend
                )}>
                  {trend.direction === 'up' ? '↑' : '↓'} {trend.value}% {trend.label}
                </span>
              )}
              {description && (
                <span className="text-xs sm:text-sm text-neutral-500">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icono */}
        {Icon && (
          <div className={cn(
            'flex-shrink-0 p-3 rounded-lg',
            styles.bg
          )}>
            <Icon className={cn('w-6 h-6', styles.icon)} />
          </div>
        )}
      </div>

      {/* Contenido adicional */}
      {children && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          {children}
        </div>
      )}
    </div>
  );
}
