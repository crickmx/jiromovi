import { cn } from '@/lib/utils';
import { ChavaOrbIcon } from './ChavaOrbIcon';

interface ChavaBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showDomain?: boolean;
  animate?: boolean;
  /** 'dark' = white text (for dark backgrounds), 'light' = dark text */
  theme?: 'dark' | 'light';
}

const TITLE_SIZE  = { sm: 'text-sm',  md: 'text-base', lg: 'text-xl'  } as const;
const BADGE_SIZE  = { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-[11px]' } as const;
const DOMAIN_SIZE = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' } as const;
const ICON_SIZE   = { sm: 'sm', md: 'md', lg: 'lg' } as const;

export function ChavaBrandLogo({
  size = 'md',
  className,
  showDomain = true,
  animate = false,
  theme = 'dark',
}: ChavaBrandLogoProps) {
  const titleColor  = theme === 'dark' ? 'text-white'      : 'text-slate-900';
  const domainColor = theme === 'dark' ? 'text-cyan-400/80' : 'text-cyan-600';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Animated orb — the official Chava AI icon */}
      <ChavaOrbIcon size={ICON_SIZE[size]} animate={animate} />

      {/* Wordmark */}
      <div className="flex flex-col justify-center leading-none gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-black tracking-tight leading-none', TITLE_SIZE[size], titleColor)}>
            Chava
          </span>
          <span
            className={cn('font-black leading-none px-1.5 py-0.5 rounded-md', BADGE_SIZE[size])}
            style={{ background: 'linear-gradient(135deg,#00FFCC,#00C8F0)', color: '#061828' }}
          >
            AI
          </span>
        </div>

        {showDomain && (
          <span className={cn('font-medium', DOMAIN_SIZE[size], domainColor)}>
            agentedeseguros.ai
          </span>
        )}
      </div>
    </div>
  );
}
