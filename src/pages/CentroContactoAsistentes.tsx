import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Pencil, Trash2, Globe, Lock, ChevronDown, ChevronUp, Save, X, Loader2, Search, RefreshCw, Settings, Sparkles, CheckCircle2, ClipboardList, ArrowLeft, AlertCircle, Building2, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: 'manual' | 'form';
  quote_form_template_id: string | null;
  office_id: string | null;
  office_name?: string;
  is_active: boolean;
  is_global: boolean;
  system_prompt: string;
  model: string;
  language: string;
  welcome_message: string;
  consent_message: string;
  completion_message: string;
  transfer_message: string;
  auto_create_tramite: boolean;
  tramite_tipo: string;
  tramite_prioridad: string;
  total_sessions: number;
  completed_sessions: number;
  transferred_sessions: number;
  created_at: string;
}

interface CcField {
  id: string;
  assistant_id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options: unknown[];
  capture_order: number;
  prompt_text: string;
}

interface QuoteTemplate {
  id: string;
  title: string;
  form_type: string;
  category: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Correo' },
  { value: 'select', label: 'Selección' },
  { value: 'file', label: 'Archivo' },
  { value: 'boolean', label: 'Sí/No' },
];

const TRAMITE_TYPES = [
  { value: 'formulario_cotizacion', label: 'Cotización' },
  { value: 'cotizacion_emision', label: 'Cotización/Emisión' },
  { value: 'renovaciones', label: 'Renovaciones' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'otros_comercial', label: 'Otros' },
];

const BLANK_ASSISTANT: Omit<CcAssistant, 'id' | 'office_name' | 'total_sessions' | 'completed_sessions' | 'transferred_sessions' | 'created_at'> = {
  nombre: '',
  descripcion: '',
  source: 'manual',
  quote_form_template_id: null,
  office_id: null,
  is_active: true,
  is_global: false,
  system_prompt: '',
  model: 'gpt-4o-mini',
  language: 'es',
  welcome_message: 'Hola, soy el asistente virtual. Estoy aquí para ayudarte con tu solicitud. ¿Podemos comenzar?',
  consent_message: 'Para continuar, necesito tu consentimiento para procesar los datos de tu solicitud. ¿Aceptas? (Si/No)',
  completion_message: '¡Gracias! Tu solicitud ha sido registrada. Un agente te contactará pronto.',
  transfer_message: 'Te transferiré con un agente que podrá ayudarte de manera personalizada. ¡Gracias!',
  auto_create_tramite: true,
  tramite_tipo: 'formulario_cotizacion',
  tramite_prioridad: 'Media',
};

