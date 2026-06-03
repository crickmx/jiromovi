
interface LoadingOrbProps {
  size?: number;
}

export function LoadingOrb({ size = 120 }: LoadingOrbProps) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Ambient glow */}
      <div
        className="lo-ambient absolute rounded-full"
        style={{
          width: size * 1.1,
          height: size * 1.1,
          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
          animation: 'lo-pulse 2.4s ease-in-out infinite',
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lo-g1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="lo-g2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="lo-g3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1" />
          </linearGradient>
          <filter id="lo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lo-glow-strong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="lo-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0c2a42" />
            <stop offset="100%" stopColor="#030d1a" />
          </radialGradient>
        </defs>

        <circle cx="70" cy="70" r="68" fill="url(#lo-bg)" />
        <circle cx="70" cy="70" r="68" stroke="#1e4a6e" strokeWidth="0.5" />

        {/* Outer ring track */}
        <circle cx="70" cy="70" r="54" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Outer ring comet arc CW */}
        <circle className="lo-ring-outer" cx="70" cy="70" r="54"
          stroke="url(#lo-g1)" strokeWidth="3" fill="none"
          strokeDasharray="80 260" strokeLinecap="round"
          filter="url(#lo-glow)"
        />
        <circle className="lo-ring-outer" cx="70" cy="16" r="3.5" fill="#38bdf8" filter="url(#lo-glow-strong)" />

        {/* Middle ring track */}
        <circle cx="70" cy="70" r="38" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Middle ring comet arc CCW */}
        <circle className="lo-ring-middle" cx="70" cy="70" r="38"
          stroke="url(#lo-g2)" strokeWidth="3" fill="none"
          strokeDasharray="60 179" strokeLinecap="round"
          filter="url(#lo-glow)"
        />
        <circle className="lo-ring-middle" cx="70" cy="32" r="3" fill="#7dd3fc" filter="url(#lo-glow-strong)" />

        {/* Inner ring track */}
        <circle cx="70" cy="70" r="22" stroke="#1e4a6e" strokeWidth="1.5" fill="none" />
        {/* Inner ring comet arc CW fast */}
        <circle className="lo-ring-inner" cx="70" cy="70" r="22"
          stroke="url(#lo-g3)" strokeWidth="2.5" fill="none"
          strokeDasharray="35 103" strokeLinecap="round"
          filter="url(#lo-glow)"
        />
        <circle className="lo-ring-inner" cx="70" cy="48" r="2.5" fill="#bae6fd" filter="url(#lo-glow-strong)" />

        {/* Core */}
        <circle className="lo-core" cx="70" cy="70" r="9" fill="#0ea5e9" filter="url(#lo-glow-strong)" />
        <circle cx="70" cy="70" r="4.5" fill="#e0f2fe" />
      </svg>

      {/* Sparkle divs */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="lo-spark"
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#7dd3fc' : '#bae6fd',
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}

      <style>{`
        .lo-ring-outer {
          transform-origin: 70px 70px;
          animation: lo-cw 2.6s linear infinite;
        }
        .lo-ring-middle {
          transform-origin: 70px 70px;
          animation: lo-ccw 3.8s linear infinite;
        }
        .lo-ring-inner {
          transform-origin: 70px 70px;
          animation: lo-cw 1.7s linear infinite;
        }
        .lo-core {
          animation: lo-core-pulse 2s ease-in-out infinite;
        }
        .lo-spark {
          animation: lo-twinkle 2s ease-in-out infinite;
        }
        @keyframes lo-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes lo-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes lo-core-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes lo-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes lo-twinkle {
          0%, 100% { opacity: 0; transform: translate(0, 0) scale(0); }
          25% { opacity: 1; transform: translate(24px, -20px) scale(1.5); }
          50% { opacity: 0.6; transform: translate(-18px, -28px) scale(1); }
          75% { opacity: 0.8; transform: translate(20px, 14px) scale(1.2); }
        }
        .lo-spark:nth-child(2) { animation-delay: 0.3s; }
        .lo-spark:nth-child(3) { animation-delay: 0.6s; animation-name: lo-twinkle2; }
        .lo-spark:nth-child(4) { animation-delay: 0.9s; }
        .lo-spark:nth-child(5) { animation-delay: 1.2s; animation-name: lo-twinkle3; }
        .lo-spark:nth-child(6) { animation-delay: 1.5s; }
        @keyframes lo-twinkle2 {
          0%, 100% { opacity: 0; transform: translate(0, 0) scale(0); }
          25% { opacity: 1; transform: translate(-22px, -16px) scale(1.3); }
          50% { opacity: 0.7; transform: translate(28px, -10px) scale(0.9); }
          75% { opacity: 0.9; transform: translate(-12px, 24px) scale(1.4); }
        }
        @keyframes lo-twinkle3 {
          0%, 100% { opacity: 0; transform: translate(0, 0) scale(0); }
          25% { opacity: 0.8; transform: translate(14px, 22px) scale(1.6); }
          50% { opacity: 1; transform: translate(-26px, 8px) scale(1); }
          75% { opacity: 0.5; transform: translate(20px, -24px) scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lo-ring-outer, .lo-ring-middle, .lo-ring-inner, .lo-core, .lo-spark, .lo-ambient {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
