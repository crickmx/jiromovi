import { useEffect, useState } from "react";

type MoviPreloaderProps = {
  isOpen: boolean;
  userName: string;
  subtitle?: string;
  logoIconUrl?: string;
  minDurationMs?: number;
};

export default function MoviPreloader({
  isOpen,
  userName,
  subtitle = "Preparando tu Dashboard…",
  logoIconUrl = "/movirecurso_7.png",
  minDurationMs = 3000,
}: MoviPreloaderProps) {
  const [canClose, setCanClose] = useState(false);
  const [visible, setVisible] = useState(isOpen);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) { setCanClose(false); return; }
    const t = setTimeout(() => setCanClose(true), minDurationMs);
    return () => clearTimeout(t);
  }, [isOpen, minDurationMs]);

  useEffect(() => {
    if (isOpen) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!visible) return null;

  const bg = isDark
    ? "radial-gradient(1200px 800px at 50% 30%, rgba(14,35,226,0.25), rgba(10,12,18,0.96) 55%, rgba(6,8,12,0.98) 100%)"
    : "radial-gradient(1200px 800px at 50% 30%, rgba(14,35,226,0.08), rgba(255,255,255,0.99) 55%, rgba(248,250,255,1) 100%)";

  const ringColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(14,35,226,0.15)';
  const spinTopColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(14,35,226,0.60)';
  const spinRightColor = isDark ? 'rgba(14,35,226,0.55)' : 'rgba(14,35,226,0.20)';
  const logoBoxBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(14,35,226,0.05)';
  const logoBoxBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(14,35,226,0.14)';
  const logoBoxShadow = isDark ? '0 0 40px rgba(14,35,226,0.25)' : '0 0 40px rgba(14,35,226,0.10)';
  const textColor = isDark ? '#ffffff' : 'rgba(10,12,30,0.88)';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(10,12,30,0.60)';
  const dotColor = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(14,35,226,0.55)';
  const footerColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(10,12,30,0.35)';
  const gridLine = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <div
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{ background: bg }}
    >
      {/* Grid sutil */}
      <div className="absolute inset-0 opacity-[0.14]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, ${gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${gridLine} 1px, transparent 1px)`,
            backgroundSize: '42px 42px',
          }}
        />
      </div>

      {/* Contenido */}
      <div className="relative w-full max-w-md px-6 text-center">
        {/* Orb glow */}
        <div
          className="mx-auto mb-6 h-24 w-24 rounded-full blur-2xl opacity-70"
          style={{ background: isDark ? 'rgba(14,35,226,0.35)' : 'rgba(14,35,226,0.12)' }}
        />

        {/* Logo + anillos */}
        <div className="relative mx-auto -mt-16 mb-4 h-24 w-24">
          <div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${ringColor}` }} />
          <div
            className="absolute inset-0 rounded-full border border-transparent"
            style={{
              borderTopColor: spinTopColor,
              borderRightColor: spinRightColor,
              animation: "moviSpin 1.4s linear infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: `1px solid ${ringColor}`,
              animation: "moviPulse 1.6s ease-in-out infinite",
            }}
          />
          {/* Logo */}
          <div
            className="absolute inset-2 rounded-2xl flex items-center justify-center p-2"
            style={{
              background: logoBoxBg,
              backdropFilter: 'blur(8px)',
              border: `1px solid ${logoBoxBorder}`,
              boxShadow: logoBoxShadow,
            }}
          >
            <img
              src={logoIconUrl}
              alt="MOVI Digital"
              className={`h-12 w-auto opacity-95 object-contain ${isDark ? 'brightness-0 invert' : ''}`}
            />
          </div>
        </div>

        {/* Saludo */}
        <div className="font-semibold text-2xl tracking-tight mb-2" style={{ color: textColor }}>
          ¡Bienvenido, {userName}!
        </div>
        <div className="text-base" style={{ color: subtitleColor }}>{subtitle}</div>

        {/* Dots loader */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 0.15, 0.30].map((delay, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{ background: dotColor, animation: `moviDot 1.2s infinite ${delay}s` }}
            />
          ))}
        </div>

        <div className="mt-6 text-[11px] leading-4" style={{ color: footerColor }}>
          Sincronizando datos • Cargando módulos • Optimizando experiencia
        </div>
      </div>

      <style>{`
        @keyframes moviSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes moviPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50%      { transform: scale(1.08); opacity: 0.90; }
        }
        @keyframes moviDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40%           { transform: translateY(-4px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
