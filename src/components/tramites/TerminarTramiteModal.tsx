import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Opcion { slug: string; label: string; color?: string }

interface Props {
  tramiteId: string;
  folio: string;
  tipoTramite: string;
  usuarioId: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function TerminarTramiteModal({ tramiteId, folio, tipoTramite, usuarioId, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [estatusCampoId, setEstatusCampoId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function load() {
      const { data: tipo } = await supabase
        .from('ticket_tipos').select('id').eq('value', tipoTramite).maybeSingle();

      if (tipo?.id) {
        const { data: campo } = await supabase
          .from('tramite_tipo_campos')
          .select('id, config')
          .eq('tramite_tipo_id', tipo.id)
          .eq('tipo', 'estatus')
          .eq('activo', true)
          .maybeSingle();

        if (campo?.config?.opciones) {
          const fins: Opcion[] = campo.config.opciones.filter((o: any) => o.clasificacion === 'terminacion');
          setOpciones(fins);
          setEstatusCampoId(campo.id);
          if (fins.length > 0) setSlug(fins[0].slug);
        }
      }
      setLoading(false);
    }
    load();
  }, [tipoTramite]);

  async function confirmar() {
    if (!comentario.trim()) { setErr('El comentario es obligatorio'); return; }
    if (opciones.length > 0 && !slug) { setErr('Selecciona un estatus de cierre'); return; }
    setSaving(true);

    const now = new Date().toISOString();

    // Actualizar estatus FormBuilder si existe
    if (estatusCampoId && slug) {
      const opcion = opciones.find(o => o.slug === slug);
      await supabase.from('tramite_respuestas').upsert(
        { tramite_id: tramiteId, campo_id: estatusCampoId, valor_json: slug },
        { onConflict: 'tramite_id,campo_id' }
      );
      await supabase.from('tickets').update({
        custom_estatus_label: opcion?.label ?? null,
        custom_estatus_color: opcion?.color ?? '#059669',
        cerrado_en: now,
        cerrado_por: usuarioId,
        requiere_atencion_manual: false,
      }).eq('id', tramiteId);
    } else {
      await supabase.from('tickets').update({
        cerrado_en: now,
        cerrado_por: usuarioId,
        requiere_atencion_manual: false,
      }).eq('id', tramiteId);
    }

    await supabase.from('ticket_comentarios').insert({
      ticket_id: tramiteId,
      usuario_id: usuarioId,
      mensaje: comentario.trim(),
    });

    setSaving(false);
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Terminar trámite <span className="text-neutral-400 font-normal">{folio}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando opciones...
            </div>
          ) : (
            <>
              {opciones.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">Estatus de cierre</label>
                  <select value={slug} onChange={e => setSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {opciones.map(o => <option key={o.slug} value={o.slug}>{o.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Comentario de cierre <span className="text-red-500">*</span>
                </label>
                <textarea
                  autoFocus
                  value={comentario}
                  onChange={e => { setComentario(e.target.value); setErr(''); }}
                  placeholder="Describe el motivo de cierre o un resumen del resultado..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={confirmar} disabled={saving || !comentario.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Terminar trámite
                </button>
                <button onClick={onClose} className="px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
