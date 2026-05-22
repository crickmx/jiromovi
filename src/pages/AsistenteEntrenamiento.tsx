import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Settings, MessageSquare, Zap, Brain, FlaskConical, BookOpen, History,
  Plus, Trash2, Save, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Search, RefreshCw, Tag, Activity, ArrowLeft, Pencil,
  ToggleLeft, ToggleRight, TrendingUp, Send,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalSettings {
  id?: string;
  smart_assistant_global_enabled: boolean;
  default_enabled_for_new_conversations: boolean;
  mode: 'suggestions_only' | 'automatic' | 'mixed';
  auto_activate_threshold: number;
  suggest_threshold: number;
  ignore_threshold: number;
  pause_on_human_message: boolean;
  human_pause_minutes: number;
  stop_on_user_request: boolean;
  allow_auto_activate_agents: boolean;
  allow_internal_suggestions: boolean;
  minimum_intervention: boolean;
  ai_message_signature_enabled: boolean;
  ai_message_signature_text: string;
  response_first_message: string;
  response_stop_message: string;
  response_form_sent_message: string;
  response_option_unclear: string;
}

interface Intent {
  id: string;
  intent_key: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  linked_assistant_id: string | null;
  linked_form_slug: string | null;
  auto_activation_allowed: boolean;
  requires_confirmation_below_threshold: boolean;
  priority: number;
  created_at: string;
  phrases?: TrainingPhrase[];
  keywords?: Keyword[];
}

interface TrainingPhrase {
  id: string;
  intent_id: string;
  phrase: string;
  weight: number;
  status: 'active' | 'inactive';
}

interface Keyword {
  id: string;
  intent_id: string;
  keyword: string;
  weight: number;
  status: 'active' | 'inactive';
}

interface AnalysisLog {
  id: string;
  message_text: string;
  detected_intent: string | null;
  confidence: number | null;
  action_taken: string | null;
  matched_form_slug: string | null;
  reason: string | null;
  was_correct: boolean | null;
  created_at: string;
  agent_user_id: string | null;
  agent_name?: string;
}

type Tab = 'config' | 'intents' | 'simulator' | 'logs';

