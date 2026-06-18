import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from './ChavaOrbIcon';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
  online?: boolean;
}

const DOT_SIZE = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

export function ChavaAvatar({ size = 'md', animate = false, className, online = false }: ChavaAvatarProps) {
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <ChavaOrbIcon size={size} animate={animate} />
      {online && (
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 border-2 border-surface-900',
            DOT_SIZE[size]
          )}
        />
      )}
    </div>
  );
}
