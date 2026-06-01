import { cn } from '@/lib/utils';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
  online?: boolean;
}

const sizes = {
  sm:  { container: 'w-8 h-8',   dot: 'w-2 h-2',     padding: 'p-1' },
  md:  { container: 'w-10 h-10', dot: 'w-2.5 h-2.5', padding: 'p-1.5' },
  lg:  { container: 'w-14 h-14', dot: 'w-3 h-3',     padding: 'p-2' },
  xl:  { container: 'w-20 h-20', dot: 'w-3.5 h-3.5', padding: 'p-2.5' },
};

export function ChavaAvatar({ size = 'md', animate = false, className, online = false }: ChavaAvatarProps) {
  const s = sizes[size];

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {animate && (
        <>
          <div className="absolute inset-0 rounded-2xl animate-ping" style={{ background: 'rgba(0,229,255,0.12)', animationDuration: '2.5s' }} />
          <div className="absolute inset-0 rounded-2xl animate-ping" style={{ background: 'rgba(0,229,255,0.07)', animationDuration: '3.5s', animationDelay: '0.5s' }} />
        </>
      )}
      <div
        className={cn('relative rounded-2xl flex items-center justify-center shadow-lg overflow-hidden', s.container, s.padding)}
        style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 60%, #060e25 100%)' }}
      >
        {/* Radial glow */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,229,255,0.18) 0%, transparent 70%)' }} />
        <img
          src="/elephant_color.png"
          alt="Chava AI"
          className="relative z-10 w-full h-full object-contain"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = 'none';
          }}
        />
      </div>

      {/* Online indicator */}
      {online && (
        <div className={cn('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-neutral-900 bg-emerald-400', s.dot)}>
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" style={{ animationDuration: '2s' }} />
        </div>
      )}
    </div>
  );
}
