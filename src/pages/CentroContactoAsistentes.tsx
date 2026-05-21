import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Plus, Pencil, Trash2, Globe, Lock, Save, X, Loader2, Search,
  RefreshCw, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Brain,
  Settings, RotateCcw, History, Archive, Filter, Tag, Activity,
  MessageSquare, List, BarChart2, AlertTriangle, Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: 'manual' | 'form';
  generation_origin: string;
  generated_from_form: boolean;
  deprecated_at: string | null;
  deprecated_reason: string | null;
  quote_form_template_id: string | null;
  form_title: string | null;
  form_type_cache: string | null;
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
  last_synced_at: string | null;
  field_count: number;
  has_documents: boolean;
  created_at: string;
}

interface CcField {
  id: string;
  assistant_id: string;
  field_key: string;
  label: string;
  field_type: string;
  priority: 'required' | 'recommended' | 'optional';
  is_required: boolean;
  options: unknown[];
  capture_order: number;
  prompt_text: string;
  example_value: string | null;
  synonyms: string[] | null;
  is_document: boolean;
  document_label: string | null;
  accepted_formats: string[];
  confirmation_message: string | null;
  is_synced_from_form: boolean;
  manually_edited: boolean;
  validation_hint: string | null;
}

type FilterTab = 'all' | 'form' | 'manual' | 'active' | 'inactive' | 'deprecated';
type SortKey = 'nombre' | 'created_at' | 'total_sessions';
type DetailTab = 'config' | 'fields' | 'messages' | 'stats';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium', color)}>
      <span className="font-bold">{value}</span>
      {label}
    </span>
  );
}

