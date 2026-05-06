import { AlertTriangle, X, Download } from 'lucide-react';

interface ExportWarningModalProps {
  unassignedCount: number;
  onExport: () => void;
  onClose: () => void;
}

export default function ExportWarningModal({
  unassignedCount,
  onExport,
  onClose,
}: ExportWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-5 text-center space-y-4">
          <div className="mx-auto w-12 h-12 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
              Polizas sin vendedor asignado
            </h3>
            <p className="text-sm text-neutral-600 dark:text-white/60">
              Hay <strong>{unassignedCount}</strong> poliza{unassignedCount !== 1 ? 's' : ''} valida{unassignedCount !== 1 ? 's' : ''} sin vendedor SICAS asignado. Esas filas se exportaran sin informacion de vendedor, oficina o gerencia.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onExport}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
}
