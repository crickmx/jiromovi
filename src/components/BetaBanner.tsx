import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { crossDomainUrl, PROD_ORIGIN } from '../lib/betaAccess';
import { useImpersonation } from '../contexts/ImpersonationContext';

/** Fijo arriba de todo en beta.movi.digital — Layout.tsx empuja el contenido hacia abajo. */
export function BetaBanner() {
  const [saliendo, setSaliendo] = useState(false);
  const { isImpersonating } = useImpersonation();
  const buildTime = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(__BUILD_TIME__));

  const handleVolver = async () => {
    setSaliendo(true);
    const url = await crossDomainUrl(PROD_ORIGIN, { skip_beta: '1' });
    window.location.href = url;
  };

  return (
    <div
      className="fixed left-0 right-0 z-[9998] text-white shadow-md border-b border-orange-600/40"
      style={{
        top: isImpersonating ? '36px' : '0px',
        height: '36px',
        background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 60%, #9A3412 100%)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="h-full max-w-screen-2xl mx-auto px-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-200" />
          <span className="text-xs font-medium truncate">
            Estás viendo la <strong className="font-bold text-amber-100">versión Beta</strong> de MOVI — entorno de pruebas.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline rounded bg-black/20 text-white px-2 py-0.5 font-mono text-[11px]" title={`Build: ${buildTime}`}>
            Commit: <strong>{__COMMIT_HASH__}</strong>
          </span>
          <span className="hidden xl:inline rounded bg-black/20 text-white px-2 py-0.5 font-mono text-[11px]">
            Build: {buildTime}
          </span>
          <button
            onClick={handleVolver}
            disabled={saliendo}
            className="px-2.5 py-1 bg-white text-[#C2410C] rounded text-xs font-bold hover:bg-orange-50 transition-colors shadow-sm disabled:opacity-60"
          >
            {saliendo ? 'Saliendo…' : 'Regresar a MOVI'}
          </button>
        </div>
      </div>
    </div>
  );
}
