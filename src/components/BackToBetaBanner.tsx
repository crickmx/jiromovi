import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { crossDomainUrl, BETA_ORIGIN } from '../lib/betaAccess';
import { useImpersonation } from '../contexts/ImpersonationContext';

/** Fijo arriba, solo para usuarios Beta que están viendo MOVI normal (salieron de la Beta). */
export function BackToBetaBanner() {
  const [entrando, setEntrando] = useState(false);
  const { isImpersonating } = useImpersonation();

  const handleVolver = async () => {
    setEntrando(true);
    const url = await crossDomainUrl(BETA_ORIGIN);
    window.location.href = url;
  };

  return (
    <div
      className="fixed left-0 right-0 z-[9998] bg-amber-400 text-amber-950 shadow-md"
      style={{ top: isImpersonating ? '36px' : '0px', height: '36px' }}
      role="status"
      aria-live="polite"
    >
      <div className="h-full max-w-screen-2xl mx-auto px-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium truncate">
            Saliste de la <strong className="font-bold">versión Beta</strong> — estás en MOVI normal.
          </span>
        </div>
        <button
          onClick={handleVolver}
          disabled={entrando}
          className="shrink-0 px-2.5 py-1 bg-amber-950 text-amber-50 rounded text-xs font-bold hover:bg-amber-900 transition-colors disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : 'Volver a Beta'}
        </button>
      </div>
    </div>
  );
}
