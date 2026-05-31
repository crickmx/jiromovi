import { cn } from '@/lib/utils';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
  online?: boolean;
}

const sizes = {
  sm: { container: 'w-8 h-8', svg: 'w-5 h-5', dot: 'w-2 h-2' },
  md: { container: 'w-10 h-10', svg: 'w-6 h-6', dot: 'w-2.5 h-2.5' },
  lg: { container: 'w-14 h-14', svg: 'w-9 h-9', dot: 'w-3 h-3' },
  xl: { container: 'w-20 h-20', svg: 'w-12 h-12', dot: 'w-3.5 h-3.5' },
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
        className={cn('relative rounded-2xl flex items-center justify-center shadow-lg overflow-hidden', s.container)}
        style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 60%, #060e25 100%)' }}
      >
        {/* Radial glow */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,229,255,0.18) 0%, transparent 70%)' }} />

        <svg
          viewBox="0 0 48 48"
          fill="none"
          className={cn('relative z-10', s.svg)}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left ear — large, rounded */}
          <ellipse cx="8.5" cy="21" rx="7" ry="10" fill="#1e3a6e" />
          <ellipse cx="8.5" cy="21" rx="4.5" ry="6.5" fill="#152d57" />

          {/* Right ear — large, rounded */}
          <ellipse cx="39.5" cy="21" rx="7" ry="10" fill="#1e3a6e" />
          <ellipse cx="39.5" cy="21" rx="4.5" ry="6.5" fill="#152d57" />

          {/* Head */}
          <ellipse cx="24" cy="22" rx="15" ry="14" fill="#1a3060" />
          <ellipse cx="24" cy="22" rx="15" ry="14" fill="url(#headGrad)" />

          {/* Eye glow outer rings */}
          <circle cx="18.5" cy="19" r="4.5" fill="rgba(0,229,255,0.18)" />
          <circle cx="29.5" cy="19" r="4.5" fill="rgba(0,229,255,0.18)" />

          {/* Eye whites */}
          <circle cx="18.5" cy="19" r="3.2" fill="#0a183d" />
          <circle cx="29.5" cy="19" r="3.2" fill="#0a183d" />

          {/* Cyan iris */}
          <circle cx="18.5" cy="19" r="2.2" fill="#00E5FF" />
          <circle cx="29.5" cy="19" r="2.2" fill="#00E5FF" />

          {/* Eye pupil */}
          <circle cx="18.5" cy="19" r="1.1" fill="#003344" />
          <circle cx="29.5" cy="19" r="1.1" fill="#003344" />

          {/* Eye shine */}
          <circle cx="19.3" cy="18.2" r="0.7" fill="white" opacity="0.9" />
          <circle cx="30.3" cy="18.2" r="0.7" fill="white" opacity="0.9" />

          {/* Subtle smile */}
          <path d="M19.5 25.5 Q24 28.5 28.5 25.5" stroke="#00E5FF" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />

          {/* Trunk */}
          <path d="M21.5 29 Q22.5 32 24 34 Q25.5 32 26.5 29" fill="#1a3a6e" opacity="0.8" />
          <path d="M24 34 Q23.5 37 24.5 39" stroke="#1a3a6e" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7" />

          {/* Circuit line bottom */}
          <line x1="17" y1="41" x2="31" y2="41" stroke="#00E5FF" strokeWidth="0.6" opacity="0.35" />
          <circle cx="24" cy="41" r="1.4" fill="#00E5FF" opacity="0.7" />
          <circle cx="17" cy="41" r="0.8" fill="#00E5FF" opacity="0.4" />
          <circle cx="31" cy="41" r="0.8" fill="#00E5FF" opacity="0.4" />
          <line x1="24" y1="39" x2="24" y2="37" stroke="#00E5FF" strokeWidth="0.6" opacity="0.3" />

          {/* Circuit accent lines sides */}
          <line x1="3" y1="28" x2="8" y2="28" stroke="#00E5FF" strokeWidth="0.5" opacity="0.3" />
          <circle cx="3" cy="28" r="0.8" fill="#00E5FF" opacity="0.35" />
          <line x1="40" y1="28" x2="45" y2="28" stroke="#00E5FF" strokeWidth="0.5" opacity="0.3" />
          <circle cx="45" cy="28" r="0.8" fill="#00E5FF" opacity="0.35" />

          {/* Sparkle top-right */}
          <path d="M37 6 L38 3.5 L39 6 L41.5 7 L39 8 L38 10.5 L37 8 L34.5 7 Z" fill="#00E5FF" opacity="0.8" />
          {/* Tiny sparkle top-left */}
          <path d="M9 8 L9.7 6.5 L10.4 8 L12 8.7 L10.4 9.4 L9.7 11 L9 9.4 L7.5 8.7 Z" fill="#00E5FF" opacity="0.45" />

          <defs>
            <radialGradient id="headGrad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#1e3a70" />
              <stop offset="100%" stopColor="#0a183d" />
            </radialGradient>
          </defs>
        </svg>
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
