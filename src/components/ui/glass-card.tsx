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
        'bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-2xl',
        'border border-neutral-200/60 dark:border-white/8',
        'shadow-card p-5',
        'transition-all duration-200 ease-smooth',
        hover && 'hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-white/15 hover:-translate-y-0.5',
        onClick && 'cursor-pointer active:translate-y-0 active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  );
}
