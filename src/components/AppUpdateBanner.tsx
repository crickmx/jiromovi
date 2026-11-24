import { RefreshCw } from 'lucide-react';

export function AppUpdateBanner() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2.5 text-white text-sm font-medium shadow-lg"
      style={{ background: 'linear-gradient(90deg, #0044cc, #0066ff)' }}
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="w-4 h-4 flex-shrink-0" />
      <span>Nueva versión disponible.</span>
      <button
        onClick={() => window.location.reload()}
        className="underline underline-offset-2 hover:opacity-80 transition-opacity font-semibold"
      >
        Actualizar ahora
      </button>
    </div>
  );
}
