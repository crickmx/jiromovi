import { cn } from '../../lib/utils';

interface ChavaOrbIconProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

const SIZE_PX = { sm: 32, md: 40, lg: 56, xl: 80 };
const SIZE_CLASS = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };

export function ChavaOrbIcon({ size = 'md', animate = false, className }: ChavaOrbIconProps) {
  const px = SIZE_PX[size];
  const uid = `co-${size}`;

  return (
    <div className={cn('relative inline-flex items-center justify-center flex-shrink-0', SIZE_CLASS[size], className)}>
      {animate && (
        <span className="absolute inset-0 rounded-full animate-ping bg-brand-400 opacity-20" />
      )}
      <svg
        width={px}
        height={px}
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Chava AI"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Gradients for ring comet arcs */}
          <linearGradient id={`${uid}-g1`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`${uid}-g2`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`${uid}-g3`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1" />
          </linearGradient>
          {/* Glow filter */}
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-glow-strong`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Background radial gradient */}
          <radialGradient id={`${uid}-bg`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0c2a42" />
            <stop offset="100%" stopColor="#030d1a" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="70" cy="70" r="68" fill={`url(#${uid}-bg)`} />
        <circle cx="70" cy="70" r="68" stroke="#1e4a6e" strokeWidth="0.5" />

        {/* Outer ring track */}
        <circle cx="70" cy="70" r="54" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Outer ring comet arc (CW 2.6s) */}
        <circle
          cx="70" cy="70" r="54"
          stroke={`url(#${uid}-g1)`}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="80 260"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
          style={{ animation: `${uid}-cw 2.6s linear infinite`, transformOrigin: '70px 70px' }}
        />
        {/* Outer ring bright dot */}
        <circle
          cx="70" cy="16"
          r="3"
          fill="#38bdf8"
          filter={`url(#${uid}-glow-strong)`}
          style={{ animation: `${uid}-cw 2.6s linear infinite`, transformOrigin: '70px 70px' }}
        />

        {/* Middle ring track */}
        <circle cx="70" cy="70" r="38" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Middle ring comet arc (CCW 3.8s) */}
        <circle
          cx="70" cy="70" r="38"
          stroke={`url(#${uid}-g2)`}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="60 179"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
          style={{ animation: `${uid}-ccw 3.8s linear infinite`, transformOrigin: '70px 70px' }}
        />
        {/* Middle ring bright dot */}
        <circle
          cx="70" cy="32"
          r="2.5"
          fill="#7dd3fc"
          filter={`url(#${uid}-glow-strong)`}
          style={{ animation: `${uid}-ccw 3.8s linear infinite`, transformOrigin: '70px 70px' }}
        />

        {/* Inner ring track */}
        <circle cx="70" cy="70" r="22" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Inner ring comet arc (CW 1.7s) */}
        <circle
          cx="70" cy="70" r="22"
          stroke={`url(#${uid}-g3)`}
          strokeWidth="2"
          fill="none"
          strokeDasharray="35 103"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
          style={{ animation: `${uid}-cw 1.7s linear infinite`, transformOrigin: '70px 70px' }}
        />
        {/* Inner ring bright dot */}
        <circle
          cx="70" cy="48"
          r="2"
          fill="#bae6fd"
          filter={`url(#${uid}-glow-strong)`}
          style={{ animation: `${uid}-cw 1.7s linear infinite`, transformOrigin: '70px 70px' }}
        />

        {/* Core */}
        <circle
          cx="70" cy="70" r="8"
          fill="#0ea5e9"
          filter={`url(#${uid}-glow-strong)`}
          style={{ animation: `${uid}-core 2s ease-in-out infinite` }}
        />
        <circle cx="70" cy="70" r="4" fill="#e0f2fe" />

        {/* Sparkle dots */}
        <circle cx="70" cy="70" r="1.5" fill="#7dd3fc" opacity="0.9" style={{ animation: `${uid}-spark 1.8s ease-in-out infinite`, transformOrigin: '70px 70px' }} />
        <circle cx="70" cy="70" r="1.5" fill="#38bdf8" opacity="0.7" style={{ animation: `${uid}-spark 2.4s ease-in-out infinite 0.6s`, transformOrigin: '70px 70px' }} />
        <circle cx="70" cy="70" r="1.5" fill="#bae6fd" opacity="0.8" style={{ animation: `${uid}-spark 1.6s ease-in-out infinite 1.2s`, transformOrigin: '70px 70px' }} />

        <style>{`
          @keyframes ${uid}-cw {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes ${uid}-ccw {
            from { transform: rotate(0deg); }
            to { transform: rotate(-360deg); }
          }
          @keyframes ${uid}-core {
            0%, 100% { opacity: 0.85; r: 8; }
            50% { opacity: 1; r: 10; }
          }
          @keyframes ${uid}-spark {
            0%, 100% { opacity: 0; transform: translate(0,0) scale(0.5); }
            30% { opacity: 1; transform: translate(${Math.random() > 0.5 ? '' : '-'}${20 + Math.floor(Math.random()*20)}px, ${Math.random() > 0.5 ? '' : '-'}${20 + Math.floor(Math.random()*20)}px) scale(1.5); }
            60% { opacity: 0.5; transform: translate(${Math.random() > 0.5 ? '' : '-'}${30 + Math.floor(Math.random()*20)}px, ${Math.random() > 0.5 ? '' : '-'}${10 + Math.floor(Math.random()*20)}px) scale(0.8); }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="${uid}-cw"],
            [style*="${uid}-ccw"],
            [style*="${uid}-core"],
            [style*="${uid}-spark"] {
              animation: none !important;
            }
          }
        `}</style>
      </svg>
    </div>
  );
}
