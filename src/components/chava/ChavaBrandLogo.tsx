import { cn } from '@/lib/utils';
import { ChavaAvatar } from './ChavaAvatar';

interface ChavaBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showDomain?: boolean;
  animate?: boolean;
  /** 'dark' = white text (for dark backgrounds), 'light' = dark text */
  theme?: 'dark' | 'light';
}

export function ChavaBrandLogo({
  size = 'md',
  className,
  showDomain = true,
  animate = false,
  theme = 'dark',
}: ChavaBrandLogoProps) {
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

  const titleClass = {
    sm: 'text-sm font-bold tracking-wide',
    md: 'text-base font-bold tracking-wide',
    lg: 'text-xl font-bold tracking-wide',
  }[size];

  const domainClass = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ChavaAvatar size={avatarSize} animate={animate} />
      <div>
        <p className={cn(titleClass, theme === 'dark' ? 'text-white' : 'text-slate-900')}>
          CHAVA AGENTE
        </p>
        {showDomain && (
          <p className={cn(domainClass, 'font-medium')} style={{ color: '#00E5FF' }}>
            agentedeseguros.ai
          </p>
        )}
      </div>
    </div>
  );
}
