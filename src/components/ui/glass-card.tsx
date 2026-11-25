import type { ReactNode } from 'react';
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
        'bg-surface-card rounded-none border border-soft p-5',
        'transition-colors duration-200 ease-smooth',
        hover && 'hover:border-neutral-900 dark:hover:border-white',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}
