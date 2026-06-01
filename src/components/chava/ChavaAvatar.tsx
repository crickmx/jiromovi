import { cn } from '@/lib/utils';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
  online?: boolean;
}

const sizes = {
  sm:  { container: 'w-8 h-8',   dot: 'w-2 h-2',     radius: 'rounded-xl' },
  md:  { container: 'w-10 h-10', dot: 'w-2.5 h-2.5', radius: 'rounded-2xl' },
  lg:  { container: 'w-14 h-14', dot: 'w-3 h-3',     radius: 'rounded-2xl' },
  xl:  { container: 'w-20 h-20', dot: 'w-3.5 h-3.5', radius: 'rounded-3xl' },
};

export function ChavaAvatar({ size = 'md', animate = false, className, online = false }: ChavaAvatarProps) {
  const s = sizes[size];

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {animate && (
        <>
          <div className={cn('absolute inset-0', s.radius, 'animate-ping')} style={{ background: 'rgba(0,229,255,0.1)', animationDuration: '2.8s' }} />
          <div className={cn('absolute inset-0', s.radius, 'animate-ping')} style={{ background: 'rgba(0,229,255,0.06)', animationDuration: '3.8s', animationDelay: '0.6s' }} />
        </>
      )}

      <div className={cn('relative overflow-hidden shadow-lg', s.container, s.radius)}>
        <img
          src="/chava-ai-icon.svg"
          alt="Chava AI"
          className="w-full h-full object-cover"
          onError={e => {
            // Fallback: render initials on error
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = 'none';
            const parent = img.parentElement;
            if (parent && !parent.querySelector('.chava-fallback')) {
              const fb = document.createElement('div');
              fb.className = 'chava-fallback w-full h-full flex items-center justify-center';
              fb.style.cssText = 'background:linear-gradient(135deg,#1845A0,#060f25)';
              fb.innerHTML = '<span style="color:#00E5FF;font-weight:900;font-size:60%;letter-spacing:0.05em">AI</span>';
              parent.appendChild(fb);
            }
          }}
        />
      </div>

      {online && (
        <div className={cn('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-neutral-900 bg-emerald-400', s.dot)}>
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" style={{ animationDuration: '2s' }} />
        </div>
      )}
    </div>
  );
}
