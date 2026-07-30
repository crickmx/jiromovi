import { useState } from 'react';
import { Zap, ArrowRight, X, AlertCircle, CheckCircle } from 'lucide-react';

export interface PendingTrigger {
  id: string;
  nombre: string;
  target_tipo_id: string;
  from_status: string;
  initial_status: string;
  prioridad_hijo: 'heredar' | 'Alta' | 'Media' | 'Baja';
  requiere_confirmacion: boolean;
  folio_mode: 'nuevo' | 'heredar_incisos';
  adjunto_categorias_ids: string[];
  target_tipo?: { label: string; color: string } | null;
}

export interface ExistingChild {
  id: string;
  folio: string;
}

interface Props {
  triggers: PendingTrigger[];
  existingChildren: Record<string, ExistingChild>;
  fromStatusLabel: string;
  onConfirm: (decisions: Record<string, 'conservar' | 'nuevo'>) => void;
  onCancel: () => void;
}

export function TriggerConfirmModal({ triggers, existingChildren, fromStatusLabel, onConfirm, onCancel }: Props) {
  const [decisions, setDecisions] = useState<Record<string, 'conservar' | 'nuevo'>>(() => {
    const init: Record<string, 'conservar' | 'nuevo'> = {};
    for (const t of triggers) {
      init[t.id] = 'nuevo';
    }
    return init;
  });

  const setDecision = (triggerId: string, d: 'conservar' | 'nuevo') =>
    setDecisions(prev => ({ ...prev, [triggerId]: d }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Acción automática al cambiar estatus</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Al guardar, el estatus cambiará a{' '}
                <strong className="text-neutral-700">{fromStatusLabel}</strong>
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          <p className="text-xs text-neutral-500">
            Este cambio disparará los siguientes trámites automáticos. Revisa y confirma antes de continuar.
          </p>

          {triggers.map(t => {
            const existing = existingChildren[t.id];
            const decision = decisions[t.id];
            const color = t.target_tipo?.color ?? '#64748b';

            return (
              <div key={t.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                {/* Trigger header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50">
                  <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-neutral-800 flex-1 min-w-0 truncate">{t.nombre}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    {t.target_tipo?.label ?? '—'}
                  </span>
                </div>

                {/* Body */}
                <div className="px-4 py-3">
                  {existing ? (
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          Este trigger ya generó el trámite <strong>{existing.folio}</strong> anteriormente.
                          ¿Quieres crear un nuevo trámite automático?
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setDecision(t.id, 'conservar')}
                          className={`flex items-center gap-1.5 justify-center py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                            decision === 'conservar'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {decision === 'conservar' && <CheckCircle className="w-3 h-3" />}
                          Conservar {existing.folio}
                        </button>
                        <button
                          onClick={() => setDecision(t.id, 'nuevo')}
                          className={`flex items-center gap-1.5 justify-center py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                            decision === 'nuevo'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {decision === 'nuevo' && <CheckCircle className="w-3 h-3" />}
                          Crear uno nuevo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      Se creará un nuevo trámite hijo automáticamente.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(decisions)}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors font-semibold"
          >
            Guardar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
