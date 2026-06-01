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
  // Logo SVG includes wordmark + AI badge + domain — height drives all proportions
  const logoH  = { sm: 'h-7', md: 'h-9', lg: 'h-12' }[size];
  const fallbackTitle = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];
  const fallbackDomain = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' }[size];
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ChavaAvatar size={avatarSize} animate={animate} />

      {/* New branded wordmark SVG */}
      <img
        src="/chava-ai-logo.svg"
        alt="Chava AI"
        className={cn(logoH, 'w-auto object-contain flex-shrink-0')}
        onError={e => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.display = 'none';
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.removeProperty('display');
        }}
      />

      {/* Text fallback — hidden unless SVG fails */}
      <div className="flex-col justify-center" style={{ display: 'none' }}>
        <div className="flex items-center gap-1.5">
          <span className={cn('font-black tracking-tight leading-none', fallbackTitle, theme === 'dark' ? 'text-white' : 'text-slate-900')}>
            Chava
          </span>
          <span
            className={cn('font-black leading-none px-1.5 py-0.5 rounded-md', { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-[11px]' }[size])}
            style={{ background: 'linear-gradient(135deg,#00E5FF,#38BDF8)', color: '#060f25' }}
          >
            AI
          </span>
        </div>
        {showDomain && (
          <span className={cn('font-medium', fallbackDomain)} style={{ color: '#00E5FF' }}>
            agentedeseguros.ai
          </span>
        )}
      </div>
    </div>
  );
}