function Badge({ label, variant }: { label: string; variant: 'blue' | 'neutral' | 'amber' | 'green' | 'red' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    neutral: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    green: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-[11px] font-semibold', styles[variant])}>
      {label}
    </span>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = pct(value, total);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{value} <span className="text-gray-400">({p}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function PriorityGroup({ priority, fields }: { priority: CcField['priority']; fields: CcField[] }) {
  const labels = { required: 'Requeridos', recommended: 'Recomendados', optional: 'Opcionales' };
  const colors = {
    required: 'text-red-600 bg-red-50 border-red-100',
    recommended: 'text-blue-600 bg-blue-50 border-blue-100',
    optional: 'text-gray-500 bg-gray-50 border-gray-100',
  };
  if (!fields.length) return null;
  return (
    <div className="mb-4">
      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold mb-2 border', colors[priority])}>
        {labels[priority]} ({fields.length})
      </div>
      <div className="space-y-2">
        {fields.map(f => (
          <div key={f.id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800">{f.label}</span>
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{f.field_key}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">{f.field_type}</span>
                </div>
                {f.prompt_text && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{f.prompt_text}</p>
                )}
                {f.synonyms && f.synonyms.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {f.synonyms.map((s, i) => (
                      <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">#{f.capture_order}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generate Modal ───────────────────────────────────────────────────────────

function GenerateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; existed: number } | null>(null);
  const [templateCount, setTemplateCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('quote_form_templates')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => setTemplateCount(count ?? 0));
  }, []);

  async function handleConfirm() {
    setLoading(true);
    try {
      const { data: templates } = await supabase
        .from('quote_form_templates')
        .select('id, title, form_type, category')
        .eq('is_active', true);

      if (!templates) { setLoading(false); return; }

      const { data: existing } = await supabase
        .from('contact_center_assistants')
        .select('quote_form_template_id')
        .not('quote_form_template_id', 'is', null);

      const existingIds = new Set((existing ?? []).map(e => e.quote_form_template_id));
      const toCreate = templates.filter(t => !existingIds.has(t.id));

      let created = 0;
      for (const t of toCreate) {
        const { error } = await supabase.from('contact_center_assistants').insert({
          nombre: t.title,
          descripcion: `Asistente automático generado desde el formulario "${t.title}"`,
          source: 'form',
          generation_origin: 'generated_from_quote_form',
          generated_from_form: true,
          quote_form_template_id: t.id,
          form_title: t.title,
          form_type_cache: t.form_type,
          is_active: true,
          is_global: true,
          model: 'gpt-4o-mini',
          language: 'es',
          welcome_message: '',
          consent_message: '',
          completion_message: '',
          transfer_message: '',
          auto_create_tramite: false,
          tramite_tipo: '',
          tramite_prioridad: 'media',
          total_sessions: 0,
          completed_sessions: 0,
          transferred_sessions: 0,
          field_count: 0,
          has_documents: false,
        });
        if (!error) created++;
      }

      setResult({ created, existed: existingIds.size });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Generar desde formularios</h2>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Se crearán asistentes automáticos para cada plantilla de formulario activa que aún no tenga uno asignado.
          </p>
        </div>

        <div className="p-6">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Proceso completado</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {result.created} creados &bull; {result.existed} ya existían
                  </p>
                </div>
              </div>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Aceptar y recargar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium text-gray-800">Plantillas activas: </span>
                  {templateCount === null ? <Loader2 className="inline w-3 h-3 animate-spin" /> : templateCount}
                </p>
                <p className="text-xs text-gray-400">Los asistentes existentes no serán modificados.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Deprecate Modal ──────────────────────────────────────────────────────────

function DeprecateModal({
  assistant,
  onClose,
  onSuccess,
}: {
  assistant: CcAssistant;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDeprecate() {
    setLoading(true);
    await supabase
      .from('contact_center_assistants')
      .update({ is_active: false, deprecated_at: new Date().toISOString(), deprecated_reason: reason || null })
      .eq('id', assistant.id);
    setLoading(false);
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Archive className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Deprecar asistente</h2>
              <p className="text-xs text-gray-400">{assistant.nombre}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            El asistente se desactivará y marcará como deprecado. Puedes restaurarlo después si es necesario.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Ej. Reemplazado por nueva versión..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeprecate}
              disabled={loading}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Deprecar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  assistant,
  onClose,
  onSuccess,
}: {
  assistant: CcAssistant;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState('');

  async function handleDelete() {
    setLoading(true);
    await supabase.from('contact_center_assistants').delete().eq('id', assistant.id);
    setLoading(false);
    onSuccess();
    onClose();
  }

  const canDelete = confirm.trim().toLowerCase() === 'eliminar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Eliminar asistente</h2>
              <p className="text-xs text-gray-400">{assistant.nombre}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Esta accion es <strong>permanente e irreversible</strong>. Se eliminaran el asistente, sus campos, sesiones e historial completo.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Escribe <span className="font-mono bg-gray-100 px-1 rounded">eliminar</span> para confirmar
            </label>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="eliminar"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || !canDelete}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Assistant Card ───────────────────────────────────────────────────────────

function AssistantCard({
  assistant,
  selected,
  onSelect,
  onToggleActive,
  onDeprecate,
  onRestore,
  onDelete,
  isAdmin,
}: {
  assistant: CcAssistant;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDeprecate: () => void;
  onRestore: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  const isDeprecated = !!assistant.deprecated_at;

  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl border transition-all cursor-pointer group',
        selected
          ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md shadow-sm',
        isDeprecated && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isDeprecated ? 'bg-gray-100' : assistant.generated_from_form ? 'bg-blue-50' : 'bg-gray-100'
          )}>
            <Bot className={cn('w-5 h-5', isDeprecated ? 'text-gray-400' : assistant.generated_from_form ? 'text-blue-600' : 'text-gray-500')} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-gray-900 truncate leading-snug">{assistant.nombre}</h3>
            {assistant.form_type_cache && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{assistant.form_type_cache}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('w-2 h-2 rounded-full', assistant.is_active ? 'bg-green-400' : 'bg-gray-300')} />
          </div>
        </div>

        {/* Description */}
        {assistant.descripcion && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{assistant.descripcion}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {assistant.generated_from_form
            ? <Badge label="Formulario" variant="blue" />
            : <Badge label="Manual" variant="neutral" />}
          {isDeprecated && <Badge label="Deprecado" variant="amber" />}
          {!assistant.is_active && !isDeprecated && <Badge label="Inactivo" variant="neutral" />}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <List className="w-3 h-3" />
            {assistant.field_count ?? 0} campos
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {assistant.total_sessions ?? 0} sesiones
          </span>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div
            className="flex items-center gap-1.5 pt-3 border-t border-gray-50"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onSelect}
              title="Ver detalle"
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver
            </button>
            <button
              onClick={onToggleActive}
              title={assistant.is_active ? 'Desactivar' : 'Activar'}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              {assistant.is_active ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
              {assistant.is_active ? 'Desactivar' : 'Activar'}
            </button>
            {isDeprecated ? (
              <button
                onClick={onRestore}
                title="Restaurar"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar
              </button>
            ) : (
              <button
                onClick={onDeprecate}
                title="Deprecar"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Deprecar
              </button>
            )}
            {(isDeprecated || !assistant.is_active) && (
              <button
                onClick={onDelete}
                title="Eliminar permanentemente"
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  assistant,
  onClose,
  onRefresh,
  isAdmin,
}: {
  assistant: CcAssistant;
  onClose: () => void;
  onRefresh: () => void;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>('config');
  const [fields, setFields] = useState<CcField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CcAssistant>>(assistant);

  useEffect(() => {
    setForm(assistant);
    if (tab === 'fields') loadFields();
  }, [assistant.id, tab]);

  async function loadFields() {
    setLoadingFields(true);
    const { data } = await supabase
      .from('contact_center_assistant_fields')
      .select('*')
      .eq('assistant_id', assistant.id)
      .order('capture_order');
    setFields(data ?? []);
    setLoadingFields(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('contact_center_assistants')
      .update({
        nombre: form.nombre,
        descripcion: form.descripcion,
        system_prompt: form.system_prompt,
        model: form.model,
        language: form.language,
        auto_create_tramite: form.auto_create_tramite,
        tramite_tipo: form.tramite_tipo,
        tramite_prioridad: form.tramite_prioridad,
      })
      .eq('id', assistant.id);
    setSaving(false);
    onRefresh();
  }

  const tabs: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
    { key: 'config', label: 'Configuración', icon: <Settings className="w-3.5 h-3.5" /> },
    { key: 'fields', label: 'Campos', icon: <List className="w-3.5 h-3.5" /> },
    { key: 'messages', label: 'Mensajes', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: 'stats', label: 'Estadísticas', icon: <BarChart2 className="w-3.5 h-3.5" /> },
  ];

  const required = fields.filter(f => f.priority === 'required');
  const recommended = fields.filter(f => f.priority === 'recommended');
  const optional = fields.filter(f => f.priority === 'optional');

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="p-5 border-b border-gray-100 shrink-0">
        <div className="flex items-start gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', assistant.generated_from_form ? 'bg-blue-50' : 'bg-gray-100')}>
            <Bot className={cn('w-5 h-5', assistant.generated_from_form ? 'text-blue-600' : 'text-gray-500')} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm leading-snug truncate">{assistant.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {assistant.generated_from_form ? <Badge label="Formulario" variant="blue" /> : <Badge label="Manual" variant="neutral" />}
              {assistant.deprecated_at && <Badge label="Deprecado" variant="amber" />}
              <span className={cn('text-[11px] font-medium', assistant.is_active ? 'text-green-600' : 'text-gray-400')}>
                {assistant.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 pt-3 shrink-0 border-b border-gray-100 pb-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg -mb-px border-b-2 transition-colors',
              tab === t.key
                ? 'text-blue-600 border-blue-500 bg-blue-50/50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Config ── */}
        {tab === 'config' && (
          <div className="space-y-4">
            {assistant.deprecated_at && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Asistente deprecado</p>
                  <p className="text-xs text-amber-700 mt-0.5">Desde {formatDate(assistant.deprecated_at)}</p>
                  {assistant.deprecated_reason && (
                    <p className="text-xs text-amber-600 mt-1 italic">"{assistant.deprecated_reason}"</p>
                  )}
                </div>
              </div>
            )}

            <Field label="Nombre">
              <input
                value={form.nombre ?? ''}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </Field>

            <Field label="Descripcion">
              <textarea
                value={form.descripcion ?? ''}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                disabled={!isAdmin}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
              />
            </Field>

            <Field label="System Prompt">
              <textarea
                value={form.system_prompt ?? ''}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                disabled={!isAdmin}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Modelo">
                <input
                  value={form.model ?? ''}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  disabled={!isAdmin}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </Field>
              <Field label="Idioma">
                <select
                  value={form.language ?? 'es'}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  disabled={!isAdmin}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500 bg-white"
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </Field>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Crear trámite automático</span>
                <button
                  onClick={() => isAdmin && setForm(f => ({ ...f, auto_create_tramite: !f.auto_create_tramite }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    form.auto_create_tramite ? 'bg-blue-500' : 'bg-gray-300',
                    !isAdmin && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', form.auto_create_tramite ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
              {form.auto_create_tramite && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field label="Tipo de trámite">
                    <input
                      value={form.tramite_tipo ?? ''}
                      onChange={e => setForm(f => ({ ...f, tramite_tipo: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 bg-white"
                    />
                  </Field>
                  <Field label="Prioridad">
                    <select
                      value={form.tramite_prioridad ?? 'media'}
                      onChange={e => setForm(f => ({ ...f, tramite_prioridad: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 bg-white"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </button>
            )}
          </div>
        )}

        {/* ── Fields ── */}
        {tab === 'fields' && (
          <div>
            {loadingFields ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : fields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin campos configurados</p>
              </div>
            ) : (
              <div>
                <PriorityGroup priority="required" fields={required} />
                <PriorityGroup priority="recommended" fields={recommended} />
                <PriorityGroup priority="optional" fields={optional} />
              </div>
            )}
            {isAdmin && (
              <button className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Agregar campo
              </button>
            )}
          </div>
        )}

        {/* ── Messages ── */}
        {tab === 'messages' && (
          <div className="space-y-4">
            {(['welcome_message', 'consent_message', 'completion_message', 'transfer_message'] as const).map(key => {
              const labels: Record<string, string> = {
                welcome_message: 'Mensaje de bienvenida',
                consent_message: 'Mensaje de consentimiento',
                completion_message: 'Mensaje de finalización',
                transfer_message: 'Mensaje de transferencia',
              };
              return (
                <Field key={key} label={labels[key]}>
                  <textarea
                    value={(form as Record<string, string>)[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    disabled={!isAdmin}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                  />
                </Field>
              );
            })}
            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar mensajes
              </button>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        {tab === 'stats' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total sesiones', value: assistant.total_sessions ?? 0, color: 'text-gray-800' },
                { label: 'Completadas', value: assistant.completed_sessions ?? 0, color: 'text-green-700' },
                { label: 'Transferidas', value: assistant.transferred_sessions ?? 0, color: 'text-blue-700' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <ProgressBar
                label="Tasa de completado"
                value={assistant.completed_sessions ?? 0}
                total={assistant.total_sessions ?? 0}
                color="bg-green-400"
              />
              <ProgressBar
                label="Tasa de transferencia"
                value={assistant.transferred_sessions ?? 0}
                total={assistant.total_sessions ?? 0}
                color="bg-blue-400"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Creado</span>
                <span className="text-gray-700">{formatDate(assistant.created_at)}</span>
              </div>
              {assistant.last_synced_at && (
                <div className="flex justify-between">
                  <span>Ultima sincronización</span>
                  <span className="text-gray-700">{formatDate(assistant.last_synced_at)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Origen</span>
                <span className="text-gray-700">{assistant.generation_origin ?? '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CentroContactoAsistentes() {
  const { user } = useAuth();
  const isAdmin = true; // Replace with real role check as needed

  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [selected, setSelected] = useState<CcAssistant | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [deprecating, setDeprecating] = useState<CcAssistant | null>(null);
  const [deleting, setDeleting] = useState<CcAssistant | null>(null);

  const loadAssistants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_center_assistants')
      .select('*, oficinas(nombre)')
      .order('is_active', { ascending: false })
      .order('nombre');

    const mapped: CcAssistant[] = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      office_name: (row.oficinas as { nombre?: string } | null)?.nombre,
    })) as CcAssistant[];

    setAssistants(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { loadAssistants(); }, [loadAssistants]);

  async function handleToggleActive(assistant: CcAssistant) {
    await supabase
      .from('contact_center_assistants')
      .update({ is_active: !assistant.is_active })
      .eq('id', assistant.id);
    loadAssistants();
    if (selected?.id === assistant.id) setSelected(prev => prev ? { ...prev, is_active: !prev.is_active } : prev);
  }

  async function handleRestore(assistant: CcAssistant) {
    await supabase
      .from('contact_center_assistants')
      .update({ is_active: true, deprecated_at: null, deprecated_reason: null })
      .eq('id', assistant.id);
    loadAssistants();
  }

  async function handleDeleteSuccess() {
    if (selected?.id === deleting?.id) setSelected(null);
    loadAssistants();
  }

  const filtered = assistants
    .filter(a => {
      const q = search.toLowerCase();
      if (q && !a.nombre.toLowerCase().includes(q) && !(a.form_title ?? '').toLowerCase().includes(q) && !(a.form_type_cache ?? '').toLowerCase().includes(q)) return false;
      if (filterTab === 'form') return a.generated_from_form;
      if (filterTab === 'manual') return !a.generated_from_form;
      if (filterTab === 'active') return a.is_active && !a.deprecated_at;
      if (filterTab === 'inactive') return !a.is_active && !a.deprecated_at;
      if (filterTab === 'deprecated') return !!a.deprecated_at;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'nombre') return a.nombre.localeCompare(b.nombre);
      if (sortKey === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === 'total_sessions') return (b.total_sessions ?? 0) - (a.total_sessions ?? 0);
      return 0;
    });

  const totalActive = assistants.filter(a => a.is_active && !a.deprecated_at).length;
  const totalDeprecated = assistants.filter(a => !!a.deprecated_at).length;
  const totalFromForms = assistants.filter(a => a.generated_from_form).length;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'form', label: 'Desde Formulario' },
    { key: 'manual', label: 'Manuales' },
    { key: 'active', label: 'Activos' },
    { key: 'inactive', label: 'Inactivos' },
    { key: 'deprecated', label: 'Deprecados' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Main area */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all', selected ? 'mr-[420px]' : '')}>

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Asistentes Automáticos</h1>
              <p className="text-sm text-gray-500 mt-0.5">Gestiona los asistentes del Centro de Contacto</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StatChip label="activos" value={totalActive} color="bg-green-50 text-green-700" />
                <StatChip label="deprecados" value={totalDeprecated} color="bg-amber-50 text-amber-700" />
                <StatChip label="desde formularios" value={totalFromForms} color="bg-blue-50 text-blue-700" />
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to="/centro-contacto/asistentes/entrenamiento"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Brain className="w-4 h-4" />
                  Entrenamiento
                </Link>
                <button
                  onClick={() => setShowGenerate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                >
                  <Sparkles className="w-4 h-4" />
                  Generar desde formularios
                </button>
                <button
                  onClick={loadAssistants}
                  className="p-2 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors"
                  title="Recargar"
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar asistente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
              {filterTabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setFilterTab(t.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                    filterTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">Ordenar:</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="nombre">Nombre</option>
                <option value="created_at">Fecha</option>
                <option value="total_sessions">Sesiones</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Bot className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No se encontraron asistentes</p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-2 text-xs text-blue-500 hover:underline">
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(a => (
                <AssistantCard
                  key={a.id}
                  assistant={a}
                  selected={selected?.id === a.id}
                  onSelect={() => setSelected(prev => prev?.id === a.id ? null : a)}
                  onToggleActive={() => handleToggleActive(a)}
                  onDeprecate={() => setDeprecating(a)}
                  onRestore={() => handleRestore(a)}
                  onDelete={() => setDeleting(a)}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-gray-100 shadow-2xl z-30 flex flex-col">
          <DetailPanel
            assistant={selected}
            onClose={() => setSelected(null)}
            onRefresh={() => { loadAssistants(); }}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* Modals */}
      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onSuccess={loadAssistants}
        />
      )}
      {deprecating && (
        <DeprecateModal
          assistant={deprecating}
          onClose={() => setDeprecating(null)}
          onSuccess={loadAssistants}
        />
      )}
      {deleting && (
        <DeleteModal
          assistant={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
