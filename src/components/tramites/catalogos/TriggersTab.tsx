import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Pencil, Zap, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { TicketTipo, TipoCampo } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdjuntoCategoria {
  id: string;
  nombre: string;
}

interface StatusTrigger {
  id: string;
  ticket_tipo_id: string;
  from_status: string;
  target_tipo_id: string;
  initial_status: string;
  prioridad_hijo: 'heredar' | 'Alta' | 'Media' | 'Baja';
  nombre: string;
  requiere_confirmacion: boolean;
  adjunto_categorias_ids: string[];
  activo: boolean;
  created_at: string;
  target_tipo?: { label: string; color: string } | null;
}

interface FieldMapping {
  id?: string;
  trigger_id?: string;
  source_campo_id: string | null;
  source_sistema_key: string | null;
  target_campo_id: string | null;
  target_sistema_key: string | null;
  valor_fijo: string | null;
  orden: number;
  _key: string;
}

interface TriggerFormState {
  nombre: string;
  from_status: string;
  target_tipo_id: string;
  initial_status: string;
  prioridad_hijo: 'heredar' | 'Alta' | 'Media' | 'Baja';
  requiere_confirmacion: boolean;
  adjunto_categorias_ids: string[];
  activo: boolean;
}

type ShowToast = (msg: string, type?: 'success' | 'error') => void;

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORIDADES: Array<{ value: string; label: string }> = [
  { value: 'heredar', label: 'Heredar del padre' },
  { value: 'Alta',    label: 'Alta' },
  { value: 'Media',   label: 'Media' },
  { value: 'Baja',    label: 'Baja' },
];

const SISTEMA_KEYS: Array<{ value: string; label: string }> = [
  { value: 'asignado',       label: 'Usuario asignado (Responsable)' },
  { value: 'prioridad',      label: 'Prioridad' },
  { value: 'agente_vendedor', label: 'Agente/Vendedor' },
  { value: 'oficina_jiro',   label: 'Oficina JIRO' },
];

function mkKey() { return Math.random().toString(36).slice(2); }

// ── Main component ────────────────────────────────────────────────────────────

