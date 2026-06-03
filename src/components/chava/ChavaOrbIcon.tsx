import { cn } from '@/lib/utils';

/**
 * ChavaOrbIcon — the official logo/icon of Chava AI.
 *
 * A tri-ring holographic HUD with comet arcs, a pulsing core,
 * and sparkle flashes. Scales perfectly at any size via CSS.
 *
 * This is the face of Chava AI throughout the platform.
 */

interface ChavaOrbIconProps {
  /** Preset sizes: sm=32 md=40 lg=56 xl=80 px */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** If true, adds an outer pulsing halo (used when Chava is "active" or "typing") */
  animate?: boolean;
  className?: string;
}

const SIZE_PX = { sm: 32, md: 40, lg: 56, xl: 80 } as const;
const SIZE_CLASS = {
  sm:  'w-8 h-8',
  md:  'w-10 h-10',
  lg:  'w-14 h-14',
  xl:  'w-20 h-20',
} as const;

export function ChavaOrbIcon({ size = 'md', animate = false, className }: ChavaOrbIconProps) {
  const px = SIZE_PX[size];
  const cls = SIZE_CLASS[size];
  // Unique ID per instance to avoid SVG filter collisions when multiple icons are on screen
  const uid = `co-${size}`;

  return (
    <div className={cn('relative flex-shrink-0 flex items-center justify-center', cls, className)}>
      {/* Outer ping halo — only when animate=true */}
      {animate && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(56,189,248,0.14)', animationDuration: '2.4s' }}
          />
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(6,182,212,0.08)', animationDuration: '3.6s', animationDelay: '0.7s' }}
          />
        </>
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
          <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#0c2a42" />
            <stop offset="100%" stopColor="#030d1a" />
          </radialGradient>

          {/* Outer ring comet gradient */}
          <linearGradient id={`${uid}-g1`} x1="70" y1="8" x2="70" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.04" />
            <stop offset="50%"  stopColor="#38bdf8" stopOpacity="0.2"  />
            <stop offset="88%"  stopColor="#7dd3fc" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1"    />
          </linearGradient>

          {/* Middle ring comet gradient */}
          <linearGradient id={`${uid}-g2`} x1="70" y1="24" x2="70" y2="116" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.04" />
            <stop offset="65%"  stopColor="#22d3ee" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="1"    />
          </linearGradient>

          {/* Inner ring gradient */}
          <linearGradient id={`${uid}-g3`} x1="70" y1="40" x2="70" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#0ea5e9" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9"  />
          </linearGradient>

          {/* Glow blur filter */}
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${uid}-glow2`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Dark background circle */}
        <circle cx="70" cy="70" r="68" fill={`url(#${uid}-bg)`} />

        {/* ── Track rings (dim, static) ── */}
        <circle cx="70" cy="70" r="58" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.14" />
        <circle cx="70" cy="70" r="42" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.10" />
        <circle cx="70" cy="70" r="27" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.10" />

        {/* ── Outer comet arc + leading dot (spins CW, 2.6s) ── */}
        <g className="co-ring-outer" style={{ transformOrigin: '70px 70px', animation: 'co-cw 2.6s linear infinite' }}>
          <circle
            cx="70" cy="70" r="58"
            stroke={`url(#${uid}-g1)`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="85 279"
            filter={`url(#${uid}-glow)`}
          />
          <circle cx="70" cy="12" r="3.2" fill="#bae6fd" filter={`url(#${uid}-glow2)`} />
        </g>

        {/* ── Middle comet arc + leading dot (CCW, 3.8s) ── */}
        <g className="co-ring-middle" style={{ transformOrigin: '70px 70px', animation: 'co-ccw 3.8s linear infinite' }}>
          <circle
            cx="70" cy="70" r="42"
            stroke={`url(#${uid}-g2)`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="58 206"
            filter={`url(#${uid}-glow)`}
          />
          <circle cx="70" cy="28" r="2.4" fill="#67e8f9" filter={`url(#${uid}-glow2)`} />
        </g>

        {/* ── Inner comet arc + leading dot (CW fast, 1.7s) ── */}
        <g className="co-ring-inner" style={{ transformOrigin: '70px 70px', animation: 'co-cw 1.7s linear infinite' }}>
          <circle
            cx="70" cy="70" r="27"
            stroke={`url(#${uid}-g3)`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="34 136"
            filter={`url(#${uid}-glow)`}
          />
          <circle cx="70" cy="43" r="2" fill="#7dd3fc" filter={`url(#${uid}-glow2)`} />
        </g>

        {/* ── Core ── */}
        <circle cx="70" cy="70" r="8" fill="#061828" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="70" cy="70" r="4.5" fill="#38bdf8" filter={`url(#${uid}-glow2)`}
          style={{ animation: 'co-core 1.9s ease-in-out infinite' }} />

        {/* ── Sparkles (hidden at very small sizes via opacity trick) ── */}
        <circle cx="70" cy="16"  r="1.8" fill="#7dd3fc" style={{ animation: 'co-spark 2.1s 0.0s ease-in-out infinite' }} filter={`url(#${uid}-glow)`} />
        <circle cx="116" cy="44" r="1.5" fill="#67e8f9" style={{ animation: 'co-spark 2.5s 0.6s ease-in-out infinite' }} filter={`url(#${uid}-glow)`} />
        <circle cx="108" cy="104" r="1.4" fill="#38bdf8" style={{ animation: 'co-spark 1.9s 1.2s ease-in-out infinite' }} filter={`url(#${uid}-glow)`} />
        <circle cx="26"  cy="96"  r="1.3" fill="#7dd3fc" style={{ animation: 'co-spark 2.8s 0.4s ease-in-out infinite' }} filter={`url(#${uid}-glow)`} />
        <circle cx="22"  cy="38"  r="1.2" fill="#bae6fd" style={{ animation: 'co-spark 2.3s 0.9s ease-in-out infinite' }} filter={`url(#${uid}-glow)`} />
      </svg>

      {/* Global keyframes — injected once, reused by all instances */}
      <style>{`
        @keyframes co-cw   { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes co-ccw  { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes co-core { 0%,100% { opacity:.7; transform:scale(1);   } 50% { opacity:1; transform:scale(1.35); } }
        @keyframes co-spark { 0%,100% { opacity:0; transform:scale(.3); } 45%,55% { opacity:1; transform:scale(1); } }

        @media (prefers-reduced-motion: reduce) {
          .co-ring-outer, .co-ring-middle, .co-ring-inner { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
