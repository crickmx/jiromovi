import { cn } from '../../lib/utils';
import { ChavaOrbIcon } from './ChavaOrbIcon';

interface ChavaBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTagline?: boolean;
}

export function ChavaBrandLogo({ size = 'md', className, showTagline = false }: ChavaBrandLogoProps) {
  const iconSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  const taglineSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ChavaOrbIcon size={iconSize} />
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-bold text-white tracking-tight', textSize)}>Chava</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-brand-600 text-white leading-none">AI</span>
        </div>
        {showTagline && (
          <span className={cn('text-surface-400 font-light', taglineSize)}>agentedeseguros.ai</span>
        )}
      </div>
    </div>
  );
}
