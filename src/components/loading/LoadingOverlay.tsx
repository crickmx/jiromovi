import { useEffect, useRef, useState } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { LoadingOrb } from './LoadingOrb';
import { LoadingProgress } from './LoadingProgress';
import { LoadingFactCard } from './LoadingFactCard';

const MESSAGES: Record<string, string[]> = {
  default: [
    'Procesando información…',
    'Un momento, por favor…',
    'Casi listo…',
    'Cargando datos…',
  ],
  'Cargando...': ['Cargando módulo…', 'Preparando vista…', 'Un momento…'],
  'Generando PDF': ['Generando documento…', 'Preparando PDF…', 'Calculando…'],
  'Importando Excel': ['Procesando archivo…', 'Analizando datos…', 'Importando…'],
  'Sincronizando SICAS': ['Sincronizando pólizas…', 'Obteniendo producción…', 'Conectando con SICAS…'],
  'Procesando IA': ['Consultando inteligencia artificial…', 'Analizando con IA…', 'Generando respuesta…'],
  'Creando trámite': ['Creando trámite…', 'Registrando solicitud…', 'Guardando datos…'],
};

function resolveMessages(label: string | null): string[] {
  if (!label) return MESSAGES.default;
  const exactMatch = MESSAGES[label];
  if (exactMatch) return exactMatch;
  // Partial match
  for (const key of Object.keys(MESSAGES)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return MESSAGES[key];
  }
  return [label + '…', ...MESSAGES.default];
}

export function LoadingOverlay() {
  const { isLoading, label } = useLoading();
  const [rendered, setRendered] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = resolveMessages(label);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount / unmount with fade
  useEffect(() => {
    if (isLoading) {
      setRendered(true);
      setMsgIdx(0);
      // Defer opacity so the transition plays
      requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1)));

      msgIntervalRef.current = setInterval(() => {
        setMsgIdx((i) => (i + 1) % messages.length);
      }, 2800);
    } else {
      setOpacity(0);
      timerRef.current = setTimeout(() => setRendered(false), 300);
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (!rendered) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className="loading-overlay"
      style={{ opacity, transition: 'opacity 0.25s ease' }}
    >
      <LoadingProgress />

      <div className="loading-overlay-content">
        <LoadingOrb />

        <div className="loading-label-block">
          <p
            className="loading-label-text"
            key={msgIdx}
            style={{ animation: 'loading-msg-in 0.4s ease' }}
          >
            {messages[msgIdx]}
          </p>
        </div>

        <LoadingFactCard />
      </div>

      <style>{`
        .loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(3, 7, 18, 0.88);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .loading-overlay-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        .loading-label-block {
          height: 24px;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        .loading-label-text {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.03em;
          margin: 0;
        }

        @keyframes loading-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-overlay {
            transition: none !important;
          }
          .loading-label-text {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
