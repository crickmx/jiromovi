// Panel "Triggers automáticos", compartido por MOVI Store y Marketing Admin.
//
// Eran dos pantallas que hacen lo mismo, y la de Marketing se escribió copiando
// la de Store a mano: en el camino se quedaron fuera el filtro por forma de
// pago, la opción de adjuntar documento y el texto que explica que un trigger
// puede cubrir varios métodos. Eso no fue una decisión de diseño, fue el costo
// de copiar.
//
// Lo que de verdad cambia entre los dos módulos —qué tabla, qué dispara el
// trigger (un estatus de pedido o un evento del Premium), qué opciones de pago,
// qué placeholders y qué documento se adjunta— entra por `config`. La pantalla
// es una sola.

import { useEffect, useState } from 'react';
import { Plus, Zap, Eye, EyeOff, CreditCard as Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface OpcionPago { value: string; label: string }

export interface ConfigTriggers {
  tablaTriggers: string;
  /** Columna que dice qué dispara el trigger. */
  columnaDisparador: 'estatus_destino_id' | 'evento_id';
  /** De dónde salen las opciones de esa columna. */
  cargarDisparadores: () => Promise<{ id: string; nombre: string }[]>;
  /** Mapeo de campos del formulario, por trigger. */
  leerMapeo: (triggerId: string) => Promise<{ campo_id: string; fuente: string; valor_template: string | null }[]>;
  guardarMapeo: (m: { trigger_id: string; campo_id: string; fuente: string; valor_template: string | null }) => Promise<void>;

  titulo: string;
  descripcion: string;
  labelDisparador: string;
  placeholderDisparador: string;
  /** Cómo se nombra el disparador en la lista de abajo. Ej. "Estatus" / "Evento". */
  nombreDisparador: string;

  labelMetodo: string;
  opcionesMetodo: OpcionPago[];
  labelForma: string;
  opcionesForma: OpcionPago[];
  /** Nota al pie de los filtros. Explica que vacío = cualquiera. */
  notaFiltros: string;

  placeholders: { key: string; label: string }[];
  plantillaPorDefecto: string;
  placeholderNombre: string;
  placeholderPlantilla: string;

  /** Documento que se puede adjuntar en un campo de tipo adjunto. */
  adjunto: { value: string; label: string };

  /** Campos de sistema que se llenan solos y no se ofrecen al admin. */
  sistemaKeysAutomaticos: string[];
}

interface TriggerRow {
  id: string;
  nombre: string;
  ticket_tipo_id: string;
  descripcion_template: string;
  metodo_pago_filtro: string[] | null;
  forma_pago_filtro: string[] | null;
  activo: boolean;
  [k: string]: unknown;
}

interface CampoTipo { id: string; label: string; tipo: string }
type Mapeo = Record<string, { fuente: string; valor_template: string }>;

export function TriggersPanel({ config }: { config: ConfigTriggers }) {
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [disparadores, setDisparadores] = useState<{ id: string; nombre: string }[]>([]);
  const [tiposList, setTiposList] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<TriggerRow | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [disparadorId, setDisparadorId] = useState('');
  const [ticketTipoId, setTicketTipoId] = useState('');
  const [descripcionTemplate, setDescripcionTemplate] = useState('');
  const [activoTrigger, setActivoTrigger] = useState(true);
  const [metodoFiltro, setMetodoFiltro] = useState<string[]>([]);
  const [formaFiltro, setFormaFiltro] = useState<string[]>([]);
  const [camposTipo, setCamposTipo] = useState<CampoTipo[]>([]);
  const [mapeoCampos, setMapeoCampos] = useState<Mapeo>({});

  const cargar = async () => {
    setLoading(true);
    const [triggersRes, disparadoresData, tiposRes] = await Promise.all([
      supabase.from(config.tablaTriggers).select('*').order('created_at'),
      config.cargarDisparadores(),
      supabase.from('ticket_tipos').select('id, nombre:label').eq('activo', true).order('label'),
    ]);
    setTriggers((triggersRes.data ?? []) as TriggerRow[]);
    setDisparadores(disparadoresData);
    setTiposList((tiposRes.data ?? []) as { id: string; nombre: string }[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [config.tablaTriggers]);

  useEffect(() => {
    if (!ticketTipoId) { setCamposTipo([]); return; }
    let vivo = true;
    supabase
      .from('tramite_tipo_campos')
      .select('id, label, tipo, sistema_key')
      .eq('tramite_tipo_id', ticketTipoId)
      .eq('activo', true)
      .order('display_order')
      .then(({ data }) => {
        if (!vivo) return;
        setCamposTipo((data ?? [])
          .filter(c => !config.sistemaKeysAutomaticos.includes((c.sistema_key as string) ?? ''))
          .map(c => ({ id: c.id as string, label: c.label as string, tipo: c.tipo as string })));
      });
    return () => { vivo = false; };
  }, [ticketTipoId, config.sistemaKeysAutomaticos]);

  const abrirNuevo = () => {
    setEditando(null); setError('');
    setNombre('');
    setDisparadorId(disparadores[0]?.id ?? '');
    setTicketTipoId(tiposList[0]?.id ?? '');
    setDescripcionTemplate(config.plantillaPorDefecto);
    setActivoTrigger(true);
    setMetodoFiltro([]); setFormaFiltro([]); setMapeoCampos({});
    setShowForm(true);
  };

  const abrirEditar = async (t: TriggerRow) => {
    setEditando(t); setError('');
    setNombre(t.nombre);
    setDisparadorId(String(t[config.columnaDisparador] ?? ''));
    setTicketTipoId(t.ticket_tipo_id);
    setDescripcionTemplate(t.descripcion_template);
    setActivoTrigger(t.activo);
    setMetodoFiltro(t.metodo_pago_filtro ?? []);
    setFormaFiltro(t.forma_pago_filtro ?? []);
    const existente = await config.leerMapeo(t.id);
    const registro: Mapeo = {};
    existente.forEach(m => { registro[m.campo_id] = { fuente: m.fuente, valor_template: m.valor_template ?? '' }; });
    setMapeoCampos(registro);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !disparadorId || !ticketTipoId) return;
    setGuardando(true); setError('');
    const payload = {
      nombre: nombre.trim(),
      [config.columnaDisparador]: disparadorId,
      ticket_tipo_id: ticketTipoId,
      descripcion_template: descripcionTemplate,
      activo: activoTrigger,
      metodo_pago_filtro: metodoFiltro.length > 0 ? metodoFiltro : null,
      forma_pago_filtro: formaFiltro.length > 0 ? formaFiltro : null,
    };

    let triggerId = editando?.id ?? null;
    if (editando) {
      const { error: err } = await supabase.from(config.tablaTriggers).update(payload).eq('id', editando.id);
      if (err) { setGuardando(false); setError(err.message); return; }
    } else {
      const { data, error: err } = await supabase.from(config.tablaTriggers).insert(payload).select().single();
      if (err) { setGuardando(false); setError(err.message); return; }
      triggerId = (data?.id as string) ?? null;
    }

    if (triggerId) {
      for (const campo of camposTipo) {
        const m = mapeoCampos[campo.id];
        await config.guardarMapeo({
          trigger_id: triggerId,
          campo_id: campo.id,
          fuente: m?.fuente ?? 'vacio',
          valor_template: m?.valor_template || null,
        });
      }
    }
    setGuardando(false);
    setShowForm(false);
    await cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este trigger?')) return;
    const { error: err } = await supabase.from(config.tablaTriggers).delete().eq('id', id);
    if (err) setError(err.message); else await cargar();
  };

  const alternarActivo = async (t: TriggerRow) => {
    const { error: err } = await supabase.from(config.tablaTriggers).update({ activo: !t.activo }).eq('id', t.id);
    if (err) setError(err.message); else await cargar();
  };

  const nombreDisparador = (id: string) => disparadores.find(d => d.id === id)?.nombre ?? id;
  const nombreTipo = (id: string) => tiposList.find(t => t.id === id)?.nombre ?? id;
  const etiquetaPago = (opciones: OpcionPago[], v: string) => opciones.find(o => o.value === v)?.label ?? v;

  const pills = (
    opciones: OpcionPago[],
    seleccion: string[],
    setSeleccion: (f: (prev: string[]) => string[]) => void,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(o => {
        const puesto = seleccion.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setSeleccion(prev => puesto ? prev.filter(x => x !== o.value) : [...prev, o.value])}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              puesto
                ? 'bg-accent text-white border-accent'
                : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/10 hover:border-accent'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando triggers...</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{config.titulo}</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">{config.descripcion}</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /><span className="ml-1">Nuevo trigger</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-6">
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">
            {editando ? 'Editar trigger' : 'Nuevo trigger'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre del trigger</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder={config.placeholderNombre}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">{config.labelDisparador}</label>
                <select
                  value={disparadorId}
                  onChange={e => setDisparadorId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">{config.placeholderDisparador}</option>
                  {disparadores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Crea trámite de tipo</label>
                <select
                  value={ticketTipoId}
                  onChange={e => setTicketTipoId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">Selecciona tipo...</option>
                  {tiposList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  {config.labelMetodo} <span className="text-neutral-400 font-normal">(opcional, elige varios)</span>
                </label>
                {pills(config.opcionesMetodo, metodoFiltro, setMetodoFiltro)}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  {config.labelForma} <span className="text-neutral-400 font-normal">(opcional, elige varias)</span>
                </label>
                {pills(config.opcionesForma, formaFiltro, setFormaFiltro)}
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-white/50 -mt-2">{config.notaFiltros}</p>

            {camposTipo.length > 0 && (
              <div className="border border-neutral-200 dark:border-white/10 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-white/70">Autollenado de campos del formulario</p>
                <p className="text-xs text-neutral-500 dark:text-white/50">
                  Elige de dónde sale el valor de cada campo al crearse el trámite. Los campos sin
                  autollenado quedan vacíos para que el equipo los complete manualmente.
                </p>
                {camposTipo.map(campo => {
                  const esAdjunto = campo.tipo === 'adjunto' || campo.tipo === 'archivos_adjuntos';
                  const m = mapeoCampos[campo.id] ?? { fuente: 'vacio', valor_template: '' };
                  return (
                    <div key={campo.id} className="border-t border-neutral-100 dark:border-white/5 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-800 dark:text-white/80 flex-1 min-w-0 truncate">{campo.label}</span>
                        <select
                          value={m.fuente}
                          onChange={e => setMapeoCampos(prev => ({
                            ...prev,
                            [campo.id]: { fuente: e.target.value, valor_template: prev[campo.id]?.valor_template ?? '' },
                          }))}
                          className="px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white shrink-0"
                        >
                          <option value="vacio">No autollenar</option>
                          {/* En un campo de adjunto la plantilla de texto no tiene
                              sentido, y al revés tampoco: por eso se ofrece una u otra. */}
                          {esAdjunto
                            ? <option value={config.adjunto.value}>{config.adjunto.label}</option>
                            : <option value="template">Plantilla de texto</option>}
                        </select>
                      </div>
                      {m.fuente === 'template' && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={m.valor_template}
                            onChange={e => setMapeoCampos(prev => ({ ...prev, [campo.id]: { fuente: 'template', valor_template: e.target.value } }))}
                            placeholder={config.placeholderPlantilla}
                            className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                          <div className="flex flex-wrap gap-1">
                            {config.placeholders.map(p => (
                              <button
                                key={p.key}
                                type="button"
                                title={p.label}
                                onClick={() => setMapeoCampos(prev => ({
                                  ...prev,
                                  [campo.id]: { fuente: 'template', valor_template: `${prev[campo.id]?.valor_template ?? ''}${p.key}` },
                                }))}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/20"
                              >
                                {p.key}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Plantilla de descripción</label>
              <textarea
                value={descripcionTemplate}
                onChange={e => setDescripcionTemplate(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trigger-activo-chk"
                checked={activoTrigger}
                onChange={e => setActivoTrigger(e.target.checked)}
                className="w-4 h-4 text-accent rounded"
              />
              <label htmlFor="trigger-activo-chk" className="text-sm text-neutral-700 dark:text-white/70">Trigger activo</label>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={guardar}
              disabled={guardando || !nombre.trim() || !disparadorId || !ticketTipoId}
              className="bg-accent text-white px-5 py-2 rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-5 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">No hay triggers configurados. Crea uno para empezar.</div>
      ) : (
        <div className="space-y-3">
          {triggers.map(t => (
            <div
              key={t.id}
              className={`flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border px-5 py-4 ${t.activo ? 'border-neutral-200 dark:border-white/10' : 'border-neutral-100 dark:border-white/5 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 flex-shrink-0 ${t.activo ? 'text-yellow-500' : 'text-neutral-400'}`} />
                  <span className="font-medium text-neutral-900 dark:text-white truncate">{t.nombre}</span>
                  {!t.activo && (
                    <span className="text-xs bg-neutral-100 dark:bg-white/10 text-neutral-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 dark:text-white/50">
                  {config.nombreDisparador}: <strong>{nombreDisparador(String(t[config.columnaDisparador] ?? ''))}</strong>
                  {' '}&middot; Trámite: <strong>{nombreTipo(t.ticket_tipo_id)}</strong>
                  {!!t.metodo_pago_filtro?.length && <> &middot; {config.labelMetodo.replace(/^Y /, '')}: <strong>{t.metodo_pago_filtro.map(v => etiquetaPago(config.opcionesMetodo, v)).join(', ')}</strong></>}
                  {!!t.forma_pago_filtro?.length && <> &middot; {config.labelForma.replace(/^Y /, '')}: <strong>{t.forma_pago_filtro.map(v => etiquetaPago(config.opcionesForma, v)).join(', ')}</strong></>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button onClick={() => alternarActivo(t)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                  {t.activo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => abrirEditar(t)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => eliminar(t.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TriggersPanel;
