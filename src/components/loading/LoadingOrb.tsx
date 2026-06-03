/**
 * Holographic CSS/SVG sphere — no WebGL, no external deps.
 * Uses layered gradients, rotating rings, and a scan-line effect.
 */
export function LoadingOrb() {
  return (
    <div className="loading-orb-wrapper" aria-hidden="true">
      {/* Glow halo behind the orb */}
      <div className="loading-orb-halo" />

      {/* Main sphere */}
      <div className="loading-orb">
        {/* Glossy highlight */}
        <div className="loading-orb-highlight" />

        {/* Scan line */}
        <div className="loading-orb-scan" />

        {/* Rotating ring 1 */}
        <div className="loading-ring loading-ring-1" />
        {/* Rotating ring 2 */}
        <div className="loading-ring loading-ring-2" />
        {/* Rotating ring 3 */}
        <div className="loading-ring loading-ring-3" />

        {/* Orbiting dot */}
        <div className="loading-orbit loading-orbit-1">
          <div className="loading-orbit-dot" />
        </div>
        <div className="loading-orbit loading-orbit-2">
          <div className="loading-orbit-dot loading-orbit-dot-sm" />
        </div>
      </div>

      <style>{`
        .loading-orb-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-orb-halo {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(6,182,212,0.08) 50%, transparent 70%);
          animation: orb-halo-pulse 3s ease-in-out infinite;
        }

        .loading-orb {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 35%,
            #38bdf8 0%,
            #0ea5e9 20%,
            #0369a1 55%,
            #0c4a6e 80%,
            #082f49 100%
          );
          box-shadow:
            0 0 24px rgba(14,165,233,0.5),
            0 0 48px rgba(14,165,233,0.2),
            inset 0 -8px 24px rgba(0,0,0,0.4);
          overflow: hidden;
        }

        .loading-orb-highlight {
          position: absolute;
          top: 12%;
          left: 18%;
          width: 36%;
          height: 28%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 100%);
          transform: rotate(-30deg);
        }

        .loading-orb-scan {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(14,165,233,0.12) 48%,
            rgba(14,165,233,0.2) 50%,
            rgba(14,165,233,0.12) 52%,
            transparent 100%
          );
          animation: orb-scan 2.4s linear infinite;
        }

        /* ── Rings ── */
        .loading-ring {
          position: absolute;
          inset: -18px;
          border-radius: 50%;
          border: 1.5px solid transparent;
        }

        .loading-ring-1 {
          border-top-color: rgba(56,189,248,0.7);
          border-right-color: rgba(56,189,248,0.2);
          animation: orb-spin 2s linear infinite;
          transform: rotateX(65deg);
        }

        .loading-ring-2 {
          inset: -12px;
          border-top-color: rgba(6,182,212,0.6);
          border-left-color: rgba(6,182,212,0.2);
          animation: orb-spin 3.2s linear infinite reverse;
          transform: rotateY(60deg);
        }

        .loading-ring-3 {
          inset: -6px;
          border-bottom-color: rgba(14,165,233,0.5);
          border-right-color: rgba(14,165,233,0.15);
          animation: orb-spin 4s linear infinite;
          transform: rotateX(80deg) rotateZ(30deg);
        }

        /* ── Orbiting dots ── */
        .loading-orbit {
          position: absolute;
          inset: -22px;
          border-radius: 50%;
        }

        .loading-orbit-1 {
          animation: orb-spin 2.8s linear infinite;
        }

        .loading-orbit-2 {
          inset: -14px;
          animation: orb-spin 4.5s linear infinite reverse;
        }

        .loading-orbit-dot {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: radial-gradient(circle, #7dd3fc, #0ea5e9);
          box-shadow: 0 0 8px #38bdf8, 0 0 16px rgba(56,189,248,0.4);
        }

        .loading-orbit-dot-sm {
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, #a5f3fc, #22d3ee);
          box-shadow: 0 0 6px #22d3ee;
        }

        /* ── Keyframes ── */
        @keyframes orb-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        @keyframes orb-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }

        @keyframes orb-halo-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%       { transform: scale(1.12); opacity: 1;   }
        }

        /* Respect reduced-motion preference */
        @media (prefers-reduced-motion: reduce) {
          .loading-orb-scan,
          .loading-ring-1,
          .loading-ring-2,
          .loading-ring-3,
          .loading-orbit-1,
          .loading-orbit-2,
          .loading-orb-halo {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
