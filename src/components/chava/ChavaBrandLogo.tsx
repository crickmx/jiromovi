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
  const logoH = { sm: 'h-6', md: 'h-8', lg: 'h-11' }[size];
  const domainClass = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }[size];
  const titleClass = { sm: 'text-sm font-bold tracking-wide', md: 'text-base font-bold tracking-wide', lg: 'text-xl font-bold tracking-wide' }[size];
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ChavaAvatar size={avatarSize} animate={animate} />
      <div className="flex flex-col justify-center">
        <img
          src="/logo_color.svg"
          alt="Chava AI"
          className={cn(logoH, 'w-auto object-contain')}
          style={{ mixBlendMode: 'screen' }}
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = 'none';
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'block';
          }}
        />
        {/* fallback text if SVG fails */}
        <p className={cn(titleClass, 'hidden', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
          CHAVA AI
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