export function TriggersTab({ tipoId, showToast }: { tipoId: string; showToast: ShowToast }) {
  const { usuario } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [triggers, setTriggers]             = useState<StatusTrigger[]>([]);
  const [allTipos, setAllTipos]             = useState<TicketTipo[]>([]);
  const [adjuntoCats, setAdjuntoCats]       = useState<AdjuntoCategoria[]>([]);
  const [sourceCampos, setSourceCampos]     = useState<TipoCampo[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<{ label: string; slug: string }[]>([]);
  const [targetCamposMap, setTargetCamposMap] = useState<Record<string, TipoCampo[]>>({});

  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [mappingsMap, setMappingsMap] = useState<Record<string, FieldMapping[]>>({});

  // Form
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [targetStatuses, setTargetStatuses] = useState<{ label: string; slug: string }[]>([]);
  const [form, setForm] = useState<TriggerFormState>({
    nombre: '', from_status: '', target_tipo_id: '', initial_status: '',
    prioridad_hijo: 'heredar', requiere_confirmacion: true,
    adjunto_categorias_ids: [], activo: true,
  });

  useEffect(() => { loadAll(); }, [tipoId]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    const [triggersRes, tiposRes, catsRes, camposRes] = await Promise.all([
      supabase.from('ticket_status_triggers')
        .select('*, target_tipo:ticket_tipos!target_tipo_id(label,color)')
        .eq('ticket_tipo_id', tipoId)
        .order('created_at'),
      supabase.from('ticket_tipos').select('*').order('label'),
      supabase.from('maestro_adjunto_categorias').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('tramite_tipo_campos')
        .select('*').eq('tramite_tipo_id', tipoId).eq('activo', true).order('display_order'),
    ]);

    setAllTipos((tiposRes.data || []) as TicketTipo[]);
    setAdjuntoCats((catsRes.data || []) as AdjuntoCategoria[]);

    const srcCampos = (camposRes.data || []) as TipoCampo[];
    setSourceCampos(srcCampos);
    const estatusCampo = srcCampos.find(c => c.tipo === 'estatus');
    setSourceStatuses(estatusCampo?.config?.opciones ?? []);

    setTriggers((triggersRes.data || []) as StatusTrigger[]);
    setLoading(false);
  };

  const loadTargetCampos = async (targetTipoId: string): Promise<TipoCampo[]> => {
    if (targetCamposMap[targetTipoId]) return targetCamposMap[targetTipoId];
    const { data } = await supabase.from('tramite_tipo_campos')
      .select('*').eq('tramite_tipo_id', targetTipoId).eq('activo', true).order('display_order');
    const campos = (data || []) as TipoCampo[];
    setTargetCamposMap(prev => ({ ...prev, [targetTipoId]: campos }));
    return campos;
  };

  const loadMappings = async (triggerId: string) => {
    if (mappingsMap[triggerId]) return;
    const { data } = await supabase.from('ticket_trigger_field_mappings')
      .select('*').eq('trigger_id', triggerId).order('orden');
    setMappingsMap(prev => ({
      ...prev,
      [triggerId]: (data || []).map(m => ({ ...m, _key: mkKey() })) as FieldMapping[],
    }));
  };

  // ── Expand / collapse ───────────────────────────────────────────────────────

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    await loadMappings(id);
    const trigger = triggers.find(t => t.id === id);
    if (trigger) await loadTargetCampos(trigger.target_tipo_id);
  };

  // ── Form helpers ────────────────────────────────────────────────────────────

  const BLANK_FORM: TriggerFormState = {
    nombre: '', from_status: '', target_tipo_id: '', initial_status: '',
    prioridad_hijo: 'heredar', requiere_confirmacion: true,
    adjunto_categorias_ids: [], activo: true,
  };

  const openNew = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
    setTargetStatuses([]);
    setShowForm(true);
  };

  const openEdit = (t: StatusTrigger) => {
    setEditingId(t.id);
    setForm({
      nombre: t.nombre, from_status: t.from_status,
      target_tipo_id: t.target_tipo_id, initial_status: t.initial_status,
      prioridad_hijo: t.prioridad_hijo, requiere_confirmacion: t.requiere_confirmacion,
      adjunto_categorias_ids: t.adjunto_categorias_ids ?? [],
      activo: t.activo,
    });
    resolveTargetStatuses(t.target_tipo_id);
    setShowForm(true);
  };

  const resolveTargetStatuses = async (targetTipoId: string) => {
    const campos = await loadTargetCampos(targetTipoId);
    const ec = campos.find(c => c.tipo === 'estatus');
    setTargetStatuses(ec?.config?.opciones ?? []);
  };

  const onTargetTipoChange = async (targetTipoId: string) => {
    setForm(f => ({ ...f, target_tipo_id: targetTipoId, initial_status: '' }));
    await resolveTargetStatuses(targetTipoId);
  };

  const toggleAdjunto = (catId: string) => {
    setForm(f => ({
      ...f,
      adjunto_categorias_ids: f.adjunto_categorias_ids.includes(catId)
        ? f.adjunto_categorias_ids.filter(id => id !== catId)
        : [...f.adjunto_categorias_ids, catId],
    }));
  };

  // ── Save trigger ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!form.from_status)   { showToast('Selecciona el estatus que dispara el trigger', 'error'); return; }
    if (!form.target_tipo_id){ showToast('Selecciona el tipo de trámite hijo', 'error'); return; }
    if (!form.initial_status){ showToast('Selecciona el estatus inicial del trámite hijo', 'error'); return; }

    setSaving(true);
    const payload = {
      ticket_tipo_id: tipoId,
      nombre: form.nombre.trim(),
      from_status: form.from_status,
      target_tipo_id: form.target_tipo_id,
      initial_status: form.initial_status,
      prioridad_hijo: form.prioridad_hijo,
      requiere_confirmacion: form.requiere_confirmacion,
      adjunto_categorias_ids: form.adjunto_categorias_ids,
      activo: form.activo,
      created_by: usuario?.id,
    };

    const { error } = editingId
      ? await supabase.from('ticket_status_triggers').update(payload).eq('id', editingId)
      : await supabase.from('ticket_status_triggers').insert(payload);

    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return; }
    showToast(editingId ? 'Trigger actualizado' : 'Trigger creado');
    setSaving(false);
    setShowForm(false);
    await loadAll();
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el trigger "${nombre}"? Los trámites hijos ya creados no se verán afectados.`)) return;
    const { error } = await supabase.from('ticket_status_triggers').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Trigger eliminado');
    if (expandedId === id) setExpandedId(null);
    await loadAll();
  };

  const handleToggleActivo = async (t: StatusTrigger) => {
    await supabase.from('ticket_status_triggers').update({ activo: !t.activo }).eq('id', t.id);
    await loadAll();
  };

  // ── Mappings ────────────────────────────────────────────────────────────────

  const addMapping = (triggerId: string) => {
    setMappingsMap(prev => ({
      ...prev,
      [triggerId]: [...(prev[triggerId] || []), {
        trigger_id: triggerId,
        source_campo_id: null, source_sistema_key: null,
        target_campo_id: null, target_sistema_key: null,
        valor_fijo: null, orden: prev[triggerId]?.length ?? 0,
        _key: mkKey(),
      }],
    }));
  };

  const updateMapping = (triggerId: string, key: string, patch: Partial<FieldMapping>) => {
    setMappingsMap(prev => ({
      ...prev,
      [triggerId]: prev[triggerId].map(m => m._key === key ? { ...m, ...patch } : m),
    }));
  };

  const removeMapping = (triggerId: string, key: string) => {
    setMappingsMap(prev => ({
      ...prev,
      [triggerId]: prev[triggerId].filter(m => m._key !== key),
    }));
  };

  const saveMappings = async (triggerId: string) => {
    const mappings = mappingsMap[triggerId] || [];
    for (const m of mappings) {
      if (!m.source_campo_id && !m.source_sistema_key && !m.valor_fijo?.trim()) {
        showToast('Cada mapeo necesita un origen (campo, campo sistema, o valor fijo)', 'error'); return;
      }
      if (!m.target_campo_id && !m.target_sistema_key) {
        showToast('Cada mapeo necesita un campo destino', 'error'); return;
      }
    }
    setSaving(true);
    await supabase.from('ticket_trigger_field_mappings').delete().eq('trigger_id', triggerId);
    if (mappings.length > 0) {
      const rows = mappings.map((m, i) => ({
        trigger_id: triggerId,
        source_campo_id: m.source_campo_id || null,
        source_sistema_key: m.source_sistema_key || null,
        target_campo_id: m.target_campo_id || null,
        target_sistema_key: m.target_sistema_key || null,
        valor_fijo: m.valor_fijo?.trim() || null,
        orden: i,
      }));
      const { error } = await supabase.from('ticket_trigger_field_mappings').insert(rows);
      if (error) { showToast('Error guardando mapeos: ' + error.message, 'error'); setSaving(false); return; }
    }
    showToast('Mapeos guardados');
    setSaving(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-6 text-sm text-neutral-500">Cargando triggers…</div>;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50 shrink-0">
        <div>
          <p className="text-sm font-semibold text-neutral-800">Triggers de Estatus</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Al cambiar al estatus indicado, se crea automáticamente un trámite hijo.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo trigger
        </button>
      </div>

      {/* Alerta: sin campo estatus */}
      {sourceStatuses.length === 0 && (
        <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Este tipo de trámite no tiene un campo <strong>Estatus</strong> configurado. Agrégalo en la pestaña
            "Campos del formulario" para poder definir triggers.
          </p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <TriggerForm
          form={form}
          editingId={editingId}
          allTipos={allTipos}
          sourceStatuses={sourceStatuses}
          targetStatuses={targetStatuses}
          adjuntoCats={adjuntoCats}
          saving={saving}
          onFormChange={(patch) => setForm(f => ({ ...f, ...patch }))}
          onTargetTipoChange={onTargetTipoChange}
          onToggleAdjunto={toggleAdjunto}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* List */}
      <div className="divide-y divide-neutral-100">
        {triggers.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Zap className="w-8 h-8 text-neutral-200 mb-3" />
            <p className="text-sm font-medium text-neutral-500">Sin triggers configurados</p>
            <p className="text-xs text-neutral-400 mt-1">Crea el primero con el botón de arriba</p>
          </div>
        )}
        {triggers.map(t => (
          <TriggerRow
            key={t.id}
            trigger={t}
            expanded={expandedId === t.id}
            sourceCampos={sourceCampos}
            targetCampos={targetCamposMap[t.target_tipo_id] || []}
            mappings={mappingsMap[t.id] ?? null}
            saving={saving}
            onToggleExpand={() => toggleExpand(t.id)}
            onEdit={() => openEdit(t)}
            onDelete={() => handleDelete(t.id, t.nombre)}
            onToggleActivo={() => handleToggleActivo(t)}
            onAddMapping={() => addMapping(t.id)}
            onUpdateMapping={(key, patch) => updateMapping(t.id, key, patch)}
            onRemoveMapping={(key) => removeMapping(t.id, key)}
            onSaveMappings={() => saveMappings(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── TriggerForm ───────────────────────────────────────────────────────────────

interface TriggerFormProps {
  form: TriggerFormState;
  editingId: string | null;
  allTipos: TicketTipo[];
  sourceStatuses: { label: string; slug: string }[];
  targetStatuses: { label: string; slug: string }[];
  adjuntoCats: AdjuntoCategoria[];
  saving: boolean;
  onFormChange: (patch: Partial<TriggerFormState>) => void;
  onTargetTipoChange: (id: string) => void;
  onToggleAdjunto: (catId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TriggerForm({
  form, editingId, allTipos, sourceStatuses, targetStatuses, adjuntoCats,
  saving, onFormChange, onTargetTipoChange, onToggleAdjunto, onSave, onCancel,
}: TriggerFormProps) {
  const inputCls = 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-neutral-600 mb-1';

  return (
    <div className="m-5 border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-blue-800">
        {editingId ? 'Editar trigger' : 'Nuevo trigger'}
      </h3>

      {/* Nombre */}
      <div>
        <label className={labelCls}>Nombre del trigger *</label>
        <input
          type="text"
          value={form.nombre}
          onChange={e => onFormChange({ nombre: e.target.value })}
          placeholder="Ej: Póliza emitida → Registro de póliza"
          className={inputCls}
        />
      </div>

      {/* Estatus que dispara */}
      <div>
        <label className={labelCls}>Estatus padre que dispara el trigger *</label>
        {sourceStatuses.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Sin opciones — agrega el campo Estatus en la pestaña Campos.</p>
        ) : (
          <select value={form.from_status} onChange={e => onFormChange({ from_status: e.target.value })} className={inputCls}>
            <option value="">Seleccionar estatus…</option>
            {sourceStatuses.map(s => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tipo hijo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo de trámite hijo *</label>
          <select
            value={form.target_tipo_id}
            onChange={e => onTargetTipoChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Seleccionar tipo…</option>
            {allTipos.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Estatus inicial del trámite hijo *</label>
          {form.target_tipo_id && targetStatuses.length === 0 ? (
            <p className="text-xs text-neutral-400 italic mt-2">El tipo hijo no tiene campo Estatus configurado.</p>
          ) : (
            <select
              value={form.initial_status}
              onChange={e => onFormChange({ initial_status: e.target.value })}
              className={inputCls}
              disabled={!form.target_tipo_id}
            >
              <option value="">Seleccionar estatus…</option>
              {targetStatuses.map(s => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Prioridad + requiere confirmación */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prioridad del trámite hijo</label>
          <select
            value={form.prioridad_hijo}
            onChange={e => onFormChange({ prioridad_hijo: e.target.value as TriggerFormState['prioridad_hijo'] })}
            className={inputCls}
          >
            {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.requiere_confirmacion}
              onChange={e => onFormChange({ requiere_confirmacion: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600"
            />
            <span className="text-xs font-medium text-neutral-700">Requiere confirmación del usuario</span>
          </label>
          <p className="text-[10px] text-neutral-400 ml-6 mt-0.5">
            Si está activo, el usuario verá un aviso antes de que se cree el trámite hijo.
          </p>
        </div>
      </div>

      {/* Adjuntos */}
      {adjuntoCats.length > 0 && (
        <div>
          <label className={labelCls}>Adjuntos que se copian al hijo (por categoría)</label>
          <div className="flex flex-wrap gap-2">
            {adjuntoCats.map(cat => {
              const checked = form.adjunto_categorias_ids.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggleAdjunto(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    checked
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400'
                  }`}
                >
                  {cat.nombre}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">
            Solo se copian los adjuntos de las categorías seleccionadas. Sin selección = ninguno se copia.
          </p>
        </div>
      )}

      {/* Activo */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={e => onFormChange({ activo: e.target.checked })}
          className="w-4 h-4 rounded text-blue-600"
        />
        <span className="text-xs font-medium text-neutral-700">Trigger activo</span>
      </label>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : (editingId ? 'Guardar cambios' : 'Crear trigger')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── TriggerRow ────────────────────────────────────────────────────────────────

interface TriggerRowProps {
  trigger: StatusTrigger;
  expanded: boolean;
  sourceCampos: TipoCampo[];
  targetCampos: TipoCampo[];
  mappings: FieldMapping[] | null;
  saving: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActivo: () => void;
  onAddMapping: () => void;
  onUpdateMapping: (key: string, patch: Partial<FieldMapping>) => void;
  onRemoveMapping: (key: string) => void;
  onSaveMappings: () => void;
}

function TriggerRow({
  trigger, expanded, sourceCampos, targetCampos, mappings, saving,
  onToggleExpand, onEdit, onDelete, onToggleActivo,
  onAddMapping, onUpdateMapping, onRemoveMapping, onSaveMappings,
}: TriggerRowProps) {
  const color = trigger.target_tipo?.color ?? '#64748b';

  return (
    <div className={`${!trigger.activo ? 'opacity-60' : ''}`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors">
        <button onClick={onToggleExpand} className="shrink-0 text-neutral-400 hover:text-neutral-600">
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>

        <Zap className="w-4 h-4 text-blue-500 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-800">{trigger.nombre}</span>
            {!trigger.activo && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                Inactivo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
              {trigger.from_status}
            </span>
            <ArrowRight className="w-3 h-3 text-neutral-300" />
            <span className="text-[11px] font-medium" style={{ color }}>
              {trigger.target_tipo?.label ?? trigger.target_tipo_id}
            </span>
            <span className="text-[11px] text-neutral-400">
              ({trigger.initial_status})
            </span>
            {trigger.requiere_confirmacion && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                con confirmación
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleActivo}
            className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              trigger.activo
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {trigger.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onEdit} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mappings panel */}
      {expanded && (
        <div className="mx-5 mb-4 border border-neutral-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
            <p className="text-xs font-semibold text-neutral-700">Mapeo de campos</p>
            <p className="text-[10px] text-neutral-400">
              Define qué campos del trámite padre se copian al hijo.
            </p>
          </div>

          {mappings === null ? (
            <p className="px-4 py-3 text-xs text-neutral-400">Cargando mapeos…</p>
          ) : (
            <>
              {mappings.length === 0 && (
                <p className="px-4 py-3 text-xs text-neutral-400 italic">
                  Sin mapeos — los campos del hijo quedarán en blanco (excepto los que se llenan automáticamente).
                </p>
              )}
              <div className="divide-y divide-neutral-100">
                {mappings.map(m => (
                  <MappingRow
                    key={m._key}
                    mapping={m}
                    sourceCampos={sourceCampos}
                    targetCampos={targetCampos}
                    onUpdate={(patch) => onUpdateMapping(m._key, patch)}
                    onRemove={() => onRemoveMapping(m._key)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
                <button
                  onClick={onAddMapping}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar mapeo
                </button>
                {mappings.length > 0 && (
                  <button
                    onClick={onSaveMappings}
                    disabled={saving}
                    className="ml-auto flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {saving ? 'Guardando…' : 'Guardar mapeos'}
                  </button>
                )}
                {mappings.length === 0 && (
                  <button
                    onClick={onSaveMappings}
                    disabled={saving}
                    className="ml-auto flex items-center gap-1 px-3 py-1 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 text-xs disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {saving ? 'Guardando…' : 'Guardar (vacío)'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── MappingRow ────────────────────────────────────────────────────────────────

type SourceType = 'campo' | 'sistema' | 'fijo';
type TargetType = 'campo' | 'sistema';

interface MappingRowProps {
  mapping: FieldMapping;
  sourceCampos: TipoCampo[];
  targetCampos: TipoCampo[];
  onUpdate: (patch: Partial<FieldMapping>) => void;
  onRemove: () => void;
}

function MappingRow({ mapping, sourceCampos, targetCampos, onUpdate, onRemove }: MappingRowProps) {
  const sourceType: SourceType = mapping.valor_fijo !== null
    ? 'fijo'
    : mapping.source_sistema_key !== null
      ? 'sistema'
      : 'campo';

  const targetType: TargetType = mapping.target_sistema_key !== null ? 'sistema' : 'campo';

  const selectCls = 'flex-1 min-w-0 px-2 py-1.5 border border-neutral-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none bg-white';

  const handleSourceTypeChange = (t: SourceType) => {
    onUpdate({
      source_campo_id: null,
      source_sistema_key: null,
      valor_fijo: t === 'fijo' ? '' : null,
    });
  };

  const handleTargetTypeChange = (t: TargetType) => {
    onUpdate({ target_campo_id: null, target_sistema_key: null });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      {/* Source */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <select
          value={sourceType}
          onChange={e => handleSourceTypeChange(e.target.value as SourceType)}
          className="px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
        >
          <option value="campo">Campo padre</option>
          <option value="sistema">Sistema</option>
          <option value="fijo">Valor fijo</option>
        </select>

        {sourceType === 'campo' && (
          <select
            value={mapping.source_campo_id ?? ''}
            onChange={e => onUpdate({ source_campo_id: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Seleccionar campo…</option>
            {sourceCampos.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        )}
        {sourceType === 'sistema' && (
          <select
            value={mapping.source_sistema_key ?? ''}
            onChange={e => onUpdate({ source_sistema_key: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Seleccionar…</option>
            {SISTEMA_KEYS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
        {sourceType === 'fijo' && (
          <input
            type="text"
            value={mapping.valor_fijo ?? ''}
            onChange={e => onUpdate({ valor_fijo: e.target.value })}
            placeholder="Valor fijo…"
            className={selectCls}
          />
        )}
      </div>

      <ArrowRight className="w-4 h-4 text-neutral-300 shrink-0" />

      {/* Target */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <select
          value={targetType}
          onChange={e => handleTargetTypeChange(e.target.value as TargetType)}
          className="px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
        >
          <option value="campo">Campo hijo</option>
          <option value="sistema">Sistema</option>
        </select>

        {targetType === 'campo' && (
          <select
            value={mapping.target_campo_id ?? ''}
            onChange={e => onUpdate({ target_campo_id: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Seleccionar campo…</option>
            {targetCampos.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        )}
        {targetType === 'sistema' && (
          <select
            value={mapping.target_sistema_key ?? ''}
            onChange={e => onUpdate({ target_sistema_key: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Seleccionar…</option>
            {SISTEMA_KEYS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      <button onClick={onRemove} className="shrink-0 p-1 text-neutral-400 hover:text-red-500 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
