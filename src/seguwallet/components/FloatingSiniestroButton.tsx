import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ReportarSiniestroModal } from './ReportarSiniestroModal';

export function FloatingSiniestroButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-200 group"
        aria-label="Reportar siniestro"
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-bold hidden sm:inline">Reportar Siniestro</span>
        {/* Mobile: show text on wider mobile */}
        <span className="text-sm font-bold sm:hidden">Siniestro</span>
        {/* Pulse ring */}
        <span className="absolute -inset-0.5 rounded-2xl animate-ping bg-red-500 opacity-20 pointer-events-none" />
      </button>

      {open && <ReportarSiniestroModal onClose={() => setOpen(false)} />}
    </>
  );
}
