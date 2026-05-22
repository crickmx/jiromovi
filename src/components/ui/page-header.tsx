import { ReactNode } from 'react';
import { type LucideIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  badge?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  backTo,
  backLabel,
  onBack,
  badge,
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

  return (
    <div className={cn("flex flex-col gap-4 sm:gap-5", className)}>
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