export default function CentroContactoAsistentes() {
  const { usuario } = useAuth();
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<CcAssistant | null>(null);
  const [fields, setFields] = useState<CcField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editForm, setEditForm] = useState<typeof BLANK_ASSISTANT>(BLANK_ASSISTANT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'fields' | 'messages'>('info');
  const [editingField, setEditingField] = useState<Partial<CcField> | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [importingFromForm, setImportingFromForm] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canEdit = isAdmin || isGerente;

  const loadAssistants = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('contact_center_assistants')
      .select(`
        *,
        oficinas(nombre)
      `)
      .order('nombre');

    const { data } = await query;
    if (data) {
      setAssistants(data.map(a => ({
        ...a,
        office_name: (a.oficinas as { nombre?: string } | null)?.nombre || null,
      })));
    }
    setLoading(false);
  }, []);

  const loadFields = useCallback(async (assistantId: string) => {
    setLoadingFields(true);
    const { data } = await supabase
      .from('contact_center_assistant_fields')
      .select('*')
      .eq('assistant_id', assistantId)
      .order('capture_order');
    setFields((data || []) as CcField[]);
    setLoadingFields(false);
  }, []);

  useEffect(() => {
    loadAssistants();
    supabase.from('oficinas').select('id, nombre').order('nombre').then(({ data }) => {
      if (data) setOficinas(data);
    });
    supabase.from('quote_form_templates').select('id, title, form_type, category').eq('is_active', true).order('title').then(({ data }) => {
      if (data) setQuoteTemplates(data as QuoteTemplate[]);
    });
  }, [loadAssistants]);

  useEffect(() => {
    if (selectedAssistant) loadFields(selectedAssistant.id);
  }, [selectedAssistant, loadFields]);

  const handleNew = () => {
    setEditForm({ ...BLANK_ASSISTANT });
    setEditingId(null);
    setShowForm(true);
    setActiveSection('info');
    setSelectedAssistant(null);
  };

  const handleEdit = (a: CcAssistant) => {
    setEditForm({
      nombre: a.nombre,
      descripcion: a.descripcion,
      source: a.source,
      quote_form_template_id: a.quote_form_template_id,
      office_id: a.office_id,
      is_active: a.is_active,
      is_global: a.is_global,
      system_prompt: a.system_prompt,
      model: a.model,
      language: a.language,
      welcome_message: a.welcome_message,
      consent_message: a.consent_message,
      completion_message: a.completion_message,
      transfer_message: a.transfer_message,
      auto_create_tramite: a.auto_create_tramite,
      tramite_tipo: a.tramite_tipo,
      tramite_prioridad: a.tramite_prioridad,
    });
    setEditingId(a.id);
    setShowForm(true);
    setSelectedAssistant(a);
    setActiveSection('info');
  };

  const handleSave = async () => {
    if (!editForm.nombre.trim()) return;
    setSaving(true);

    const payload = {
      nombre: editForm.nombre.trim(),
      descripcion: editForm.descripcion,
      source: editForm.source,
      quote_form_template_id: editForm.quote_form_template_id || null,
      office_id: editForm.office_id || null,
      is_active: editForm.is_active,
      is_global: editForm.is_global,
      system_prompt: editForm.system_prompt,
      model: editForm.model,
      language: editForm.language,
      welcome_message: editForm.welcome_message,
      consent_message: editForm.consent_message,
      completion_message: editForm.completion_message,
      transfer_message: editForm.transfer_message,
      auto_create_tramite: editForm.auto_create_tramite,
      tramite_tipo: editForm.tramite_tipo,
      tramite_prioridad: editForm.tramite_prioridad,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('contact_center_assistants')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (!error && data) {
        setSelectedAssistant({ ...data, office_name: oficinas.find(o => o.id === data.office_id)?.nombre });
        setShowForm(false);
        loadAssistants();
      } else {
        alert(error?.message || 'Error al guardar');
      }
    } else {
      const { data, error } = await supabase
        .from('contact_center_assistants')
        .insert({ ...payload, created_by: usuario?.id })
        .select()
        .single();
      if (!error && data) {
        setSelectedAssistant({ ...data, office_name: oficinas.find(o => o.id === data.office_id)?.nombre });
        setEditingId(data.id);
        setShowForm(false);
        loadAssistants();
      } else {
        alert(error?.message || 'Error al crear');
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este asistente? Esta acción no se puede deshacer.')) return;
    await supabase.from('contact_center_assistants').delete().eq('id', id);
    if (selectedAssistant?.id === id) setSelectedAssistant(null);
    loadAssistants();
  };

  const handleToggleActive = async (a: CcAssistant) => {
    await supabase.from('contact_center_assistants').update({ is_active: !a.is_active }).eq('id', a.id);
    loadAssistants();
    if (selectedAssistant?.id === a.id) setSelectedAssistant(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
  };

  // Import fields from quote form template
  const handleImportFromForm = async () => {
    if (!selectedAssistant || !editForm.quote_form_template_id) return;
    setImportingFromForm(true);
    try {
      const { data: tpl } = await supabase
        .from('quote_form_templates')
        .select('schema_json')
        .eq('id', editForm.quote_form_template_id)
        .maybeSingle();

      if (tpl?.schema_json) {
        const schema = tpl.schema_json as Record<string, unknown>;
        const steps = (schema.steps || []) as Array<{ fields?: Array<{ key: string; label: string; type?: string; required?: boolean }> }>;
        let order = fields.length;

        for (const step of steps) {
          for (const f of (step.fields || [])) {
            const existing = fields.find(ef => ef.field_key === f.key);
            if (!existing) {
              await supabase.from('contact_center_assistant_fields').insert({
                assistant_id: selectedAssistant.id,
                field_key: f.key,
                label: f.label || f.key,
                field_type: f.type || 'text',
                is_required: f.required !== false,
                capture_order: order++,
                prompt_text: `Por favor, proporciona ${f.label || f.key}:`,
              });
            }
          }
        }
        await loadFields(selectedAssistant.id);
      }
    } catch (err) {
      alert('Error al importar campos: ' + String(err));
    }
    setImportingFromForm(false);
  };

  // Field CRUD
  const handleSaveField = async () => {
    if (!selectedAssistant || !editingField?.field_key || !editingField?.label) return;
    setSavingField(true);

    const payload = {
      assistant_id: selectedAssistant.id,
      field_key: editingField.field_key,
      label: editingField.label,
      field_type: editingField.field_type || 'text',
      is_required: editingField.is_required !== false,
      options: editingField.options || [],
      capture_order: editingField.capture_order ?? fields.length,
      prompt_text: editingField.prompt_text || `Por favor, proporciona ${editingField.label}:`,
    };

    if (editingField.id) {
      await supabase.from('contact_center_assistant_fields').update(payload).eq('id', editingField.id);
    } else {
      await supabase.from('contact_center_assistant_fields').insert(payload);
    }
    setEditingField(null);
    await loadFields(selectedAssistant.id);
    setSavingField(false);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('¿Eliminar este campo?')) return;
    await supabase.from('contact_center_assistant_fields').delete().eq('id', fieldId);
    if (selectedAssistant) loadFields(selectedAssistant.id);
  };

  const filtered = assistants.filter(a =>
    !search || a.nombre.toLowerCase().includes(search.toLowerCase()) || a.descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Asistentes Automáticos</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Centro de Contacto — Modo Automático</p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo asistente
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar asistente..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {assistants.length === 0 ? 'Sin asistentes aún' : 'Sin resultados'}
                </p>
                {assistants.length === 0 && canEdit && (
                  <button onClick={handleNew} className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    Crear el primer asistente
                  </button>
                )}
              </div>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAssistant(a); setShowForm(false); }}
                  className={`w-full text-left p-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    selectedAssistant?.id === a.id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.source === 'form' && <ClipboardList className="w-3 h-3 text-blue-400" title="Basado en formulario" />}
                      {a.is_global ? <Globe className="w-3 h-3 text-gray-400" title="Global" /> : <Lock className="w-3 h-3 text-gray-400" title="Por oficina" />}
                    </div>
                  </div>
                  {a.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 pl-4">{a.descripcion}</p>}
                  <div className="flex items-center gap-3 mt-1.5 pl-4">
                    <span className="text-[10px] text-gray-400">{a.total_sessions || 0} sesiones</span>
                    {a.office_name && <span className="text-[10px] text-gray-400 truncate">{a.office_name}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAssistant && !showForm ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">Asistentes Automáticos</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Configura asistentes de IA para gestionar conversaciones de WhatsApp, capturar datos de cotización y crear trámites automáticamente.
              </p>
              {canEdit && (
                <button onClick={handleNew} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Crear asistente
                </button>
              )}
            </div>
          ) : showForm ? (
            <AssistantForm
              form={editForm}
              isEditing={!!editingId}
              oficinas={oficinas}
              quoteTemplates={quoteTemplates}
              saving={saving}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              onChange={(field, value) => setEditForm(prev => ({ ...prev, [field]: value }))}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); if (!editingId) setSelectedAssistant(null); }}
            />
          ) : selectedAssistant ? (
            <AssistantDetail
              assistant={selectedAssistant}
              fields={fields}
              loadingFields={loadingFields}
              editingField={editingField}
              savingField={savingField}
              importingFromForm={importingFromForm}
              canEdit={canEdit}
              onEdit={() => handleEdit(selectedAssistant)}
              onDelete={() => handleDelete(selectedAssistant.id)}
              onToggleActive={() => handleToggleActive(selectedAssistant)}
              onAddField={() => setEditingField({ assistant_id: selectedAssistant.id, capture_order: fields.length, is_required: true, field_type: 'text' })}
              onEditField={(f) => setEditingField(f)}
              onDeleteField={handleDeleteField}
              onSaveField={handleSaveField}
              onCancelField={() => setEditingField(null)}
              onImportFromForm={handleImportFromForm}
              setEditingField={setEditingField}
              hasFormTemplate={!!selectedAssistant.quote_form_template_id}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Assistant Form
// ============================================================

function AssistantForm({ form, isEditing, oficinas, quoteTemplates, saving, activeSection, setActiveSection, onChange, onSave, onCancel }: {
  form: typeof BLANK_ASSISTANT;
  isEditing: boolean;
  oficinas: Oficina[];
  quoteTemplates: QuoteTemplate[];
  saving: boolean;
  activeSection: 'info' | 'fields' | 'messages';
  setActiveSection: (s: 'info' | 'fields' | 'messages') => void;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const sections = [
    { key: 'info' as const, label: 'Configuración general' },
    { key: 'messages' as const, label: 'Mensajes' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Editar asistente' : 'Nuevo asistente'}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              activeSection === s.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'info' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Nombre del asistente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => onChange('nombre', e.target.value)}
                placeholder="Ej: Asistente GMM, Cotizador de Autos..."
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => onChange('descripcion', e.target.value)}
                placeholder="Breve descripción del propósito de este asistente..."
                rows={2}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo</label>
              <select value={form.source} onChange={e => onChange('source', e.target.value)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                <option value="manual">Manual</option>
                <option value="form">Basado en formulario</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Modelo IA</label>
              <select value={form.model} onChange={e => onChange('model', e.target.value)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                <option value="gpt-4o-mini">GPT-4o mini (rápido)</option>
                <option value="gpt-4o">GPT-4o (preciso)</option>
              </select>
            </div>

            {form.source === 'form' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Formulario de cotización</label>
                <select value={form.quote_form_template_id || ''} onChange={e => onChange('quote_form_template_id', e.target.value || null)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                  <option value="">— Seleccionar formulario —</option>
                  {quoteTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Oficina</label>
              <select value={form.office_id || ''} onChange={e => onChange('office_id', e.target.value || null)} className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white" disabled={form.is_global}>
                <option value="">— Seleccionar —</option>
                {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>

            <div className="flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_global} onChange={e => { onChange('is_global', e.target.checked); if (e.target.checked) onChange('office_id', null); }} className="w-4 h-4 rounded border-gray-300 text-emerald-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Global</span>
              </label>
            </div>
          </div>

          {/* Tramite config */}
          <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">Creación automática de trámite</span>
              <label className="ml-auto flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_create_tramite} onChange={e => onChange('auto_create_tramite', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-teal-600" />
                <span className="text-xs text-teal-700 dark:text-teal-400">Activado</span>
              </label>
            </div>
            {form.auto_create_tramite && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tipo de trámite</label>
                  <select value={form.tramite_tipo} onChange={e => onChange('tramite_tipo', e.target.value)} className="w-full text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-800 px-3 py-1.5">
                    {TRAMITE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Prioridad</label>
                  <select value={form.tramite_prioridad} onChange={e => onChange('tramite_prioridad', e.target.value)} className="w-full text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-800 px-3 py-1.5">
                    <option>Alta</option><option>Media</option><option>Baja</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Instrucciones del sistema (opcional)
            </label>
            <textarea
              value={form.system_prompt}
              onChange={e => onChange('system_prompt', e.target.value)}
              placeholder="Instrucciones adicionales para la IA. Ej: Eres un asistente de seguros de gastos médicos. Sé amable y conciso."
              rows={3}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {activeSection === 'messages' && (
        <div className="space-y-4">
          {[
            { key: 'welcome_message', label: 'Mensaje de bienvenida', hint: 'Primer mensaje que recibe el contacto' },
            { key: 'consent_message', label: 'Solicitud de consentimiento', hint: 'Se envía antes de capturar datos' },
            { key: 'completion_message', label: 'Mensaje de finalización', hint: 'Al completar todos los campos' },
            { key: 'transfer_message', label: 'Mensaje de transferencia', hint: 'Al pasar a agente humano' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">{label}</label>
              <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>
              <textarea
                value={(form as Record<string, unknown>)[key] as string}
                onChange={e => onChange(key, e.target.value)}
                rows={3}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.nombre.trim()}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Guardar cambios' : 'Crear asistente'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Assistant Detail
// ============================================================

function AssistantDetail({ assistant, fields, loadingFields, editingField, savingField, importingFromForm, canEdit, onEdit, onDelete, onToggleActive, onAddField, onEditField, onDeleteField, onSaveField, onCancelField, onImportFromForm, setEditingField, hasFormTemplate }: {
  assistant: CcAssistant;
  fields: CcField[];
  loadingFields: boolean;
  editingField: Partial<CcField> | null;
  savingField: boolean;
  importingFromForm: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddField: () => void;
  onEditField: (f: CcField) => void;
  onDeleteField: (id: string) => void;
  onSaveField: () => void;
  onCancelField: () => void;
  onImportFromForm: () => void;
  setEditingField: (f: Partial<CcField> | null) => void;
  hasFormTemplate: boolean;
}) {
  const completionRate = assistant.total_sessions > 0
    ? Math.round((assistant.completed_sessions / assistant.total_sessions) * 100)
    : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${assistant.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Bot className={`w-6 h-6 ${assistant.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{assistant.nombre}</h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${assistant.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                {assistant.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {assistant.source === 'form' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Formulario
                </span>
              )}
            </div>
            {assistant.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{assistant.descripcion}</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={onToggleActive} className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${assistant.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'}`}>
              {assistant.is_active ? 'Desactivar' : 'Activar'}
            </button>
            <button onClick={onEdit} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sesiones', value: assistant.total_sessions || 0, icon: MessageCircle, color: 'text-teal-600' },
          { label: 'Completadas', value: assistant.completed_sessions || 0, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Transferidas', value: assistant.transferred_sessions || 0, icon: AlertCircle, color: 'text-amber-600' },
        ].map(m => (
          <div key={m.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <m.icon className={`w-5 h-5 mx-auto mb-1.5 ${m.color}`} />
            <p className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>
      {assistant.total_sessions > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Tasa de finalización</span>
            <span className="text-xs font-bold text-emerald-600">{completionRate}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      )}

      {/* Info row */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Modelo</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5">{assistant.model}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Alcance</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5 flex items-center gap-1">
            {assistant.is_global ? <><Globe className="w-3 h-3 text-blue-500" /> Global</> : <><Lock className="w-3 h-3 text-gray-400" /> {assistant.office_name || 'Por oficina'}</>}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Trámite automático</p>
          <p className={`font-medium mt-0.5 ${assistant.auto_create_tramite ? 'text-emerald-600' : 'text-gray-500'}`}>
            {assistant.auto_create_tramite ? `Sí — ${TRAMITE_TYPES.find(t => t.value === assistant.tramite_tipo)?.label || assistant.tramite_tipo}` : 'No'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase text-[10px]">Creado</p>
          <p className="text-gray-800 dark:text-gray-200 font-medium mt-0.5">
            {new Date(assistant.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-600" />
            Campos a capturar ({fields.length})
          </h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              {hasFormTemplate && (
                <button
                  onClick={onImportFromForm}
                  disabled={importingFromForm}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  {importingFromForm ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Importar del formulario
                </button>
              )}
              <button
                onClick={onAddField}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors border border-teal-200 dark:border-teal-800"
              >
                <Plus className="w-3 h-3" /> Agregar campo
              </button>
            </div>
          )}
        </div>

        {loadingFields ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
        ) : fields.length === 0 && !editingField ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <p>Sin campos configurados.</p>
            {canEdit && hasFormTemplate && (
              <button onClick={onImportFromForm} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
                <Sparkles className="w-3 h-3" /> Importar del formulario vinculado
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {fields.map((f, idx) => (
              editingField?.id === f.id ? (
                <FieldForm key={f.id} field={editingField} onChange={v => setEditingField(v)} onSave={onSaveField} onCancel={onCancelField} saving={savingField} />
              ) : (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                  <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</span>
                      {f.is_required && <span className="text-[10px] text-red-500">*</span>}
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</span>
                    </div>
                    {f.prompt_text && <p className="text-[11px] text-gray-400 truncate mt-0.5">{f.prompt_text}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditField(f)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeleteField(f.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
            {editingField && !editingField.id && (
              <FieldForm field={editingField} onChange={v => setEditingField(v)} onSave={onSaveField} onCancel={onCancelField} saving={savingField} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Field Form (inline)
// ============================================================

function FieldForm({ field, onChange, onSave, onCancel, saving }: {
  field: Partial<CcField>;
  onChange: (f: Partial<CcField>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="px-4 py-4 bg-teal-50 dark:bg-teal-900/10 border-b border-teal-100 dark:border-teal-900 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Clave única</label>
          <input
            type="text"
            value={field.field_key || ''}
            onChange={e => onChange({ ...field, field_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="nombre_completo"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Etiqueta</label>
          <input
            type="text"
            value={field.label || ''}
            onChange={e => onChange({ ...field, label: e.target.value })}
            placeholder="Nombre completo"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Tipo</label>
          <select value={field.field_type || 'text'} onChange={e => onChange({ ...field, field_type: e.target.value })} className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white">
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={field.is_required !== false} onChange={e => onChange({ ...field, is_required: e.target.checked })} className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Obligatorio</span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Pregunta al contacto</label>
          <input
            type="text"
            value={field.prompt_text || ''}
            onChange={e => onChange({ ...field, prompt_text: e.target.value })}
            placeholder="Por favor, proporciona tu nombre completo:"
            className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving || !field.field_key || !field.label}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
