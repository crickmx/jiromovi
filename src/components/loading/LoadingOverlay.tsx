import { useState, useEffect } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { LoadingFactCard } from './LoadingFactCard';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function LoadingOverlay() {
  const { isLoading } = useLoading();
  const isDark = useDarkMode();

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 backdrop-blur-[8px]"
      style={{ background: isDark ? 'rgba(9, 15, 26, 0.96)' : 'rgba(255, 255, 255, 0.96)' }}
    >
      {/* Logo con anillos animados */}
      <div className="relative h-24 w-24">
        {/* Outer static ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(14,35,226,0.15)'}`,
            animation: 'lo-pulse 1.6s ease-in-out infinite',
          }}
        />
        {/* Rotating ring */}
        <div
          className="absolute inset-0 rounded-full border border-transparent"
          style={{
            borderTopColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(14,35,226,0.65)',
            borderRightColor: isDark ? 'rgba(14,35,226,0.6)' : 'rgba(14,35,226,0.2)',
            animation: 'lo-spin 1.4s linear infinite',
          }}
        />
        {/* Logo container */}
        <div
          className="absolute inset-2 rounded-2xl flex items-center justify-center p-2.5"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(14,35,226,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,35,226,0.12)'}`,
          }}
        >
          <img
            src="/movirecurso_7.png"
            alt="MOVI Digital"
            className={`h-9 w-auto object-contain transition-none ${isDark ? 'brightness-0 invert' : ''}`}
          />
        </div>
      </div>

      {/* Texto */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="font-semibold text-sm tracking-wide"
          style={{ color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(10,12,30,0.80)' }}
        >
          Cargando
        </span>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isDark ? 'rgba(56,189,248,1)' : 'rgba(14,35,226,0.65)',
                animation: `lo-dot-bounce 1.2s ease-in-out infinite ${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <LoadingFactCard />

      <style>{`
        @keyframes lo-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes lo-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50%      { transform: scale(1.08); opacity: 0.90; }
        }
      `}</style>
    </div>
  );
}
