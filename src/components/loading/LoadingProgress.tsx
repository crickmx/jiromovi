/**
 * Indeterminate progress bar — a shimmering blue stripe that moves across
 * the top of the loading overlay.
 */
export function LoadingProgress() {
  return (
    <div className="loading-progress-track" role="progressbar" aria-valuetext="Cargando…">
      <div className="loading-progress-bar" />
      <style>{`
        .loading-progress-track {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(14,165,233,0.15);
          overflow: hidden;
        }

        .loading-progress-bar {
          height: 100%;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            #38bdf8 25%,
            #7dd3fc 50%,
            #38bdf8 75%,
            transparent 100%
          );
          animation: progress-slide 1.8s ease-in-out infinite;
        }

        @keyframes progress-slide {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-progress-bar {
            animation: none;
            width: 100%;
            background: #38bdf8;
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
