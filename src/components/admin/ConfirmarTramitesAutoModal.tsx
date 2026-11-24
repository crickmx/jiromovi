// Aviso antes de que una acción levante trámites sola.
//
// MOVI Store y Marketing creaban trámites en silencio: cambiabas un estatus o
// activabas un Premium y te enterabas por el toast, con el trámite ya creado y
// notificado. Ahora la acción se detiene aquí: se dice qué se va a crear y
// quién lo está disparando, y nada se guarda hasta que esa persona confirma.
//
// Cancelar no deja nada a medias — la ventana sale ANTES de guardar el cambio,
// así que no hay nada que revertir.

import { AlertTriangle, FileText, X } from 'lucide-react';

export interface TramiteAutoPreview {
  /** Id de la regla; solo sirve como key de la lista. */
  id: string;
  /** Nombre de la regla, tal como se llama en el panel de Triggers. */
  nombre: string;
  /** Tipo de trámite que se va a crear. */
  tipoLabel: string;
  /** Qué lo dispara: el estatus destino (Store) o el evento (Marketing). */
  disparador?: string;
}

interface Props {
  /** Qué está a punto de pasar, en una línea. */
  accion: string;
  items: TramiteAutoPreview[];
  /** Quién está disparando: se muestra para que quede claro a nombre de quién queda. */
  usuarioNombre?: string | null;
  confirmando?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmarTramitesAutoModal({ accion, items, usuarioNombre, confirmando, onConfirm, onCancel }: Props) {
  const varios = items.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-neutral-100 dark:border-white/10">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Esto va a crear {varios ? `${items.length} trámites` : 'un trámite'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">{accion}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={confirmando}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5"
            >
              <FileText className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">{item.tipoLabel}</p>
                <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
                  Regla: {item.nombre}
                  {item.disparador && <> · {item.disparador}</>}
                </p>
              </div>
            </div>
          ))}

          <p className="text-xs text-neutral-500 dark:text-white/50 pt-1">
            {varios ? 'Se asignarán' : 'Se asignará'} solos según las reglas de equipo del tipo de trámite
            {usuarioNombre && <>, y {varios ? 'quedarán' : 'quedará'} registrados como creados por <strong className="text-neutral-700 dark:text-white/80">{usuarioNombre}</strong></>}.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 dark:border-white/10">
          <button
            onClick={onCancel}
            disabled={confirmando}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmando}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-60"
          >
            {confirmando ? 'Creando…' : `Confirmar y crear`}
          </button>
        </div>
      </div>
    </div>
  );
}