const DEFAULT_SETTINGS: GlobalSettings = {
  smart_assistant_global_enabled: true,
  default_enabled_for_new_conversations: true,
  mode: 'mixed',
  auto_activate_threshold: 0.85,
  suggest_threshold: 0.55,
  ignore_threshold: 0.54,
  pause_on_human_message: true,
  human_pause_minutes: 20,
  stop_on_user_request: true,
  allow_auto_activate_agents: true,
  allow_internal_suggestions: true,
  minimum_intervention: true,
  ai_message_signature_enabled: true,
  ai_message_signature_text: '- 🤖 MOVI IA',
  response_first_message: 'Hola, puedo ayudarte de dos formas:\n1. Llenar el formulario en línea\n2. Responder las preguntas por aquí\n¿Qué prefieres?',
  response_stop_message: 'Claro, {{nombre_responsable}} te atenderá por este medio.',
  response_form_sent_message: 'Perfecto, puedes llenar el formulario aquí:\n{{link_formulario}}\nCuando lo envíes, {{nombre_responsable}} dará seguimiento a tu solicitud.',
  response_option_unclear: '¿Prefieres llenar el formulario en línea o responder por aquí?',
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-white/20',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-1')} />
    </button>
  );
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium text-neutral-800 dark:text-white/90">{label}</p>
        {sub && <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5">{sub}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Badge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400 dark:bg-white/40')} />
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-neutral-600 dark:text-white/60 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Tab: Config ─────────────────────────────────────────────────────────────

function TabConfig({ settings, setSettings, onSave, saving }: {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (k: keyof GlobalSettings, v: unknown) => setSettings({ ...settings, [k]: v });

  return (
    <div className="space-y-6">
      {/* Master switch */}
      <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Settings className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Configuracion General</h2>
        </div>
        <div className="px-6 py-2">
          <ToggleRow label="Asistente Inteligente activo" sub="Habilita MOVI IA globalmente" checked={settings.smart_assistant_global_enabled} onChange={v => set('smart_assistant_global_enabled', v)} />
          <ToggleRow label="Activo por defecto en conversaciones nuevas" checked={settings.default_enabled_for_new_conversations} onChange={v => set('default_enabled_for_new_conversations', v)} />
          <ToggleRow label="Pausar al intervenir humano" sub={`Se pausa ${settings.human_pause_minutes} min cuando un usuario interno responde manualmente`} checked={settings.pause_on_human_message} onChange={v => set('pause_on_human_message', v)} />
          <ToggleRow label="Detener si el contacto lo solicita" sub='Frases como "no quiero bot" detienen la IA' checked={settings.stop_on_user_request} onChange={v => set('stop_on_user_request', v)} />
          <ToggleRow label="Permitir activar asistentes automaticos" checked={settings.allow_auto_activate_agents} onChange={v => set('allow_auto_activate_agents', v)} />
          <ToggleRow label="Mostrar sugerencias internas" sub="Visible solo para el usuario interno" checked={settings.allow_internal_suggestions} onChange={v => set('allow_internal_suggestions', v)} />
          <ToggleRow label="Intervencion minima" sub="No intervenir si no es necesario" checked={settings.minimum_intervention} onChange={v => set('minimum_intervention', v)} />
        </div>
      </div>

      {/* Mode & thresholds */}
      <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Modo de Actuacion y Umbrales</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-2">Modo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['suggestions_only', 'automatic', 'mixed'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => set('mode', m)}
                  className={cn(
                    'py-2.5 px-3 rounded-xl border text-xs font-medium transition-all',
                    settings.mode === m ? 'bg-blue-600 border-blue-600 text-white' : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60 hover:border-blue-300',
                  )}
                >
                  {m === 'suggestions_only' ? 'Solo sugerencias' : m === 'automatic' ? 'Automatico' : 'Mixto'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: 'auto_activate_threshold', label: 'Umbral activacion auto', color: 'text-emerald-700' },
              { key: 'suggest_threshold', label: 'Umbral sugerencia', color: 'text-amber-700' },
              { key: 'ignore_threshold', label: 'Umbral ignorar', color: 'text-red-600' },
            ] as const).map(({ key, label, color }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={settings[key]}
                    onChange={e => set(key, parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className={cn('text-sm font-semibold w-10 text-right', color)}>
                    {Math.round((settings[key] as number) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Minutos de pausa por intervencion humana</label>
            <input
              type="number" min={1} max={120}
              value={settings.human_pause_minutes}
              onChange={e => set('human_pause_minutes', parseInt(e.target.value) || 20)}
              className="w-32 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Signature */}
      <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-neutral-500 dark:text-white/50" />
          </div>
          <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Firma MOVI IA</h2>
        </div>
        <div className="p-6 space-y-4">
          <ToggleRow label="Agregar firma a mensajes automaticos" checked={settings.ai_message_signature_enabled} onChange={v => set('ai_message_signature_enabled', v)} />
          {settings.ai_message_signature_enabled && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Texto de firma</label>
              <input
                value={settings.ai_message_signature_text}
                onChange={e => set('ai_message_signature_text', e.target.value)}
                className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="- 🤖 MOVI IA"
              />
              <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Se agrega al final de cada mensaje automatico visible para el contacto.</p>
            </div>
          )}
        </div>
      </div>

      {/* Response Templates */}
      <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
            <Send className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Mensajes Base</h2>
            <p className="text-xs text-neutral-400 dark:text-white/40">Mensajes que MOVI IA envia automaticamente al contacto.</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Primer mensaje al activar asistente</label>
            <textarea
              rows={3}
              value={settings.response_first_message}
              onChange={e => set('response_first_message', e.target.value)}
              className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Hola, puedo ayudarte de dos formas..."
            />
            <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Se envia cuando MOVI IA activa un asistente automatico.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Mensaje al detener bot (contacto pide humano)</label>
            <textarea
              rows={2}
              value={settings.response_stop_message}
              onChange={e => set('response_stop_message', e.target.value)}
              className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Claro, {{nombre_responsable}} te atenderá..."
            />
            <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Variables: <code className="text-xs bg-neutral-100 dark:bg-white/10 px-1 rounded">{'{{nombre_responsable}}'}</code></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Mensaje al enviar link de formulario</label>
            <textarea
              rows={3}
              value={settings.response_form_sent_message}
              onChange={e => set('response_form_sent_message', e.target.value)}
              className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Perfecto, puedes llenar el formulario aquí..."
            />
            <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Variables: <code className="text-xs bg-neutral-100 dark:bg-white/10 px-1 rounded">{'{{link_formulario}}'}</code> <code className="text-xs bg-neutral-100 dark:bg-white/10 px-1 rounded">{'{{nombre_responsable}}'}</code></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Mensaje cuando la opcion no es clara</label>
            <textarea
              rows={2}
              value={settings.response_option_unclear}
              onChange={e => set('response_option_unclear', e.target.value)}
              className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="¿Prefieres llenar el formulario o responder por aquí?"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuracion
        </button>
      </div>
    </div>
  );
}

// ─── Intent Detail Panel ──────────────────────────────────────────────────────

function IntentDetail({ intent, onClose, onRefresh }: { intent: Intent; onClose: () => void; onRefresh: () => void }) {
  const [phrases, setPhrases] = useState<TrainingPhrase[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: ph }, { data: kw }] = await Promise.all([
      supabase.from('smart_assistant_training_phrases').select('*').eq('intent_id', intent.id).order('phrase'),
      supabase.from('smart_assistant_keywords').select('*').eq('intent_id', intent.id).order('keyword'),
    ]);
    setPhrases(ph ?? []);
    setKeywords(kw ?? []);
    setLoading(false);
  }, [intent.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function addPhrase() {
    const t = newPhrase.trim();
    if (!t) return;
    setSaving(true);
    await supabase.from('smart_assistant_training_phrases').insert({ intent_id: intent.id, phrase: t });
    setNewPhrase('');
    await loadData();
    setSaving(false);
  }

  async function removePhrase(id: string) {
    await supabase.from('smart_assistant_training_phrases').delete().eq('id', id);
    setPhrases(prev => prev.filter(p => p.id !== id));
  }

  async function addKeyword() {
    const t = newKeyword.trim().toLowerCase();
    if (!t) return;
    setSaving(true);
    await supabase.from('smart_assistant_keywords').insert({ intent_id: intent.id, keyword: t });
    setNewKeyword('');
    await loadData();
    setSaving(false);
  }

  async function removeKeyword(id: string) {
    await supabase.from('smart_assistant_keywords').delete().eq('id', id);
    setKeywords(prev => prev.filter(k => k.id !== id));
  }

  async function toggleStatus(field: 'linked_form_slug' | 'auto_activation_allowed', value: unknown) {
    await supabase.from('smart_assistant_intents').update({ [field]: value }).eq('id', intent.id);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[480px] bg-white border-l border-neutral-100 dark:border-white/5 shadow-2xl flex flex-col h-full">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">{intent.name}</h3>
            <p className="text-xs text-neutral-400 dark:text-white/40 font-mono mt-0.5">{intent.intent_key}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-neutral-500 dark:text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Activation rule */}
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-white/70">Activacion automatica permitida</p>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5">Permite que MOVI IA active esta intencion sin confirmacion</p>
              </div>
              <Toggle checked={intent.auto_activation_allowed} onChange={v => toggleStatus('auto_activation_allowed', v)} />
            </div>
          </div>

          {/* Form slug */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1.5">Slug de formulario vinculado</label>
            <input
              defaultValue={intent.linked_form_slug ?? ''}
              onBlur={e => toggleStatus('linked_form_slug', e.target.value || null)}
              placeholder="Ej: auto-individual"
              className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Slug del formulario de cotizacion/tramite que se activa para esta intencion.</p>
          </div>

          {/* Phrases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-white/70">Frases de entrenamiento</h4>
              <span className="text-xs text-neutral-400 dark:text-white/40">{phrases.filter(p => p.status === 'active').length} activas</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-neutral-300 dark:text-white/30" /></div>
            ) : (
              <div className="space-y-2 mb-3">
                {phrases.length === 0 && <p className="text-xs text-neutral-400 dark:text-white/40 italic">Sin frases registradas.</p>}
                {phrases.map(p => (
                  <div key={p.id} className="flex items-center gap-2 group">
                    <span className={cn('flex-1 text-sm px-3 py-1.5 rounded-lg', p.status === 'active' ? 'bg-blue-50 text-blue-800' : 'bg-neutral-100 dark:bg-white/10 text-neutral-400 dark:text-white/40 line-through')}>
                      {p.phrase}
                    </span>
                    <button onClick={() => removePhrase(p.id)} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-400 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPhrase()}
                placeholder="Nueva frase..."
                className="flex-1 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={addPhrase}
                disabled={saving || !newPhrase.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-white/70">Palabras clave</h4>
              <span className="text-xs text-neutral-400 dark:text-white/40">{keywords.length} registradas</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {keywords.length === 0 && <p className="text-xs text-neutral-400 dark:text-white/40 italic">Sin palabras clave.</p>}
              {keywords.map(k => (
                <span key={k.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 rounded-full text-xs font-medium group">
                  {k.keyword}
                  <button onClick={() => removeKeyword(k.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-neutral-400 dark:text-white/40 hover:text-red-500" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                placeholder="Nueva palabra clave..."
                className="flex-1 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="px-3 py-2 bg-neutral-700 dark:bg-white/20 text-white rounded-xl text-sm hover:bg-neutral-800 dark:hover:bg-white/30 transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Intents ─────────────────────────────────────────────────────────────

function TabIntents() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Intent | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('smart_assistant_intents').select('*').order('priority').order('name');
    setIntents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleStatus(intent: Intent) {
    const newStatus = intent.status === 'active' ? 'inactive' : 'active';
    await supabase.from('smart_assistant_intents').update({ status: newStatus }).eq('id', intent.id);
    setIntents(prev => prev.map(i => i.id === intent.id ? { ...i, status: newStatus } : i));
  }

  async function handleAdd() {
    if (!newName.trim() || !newKey.trim()) return;
    setSaving(true);
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    await supabase.from('smart_assistant_intents').insert({
      intent_key: key, name: newName.trim(), description: newDesc.trim() || null,
    });
    setNewName(''); setNewKey(''); setNewDesc(''); setShowAdd(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta intencion y todas sus frases y palabras clave?')) return;
    await supabase.from('smart_assistant_intents').delete().eq('id', id);
    setIntents(prev => prev.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const filtered = intents.filter(i => {
    const q = search.toLowerCase();
    return !q || i.intent_key.includes(q) || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar intencion..." className="w-full pl-9 pr-4 py-2 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-800">Nueva intencion</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Nombre</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Cotizacion Auto" className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Clave unica</label>
              <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="cotizacion_auto" className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Descripcion (opcional)</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Cuando el contacto quiere..." className="w-full border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:bg-white/10 rounded-xl transition-colors">Cancelar</button>
            <button onClick={handleAdd} disabled={saving || !newName.trim() || !newKey.trim()} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-300 dark:text-white/30" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(intent => (
            <div
              key={intent.id}
              className="bg-white border border-neutral-100 dark:border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-blue-200 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-neutral-800 dark:text-white/90">{intent.name}</span>
                  <Badge status={intent.status} />
                  {intent.linked_form_slug && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50 rounded text-xs font-mono">
                      {intent.linked_form_slug}
                    </span>
                  )}
                  {intent.auto_activation_allowed && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs">
                      <Zap className="w-2.5 h-2.5" /> Auto
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5 font-mono">{intent.intent_key}</p>
                {intent.description && <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5 truncate">{intent.description}</p>}
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggleStatus(intent)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:bg-white/10 transition-colors text-neutral-400 dark:text-white/40"
                  title={intent.status === 'active' ? 'Desactivar' : 'Activar'}
                >
                  {intent.status === 'active' ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSelected(intent)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors text-neutral-400 dark:text-white/40 hover:text-blue-600"
                  title="Editar frases y palabras clave"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(intent.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-neutral-400 dark:text-white/40 hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-400 dark:text-white/40">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin intenciones{search ? ' que coincidan' : ' registradas'}.</p>
            </div>
          )}
        </div>
      )}

      {selected && (
        <IntentDetail intent={selected} onClose={() => setSelected(null)} onRefresh={load} />
      )}
    </div>
  );
}

// ─── Tab: Simulator ───────────────────────────────────────────────────────────

interface SimResult {
  should_act: boolean;
  action: string;
  intent: string | null;
  confidence: number;
  matched_form_slug: string | null;
  reason: string;
  requires_internal_confirmation: boolean;
  suggested_actions?: Array<{ label: string; form_slug?: string }>;
}

function simulateAnalysis(text: string, intents: Intent[], settings: GlobalSettings): SimResult {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let best: { intent: Intent; score: number } | null = null;

  for (const intent of intents) {
    if (intent.status !== 'active') continue;
    let score = 0;

    // Match against keywords
    if (intent.keywords) {
      for (const kw of intent.keywords) {
        if (kw.status === 'active' && lower.includes(kw.keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          score += 0.3 * (kw.weight ?? 1);
        }
      }
    }

    // Match against phrases (exact or partial)
    if (intent.phrases) {
      for (const ph of intent.phrases) {
        if (ph.status !== 'active') continue;
        const phLower = ph.phrase.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower === phLower) {
          score += 1.0 * (ph.weight ?? 1);
        } else if (lower.includes(phLower) || phLower.includes(lower)) {
          score += 0.6 * (ph.weight ?? 1);
        } else {
          // Word overlap scoring
          const words = phLower.split(/\s+/);
          const inputWords = lower.split(/\s+/);
          const overlap = words.filter(w => w.length > 3 && inputWords.some(iw => iw.includes(w) || w.includes(iw)));
          if (overlap.length > 0) score += 0.2 * (overlap.length / words.length) * (ph.weight ?? 1);
        }
      }
    }

    // Normalize score to [0,1]
    const normalized = Math.min(score / 2, 1);
    if (!best || normalized > best.score) best = { intent, score: normalized };
  }

  if (!best || best.score < settings.ignore_threshold) {
    return { should_act: false, action: 'none', intent: null, confidence: best?.score ?? 0, matched_form_slug: null, reason: 'Confianza demasiado baja o sin intencion operativa', requires_internal_confirmation: false };
  }

  if (best.score >= settings.auto_activate_threshold && best.intent.auto_activation_allowed && settings.allow_auto_activate_agents) {
    return {
      should_act: true, action: 'activate_automatic_agent',
      intent: best.intent.intent_key, confidence: best.score,
      matched_form_slug: best.intent.linked_form_slug,
      reason: `MOVI IA detecto intencion: ${best.intent.name}`,
      requires_internal_confirmation: false,
    };
  }

  if (best.score >= settings.suggest_threshold && settings.allow_internal_suggestions) {
    return {
      should_act: true, action: 'suggest_internal_actions',
      intent: best.intent.intent_key, confidence: best.score,
      matched_form_slug: best.intent.linked_form_slug,
      reason: `Posible intencion detectada: ${best.intent.name} (requiere confirmacion interna)`,
      requires_internal_confirmation: true,
      suggested_actions: [
        { label: `Activar ${best.intent.name}`, form_slug: best.intent.linked_form_slug ?? undefined },
        { label: 'Crear tramite manual' },
        { label: 'Ignorar' },
      ],
    };
  }

  return { should_act: false, action: 'none', intent: best.intent.intent_key, confidence: best.score, matched_form_slug: null, reason: 'Confianza insuficiente para actuar', requires_internal_confirmation: false };
}

function TabSimulator({ settings }: { settings: GlobalSettings }) {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: intentData } = await supabase.from('smart_assistant_intents').select('*').eq('status', 'active');
      if (!intentData) { setLoading(false); return; }
      const ids = intentData.map(i => i.id);
      const [{ data: phrases }, { data: keywords }] = await Promise.all([
        supabase.from('smart_assistant_training_phrases').select('*').in('intent_id', ids).eq('status', 'active'),
        supabase.from('smart_assistant_keywords').select('*').in('intent_id', ids).eq('status', 'active'),
      ]);
      const enriched = intentData.map(i => ({
        ...i,
        phrases: (phrases ?? []).filter(p => p.intent_id === i.id),
        keywords: (keywords ?? []).filter(k => k.intent_id === i.id),
      }));
      setIntents(enriched);
      setLoading(false);
    }
    load();
  }, []);

  function handleSimulate() {
    if (!input.trim()) return;
    const r = simulateAnalysis(input, intents, settings);
    setResult(r);
  }

  const actionColors: Record<string, string> = {
    activate_automatic_agent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    suggest_internal_actions: 'bg-amber-50 border-amber-200 text-amber-800',
    none: 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60',
  };

  const actionLabel: Record<string, string> = {
    activate_automatic_agent: 'Activar asistente automatico',
    suggest_internal_actions: 'Mostrar sugerencia interna',
    none: 'No actuar',
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Simulador de entrenamiento</h2>
            <p className="text-xs text-neutral-400 dark:text-white/40">Prueba como MOVI IA reaccionaria a un mensaje</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {loading && <p className="text-xs text-neutral-400 dark:text-white/40">Cargando datos de entrenamiento...</p>}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1.5">Mensaje de prueba</label>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSimulate()}
                placeholder='Escribe un mensaje, ej: "quiero cotizar mi auto"'
                className="flex-1 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={handleSimulate}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Simular
              </button>
            </div>
          </div>

          {/* Quick test phrases */}
          <div>
            <p className="text-xs text-neutral-400 dark:text-white/40 mb-2">Frases rapidas:</p>
            <div className="flex flex-wrap gap-1.5">
              {['quiero cotizar mi auto', 'necesito seguro medico', 'quiero asegurar mi negocio', 'hola buenos dias', 'no quiero bot'].map(s => (
                <button key={s} onClick={() => setInput(s)} className="px-2.5 py-1 bg-neutral-100 dark:bg-white/10 hover:bg-blue-50 hover:text-blue-700 text-neutral-600 dark:text-white/60 rounded-full text-xs transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-50 dark:border-white/5">
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">Resultado del analisis</h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Action */}
            <div className={cn('px-4 py-3 rounded-xl border font-semibold text-sm', actionColors[result.action])}>
              {actionLabel[result.action] ?? result.action}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-neutral-400 dark:text-white/40 mb-1">Intencion detectada</p>
                <p className="font-mono text-neutral-800 dark:text-white/90">{result.intent ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-white/40 mb-1">Confianza</p>
                <ConfidenceBar value={result.confidence} />
              </div>
              {result.matched_form_slug && (
                <div>
                  <p className="text-xs text-neutral-400 dark:text-white/40 mb-1">Formulario</p>
                  <p className="font-mono text-neutral-700 dark:text-white/70">{result.matched_form_slug}</p>
                </div>
              )}
              <div className={result.matched_form_slug ? '' : 'col-span-2'}>
                <p className="text-xs text-neutral-400 dark:text-white/40 mb-1">Razon</p>
                <p className="text-neutral-700 dark:text-white/70">{result.reason}</p>
              </div>
            </div>

            {result.requires_internal_confirmation && result.suggested_actions && (
              <div>
                <p className="text-xs text-neutral-400 dark:text-white/40 mb-2">Sugerencias que se mostrarian internamente:</p>
                <div className="flex flex-wrap gap-2">
                  {result.suggested_actions.map((a, i) => (
                    <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* What would happen */}
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4">
              <p className="text-xs font-medium text-neutral-600 dark:text-white/60 mb-2">Que pasaria en WhatsApp:</p>
              {result.action === 'activate_automatic_agent' && (
                <p className="text-sm text-neutral-700 dark:text-white/70">MOVI IA activaria el asistente automatico vinculado a <strong>{result.intent}</strong> y enviaria el primer mensaje firmado con <em>{settings.ai_message_signature_text}</em>.</p>
              )}
              {result.action === 'suggest_internal_actions' && (
                <p className="text-sm text-neutral-700 dark:text-white/70">MOVI IA mostraria una tarjeta de sugerencias solo visible para el usuario interno. No responderia al contacto.</p>
              )}
              {result.action === 'none' && (
                <p className="text-sm text-neutral-700 dark:text-white/70">MOVI IA no haria nada. El mensaje seria manejado manualmente por el usuario interno.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Logs ────────────────────────────────────────────────────────────────

function TabLogs() {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unreviewed'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('smart_assistant_analysis_logs')
      .select('*, usuarios(nombre, apellido_paterno)')
      .order('created_at', { ascending: false })
      .limit(200);
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      agent_name: r.usuarios ? `${(r.usuarios as { nombre: string; apellido_paterno: string }).nombre} ${(r.usuarios as { nombre: string; apellido_paterno: string }).apellido_paterno ?? ''}`.trim() : null,
    })) as AnalysisLog[];
    setLogs(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markCorrect(id: string, correct: boolean) {
    await supabase.from('smart_assistant_analysis_logs').update({ was_correct: correct, reviewed_at: new Date().toISOString() }).eq('id', id);
    setLogs(prev => prev.map(l => l.id === id ? { ...l, was_correct: correct } : l));
  }

  const filtered = logs.filter(l => {
    if (filter === 'correct') return l.was_correct === true;
    if (filter === 'incorrect') return l.was_correct === false;
    if (filter === 'unreviewed') return l.was_correct === null;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'unreviewed', 'correct', 'incorrect'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors', filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60 hover:border-blue-300')}
          >
            {f === 'all' ? 'Todos' : f === 'unreviewed' ? 'Sin revisar' : f === 'correct' ? 'Correctos' : 'Incorrectos'}
          </button>
        ))}
        <button onClick={load} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-white/40">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-300 dark:text-white/30" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 dark:text-white/40">
          <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin registros de analisis.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className="bg-white border border-neutral-100 dark:border-white/5 rounded-2xl p-4 space-y-3 hover:border-neutral-200 dark:border-white/10 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-white/90 font-medium truncate">"{log.message_text}"</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {log.detected_intent && (
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{log.detected_intent}</span>
                    )}
                    {log.confidence !== null && (
                      <span className={cn('text-xs font-medium', (log.confidence ?? 0) >= 0.85 ? 'text-emerald-600' : (log.confidence ?? 0) >= 0.55 ? 'text-amber-600' : 'text-red-500')}>
                        {Math.round((log.confidence ?? 0) * 100)}% confianza
                      </span>
                    )}
                    {log.action_taken && <span className="text-xs text-neutral-400 dark:text-white/40">{log.action_taken}</span>}
                    {log.agent_name && <span className="text-xs text-neutral-400 dark:text-white/40">• {log.agent_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {log.was_correct === null ? (
                    <>
                      <button onClick={() => markCorrect(log.id, true)} title="Marcar como correcto" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-neutral-300 dark:text-white/30 hover:text-emerald-600 transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => markCorrect(log.id, false)} title="Marcar como incorrecto" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-neutral-300 dark:text-white/30 hover:text-red-500 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  ) : log.was_correct ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
              {log.reason && <p className="text-xs text-neutral-400 dark:text-white/40 italic">{log.reason}</p>}
              <p className="text-xs text-neutral-300 dark:text-white/30">{new Date(log.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AsistenteEntrenamiento() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [tab, setTab] = useState<Tab>('config');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Role check
  useEffect(() => {
    if (!user) return;
    supabase.from('usuarios').select('rol').eq('id', user.id).maybeSingle().then(({ data }) => {
      setIsAdmin(data?.rol === 'Administrador');
      setCheckingRole(false);
    });
  }, [user]);

  // Load global settings
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('smart_assistant_global_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setSettings(data as GlobalSettings);
      setLoadingSettings(false);
    });
  }, [isAdmin]);

  async function handleSaveSettings() {
    setSaving(true);
    const { id, ...rest } = settings;
    if (id) {
      await supabase.from('smart_assistant_global_settings').update({ ...rest, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      const { data } = await supabase.from('smart_assistant_global_settings').insert({ ...rest, updated_by: user?.id }).select('id').maybeSingle();
      if (data) setSettings(prev => ({ ...prev, id: data.id }));
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (checkingRole) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-neutral-300 dark:text-white/30" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Acceso restringido</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">Solo administradores pueden acceder a este modulo.</p>
        </div>
        <Link to="/configuracion" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'config', label: 'Configuracion', icon: <Settings className="w-4 h-4" /> },
    { key: 'intents', label: 'Intenciones', icon: <Brain className="w-4 h-4" /> },
    { key: 'simulator', label: 'Simulador', icon: <FlaskConical className="w-4 h-4" /> },
    { key: 'logs', label: 'Historial', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
          <PageHeader
            title="Entrenamiento del Asistente Inteligente"
            description="MOVI IA - Solo administradores"
            icon={Brain}
            backTo="/configuracion"
            actions={
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                  </span>
                )}
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  settings.smart_assistant_global_enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50',
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', settings.smart_assistant_global_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400 dark:bg-white/40')} />
                  {settings.smart_assistant_global_enabled ? 'MOVI IA activo' : 'MOVI IA inactivo'}
                </div>
              </div>
            }
          />

          {/* Tabs */}
          <div className="flex gap-1 pb-0 mt-4">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  tab === t.key ? 'border-accent text-accent' : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70',
                )}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loadingSettings && tab === 'config' ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-300 dark:text-white/30" /></div>
        ) : (
          <>
            {tab === 'config' && <TabConfig settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={saving} />}
            {tab === 'intents' && <TabIntents />}
            {tab === 'simulator' && <TabSimulator settings={settings} />}
            {tab === 'logs' && <TabLogs />}
          </>
        )}
      </div>
    </div>
  );
}
