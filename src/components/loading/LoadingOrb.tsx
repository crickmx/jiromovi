/**
 * Tech ring orb — a tri-ring HUD with comet arcs, a pulsing core, and
 * random sparkle flashes. Pure CSS/SVG, no external deps.
 */
export function LoadingOrb() {
  return (
    <div className="lo-wrap" aria-hidden="true">
      {/* Ambient glow behind everything */}
      <div className="lo-ambient" />

      {/* SVG ring system */}
      <svg className="lo-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Outer ring gradient: comet arc fades from transparent → bright */}
          <linearGradient id="lo-g1" x1="70" y1="5" x2="70" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.05" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.15" />
            <stop offset="85%" stopColor="#7dd3fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1" />
          </linearGradient>
          {/* Middle ring gradient */}
          <linearGradient id="lo-g2" x1="70" y1="22" x2="70" y2="118" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.05" />
            <stop offset="70%" stopColor="#22d3ee" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="1" />
          </linearGradient>
          {/* Inner ring gradient */}
          <linearGradient id="lo-g3" x1="70" y1="38" x2="70" y2="102" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="lo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lo-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Outer track ring (dim, full circle) ── */}
        <circle cx="70" cy="70" r="60" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.12" />

        {/* ── Outer comet arc (spins CW) ── */}
        <circle
          cx="70" cy="70" r="60"
          stroke="url(#lo-g1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="88 289"
          filter="url(#lo-glow)"
          className="lo-ring-outer"
        />
        {/* Bright leading dot on outer ring */}
        <circle cx="70" cy="10" r="3.5" fill="#bae6fd" filter="url(#lo-glow-strong)" className="lo-ring-outer lo-dot-outer" />

        {/* ── Middle track ring (dim) ── */}
        <circle cx="70" cy="70" r="44" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.1" />

        {/* ── Middle comet arc (counter-spins) ── */}
        <circle
          cx="70" cy="70" r="44"
          stroke="url(#lo-g2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="60 216"
          filter="url(#lo-glow)"
          className="lo-ring-middle"
        />
        <circle cx="70" cy="26" r="2.5" fill="#67e8f9" filter="url(#lo-glow-strong)" className="lo-ring-middle lo-dot-middle" />

        {/* ── Inner track ring ── */}
        <circle cx="70" cy="70" r="28" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.1" />

        {/* ── Inner comet arc (spins CW, fast) ── */}
        <circle
          cx="70" cy="70" r="28"
          stroke="url(#lo-g3)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="36 140"
          filter="url(#lo-glow)"
          className="lo-ring-inner"
        />
        <circle cx="70" cy="42" r="2" fill="#7dd3fc" filter="url(#lo-glow-strong)" className="lo-ring-inner lo-dot-inner" />

        {/* ── Core pulse ── */}
        <circle cx="70" cy="70" r="7" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" />
        <circle cx="70" cy="70" r="4" fill="#38bdf8" className="lo-core" filter="url(#lo-glow-strong)" />
      </svg>

      {/* ── Sparkle flashes ── */}
      <div className="lo-spark lo-s1" />
      <div className="lo-spark lo-s2" />
      <div className="lo-spark lo-s3" />
      <div className="lo-spark lo-s4" />
      <div className="lo-spark lo-s5" />
      <div className="lo-spark lo-s6" />

      <style>{`
        .lo-wrap {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lo-ambient {
          position: absolute;
          inset: -30px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%);
          animation: lo-pulse 3.2s ease-in-out infinite;
        }

        .lo-svg {
          width: 140px;
          height: 140px;
          overflow: visible;
        }

        /* ── Ring spin animations ── */
        .lo-ring-outer {
          transform-origin: 70px 70px;
          animation: lo-spin-cw 2.6s linear infinite;
        }
        .lo-ring-middle {
          transform-origin: 70px 70px;
          animation: lo-spin-ccw 3.8s linear infinite;
        }
        .lo-ring-inner {
          transform-origin: 70px 70px;
          animation: lo-spin-cw 1.7s linear infinite;
        }

        /* Leading dots inherit the same transform so they ride the arc tip */
        .lo-dot-outer {
          transform-origin: 70px 70px;
        }
        .lo-dot-middle {
          transform-origin: 70px 70px;
        }
        .lo-dot-inner {
          transform-origin: 70px 70px;
        }

        /* Core breathe */
        .lo-core {
          animation: lo-core-pulse 1.8s ease-in-out infinite;
        }

        /* ── Sparkles ── */
        .lo-spark {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #7dd3fc;
          box-shadow: 0 0 6px #38bdf8, 0 0 10px rgba(56,189,248,0.6);
        }

        .lo-s1 { top: 14%;  left: 50%;  animation: lo-twinkle 2.1s 0.0s ease-in-out infinite; }
        .lo-s2 { top: 28%;  right: 14%; animation: lo-twinkle 2.4s 0.5s ease-in-out infinite; }
        .lo-s3 { bottom: 18%; right: 22%; animation: lo-twinkle 1.9s 1.1s ease-in-out infinite; }
        .lo-s4 { bottom: 14%; left: 40%;  animation: lo-twinkle 2.7s 0.3s ease-in-out infinite; }
        .lo-s5 { top: 40%;  left: 10%;  animation: lo-twinkle 2.2s 0.8s ease-in-out infinite; }
        .lo-s6 { top: 20%;  right: 30%; animation: lo-twinkle 3.0s 1.5s ease-in-out infinite; width: 2px; height: 2px; }

        /* ── Keyframes ── */
        @keyframes lo-spin-cw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lo-spin-ccw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes lo-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.15); opacity: 1;   }
        }
        @keyframes lo-core-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
        @keyframes lo-twinkle {
          0%, 100% { opacity: 0;   transform: scale(0.4); }
          40%, 60% { opacity: 1;   transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lo-ring-outer,
          .lo-ring-middle,
          .lo-ring-inner,
          .lo-ambient,
          .lo-core,
          .lo-spark {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
