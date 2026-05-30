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
          <div className="absolute inset-0 rounded-2xl bg-cyan-400/15 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute inset-0 rounded-2xl bg-cyan-400/8 animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
        </>
      )}
      <div className={cn(
        'relative rounded-2xl flex items-center justify-center shadow-lg overflow-hidden',
        s.container,
        animate ? 'shadow-cyan-500/30' : 'shadow-black/20'
      )}
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 40%, #155e75 100%)',
        }}
      >
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent rounded-2xl" />

        <svg
          viewBox="0 0 48 48"
          fill="none"
          className={cn('relative z-10', s.svg)}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left ear */}
          <ellipse cx="10" cy="20" rx="6.5" ry="9" fill="white" opacity="0.9" />
          <ellipse cx="10" cy="20" rx="4" ry="5.5" fill="#0e7490" opacity="0.35" />
          {/* Right ear */}
          <ellipse cx="38" cy="20" rx="6.5" ry="9" fill="white" opacity="0.9" />
          <ellipse cx="38" cy="20" rx="4" ry="5.5" fill="#0e7490" opacity="0.35" />

          {/* Head */}
          <ellipse cx="24" cy="22" rx="14" ry="13" fill="white" opacity="0.96" />

          {/* Eyes */}
          <circle cx="19" cy="19" r="3" fill="#0c4a6e" />
          <circle cx="29" cy="19" r="3" fill="#0c4a6e" />
          {/* Eye shine */}
          <circle cx="20.2" cy="17.8" r="1" fill="white" />
          <circle cx="30.2" cy="17.8" r="1" fill="white" />

          {/* Smile */}
          <path d="M19 25 Q24 29 29 25" stroke="#0e7490" strokeWidth="1.5" strokeLinecap="round" fill="none" />

          {/* Trunk */}
          <path d="M21 28 Q22 31 24 33 Q26 31 27 28" fill="#94a3b8" opacity="0.55" />
          <path d="M24 33 Q23 36 24 38 Q25 36 24 33" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5" />

          {/* Circuit accent dots */}
          <circle cx="24" cy="40" r="2" fill="#22d3ee" opacity="0.85" />
          <line x1="20" y1="40" x2="17" y2="40" stroke="#22d3ee" strokeWidth="0.8" opacity="0.5" />
          <line x1="28" y1="40" x2="31" y2="40" stroke="#22d3ee" strokeWidth="0.8" opacity="0.5" />
          <circle cx="15" cy="40" r="1" fill="#22d3ee" opacity="0.4" />
          <circle cx="33" cy="40" r="1" fill="#22d3ee" opacity="0.4" />
          <line x1="24" y1="38" x2="24" y2="36" stroke="#22d3ee" strokeWidth="0.8" opacity="0.4" />

          {/* Sparkle top */}
          <path d="M35 8 L36 5 L37 8 L40 9 L37 10 L36 13 L35 10 L32 9 Z" fill="#67e8f9" opacity="0.7" />
          <path d="M8 10 L9 8 L10 10 L12 11 L10 12 L9 14 L8 12 L6 11 Z" fill="#67e8f9" opacity="0.45" />
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
