import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { crossDomainUrl, PROD_ORIGIN } from '../lib/betaAccess';

/** Fijo arriba de todo en beta.movi.digital — Layout.tsx empuja el contenido hacia abajo. */
export function BetaBanner() {
  const [saliendo, setSaliendo] = useState(false);

  const handleVolver = async () => {
    setSaliendo(true);
    const url = await crossDomainUrl(PROD_ORIGIN, { skip_beta: '1' });
    window.location.href = url;
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-violet-600 text-white shadow-md"
      style={{ height: '36px' }}
      role="status"
      aria-live="polite"
    >
      <div className="h-full max-w-screen-2xl mx-auto px-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium truncate">
            Estás viendo la <strong className="font-bold">versión Beta</strong> de MOVI — puede presentar errores o fallas.
          </span>
        </div>
        <button
          onClick={handleVolver}
          disabled={saliendo}
          className="shrink-0 px-2.5 py-1 bg-white text-violet-700 rounded text-xs font-bold hover:bg-violet-50 transition-colors disabled:opacity-60"
        >
          {saliendo ? 'Saliendo…' : 'Regresar a MOVI'}
        </button>
      </div>
    </div>
  );
}
