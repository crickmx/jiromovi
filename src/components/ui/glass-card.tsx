import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white/70 dark:bg-white/5 backdrop-blur-md rounded-2xl',
        'border border-neutral-200/50 dark:border-white/10',
        'shadow-ios p-6',
        'transition-all duration-250 ease-ios-smooth',
        hover && 'hover:shadow-ios-lg hover:border-primary-300 dark:hover:border-primary-500/30 hover:-translate-y-0.5',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {children}
    </div>
  );
}
