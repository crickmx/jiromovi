import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Pencil, Zap, ArrowRight, AlertCircle, Wand2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { TicketTipo, TipoCampo } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdjuntoCategoria { id: string; nombre: string }
interface Grupo { id: string; nombre: string }

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
  folio_mode: 'nuevo' | 'heredar_incisos';
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
  folio_mode: 'nuevo' | 'heredar_incisos';
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
  { value: 'asignado',          label: 'Responsable asignado' },
  { value: 'prioridad',         label: 'Prioridad' },
  { value: 'agente_vendedor',   label: 'Agente / Vendedor' },
  { value: 'oficina_jiro',      label: 'Oficina JIRO' },
  { value: 'poliza_numero',     label: 'Número de póliza' },
  { value: 'responsable_padre', label: 'Responsable del trámite padre' },
  { value: 'autoasignar',       label: 'Auto-asignar (reglas del equipo)' },
];

function mkKey() { return Math.random().toString(36).slice(2); }

// ── Main component ────────────────────────────────────────────────────────────

export function TriggersTab({ tipoId, showToast }: { tipoId: string; showToast: ShowToast }) {
  const { usuario } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [triggers, setTriggers]               = useState<StatusTrigger[]>([]);
  const [allTipos, setAllTipos]               = useState<TicketTipo[]>([]);
  const [adjuntoCats, setAdjuntoCats]         = useState<AdjuntoCategoria[]>([]);
  const [sourceCampos, setSourceCampos]       = useState<TipoCampo[]>([]);
  const [sourceStatuses, setSourceStatuses]   = useState<{ label: string; slug: string }[]>([]);
  const [targetCamposMap, setTargetCamposMap] = useState<Record<string, TipoCampo[]>>({});
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [initialMappingsMap, setInitialMappingsMap] = useState<Record<string, FieldMapping[]>>({});

  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [targetStatuses, setTargetStatuses] = useState<{ label: string; slug: string }[]>([]);
  const [form, setForm] = useState<TriggerFormState>({
    nombre: '', from_status: '', target_tipo_id: '', initial_status: '',
    prioridad_hijo: 'heredar', requiere_confirmacion: true,
    adjunto_categorias_ids: [], activo: true, folio_mode: 'nuevo',
  });

  // Escalation
  interface EscalacionTrigger { id: string; from_status: string; destinatario: 'supervisor' | 'director' | 'ambos'; activo: boolean }
  const [escalaciones, setEscalaciones]     = useState<EscalacionTrigger[]>([]);
  const [showEscForm, setShowEscForm]       = useState(false);
  const [escForm, setEscForm]               = useState<{ from_status: string; destinatario: 'supervisor' | 'director' | 'ambos' }>({ from_status: '', destinatario: 'ambos' });
  const [escEditingId, setEscEditingId]     = useState<string | null>(null);

  useEffect(() => { loadAll(); loadEscalaciones(); }, [tipoId]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    const [triggersRes, tiposRes, catsRes, camposRes, gruposRes] = await Promise.all([
      supabase.from('ticket_status_triggers')
        .select('*, target_tipo:ticket_tipos!target_tipo_id(label,color)')
        .eq('ticket_tipo_id', tipoId).order('created_at'),
      supabase.from('ticket_tipos').select('*').order('label'),
      supabase.from('maestro_adjunto_categorias').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('tramite_tipo_campos').select('*').eq('tramite_tipo_id', tipoId).eq('activo', true).order('display_order'),
      supabase.from('tramites_grupos').select('id, nombre').order('nombre'),
    ]);
    setAllTipos((tiposRes.data || []) as TicketTipo[]);
    setAdjuntoCats((catsRes.data || []) as AdjuntoCategoria[]);
    setGrupos((gruposRes.data || []) as Grupo[]);
    const srcCampos = (camposRes.data || []) as TipoCampo[];
    setSourceCampos(srcCampos);
    setSourceStatuses(srcCampos.find(c => c.tipo === 'estatus')?.config?.opciones ?? []);
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

  const loadMappings = async (triggerId: string): Promise<FieldMapping[]> => {
    if (initialMappingsMap[triggerId]) return initialMappingsMap[triggerId];
    const { data } = await supabase.from('ticket_trigger_field_mappings')
      .select('*').eq('trigger_id', triggerId).order('orden');
    const rows = (data || []).map(m => ({ ...m, _key: mkKey() })) as FieldMapping[];
    setInitialMappingsMap(prev => ({ ...prev, [triggerId]: rows }));
    return rows;
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const trigger = triggers.find(t => t.id === id);
    if (trigger) {
      await Promise.all([loadMappings(id), loadTargetCampos(trigger.target_tipo_id)]);
    }
  };

  // ── Form helpers ────────────────────────────────────────────────────────────

  const BLANK_FORM: TriggerFormState = {
    nombre: '', from_status: '', target_tipo_id: '', initial_status: '',
    prioridad_hijo: 'heredar', requiere_confirmacion: true,
    adjunto_categorias_ids: [], activo: true, folio_mode: 'nuevo',
  };

  const openNew = () => { setEditingId(null); setForm(BLANK_FORM); setTargetStatuses([]); setShowForm(true); };

  const openEdit = (t: StatusTrigger) => {
    setEditingId(t.id);
    setForm({
      nombre: t.nombre, from_status: t.from_status, target_tipo_id: t.target_tipo_id,
      initial_status: t.initial_status, prioridad_hijo: t.prioridad_hijo,
      requiere_confirmacion: t.requiere_confirmacion,
      adjunto_categorias_ids: t.adjunto_categorias_ids ?? [],
      activo: t.activo, folio_mode: t.folio_mode ?? 'nuevo',
    });
    resolveTargetStatuses(t.target_tipo_id);
    setShowForm(true);
  };

  const resolveTargetStatuses = async (targetTipoId: string) => {
    const campos = await loadTargetCampos(targetTipoId);
    setTargetStatuses(campos.find(c => c.tipo === 'estatus')?.config?.opciones ?? []);
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
    if (!form.nombre.trim())    { showToast('El nombre es obligatorio', 'error'); return; }
    if (!form.from_status)      { showToast('Selecciona el estatus que dispara el trigger', 'error'); return; }
    if (!form.target_tipo_id)   { showToast('Selecciona el tipo de trámite hijo', 'error'); return; }
    if (!form.initial_status)   { showToast('Selecciona el estatus inicial del trámite hijo', 'error'); return; }
    setSaving(true);
    const payload = {
      ticket_tipo_id: tipoId, nombre: form.nombre.trim(), from_status: form.from_status,
      target_tipo_id: form.target_tipo_id, initial_status: form.initial_status,
      prioridad_hijo: form.prioridad_hijo, requiere_confirmacion: form.requiere_confirmacion,
      adjunto_categorias_ids: form.adjunto_categorias_ids, activo: form.activo,
      folio_mode: form.folio_mode, created_by: usuario?.id,
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

  // ── Save mappings (called from TriggerRow with the final rows) ───────────────

  const saveMappings = async (triggerId: string, rows: FieldMapping[]) => {
    for (const m of rows) {
      if (!m.source_campo_id && !m.source_sistema_key && !m.valor_fijo?.trim()) {
        showToast('Cada mapeo necesita un origen', 'error'); return;
      }
      if (!m.target_campo_id && !m.target_sistema_key) {
        showToast('Cada mapeo necesita un campo destino', 'error'); return;
      }
    }
    setSaving(true);
    await supabase.from('ticket_trigger_field_mappings').delete().eq('trigger_id', triggerId);
    if (rows.length > 0) {
      const dbRows = rows.map((m, i) => ({
        trigger_id: triggerId,
        source_campo_id:    m.source_campo_id || null,
        source_sistema_key: m.source_sistema_key || null,
        target_campo_id:    m.target_campo_id || null,
        target_sistema_key: m.target_sistema_key || null,
        valor_fijo:         m.valor_fijo?.trim() || null,
        orden: i,
      }));
      const { error } = await supabase.from('ticket_trigger_field_mappings').insert(dbRows);
      if (error) { showToast('Error guardando mapeos: ' + error.message, 'error'); setSaving(false); return; }
    }
    // Invalidate cache so next expand re-fetches
    setInitialMappingsMap(prev => ({ ...prev, [triggerId]: rows }));
    showToast('Mapeos guardados');
    setSaving(false);
  };

  // ── Escalation ─────────────────────────────────────────────────────────────

  const loadEscalaciones = async () => {
    const { data } = await supabase.from('ticket_escalacion_triggers')
      .select('*').eq('ticket_tipo_id', tipoId).order('created_at');
    setEscalaciones((data ?? []) as EscalacionTrigger[]);
  };

  const handleSaveEscalacion = async () => {
    if (!escForm.from_status) { showToast('Elige un estatus que dispare la escalación', 'error'); return; }
    setSaving(true);
    if (escEditingId) {
      const { error } = await supabase.from('ticket_escalacion_triggers')
        .update({ from_status: escForm.from_status, destinatario: escForm.destinatario }).eq('id', escEditingId);
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('ticket_escalacion_triggers')
        .insert({ ticket_tipo_id: tipoId, from_status: escForm.from_status, destinatario: escForm.destinatario });
      if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return; }
    }
    showToast('Trigger de escalación guardado');
    setSaving(false); setShowEscForm(false); setEscEditingId(null);
    setEscForm({ from_status: '', destinatario: 'ambos' });
    await loadEscalaciones();
  };

  const handleDeleteEscalacion = async (id: string) => {
    if (!confirm('¿Eliminar este trigger de escalación?')) return;
    await supabase.from('ticket_escalacion_triggers').delete().eq('id', id);
    setEscalaciones(prev => prev.filter(e => e.id !== id));
  };

  const handleToggleEscActivo = async (e: EscalacionTrigger) => {
    await supabase.from('ticket_escalacion_triggers').update({ activo: !e.activo }).eq('id', e.id);
    setEscalaciones(prev => prev.map(x => x.id === e.id ? { ...x, activo: !x.activo } : x));
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
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
          <Plus className="w-3.5 h-3.5" />Nuevo trigger
        </button>
      </div>

      {sourceStatuses.length === 0 && (
        <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Este tipo de trámite no tiene un campo <strong>Estatus</strong> configurado.
          </p>
        </div>
      )}

      {showForm && (
        <TriggerForm
          form={form} editingId={editingId} allTipos={allTipos}
          sourceStatuses={sourceStatuses} targetStatuses={targetStatuses}
          adjuntoCats={adjuntoCats} saving={saving}
          onFormChange={(patch) => setForm(f => ({ ...f, ...patch }))}
          onTargetTipoChange={onTargetTipoChange}
          onToggleAdjunto={toggleAdjunto}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

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
            initialMappings={initialMappingsMap[t.id] ?? null}
            saving={saving}
            grupos={grupos}
            onToggleExpand={() => toggleExpand(t.id)}
            onEdit={() => openEdit(t)}
            onDelete={() => handleDelete(t.id, t.nombre)}
            onToggleActivo={() => handleToggleActivo(t)}
            onSaveMappings={(rows) => saveMappings(t.id, rows)}
          />
        ))}
      </div>

      {/* Escalation */}
      <div className="mt-6 border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-orange-50 shrink-0">
          <div>
            <p className="text-sm font-semibold text-orange-800">Triggers de Escalación</p>
            <p className="text-xs text-orange-600 mt-0.5">
              Al cambiar al estatus indicado, se notifica al supervisor/director y el trámite aparece en "Requiere atención".
            </p>
          </div>
          <button
            onClick={() => { setShowEscForm(true); setEscEditingId(null); setEscForm({ from_status: '', destinatario: 'ambos' }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
          >
            <Plus className="w-3.5 h-3.5" />Nuevo
          </button>
        </div>

        {showEscForm && (
          <div className="mx-5 mt-3 border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Estatus que dispara</label>
                <select value={escForm.from_status} onChange={e => setEscForm(f => ({ ...f, from_status: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                  <option value="">Seleccionar estatus…</option>
                  {sourceStatuses.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notificar a</label>
                <select value={escForm.destinatario} onChange={e => setEscForm(f => ({ ...f, destinatario: e.target.value as EscalacionTrigger['destinatario'] }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                  <option value="ambos">Supervisor y Director</option>
                  <option value="supervisor">Solo Supervisor</option>
                  <option value="director">Solo Director</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEscForm(false)} className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
              <button onClick={handleSaveEscalacion} disabled={saving} className="px-4 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-100">
          {escalaciones.length === 0 && !showEscForm && (
            <div className="py-8 text-center text-xs text-neutral-400">Sin triggers de escalación</div>
          )}
          {escalaciones.map(e => {
            const destinatarioLabel = e.destinatario === 'ambos' ? 'Supervisor y Director' : e.destinatario === 'supervisor' ? 'Supervisor' : 'Director';
            const statusLabel = sourceStatuses.find(s => s.slug === e.from_status)?.label ?? e.from_status;
            return (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded mr-2">{statusLabel}</span>
                    <ArrowRight className="w-3 h-3 inline text-neutral-400 mr-2" />
                    Notificar a <strong>{destinatarioLabel}</strong>
                  </p>
                </div>
                <button onClick={() => handleToggleEscActivo(e)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.activo ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {e.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => { setEscEditingId(e.id); setEscForm({ from_status: e.from_status, destinatario: e.destinatario }); setShowEscForm(true); }} className="p-1 text-neutral-400 hover:text-blue-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteEscalacion(e.id)} className="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TriggerForm ───────────────────────────────────────────────────────────────

interface TriggerFormProps {
  form: TriggerFormState; editingId: string | null; allTipos: TicketTipo[];
  sourceStatuses: { label: string; slug: string }[]; targetStatuses: { label: string; slug: string }[];
  adjuntoCats: AdjuntoCategoria[]; saving: boolean;
  onFormChange: (patch: Partial<TriggerFormState>) => void;
  onTargetTipoChange: (id: string) => void; onToggleAdjunto: (catId: string) => void;
  onSave: () => void; onCancel: () => void;
}

function TriggerForm({ form, editingId, allTipos, sourceStatuses, targetStatuses, adjuntoCats, saving, onFormChange, onTargetTipoChange, onToggleAdjunto, onSave, onCancel }: TriggerFormProps) {
  const inputCls = 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-neutral-600 mb-1';
  return (
    <div className="m-5 border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-blue-800">{editingId ? 'Editar trigger' : 'Nuevo trigger'}</h3>
      <div>
        <label className={labelCls}>Nombre del trigger *</label>
        <input type="text" value={form.nombre} onChange={e => onFormChange({ nombre: e.target.value })} placeholder="Ej: Póliza emitida → Registro de póliza" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Estatus padre que dispara el trigger *</label>
        {sourceStatuses.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">Sin opciones — agrega el campo Estatus en la pestaña Campos.</p>
        ) : (
          <select value={form.from_status} onChange={e => onFormChange({ from_status: e.target.value })} className={inputCls}>
            <option value="">Seleccionar estatus…</option>
            {sourceStatuses.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo de trámite hijo *</label>
          <select value={form.target_tipo_id} onChange={e => onTargetTipoChange(e.target.value)} className={inputCls}>
            <option value="">Seleccionar tipo…</option>
            {allTipos.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Estatus inicial del trámite hijo *</label>
          {form.target_tipo_id && targetStatuses.length === 0 ? (
            <p className="text-xs text-neutral-400 italic mt-2">El tipo hijo no tiene campo Estatus.</p>
          ) : (
            <select value={form.initial_status} onChange={e => onFormChange({ initial_status: e.target.value })} className={inputCls} disabled={!form.target_tipo_id}>
              <option value="">Seleccionar estatus…</option>
              {targetStatuses.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prioridad del trámite hijo</label>
          <select value={form.prioridad_hijo} onChange={e => onFormChange({ prioridad_hijo: e.target.value as TriggerFormState['prioridad_hijo'] })} className={inputCls}>
            {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.requiere_confirmacion} onChange={e => onFormChange({ requiere_confirmacion: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-xs font-medium text-neutral-700">Requiere confirmación del usuario</span>
          </label>
          <p className="text-[10px] text-neutral-400 ml-6 mt-0.5">Si está activo, el usuario verá un aviso antes de crear el trámite hijo.</p>
        </div>
      </div>
      <div>
        <label className={labelCls}>Folio del trámite hijo</label>
        <select value={form.folio_mode} onChange={e => onFormChange({ folio_mode: e.target.value as TriggerFormState['folio_mode'] })} className={inputCls}>
          <option value="nuevo">Folio nuevo (normal)</option>
          <option value="heredar_incisos">Folio del padre + inciso (ej. TK09672-A)</option>
        </select>
      </div>
      {adjuntoCats.length > 0 && (
        <div>
          <label className={labelCls}>Adjuntos que se copian al hijo</label>
          <div className="flex flex-wrap gap-2">
            {adjuntoCats.map(cat => {
              const checked = form.adjunto_categorias_ids.includes(cat.id);
              return (
                <button key={cat.id} type="button" onClick={() => onToggleAdjunto(cat.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400'}`}>
                  {cat.nombre}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Selecciona las categorías de adjuntos a copiar al hijo. Sin selección = ninguno.</p>
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={form.activo} onChange={e => onFormChange({ activo: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
        <span className="text-xs font-medium text-neutral-700">Trigger activo</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
          <Save className="w-3.5 h-3.5" />{saving ? 'Guardando…' : (editingId ? 'Guardar cambios' : 'Crear trigger')}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm">Cancelar</button>
      </div>
    </div>
  );
}

// ── TriggerRow ────────────────────────────────────────────────────────────────

interface TriggerRowProps {
  trigger: StatusTrigger; expanded: boolean;
  sourceCampos: TipoCampo[]; targetCampos: TipoCampo[];
  initialMappings: FieldMapping[] | null; saving: boolean;
  grupos: Grupo[];
  onToggleExpand: () => void; onEdit: () => void;
  onDelete: () => void; onToggleActivo: () => void;
  onSaveMappings: (rows: FieldMapping[]) => void;
}

function TriggerRow({ trigger, expanded, sourceCampos, targetCampos, initialMappings, saving, grupos, onToggleExpand, onEdit, onDelete, onToggleActivo, onSaveMappings }: TriggerRowProps) {
  const color = trigger.target_tipo?.color ?? '#64748b';

  // Local mapping state: keyed by target_campo_id (or _key for sistema targets)
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>([]);

  // Sync from parent when initial data arrives
  useEffect(() => {
    if (initialMappings !== null) setLocalMappings(initialMappings);
  }, [initialMappings]);

  const findByCampoId = (campoId: string) => localMappings.find(m => m.target_campo_id === campoId) ?? null;

  const handleCampoSet = (targetCampoId: string, patch: Partial<FieldMapping> | null) => {
    setLocalMappings(prev => {
      const existing = prev.find(m => m.target_campo_id === targetCampoId);
      if (patch === null) return prev.filter(m => m.target_campo_id !== targetCampoId);
      if (existing) return prev.map(m => m.target_campo_id === targetCampoId ? { ...m, ...patch } : m);
      return [...prev, { _key: mkKey(), trigger_id: trigger.id, source_campo_id: null, source_sistema_key: null, target_campo_id: targetCampoId, target_sistema_key: null, valor_fijo: null, orden: prev.length, ...patch }];
    });
  };

  const autoDetect = () => {
    const newMappings: FieldMapping[] = [];
    for (const tgt of targetCampos) {
      if (tgt.tipo === 'estatus') continue; // handled separately
      const match = sourceCampos.find(src =>
        src.tipo === tgt.tipo && (src.label.toLowerCase() === tgt.label.toLowerCase() || src.sistema_key === tgt.sistema_key)
      );
      if (match) {
        const existing = localMappings.find(m => m.target_campo_id === tgt.id);
        if (!existing) {
          newMappings.push({ _key: mkKey(), trigger_id: trigger.id, source_campo_id: match.id, source_sistema_key: null, target_campo_id: tgt.id, target_sistema_key: null, valor_fijo: null, orden: localMappings.length + newMappings.length });
        }
      }
    }
    if (newMappings.length > 0) setLocalMappings(prev => [...prev, ...newMappings]);
  };

  const configuredCount = localMappings.filter(m => m.target_campo_id).length;
  const totalCampos = targetCampos.filter(c => c.tipo !== 'estatus').length;

  return (
    <div className={!trigger.activo ? 'opacity-60' : ''}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors">
        <button onClick={onToggleExpand} className="shrink-0 text-neutral-400 hover:text-neutral-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Zap className="w-4 h-4 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-800">{trigger.nombre}</span>
            {!trigger.activo && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">Inactivo</span>}
            {configuredCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                {configuredCount}/{totalCampos} campos mapeados
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">{trigger.from_status}</span>
            <ArrowRight className="w-3 h-3 text-neutral-300" />
            <span className="text-[11px] font-medium" style={{ color }}>{trigger.target_tipo?.label ?? trigger.target_tipo_id}</span>
            <span className="text-[11px] text-neutral-400">({trigger.initial_status})</span>
            {trigger.requiere_confirmacion && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">con confirmación</span>}
            {trigger.folio_mode === 'heredar_incisos' && <span className="text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-mono">folio-A/B/C…</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggleActivo} className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${trigger.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
            {trigger.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onEdit} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Mappings panel */}
      {expanded && (
        <div className="mx-5 mb-4 border border-neutral-200 rounded-xl overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
            <div>
              <p className="text-xs font-semibold text-neutral-700">
                Campos del trámite hijo
                {trigger.target_tipo?.label && <span className="font-normal text-neutral-400 ml-1">— {trigger.target_tipo.label}</span>}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Para cada campo del hijo, elige qué copiar del trámite padre.
              </p>
            </div>
            {totalCampos > 0 && (
              <button
                onClick={autoDetect}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                title="Detecta y sugiere automáticamente campos con el mismo nombre y tipo"
              >
                <Wand2 className="w-3 h-3" />
                Auto-detectar
              </button>
            )}
          </div>

          {initialMappings === null ? (
            <p className="px-4 py-3 text-xs text-neutral-400">Cargando…</p>
          ) : targetCampos.filter(c => c.tipo !== 'estatus').length === 0 ? (
            <p className="px-4 py-3 text-xs text-neutral-400 italic">
              El tipo hijo no tiene campos configurados aún.
            </p>
          ) : (
            <>
              <div className="divide-y divide-neutral-100">
                {targetCampos
                  .filter(c => c.tipo !== 'estatus')
                  .map(campo => (
                    <CampoMappingRow
                      key={campo.id}
                      campo={campo}
                      mapping={findByCampoId(campo.id)}
                      sourceCampos={sourceCampos}
                      grupos={grupos}
                      onSet={(patch) => handleCampoSet(campo.id, patch)}
                    />
                  ))}
              </div>

              {/* Footer: save */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
                <p className="text-[10px] text-neutral-400">
                  {configuredCount === 0
                    ? 'Sin mapeos — los campos quedarán en blanco al crear el hijo.'
                    : `${configuredCount} de ${totalCampos} campo${totalCampos !== 1 ? 's' : ''} con origen configurado.`}
                </p>
                <button
                  onClick={() => onSaveMappings(localMappings)}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Guardando…' : 'Guardar mapeos'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── CampoMappingRow ───────────────────────────────────────────────────────────
// Shows one target campo with a source selector on the right.

interface CampoMappingRowProps {
  campo: TipoCampo;
  mapping: FieldMapping | null;
  sourceCampos: TipoCampo[];
  grupos: Grupo[];
  onSet: (patch: Partial<FieldMapping> | null) => void;
}

function CampoMappingRow({ campo, mapping, sourceCampos, grupos, onSet }: CampoMappingRowProps) {
  // Hooks first — before any conditional returns
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSource = !mapping ? ''
    : mapping.valor_fijo !== null ? 'fijo'
    : mapping.source_sistema_key ? `s:${mapping.source_sistema_key}`
    : mapping.source_campo_id ? `c:${mapping.source_campo_id}`
    : '';

  const isFijo = currentSource === 'fijo';
  const hasMapping = currentSource !== '';
  const isTextoCampo = (campo.tipo === 'texto_largo' || campo.tipo === 'texto_corto') && !campo.sistema_key;
  const [usePlantilla, setUsePlantilla] = useState(
    isFijo && isTextoCampo && (mapping?.valor_fijo?.includes('{') ?? false)
  );

  // fecha_creacion: auto-set, no mapping needed
  if (campo.sistema_key === 'fecha_creacion') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50/50">
        <div className="w-44 shrink-0">
          <p className="text-xs font-medium truncate text-neutral-700">{campo.label}</p>
          <p className="text-[10px] text-neutral-400">{campo.tipo}</p>
        </div>
        <span className="text-neutral-300 text-xs shrink-0">←</span>
        <span className="text-xs px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          Auto — se registra al crear el trámite
        </span>
      </div>
    );
  }

  // archivos_adjuntos: handled by trigger config
  if (campo.sistema_key === 'archivos_adjuntos') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50/50">
        <div className="w-44 shrink-0">
          <p className="text-xs font-medium truncate text-neutral-700">{campo.label}</p>
          <p className="text-[10px] text-neutral-400">{campo.tipo}</p>
        </div>
        <span className="text-neutral-300 text-xs shrink-0">←</span>
        <span className="text-xs px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
          Categorías configuradas en el trigger
        </span>
      </div>
    );
  }

  // equipo: multi-select team toggle buttons
  if (campo.tipo === 'equipo') {
    const selectedIds: string[] = (() => {
      try { return JSON.parse(mapping?.valor_fijo ?? '[]'); } catch { return []; }
    })();
    const toggleTeam = (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id];
      if (next.length === 0) { onSet(null); return; }
      onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: JSON.stringify(next) });
    };
    return (
      <div className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${selectedIds.length > 0 ? 'bg-blue-50/40' : 'hover:bg-neutral-50/50'}`}>
        <div className="w-44 shrink-0 pt-0.5">
          <p className={`text-xs font-medium truncate ${selectedIds.length > 0 ? 'text-blue-700' : 'text-neutral-700'}`}>{campo.label}</p>
          <p className="text-[10px] text-neutral-400">{campo.tipo}</p>
        </div>
        <span className="text-neutral-300 text-xs shrink-0 pt-1">←</span>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {grupos.length === 0
            ? <span className="text-xs text-neutral-400 italic">Sin equipos configurados</span>
            : grupos.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleTeam(g.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedIds.includes(g.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400'}`}
              >
                {g.nombre}
              </button>
            ))}
        </div>
      </div>
    );
  }

  const handleChange = (val: string) => {
    setUsePlantilla(false);
    if (!val) { onSet(null); return; }
    if (val === 'fijo') { onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: '' }); return; }
    if (val === 'plantilla') { setUsePlantilla(true); onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: '' }); return; }
    if (val.startsWith('c:')) { onSet({ source_campo_id: val.slice(2), source_sistema_key: null, valor_fijo: null }); return; }
    if (val.startsWith('s:')) { onSet({ source_campo_id: null, source_sistema_key: val.slice(2), valor_fijo: null }); return; }
  };

  const insertChip = (label: string) => {
    const token = `{${label}}`;
    const current = mapping?.valor_fijo ?? '';
    if (!textareaRef.current) {
      onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: current + token });
      return;
    }
    const ta = textareaRef.current;
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? start;
    onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: current.slice(0, start) + token + current.slice(end) });
  };

  const compatible = sourceCampos.filter(c => c.tipo === campo.tipo);
  const selectDisplayValue = usePlantilla ? 'plantilla' : currentSource;

  return (
    <div className={`flex ${usePlantilla ? 'items-start' : 'items-center'} gap-3 px-4 py-2.5 transition-colors ${hasMapping ? 'bg-blue-50/40' : 'hover:bg-neutral-50/50'}`}>
      {/* Target campo label */}
      <div className="w-44 shrink-0">
        <p className={`text-xs font-medium truncate ${hasMapping ? 'text-blue-700' : 'text-neutral-700'}`}>{campo.label}</p>
        <p className="text-[10px] text-neutral-400">{campo.tipo}</p>
      </div>

      {/* Arrow */}
      <span className="text-neutral-300 text-xs shrink-0">←</span>

      {/* Source picker */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <select
            value={selectDisplayValue}
            onChange={e => handleChange(e.target.value)}
            className={`flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-xs bg-white focus:ring-1 focus:outline-none transition-colors ${hasMapping ? 'border-blue-300 focus:ring-blue-400' : 'border-neutral-200 focus:ring-blue-400'}`}
          >
            <option value="">— No copiar</option>
            {compatible.length > 0 && (
              <optgroup label={`Campos del padre (${campo.tipo})`}>
                {compatible.map(c => <option key={c.id} value={`c:${c.id}`}>{c.label}</option>)}
              </optgroup>
            )}
            {sourceCampos.filter(c => c.tipo !== campo.tipo).length > 0 && (
              <optgroup label="Otros campos del padre">
                {sourceCampos.filter(c => c.tipo !== campo.tipo).map(c => <option key={c.id} value={`c:${c.id}`}>{c.label} ({c.tipo})</option>)}
              </optgroup>
            )}
            <optgroup label="Del sistema">
              {SISTEMA_KEYS.map(s => <option key={s.value} value={`s:${s.value}`}>{s.label}</option>)}
            </optgroup>
            <option value="fijo">✏ Valor fijo…</option>
            {isTextoCampo && <option value="plantilla">✏ Plantilla con variables…</option>}
          </select>

          {isFijo && !usePlantilla && (
            <input
              type="text"
              value={mapping?.valor_fijo ?? ''}
              onChange={e => onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: e.target.value })}
              placeholder="Escribe el valor…"
              className="w-36 shrink-0 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
            />
          )}
        </div>

        {usePlantilla && (
          <div className="mt-1.5 space-y-1.5">
            <textarea
              ref={textareaRef}
              rows={3}
              value={mapping?.valor_fijo ?? ''}
              onChange={e => onSet({ source_campo_id: null, source_sistema_key: null, valor_fijo: e.target.value })}
              placeholder="Ej: El cliente {Nombre} tiene póliza {Número de Póliza}"
              className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {sourceCampos.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => insertChip(c.label)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 transition-colors"
                >
                  {`{${c.label}}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
