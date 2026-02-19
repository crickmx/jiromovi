import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextMessageProps {
  icon: LucideIcon;
  message: ReactNode;
  type?: 'info' | 'success' | 'warning' | 'tip';
  className?: string;
}

export function ContextMessage({
  icon: Icon,
  message,
  type = 'info',
  className
}: ContextMessageProps) {
  const styles = {
    info: {
      bg: 'bg-blue-50 dark:bg-accent/10',
      border: 'border-blue-200 dark:border-accent/30',
      icon: 'text-accent dark:text-blue-400',
      text: 'text-blue-900 dark:text-blue-100'
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-500/10',
      border: 'border-green-200 dark:border-green-500/30',
      icon: 'text-green-600 dark:text-green-400',
      text: 'text-green-900 dark:text-green-100'
    },
    warning: {
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      border: 'border-orange-200 dark:border-orange-500/30',
      icon: 'text-orange-600 dark:text-orange-400',
      text: 'text-orange-900 dark:text-orange-100'
    },
    tip: {
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      border: 'border-purple-200 dark:border-purple-500/30',
      icon: 'text-purple-600 dark:text-purple-400',
      text: 'text-purple-900 dark:text-purple-100'
    }
  };

  const style = styles[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm',
        style.bg,
        style.border,
        'animate-slide-down',
        className
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', style.icon)}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className={cn('text-sm leading-relaxed', style.text)}>
        {message}
      </div>
    </div>
  );
}
