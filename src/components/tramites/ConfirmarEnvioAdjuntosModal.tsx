import { useEffect, useState } from 'react';
import { Send, X, Mail, MessageCircle, FileText } from 'lucide-react';

export interface ArchivoParaEnviar {
  id: string;
  nombre: string;
  categoriaNombre?: string | null;
  /** Ya salió antes: marcarlo lo manda otra vez, a propósito. */
  yaEnviado?: boolean;
}

interface Props {
  archivos: ArchivoParaEnviar[];
  /** Los que vienen marcados: los que saldrían solos según el tipo de trámite. */
  preseleccion: string[];
  canales: string[];
  enviando?: boolean;
  onCancelar: () => void;
  onConfirmar: (ids: string[]) => void;
}

/**
 * Última parada antes de que un archivo salga hacia el agente.
 *
 * No es solo un "¿seguro?": la lista se puede editar aquí mismo, porque el
 * momento en que alguien se da cuenta de que un archivo no debía salir es
 * justo cuando lo ve enlistado. Cancelar no detiene la notificación del
 * trámite, solo deja de mandar los archivos.
 */
export function ConfirmarEnvioAdjuntosModal({
  archivos, preseleccion, canales, enviando = false, onCancelar, onConfirmar,
}: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(preseleccion));

  // Escape = cancelar, como en el resto de los modales del proyecto.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCancelar]);

  const alternar = (id: string) => {
    setMarcados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const todos = marcados.size === archivos.length;
  const etiquetaCanales = canales
    .map(c => (c === 'whatsapp' ? 'WhatsApp' : c === 'correo' ? 'correo' : c))
    .join(' y ');

  return (
    <div
      className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] flex items-center justify-center p-4 z-[60]"
      onClick={onCancelar}
    >
      <div
        className="bg-surface-card rounded-2xl shadow-e4 max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Se enviarán al agente</h3>
              <p className="text-sm text-neutral-600 mt-0.5">
                Estos archivos se le mandan por {etiquetaCanales || 'los canales configurados'}.
                Desmarca los que no quieras enviar.
              </p>
            </div>
            <button
              onClick={onCancelar}
              className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            {canales.includes('whatsapp') && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </span>
            )}
            {canales.includes('correo') && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-1 rounded-lg">
                <Mail className="w-3.5 h-3.5" /> Correo
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1">
          {archivos.length > 1 && (
            <label className="flex items-center gap-3 p-2 rounded-lg border border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={todos}
                ref={el => { if (el) el.indeterminate = marcados.size > 0 && !todos; }}
                onChange={() => setMarcados(todos ? new Set() : new Set(archivos.map(a => a.id)))}
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">
                Seleccionar todo
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  ({marcados.size} de {archivos.length})
                </span>
              </span>
            </label>
          )}

          <div className="space-y-1">
            {archivos.map(a => (
              <label
                key={a.id}
                className="flex items-start gap-3 p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={marcados.has(a.id)}
                  onChange={() => alternar(a.id)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300"
                />
                <FileText className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-neutral-800 break-words">{a.nombre}</span>
                  <span className="block text-xs text-neutral-500">
                    {a.categoriaNombre || 'Sin categoría'}
                    {a.yaEnviado && (
                      <span className="ml-2 text-amber-600 font-semibold">ya se le envió antes</span>
                    )}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-soft flex items-center justify-end gap-2">
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
          >
            No enviar
          </button>
          <button
            onClick={() => onConfirmar([...marcados])}
            disabled={enviando || marcados.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {enviando ? 'Enviando…' : `Enviar ${marcados.size === 1 ? 'archivo' : `${marcados.size} archivos`}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmarEnvioAdjuntosModal;
