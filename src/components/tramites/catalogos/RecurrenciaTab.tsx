import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Save, X, RefreshCw } from 'lucide-react';
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
  asignacion_tipo: 'pool' | 'todos_del_grupo' | 'usuario_especifico';
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
  pool: 'Pool del equipo',
  todos_del_grupo: 'Todos del equipo',
  usuario_especifico: 'Usuario específico',
};

export default function RecurrenciaTab({ tipoId, showToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Recurrencia[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Selectors data
  const [estatuses, setEstatuses] = useState<{ id: string; nombre: string; color: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; nombre: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre_completo: string }[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

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

  function openNew() {
    setForm(EMPTY);
    setEditingId('new');
  }

  function openEdit(r: Recurrencia) {
    setForm({ ...r });
    setEditingId(r.id);
    if (r.asignacion_tipo === 'usuario_especifico') loadUsuarios();
  }

  function cancelEdit() { setEditingId(null); }

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function toggleDia(d: number) {
    const curr = form.dias_semana ?? [];
    setF('dias_semana', curr.includes(d) ? curr.filter(x => x !== d) : [...curr, d].sort());
  }

  async function save() {
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (form.frecuencia === 'semanal' && !form.dias_semana?.length) {
      showToast('Selecciona al menos un día de la semana', 'error'); return;
    }
    setSaving(true);

    const payload = {
      ticket_tipo_id: tipoId,
      nombre: form.nombre.trim(),
      activo: form.activo,
      frecuencia: form.frecuencia,
      dias_semana: form.frecuencia === 'semanal' ? form.dias_semana : null,
      dia_mes: form.frecuencia === 'mensual' ? form.dia_mes : null,
      dias_para_vencer: form.dias_para_vencer,
      asignacion_tipo: form.asignacion_tipo,
      grupo_id: form.asignacion_tipo !== 'usuario_especifico' ? form.grupo_id : null,
      usuario_id: form.asignacion_tipo === 'usuario_especifico' ? form.usuario_id : null,
      estatus_id_inicial: form.estatus_id_inicial || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId === 'new') {
      ({ error } = await supabase.from('ticket_tipos_recurrencia').insert(payload));
    } else {
      ({ error } = await supabase.from('ticket_tipos_recurrencia').update(payload).eq('id', editingId!));
    }

    setSaving(false);
    if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }
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

  if (loading) return (
    <div className="flex items-center justify-center p-10">
      <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
    </div>
  );

  const showingForm = editingId !== null;

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Recurrencias</p>
          <p className="text-xs text-neutral-500">Tickets que se generan automáticamente según una frecuencia.</p>
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
          Sin recurrencias. Crea una para generar tickets automáticamente.
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
                  {' · '}{ASIG_LABEL[r.asignacion_tipo]}
                  {' · '}{r.dias_para_vencer}d para vencer
                </p>
              </div>
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

      {/* Form */}
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
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setF('nombre', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Frecuencia */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Frecuencia</label>
              <select value={form.frecuencia} onChange={e => setF('frecuencia', e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            {/* Días para vencer */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Días para vencer</label>
              <input type="number" min={1} max={365} value={form.dias_para_vencer} onChange={e => setF('dias_para_vencer', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Días de la semana */}
            {form.frecuencia === 'semanal' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Días de la semana</label>
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
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Día del mes (1–28)</label>
                <input type="number" min={1} max={28} value={form.dia_mes ?? 1} onChange={e => setF('dia_mes', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            {/* Asignación */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Tipo de asignación</label>
              <select value={form.asignacion_tipo} onChange={e => { setF('asignacion_tipo', e.target.value as any); if (e.target.value === 'usuario_especifico') loadUsuarios(); }}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="pool">Pool del equipo</option>
                <option value="todos_del_grupo">Todos del equipo (uno por miembro)</option>
                <option value="usuario_especifico">Usuario específico</option>
              </select>
            </div>

            {/* Grupo */}
            {form.asignacion_tipo !== 'usuario_especifico' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Equipo (opcional)</label>
                <select value={form.grupo_id ?? ''} onChange={e => setF('grupo_id', e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sin equipo específico</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Usuario específico */}
            {form.asignacion_tipo === 'usuario_especifico' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Usuario</label>
                {loadingUsuarios ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando...</div>
                ) : (
                  <select value={form.usuario_id ?? ''} onChange={e => setF('usuario_id', e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar usuario</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Estatus inicial */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Estatus inicial (opcional)</label>
              <select value={form.estatus_id_inicial ?? ''} onChange={e => setF('estatus_id_inicial', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Primer estatus activo (automático)</option>
                {estatuses.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {/* Fechas */}
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Fecha fin (opcional)</label>
              <input type="date" value={form.fecha_fin ?? ''} onChange={e => setF('fecha_fin', e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Activo */}
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="rec-activo" checked={form.activo} onChange={e => setF('activo', e.target.checked)}
                className="w-4 h-4 rounded" />
              <label htmlFor="rec-activo" className="text-sm text-neutral-700 dark:text-neutral-300">Activa al crear</label>
            </div>
          </div>

          {/* Actions */}
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
    </div>
  );
}
