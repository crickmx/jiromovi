import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Info, Mail, MessageCircle } from 'lucide-react';

interface Props {
  tipoId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
}

const CANALES = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'correo', label: 'Correo', icon: Mail },
] as const;

/**
 * Qué adjuntos de este tipo de trámite le llegan solos al agente.
 *
 * Un tipo sin canales o sin categorías NO manda nada automáticamente — ese es
 * el estado de todos los tipos hasta que alguien los configure aquí, y es a
 * propósito: antes se mandaba todo, incluido lo interno. Lo que no sale solo
 * se puede mandar a mano desde la pestaña Archivos del trámite.
 */
export function EnvioAdjuntosTab({ tipoId, showToast }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [canales, setCanales] = useState<string[]>([]);
  const [categoriasElegidas, setCategoriasElegidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let vivo = true;
    setLoading(true);

    Promise.all([
      supabase
        .from('maestro_adjunto_categorias')
        .select('id, nombre, descripcion')
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('ticket_tipos')
        .select('envio_adjuntos_canales, envio_adjuntos_categorias_ids')
        .eq('id', tipoId)
        .maybeSingle(),
    ]).then(([{ data: cats }, { data: tipo, error }]) => {
      if (!vivo) return;
      if (error) showToast(`No se pudo leer la configuración: ${error.message}`, 'error');
      setCategorias((cats as Categoria[]) ?? []);
      setCanales(tipo?.envio_adjuntos_canales ?? []);
      setCategoriasElegidas(tipo?.envio_adjuntos_categorias_ids ?? []);
      setLoading(false);
    });

    return () => { vivo = false; };
  }, [tipoId, showToast]);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('ticket_tipos')
      .update({
        envio_adjuntos_canales: canales,
        envio_adjuntos_categorias_ids: categoriasElegidas,
      })
      .eq('id', tipoId);
    setSaving(false);

    if (error) {
      showToast(`No se pudo guardar: ${error.message}`, 'error');
      return;
    }
    showToast('Configuración de envío guardada');
  };

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">Cargando…</div>;
  }

  const activo = canales.length > 0 && categoriasElegidas.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-1">
          <p>
            Define qué archivos le llegan <strong>solos</strong> al agente cuando se adjuntan a un
            trámite de este tipo. Cada archivo se manda <strong>una sola vez</strong>: los cambios
            de estatus posteriores ya no lo repiten.
          </p>
          <p>
            Lo que no salga solo se puede mandar a mano desde la pestaña Archivos del trámite,
            marcando los que quieras. El botón de reenviar de ahí ignora estas reglas.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Canales</h3>
        <p className="text-xs text-neutral-500 mb-3">Por dónde se le mandan los archivos al agente.</p>
        <div className="flex gap-2">
          {CANALES.map(c => {
            const Icon = c.icon;
            const puesto = canales.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCanales(prev => alternar(prev, c.value))}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${
                  puesto
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Categorías que salen solas</h3>
        <p className="text-xs text-neutral-500 mb-3">
          Solo los adjuntos de estas categorías. Lo demás —documentos internos, notas— se queda sin enviar.
        </p>
        {categorias.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">No hay categorías de adjunto activas.</p>
        ) : (
          <div className="space-y-1">
            <label className="flex items-center gap-3 p-2.5 rounded-lg border border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer">
              <input
                type="checkbox"
                checked={categoriasElegidas.length === categorias.length}
                // Marcado a medias: ni todas ni ninguna. El indeterminado se pone
                // por ref porque no existe como atributo de HTML.
                ref={el => { if (el) el.indeterminate = categoriasElegidas.length > 0 && categoriasElegidas.length < categorias.length; }}
                onChange={() => setCategoriasElegidas(
                  categoriasElegidas.length === categorias.length ? [] : categorias.map(c => c.id),
                )}
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">
                Seleccionar todo
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  ({categoriasElegidas.length} de {categorias.length})
                </span>
              </span>
            </label>
            {categorias.map(cat => (
              <label
                key={cat.id}
                className="flex items-start gap-3 p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={categoriasElegidas.includes(cat.id)}
                  onChange={() => setCategoriasElegidas(prev => alternar(prev, cat.id))}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-neutral-800">{cat.nombre}</span>
                  {cat.descripcion && (
                    <span className="block text-xs text-neutral-500">{cat.descripcion}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <p className="text-xs text-neutral-500">
          {activo
            ? `Se enviarán ${categoriasElegidas.length} categoría(s) por ${canales.join(' y ')}.`
            : 'Tal como está, este tipo no manda ningún adjunto automáticamente.'}
        </p>
      </div>
    </div>
  );
}

export default EnvioAdjuntosTab;
