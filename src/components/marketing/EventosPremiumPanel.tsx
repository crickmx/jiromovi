// Alta y edición de los eventos que disparan reglas en Plan Premium.
//
// Un evento no es solo un nombre: es un momento que el sistema tiene que saber
// reconocer. Por eso cada uno declara QUÉ observa — que el Premium se prenda,
// que se apague, o que cambie alguno de ciertos datos del agente. Sin eso, un
// evento creado aquí sería decorativo: se podría configurar una regla para él y
// no dispararse nunca, sin error ni aviso.

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EventoRow {
  id: string;
  key: string;
  nombre: string;
  orden: number;
  activo: boolean;
  disparador_tipo: 'activacion' | 'desactivacion' | 'cambio_campo';
  campos_observados: string[] | null;
}

/** Datos del Premium que se pueden vigilar. Son columnas reales de `usuarios`. */
const CAMPOS_VIGILABLES: { value: string; label: string }[] = [
  { value: 'mkt_premium_plan', label: 'Plan (mensual / anual)' },
  { value: 'mkt_premium_metodo_pago', label: 'Método de pago' },
  { value: 'mkt_premium_fecha_inicio', label: 'Fecha de inicio' },
  { value: 'mkt_premium_fecha_pago', label: 'Fecha de pago / renovación' },
  { value: 'mkt_premium_parcialidades', label: 'Parcialidades' },
];

const DISPARADORES: { value: EventoRow['disparador_tipo']; label: string; ayuda: string }[] = [
  { value: 'activacion', label: 'Se activa el Premium', ayuda: 'Cuando a un agente se le prende el plan.' },
  { value: 'desactivacion', label: 'Se desactiva el Premium', ayuda: 'Cuando se le apaga.' },
  { value: 'cambio_campo', label: 'Cambia un dato (estando activo)', ayuda: 'Elige abajo qué datos vigilar. Basta que cambie uno.' },
];

/** `key` a partir del nombre: sin acentos, minúsculas, guiones bajos. */
function claveDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function EventosPremiumPanel() {
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<EventoRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [disparador, setDisparador] = useState<EventoRow['disparador_tipo']>('cambio_campo');
  const [campos, setCampos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mkt_premium_eventos')
      .select('id, key, nombre, orden, activo, disparador_tipo, campos_observados')
      .order('orden');
    setEventos((data ?? []) as EventoRow[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando(null); setCreando(true); setError('');
    setNombre(''); setDisparador('cambio_campo'); setCampos([]);
  };

  const abrirEditar = (e: EventoRow) => {
    setEditando(e); setCreando(false); setError('');
    setNombre(e.nombre);
    setDisparador(e.disparador_tipo);
    setCampos(e.campos_observados ?? []);
  };

  const cerrar = () => { setEditando(null); setCreando(false); setError(''); };

  const guardar = async () => {
    if (!nombre.trim()) { setError('Ponle un nombre al evento.'); return; }
    if (disparador === 'cambio_campo' && campos.length === 0) {
      // Sin esto el evento existiría pero no se dispararía nunca, que es
      // justo el problema que esta pantalla viene a resolver.
      setError('Elige al menos un dato a vigilar, o el evento nunca se va a disparar.');
      return;
    }
    setGuardando(true);
    setError('');

    const payload = {
      nombre: nombre.trim(),
      disparador_tipo: disparador,
      campos_observados: disparador === 'cambio_campo' ? campos : [],
    };

    const { error: err } = editando
      // La `key` no se renombra: es la que une el evento con sus reglas ya
      // configuradas. Cambiarla las dejaría huérfanas en silencio.
      ? await supabase.from('mkt_premium_eventos').update(payload).eq('id', editando.id)
      : await supabase.from('mkt_premium_eventos').insert({
          ...payload,
          key: claveDesdeNombre(nombre) || `evento_${Date.now()}`,
          orden: (eventos.at(-1)?.orden ?? 0) + 1,
          activo: true,
        });

    setGuardando(false);
    if (err) { setError(err.message); return; }
    cerrar();
    cargar();
  };

  const alternarActivo = async (e: EventoRow) => {
    const { error: err } = await supabase
      .from('mkt_premium_eventos').update({ activo: !e.activo }).eq('id', e.id);
    if (err) setError(err.message); else cargar();
  };

  const eliminar = async (e: EventoRow) => {
    if (!confirm(`¿Eliminar "${e.nombre}"? Las reglas configuradas para este evento se borran con él.`)) return;
    const { error: err } = await supabase.from('mkt_premium_eventos').delete().eq('id', e.id);
    if (err) setError(err.message); else cargar();
  };

  const descripcion = (e: EventoRow) => {
    if (e.disparador_tipo !== 'cambio_campo') {
      return DISPARADORES.find(d => d.value === e.disparador_tipo)?.label ?? e.disparador_tipo;
    }
    const nombres = (e.campos_observados ?? [])
      .map(c => CAMPOS_VIGILABLES.find(v => v.value === c)?.label ?? c);
    return nombres.length > 0
      ? `Cambia: ${nombres.join(' · ')}`
      : '⚠ Sin datos vigilados — nunca se dispara';
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando eventos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Eventos que disparan reglas</h3>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">
            Un evento es un momento del Plan Premium que el sistema reconoce. Las reglas se configuran
            por evento, en la pestaña de al lado.
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium shrink-0"
        >
          <Plus className="w-4 h-4" /> Nuevo evento
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {(creando || editando) && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800 dark:text-white">
              {editando ? `Editar "${editando.nombre}"` : 'Nuevo evento'}
            </p>
            <button onClick={cerrar} className="p-1 hover:bg-white/60 dark:hover:bg-white/10 rounded">
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Se renueva la fecha de pago"
              className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-neutral-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">¿Cuándo se dispara?</label>
            <div className="space-y-1.5">
              {DISPARADORES.map(d => (
                <label key={d.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={disparador === d.value}
                    onChange={() => setDisparador(d.value)}
                    className="mt-1 accent-purple-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-neutral-800 dark:text-white/80">{d.label}</span>
                    <span className="block text-xs text-neutral-500 dark:text-white/40">{d.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {disparador === 'cambio_campo' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                Datos a vigilar <span className="text-neutral-400 font-normal">(basta que cambie uno)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CAMPOS_VIGILABLES.map(c => {
                  const puesto = campos.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCampos(prev => puesto ? prev.filter(x => x !== c.value) : [...prev, c.value])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        puesto
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/10 hover:border-purple-400'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cerrar} className="px-3 py-1.5 text-sm text-neutral-600 dark:text-white/60 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 divide-y divide-neutral-100 dark:divide-white/5 overflow-hidden">
        {eventos.length === 0 && (
          <div className="px-4 py-6 text-sm text-neutral-400 text-center">No hay eventos configurados.</div>
        )}
        {eventos.map(e => (
          <div key={e.id} className={`px-4 py-3 flex items-center gap-3 ${e.activo ? '' : 'opacity-50'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{e.nombre}</p>
              <p className="text-xs text-neutral-500 dark:text-white/40">{descripcion(e)}</p>
            </div>
            <button
              onClick={() => alternarActivo(e)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                e.activo
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/40'
              }`}
            >
              {e.activo ? 'Activo' : 'Inactivo'}
            </button>
            <button onClick={() => abrirEditar(e)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 shrink-0" title="Editar">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => eliminar(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-500 shrink-0" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventosPremiumPanel;
