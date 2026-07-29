import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Save, X, RefreshCw, Play, HelpCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props {
  tipoId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Recurrencia {
  id: string;
  nombre: string;
  activo: boolean;
  frecuencia: 'diaria' | 'semanal' | 'mensual';
  dias_semana: number[] | null;
  dia_mes: number | null;
  dias_para_vencer: number;
  hora_disparo: string;
  asignacion_tipo: 'pool' | 'todos_del_grupo' | 'usuario_especifico' | 'usuarios_especificos';
  grupo_id: string | null;
  usuario_id: string | null;
  estatus_id_inicial: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
}

type FormData = Omit<Recurrencia, 'id'>;

const today = new Date().toISOString().slice(0, 10);

const EMPTY: FormData = {
  nombre: '',
  activo: true,
  frecuencia: 'semanal',
  dias_semana: [1],
  dia_mes: 1,
  dias_para_vencer: 1,
  hora_disparo: '08:00',
  asignacion_tipo: 'pool',
  grupo_id: null,
  usuario_id: null,
  estatus_id_inicial: null,
  fecha_inicio: today,
  fecha_fin: null,
};

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const FREC_LABEL: Record<string, string> = { diaria: 'Diaria', semanal: 'Semanal', mensual: 'Mensual' };
const ASIG_LABEL: Record<string, string> = {
  pool:                'Pool del equipo',
  todos_del_grupo:     'Todos del equipo',
  usuario_especifico:  'Usuario específico',
  usuarios_especificos:'Usuarios específicos',
};

const inputCls = 'w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1';

export default function RecurrenciaTab({ tipoId, showToast }: Props) {
  const [loading, setLoading]     = useState(true);
  const [rows, setRows]           = useState<Recurrencia[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm]           = useState<FormData>(EMPTY);
  const [saving, setSaving]       = useState(false);

  const [estatuses, setEstatuses]           = useState<{ id: string; nombre: string; color: string }[]>([]);
  const [grupos, setGrupos]                 = useState<{ id: string; nombre: string }[]>([]);
  const [usuarios, setUsuarios]             = useState<{ id: string; nombre_completo: string }[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [selectedUsuarios, setSelectedUsuarios] = useState<string[]>([]);

  // Disparar ahora
  const [dispararRec, setDispararRec]       = useState<Recurrencia | null>(null);
  const [dispararYaEjec, setDispararYaEjec] = useState(false);
  const [dispararMarcarLog, setDispararMarcarLog] = useState(true);
  const [dispararLoading, setDispararLoading] = useState(false);

  useEffect(() => { loadAll(); }, [tipoId]);

  async function loadAll() {
    setLoading(true);
    const [{ data: recs }, { data: ests }, { data: grps }] = await Promise.all([
      supabase.from('ticket_tipos_recurrencia').select('*').eq('ticket_tipo_id', tipoId).order('created_at'),
      supabase.from('ticket_estatus').select('id, nombre, color').eq('activo', true).order('orden'),
      supabase.from('tramites_grupos_visualizacion').select('id, nombre').eq('activo', true).order('nombre'),
    ]);
    setRows((recs ?? []) as Recurrencia[]);
    setEstatuses(ests ?? []);
    setGrupos(grps ?? []);
    setLoading(false);
  }

  async function loadUsuarios() {
    if (usuarios.length > 0) return;
    setLoadingUsuarios(true);
    const { data } = await supabase.from('usuarios').select('id, nombre_completo').eq('activo', true).order('nombre_completo');
    setUsuarios(data ?? []);
    setLoadingUsuarios(false);
  }

  async function loadRecurrenciaUsuarios(recurrenciaId: string) {
    const { data } = await supabase.from('ticket_tipos_recurrencia_usuarios')
      .select('usuario_id').eq('recurrencia_id', recurrenciaId);
    setSelectedUsuarios((data ?? []).map((r: any) => r.usuario_id));
  }

  function openNew() {
    setForm(EMPTY);
    setSelectedUsuarios([]);
    setEditingId('new');
  }

  function openEdit(r: Recurrencia) {
    setForm({ ...r, hora_disparo: r.hora_disparo ?? '08:00' });
    setSelectedUsuarios([]);
    setEditingId(r.id);
    if (r.asignacion_tipo === 'usuario_especifico' || r.asignacion_tipo === 'usuarios_especificos') {
      loadUsuarios();
    }
    if (r.asignacion_tipo === 'usuarios_especificos') {
      loadRecurrenciaUsuarios(r.id);
    }
  }

  function cancelEdit() { setEditingId(null); }

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function toggleDia(d: number) {
    const curr = form.dias_semana ?? [];
    setF('dias_semana', curr.includes(d) ? curr.filter(x => x !== d) : [...curr, d].sort());
  }

  function toggleUsuario(uid: string) {
    setSelectedUsuarios(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  }

  async function save() {
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (form.frecuencia === 'semanal' && !form.dias_semana?.length) {
      showToast('Selecciona al menos un día de la semana', 'error'); return;
    }
    if (form.asignacion_tipo === 'usuarios_especificos' && selectedUsuarios.length === 0) {
      showToast('Selecciona al menos un usuario', 'error'); return;
    }
    setSaving(true);

    const payload = {
      ticket_tipo_id:     tipoId,
      nombre:             form.nombre.trim(),
      activo:             form.activo,
      frecuencia:         form.frecuencia,
      dias_semana:        form.frecuencia === 'semanal' ? form.dias_semana : null,
      dia_mes:            form.frecuencia === 'mensual' ? form.dia_mes : null,
      dias_para_vencer:   form.dias_para_vencer,
      hora_disparo:       form.hora_disparo || '08:00',
      asignacion_tipo:    form.asignacion_tipo,
      grupo_id:           form.asignacion_tipo !== 'usuario_especifico' && form.asignacion_tipo !== 'usuarios_especificos'
                            ? form.grupo_id : null,
      usuario_id:         form.asignacion_tipo === 'usuario_especifico' ? form.usuario_id : null,
      estatus_id_inicial: form.estatus_id_inicial || null,
      fecha_inicio:       form.fecha_inicio,
      fecha_fin:          form.fecha_fin || null,
      updated_at:         new Date().toISOString(),
    };

    let savedId: string | null = null;

    if (editingId === 'new') {
      const { data, error } = await supabase.from('ticket_tipos_recurrencia').insert(payload).select('id').single();
      if (error || !data) { showToast('Error al guardar: ' + (error?.message ?? ''), 'error'); setSaving(false); return; }
      savedId = data.id;
    } else {
      const { error } = await supabase.from('ticket_tipos_recurrencia').update(payload).eq('id', editingId!);
      if (error) { showToast('Error al guardar: ' + error.message, 'error'); setSaving(false); return; }
      savedId = editingId!;
    }

    // Guardar lista de usuarios específicos
    if (form.asignacion_tipo === 'usuarios_especificos' && savedId) {
      await supabase.from('ticket_tipos_recurrencia_usuarios').delete().eq('recurrencia_id', savedId);
      if (selectedUsuarios.length > 0) {
        await supabase.from('ticket_tipos_recurrencia_usuarios').insert(
          selectedUsuarios.map(uid => ({ recurrencia_id: savedId, usuario_id: uid }))
        );
      }
    }

    setSaving(false);
    showToast(editingId === 'new' ? 'Recurrencia creada' : 'Recurrencia actualizada');
    setEditingId(null);
    loadAll();
  }

  async function toggleActivo(r: Recurrencia) {
    await supabase.from('ticket_tipos_recurrencia').update({ activo: !r.activo }).eq('id', r.id);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x));
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta recurrencia?')) return;
    const { error } = await supabase.from('ticket_tipos_recurrencia').delete().eq('id', id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    showToast('Eliminada');
    setRows(prev => prev.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // ── Disparar ahora ─────────────────────────────────────────────────────────

  async function abrirDisparar(r: Recurrencia) {
    setDispararLoading(true);
    const { data } = await supabase.from('ticket_recurrencia_log')
      .select('id')
      .eq('recurrencia_id', r.id)
      .eq('fecha_generada', today)
      .maybeSingle();
    const yaEjec = !!data;
    setDispararYaEjec(yaEjec);
    setDispararMarcarLog(true);
    setDispararRec(r);
    setDispararLoading(false);
  }

  async function confirmarDisparar() {
    if (!dispararRec) return;
    setDispararLoading(true);
    const { data, error } = await supabase.rpc('disparar_recurrencia_manual', {
      p_recurrencia_id: dispararRec.id,
      p_marcar_log:     dispararMarcarLog,
    });
    setDispararLoading(false);
    setDispararRec(null);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    const n = (data as any)?.tickets_creados ?? 0;
    showToast(`Listo — ${n} trámite${n !== 1 ? 's' : ''} creado${n !== 1 ? 's' : ''}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center p-10">
      <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
    </div>
  );

  const showingForm = editingId !== null;
  const needsMultiUser = form.asignacion_tipo === 'usuario_especifico' || form.asignacion_tipo === 'usuarios_especificos';

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Recurrencias</p>
          <p className="text-xs text-neutral-500">Trámites que se generan automáticamente según una frecuencia.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <RefreshCw className="w-4 h-4" />
          </button>
          {!showingForm && (
            <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {rows.length === 0 && !showingForm ? (
        <div className="text-center py-10 text-sm text-neutral-400">
          Sin recurrencias. Crea una para generar trámites automáticamente.
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(r => (
            <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${editingId === r.id ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/30'}`}>
              <button onClick={() => toggleActivo(r)} className={`w-8 h-4 rounded-full transition-colors shrink-0 ${r.activo ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${r.activo ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${r.activo ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-400'}`}>{r.nombre}</p>
                <p className="text-xs text-neutral-500">
                  {FREC_LABEL[r.frecuencia]}
                  {r.frecuencia === 'semanal' && r.dias_semana?.length ? ` · ${r.dias_semana.map(d => DIAS_SEMANA[d]).join(', ')}` : ''}
                  {r.frecuencia === 'mensual' ? ` · día ${r.dia_mes}` : ''}
                  {r.hora_disparo ? ` · ${r.hora_disparo.slice(0, 5)}` : ''}
                  {' · '}{ASIG_LABEL[r.asignacion_tipo]}
                  {' · '}{r.dias_para_vencer}d para vencer
                </p>
              </div>
              {/* Disparar ahora */}
              <button
                onClick={() => abrirDisparar(r)}
                disabled={dispararLoading}
                title="Disparar ahora"
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 transition-colors"
              >
                {dispararLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => eliminar(r.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      {showingForm && (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5 space-y-4 bg-neutral-50 dark:bg-neutral-800/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {editingId === 'new' ? 'Nueva recurrencia' : 'Editar recurrencia'}
            </p>
            <button onClick={cancelEdit} className="p-1 rounded-lg text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Nombre */}
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => setF('nombre', e.target.value)} className={inputCls} />
            </div>

            {/* Frecuencia */}
            <div>
              <label className={labelCls}>Frecuencia</label>
              <select value={form.frecuencia} onChange={e => setF('frecuencia', e.target.value as any)} className={inputCls}>
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            {/* Hora de disparo */}
            <div>
              <label className={labelCls}>Hora de disparo (hora CST)</label>
              <input type="time" value={form.hora_disparo} onChange={e => setF('hora_disparo', e.target.value)} className={inputCls} />
              <p className="text-[10px] text-neutral-400 mt-0.5">Hora local (Ciudad de México) en que se crean los trámites.</p>
            </div>

            {/* Días para vencer */}
            <div className="col-span-2">
              <label className={labelCls}>
                Días para vencer
                <span className="ml-1 inline-flex items-center text-neutral-400" title="Días contados desde hoy para calcular la fecha de vencimiento. Ej: 1 = vence mañana, 7 = vence en una semana, 0 = vence el mismo día.">
                  <HelpCircle className="w-3 h-3" />
                </span>
              </label>
              <input type="number" min={0} max={365} value={form.dias_para_vencer} onChange={e => setF('dias_para_vencer', Number(e.target.value))} className={inputCls} />
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Días desde la fecha de creación hasta el vencimiento. Ej: 1 = vence al día siguiente.
              </p>
            </div>

            {/* Días de la semana */}
            {form.frecuencia === 'semanal' && (
              <div className="col-span-2">
                <label className={labelCls}>Días de la semana</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDia(i)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.dias_semana?.includes(i) ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Día del mes */}
            {form.frecuencia === 'mensual' && (
              <div>
                <label className={labelCls}>Día del mes (1–28)</label>
                <input type="number" min={1} max={28} value={form.dia_mes ?? 1} onChange={e => setF('dia_mes', Number(e.target.value))} className={inputCls} />
              </div>
            )}

            {/* Tipo de asignación */}
            <div className="col-span-2">
              <label className={labelCls}>Tipo de asignación</label>
              <select value={form.asignacion_tipo}
                onChange={e => {
                  setF('asignacion_tipo', e.target.value as any);
                  if (e.target.value === 'usuario_especifico' || e.target.value === 'usuarios_especificos') loadUsuarios();
                }}
                className={inputCls}>
                <option value="pool">Pool del equipo (sin asignar, primer disponible)</option>
                <option value="todos_del_grupo">Todos del equipo (uno por miembro)</option>
                <option value="usuario_especifico">Usuario específico</option>
                <option value="usuarios_especificos">Usuarios específicos (elegir lista)</option>
              </select>
            </div>

            {/* Equipo — para pool / todos_del_grupo */}
            {(form.asignacion_tipo === 'pool' || form.asignacion_tipo === 'todos_del_grupo') && (
              <div className="col-span-2">
                <label className={labelCls}>Equipo (opcional)</label>
                <select value={form.grupo_id ?? ''} onChange={e => setF('grupo_id', e.target.value || null)} className={inputCls}>
                  <option value="">Sin equipo específico</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Un solo usuario */}
            {form.asignacion_tipo === 'usuario_especifico' && (
              <div className="col-span-2">
                <label className={labelCls}>Usuario</label>
                {loadingUsuarios ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando...</div>
                ) : (
                  <select value={form.usuario_id ?? ''} onChange={e => setF('usuario_id', e.target.value || null)} className={inputCls}>
                    <option value="">Seleccionar usuario</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Múltiples usuarios */}
            {form.asignacion_tipo === 'usuarios_especificos' && (
              <div className="col-span-2">
                <label className={labelCls}>
                  Usuarios ({selectedUsuarios.length} seleccionado{selectedUsuarios.length !== 1 ? 's' : ''})
                </label>
                {loadingUsuarios ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando...</div>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-700 bg-white dark:bg-neutral-800">
                    {usuarios.map(u => {
                      const checked = selectedUsuarios.includes(u.id);
                      return (
                        <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors ${checked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleUsuario(u.id)} className="w-3.5 h-3.5 rounded text-blue-600" />
                          <span className={`text-xs ${checked ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-neutral-700 dark:text-neutral-300'}`}>{u.nombre_completo}</span>
                        </label>
                      );
                    })}
                    {usuarios.length === 0 && <p className="px-3 py-4 text-xs text-neutral-400 text-center">Sin usuarios activos</p>}
                  </div>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">Se creará un trámite por cada usuario seleccionado.</p>
              </div>
            )}

            {/* Equipo para usuarios_especificos — opcional para agrupación */}
            {form.asignacion_tipo === 'usuarios_especificos' && (
              <div className="col-span-2">
                <label className={labelCls}>Equipo de agrupación (opcional)</label>
                <select value={form.grupo_id ?? ''} onChange={e => setF('grupo_id', e.target.value || null)} className={inputCls}>
                  <option value="">Sin equipo</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Estatus inicial */}
            <div className="col-span-2">
              <label className={labelCls}>Estatus inicial (opcional)</label>
              <select value={form.estatus_id_inicial ?? ''} onChange={e => setF('estatus_id_inicial', e.target.value || null)} className={inputCls}>
                <option value="">Primer estatus activo (automático)</option>
                {estatuses.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {/* Fechas */}
            <div>
              <label className={labelCls}>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin (opcional)</label>
              <input type="date" value={form.fecha_fin ?? ''} onChange={e => setF('fecha_fin', e.target.value || null)} className={inputCls} />
            </div>

            {/* Activo */}
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="rec-activo" checked={form.activo} onChange={e => setF('activo', e.target.checked)} className="w-4 h-4 rounded" />
              <label htmlFor="rec-activo" className="text-sm text-neutral-700 dark:text-neutral-300">Activa al crear</label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal "Disparar ahora" ──────────────────────────────────────────── */}
      {dispararRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Disparar ahora</p>
                  <p className="text-xs text-neutral-500 truncate max-w-[180px]">{dispararRec.nombre}</p>
                </div>
              </div>
              <button onClick={() => setDispararRec(null)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {dispararYaEjec ? (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Esta recurrencia ya se ejecutó hoy. Se crearán trámites <strong>adicionales</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Se crearán los trámites de esta recurrencia ahora mismo.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dispararMarcarLog}
                  onChange={e => setDispararMarcarLog(e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5 text-blue-600"
                />
                <div>
                  <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Marcar como ejecutado hoy
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    El cron automático no volverá a correr esta recurrencia el día de hoy.
                    Desactívalo si quieres que igual corra a la hora programada.
                  </p>
                </div>
              </label>
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
              <button onClick={() => setDispararRec(null)} className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarDisparar} disabled={dispararLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {dispararLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Disparar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
