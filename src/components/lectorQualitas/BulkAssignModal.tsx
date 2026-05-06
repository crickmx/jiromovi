import { useState } from 'react';
import { Users, AlertTriangle, X } from 'lucide-react';
import VendorSearchCombobox from './VendorSearchCombobox';
import type { SicasVendorOption } from '../../lib/lectorQualitasTypes';

interface BulkAssignModalProps {
  vendors: SicasVendorOption[];
  totalPolizas: number;
  polizasWithVendor: number;
  onConfirm: (vendor: SicasVendorOption) => void;
  onClose: () => void;
}

export default function BulkAssignModal({
  vendors,
  totalPolizas,
  polizasWithVendor,
  onConfirm,
  onClose,
}: BulkAssignModalProps) {
  const [selectedVendor, setSelectedVendor] = useState<SicasVendorOption | null>(null);

  const handleConfirm = () => {
    if (selectedVendor) {
      onConfirm(selectedVendor);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Asignar Vendedor a Todas
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-neutral-600 dark:text-white/70">
            Selecciona un vendedor SICAS para asignarlo a las <strong>{totalPolizas}</strong> poliza{totalPolizas !== 1 ? 's' : ''} valida{totalPolizas !== 1 ? 's' : ''}.
          </p>

          {polizasWithVendor > 0 && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {polizasWithVendor} poliza{polizasWithVendor !== 1 ? 's' : ''} ya tiene{polizasWithVendor !== 1 ? 'n' : ''} vendedor asignado. Se reemplazara.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider mb-2">
              Vendedor SICAS
            </label>
            <VendorSearchCombobox
              vendors={vendors}
              selectedVendor={selectedVendor}
              onSelect={setSelectedVendor}
              placeholder="Buscar vendedor..."
            />
          </div>

          {selectedVendor && (
            <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-xl space-y-1">
              <p className="text-sm font-semibold text-neutral-800 dark:text-white">{selectedVendor.nombre}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500 dark:text-white/50">
                {selectedVendor.clave && <span>Clave: {selectedVendor.clave}</span>}
                {selectedVendor.gerenciaName && <span>Gerencia: {selectedVendor.gerenciaName}</span>}
                {selectedVendor.despachoName && <span>Despacho: {selectedVendor.despachoName}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedVendor}
            className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
          >
            Asignar a {totalPolizas} poliza{totalPolizas !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
