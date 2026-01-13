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
  logoIconUrl = "/logojiro.png",
  minDurationMs = 600,
}: MoviPreloaderProps) {
  const [canClose, setCanClose] = useState(false);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setCanClose(false);
      return;
    }
    const t = setTimeout(() => setCanClose(true), minDurationMs);
    return () => clearTimeout(t);
  }, [isOpen, minDurationMs]);

  useEffect(() => {
    if (isOpen) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <div
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{
        background:
          "radial-gradient(1200px 800px at 50% 30%, rgba(14,35,226,0.25), rgba(10,12,18,0.96) 55%, rgba(6,8,12,0.98) 100%)",
      }}
    >
      {/* Grid sutil */}
      <div className="absolute inset-0 opacity-[0.14]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_45%)]" />
      </div>

      {/* Contenido */}
      <div className="relative w-full max-w-md px-6 text-center">
        {/* Orb glow */}
        <div
          className="mx-auto mb-6 h-24 w-24 rounded-full blur-2xl opacity-70"
          style={{ background: "rgba(14,35,226,0.35)" }}
        />

        {/* Logo + anillos */}
        <div className="relative mx-auto -mt-16 mb-4 h-24 w-24">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-white/15" />
          {/* Rotating scan ring */}
          <div
            className="absolute inset-0 rounded-full border border-transparent"
            style={{
              borderTopColor: "rgba(255,255,255,0.45)",
              borderRightColor: "rgba(14,35,226,0.55)",
              animation: "moviSpin 1.4s linear infinite",
            }}
          />
          {/* Pulse ring */}
          <div
            className="absolute inset-0 rounded-full border border-white/20"
            style={{ animation: "moviPulse 1.6s ease-in-out infinite" }}
          />

          {/* Logo */}
          <div className="absolute inset-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_0_40px_rgba(14,35,226,0.25)] flex items-center justify-center">
            <img
              src={logoIconUrl}
              alt="MOVI Digital"
              className="h-10 w-auto opacity-95"
            />
          </div>
        </div>

        {/* Saludo */}
        <div className="font-semibold text-white text-xl tracking-tight">
          Hola, {userName}
        </div>

        <div className="mt-1 text-white/70 text-sm">{subtitle}</div>

        {/* Dots loader */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-white/70"
            style={{ animation: "moviDot 1.2s infinite" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-white/70"
            style={{ animation: "moviDot 1.2s infinite 0.15s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-white/70"
            style={{ animation: "moviDot 1.2s infinite 0.30s" }}
          />
        </div>

        {/* Texto ultra pequeño "tech" */}
        <div className="mt-6 text-[11px] leading-4 text-white/45">
          Sincronizando datos • Cargando módulos • Optimizando experiencia
        </div>
      </div>

      {/* Keyframes */}
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
