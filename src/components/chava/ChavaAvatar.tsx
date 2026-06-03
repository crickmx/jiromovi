import { cn } from '@/lib/utils';
import { ChavaOrbIcon } from './ChavaOrbIcon';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
  online?: boolean;
}

const DOT_SIZE = {
  sm:  'w-2 h-2',
  md:  'w-2.5 h-2.5',
  lg:  'w-3 h-3',
  xl:  'w-3.5 h-3.5',
} as const;

export function ChavaAvatar({ size = 'md', animate = false, className, online = false }: ChavaAvatarProps) {
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <ChavaOrbIcon size={size} animate={animate} />

      {online && (
        <div className={cn('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-neutral-900 bg-emerald-400', DOT_SIZE[size])}>
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" style={{ animationDuration: '2s' }} />
        </div>
      )}
    </div>
  );
}
