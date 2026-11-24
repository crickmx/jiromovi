import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';

interface Props {
  destino: 'atencion' | 'proceso';
  folio: string;
  onConfirm: (comentario: string) => Promise<void>;
  onClose: () => void;
}

// Comentario obligatorio al mover un trámite a mano entre "En Proceso" y "Requiere
// Atención" — queda en los comentarios del trámite (y por el trigger existente en
// ticket_comentarios, también actualiza ultima_accion_por automáticamente).
export function ConfirmarMovimientoKanbanModal({ destino, folio, onConfirm, onClose }: Props) {
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleConfirmar = async () => {
    if (!comentario.trim()) return;
    setEnviando(true);
    try {
      await onConfirm(comentario.trim());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            <p className="text-base font-semibold text-neutral-900 dark:text-white">
              Mover {folio} a "{destino === 'atencion' ? 'Requiere atención' : 'En proceso'}"
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
              Comentario (obligatorio)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="¿Por qué se mueve este trámite?"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-accent focus:outline-none resize-none bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleConfirmar}
            disabled={enviando || !comentario.trim()}
            className="w-full px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {enviando ? 'Moviendo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
