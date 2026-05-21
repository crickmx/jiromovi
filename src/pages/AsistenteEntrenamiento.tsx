import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Bot, Settings, MessageSquare, Sliders, Zap, VolumeX,
  StopCircle, RefreshCw, PenLine, ShieldCheck, BookOpen, FlaskConical,
  ChevronRight, X, Plus, Send, CheckCircle2, AlertCircle, Trash2, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToneJson { formality: 'formal'|'semiformal'|'casual'; empathy_level: 'low'|'medium'|'high'; use_name: boolean; use_honorifics: boolean; custom_style_notes: string }
interface AllowedActions { create_tramite: boolean; send_summary: boolean; transfer_to_agent: boolean; send_documents: boolean; schedule_followup: boolean }
interface KnowledgeEntry { title: string; content: string }
interface Rule { type: string; value?: string }

interface Settings {
  id?: string;
  is_active: boolean; auto_activate_on_new_contact: boolean; max_inactive_minutes: number; default_language: 'es'|'en';
  base_instructions: string; tone_json: ToneJson; intervention_level: 'conservative'|'balanced'|'proactive'; confidence_threshold: number;
  activation_rules_json: Rule[]; silence_rules_json: Rule[]; stop_phrases_json: string[]; reactivate_phrases_json: string[];
  message_signature: string; allowed_actions_json: AllowedActions; knowledge_base_json: KnowledgeEntry[];
}

const DEF: Settings = {
  is_active: false, auto_activate_on_new_contact: false, max_inactive_minutes: 10, default_language: 'es',
  base_instructions: '', tone_json: { formality: 'semiformal', empathy_level: 'medium', use_name: true, use_honorifics: false, custom_style_notes: '' },
  intervention_level: 'balanced', confidence_threshold: 70,
  activation_rules_json: [], silence_rules_json: [], stop_phrases_json: [], reactivate_phrases_json: [],
  message_signature: '- MOVI IA', allowed_actions_json: { create_tramite: false, send_summary: true, transfer_to_agent: true, send_documents: false, schedule_followup: false },
  knowledge_base_json: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ic = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white placeholder:text-neutral-400';
const sc = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-neutral-300')}>
      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-1')} />
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>{children}{hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}</div>;
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">{label}<button onClick={onRemove}><X className="w-3 h-3" /></button></span>;
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100">
      <div><p className="text-sm font-medium text-neutral-800">{label}</p>{sub && <p className="text-xs text-neutral-400">{sub}</p>}</div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function RulesPanel({ rules, onAdd, onRemove, types, placeholder }: { rules: Rule[]; onAdd: (r: Rule) => void; onRemove: (i: number) => void; types: { value: string; label: string; hasValue?: boolean }[]; placeholder?: string }) {
  const [newType, setNewType] = useState(types[0].value);
  const [val, setVal] = useState('');
  const def = types.find(t => t.value === newType);
  const lbl = (r: Rule) => { const d = types.find(t => t.value === r.type); return r.value ? `${d?.label ?? r.type}: ${r.value}` : (d?.label ?? r.type); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {rules.length === 0 ? <p className="text-xs text-neutral-400 italic">Sin reglas configuradas.</p> : rules.map((r, i) => <Pill key={i} label={lbl(r)} onRemove={() => onRemove(i)} />)}
      </div>
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]"><p className="text-xs font-medium text-neutral-500 mb-1">Tipo</p><select value={newType} onChange={e => { setNewType(e.target.value); setVal(''); }} className={sc}>{types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        {def?.hasValue && <div className="flex-1 min-w-[130px]"><p className="text-xs font-medium text-neutral-500 mb-1">Valor</p><input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} className={ic} /></div>}
        <button onClick={() => { if (!def?.hasValue || val.trim()) { onAdd({ type: newType, value: val.trim() || undefined }); setVal(''); } }} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"><Plus className="w-4 h-4" /> Agregar</button>
      </div>
    </div>
  );
}

function PhrasesPanel({ phrases, onChange, hint }: { phrases: string[]; onChange: (p: string[]) => void; hint: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { if (draft.trim()) { onChange([...phrases, draft.trim()]); setDraft(''); } };
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">{hint}</p>
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {phrases.length === 0 ? <p className="text-xs text-neutral-400 italic">Sin frases configuradas.</p>
          : phrases.map((p, i) => <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">&ldquo;{p}&rdquo;<button onClick={() => onChange(phrases.filter((_, j) => j !== i))}><X className="w-3 h-3 text-neutral-400 hover:text-neutral-700" /></button></span>)}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Escribe una frase y presiona Enter..." className={cn(ic, 'flex-1')} />
        <button onClick={add} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── Section components ────────────────────────────────────────────────────────

function SEstado({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  return <div className="space-y-4">
    <ToggleRow label="Asistente activo" sub="Habilita o deshabilita el asistente globalmente" checked={s.is_active} onChange={v => set({ is_active: v })} />
    <ToggleRow label="Activar automaticamente en nuevos contactos" sub="El asistente iniciara en cada nuevo contacto entrante" checked={s.auto_activate_on_new_contact} onChange={v => set({ auto_activate_on_new_contact: v })} />
    <Field label="Minutos de inactividad antes de transferir"><input type="number" min={1} max={120} value={s.max_inactive_minutes} onChange={e => set({ max_inactive_minutes: +e.target.value })} className={ic} /></Field>
    <Field label="Idioma predeterminado"><select value={s.default_language} onChange={e => set({ default_language: e.target.value as 'es'|'en' })} className={sc}><option value="es">Espanol (es)</option><option value="en">English (en)</option></select></Field>
  </div>;
}

function SInstrucciones({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  return <Field label="Instrucciones para el asistente" hint="Define el comportamiento general del asistente. Se envia en cada conversacion como contexto base.">
    <textarea rows={10} value={s.base_instructions} onChange={e => set({ base_instructions: e.target.value })} placeholder={"Eres un asistente de MOVI Digital...\nResponde de forma clara, profesional y empatica.\n..."} className={cn(ic, 'resize-y min-h-[200px] font-mono text-xs leading-relaxed')} />
  </Field>;
}

function STono({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const t = s.tone_json; const u = (p: Partial<ToneJson>) => set({ tone_json: { ...t, ...p } });
  return <div className="space-y-4">
    <Field label="Formalidad"><select value={t.formality} onChange={e => u({ formality: e.target.value as ToneJson['formality'] })} className={sc}><option value="formal">Formal</option><option value="semiformal">Semiformal</option><option value="casual">Casual</option></select></Field>
    <Field label="Nivel de empatia"><select value={t.empathy_level} onChange={e => u({ empathy_level: e.target.value as ToneJson['empathy_level'] })} className={sc}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></Field>
    <ToggleRow label="Usar nombre del cliente" checked={t.use_name} onChange={v => u({ use_name: v })} />
    <ToggleRow label="Usar tratamiento (Sr./Sra.)" checked={t.use_honorifics} onChange={v => u({ use_honorifics: v })} />
    <Field label="Notas de estilo adicionales"><textarea rows={3} value={t.custom_style_notes} onChange={e => u({ custom_style_notes: e.target.value })} placeholder="Ej: Evitar terminos tecnicos..." className={cn(ic, 'resize-y')} /></Field>
  </div>;
}

function SIntervencion({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const levels = [
    { value: 'conservative', title: 'Conservador', desc: 'Solo responde cuando hay intent claro' },
    { value: 'balanced', title: 'Equilibrado', desc: 'Interviene en la mayoria de mensajes relevantes', rec: true },
    { value: 'proactive', title: 'Proactivo', desc: 'Interviene en casi todos los mensajes entrantes' },
  ] as const;
  return <div className="space-y-5">
    <div className="space-y-2">
      {levels.map(l => (
        <label key={l.value} className={cn('flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all', s.intervention_level === l.value ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 hover:border-neutral-300 bg-white')}>
          <input type="radio" name="ivl" value={l.value} checked={s.intervention_level === l.value} onChange={() => set({ intervention_level: l.value })} className="mt-0.5 accent-blue-600" />
          <div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-neutral-800">{l.title}</span>{'rec' in l && l.rec && <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-blue-600 text-white rounded">Recomendado</span>}</div><p className="text-xs text-neutral-500 mt-0.5">{l.desc}</p></div>
        </label>
      ))}
    </div>
    <Field label={`Umbral de confianza minimo: ${s.confidence_threshold}%`}>
      <input type="range" min={0} max={100} step={5} value={s.confidence_threshold} onChange={e => set({ confidence_threshold: +e.target.value })} className="w-full accent-blue-600" />
      <div className="flex justify-between text-xs text-neutral-400 mt-0.5"><span>0%</span><span>50%</span><span>100%</span></div>
    </Field>
  </div>;
}

function SFirma({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  return <div className="space-y-5">
    <Field label="Firma al final de mensajes automaticos"><input value={s.message_signature} onChange={e => set({ message_signature: e.target.value })} placeholder="- MOVI IA" className={ic} /></Field>
    <div><p className="text-xs font-medium text-neutral-500 mb-2">Vista previa</p>
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4"><div className="max-w-xs ml-auto">
        <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-line shadow-sm">{`Hola, adjunto encontraras el resumen de tu poliza.\n${s.message_signature}`}</div>
      </div></div>
    </div>
  </div>;
}

function SAcciones({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const acts = [
    { k: 'create_tramite' as const, l: 'Crear tramite automaticamente', d: 'Inicia un tramite basado en la solicitud del cliente' },
    { k: 'send_summary' as const, l: 'Enviar resumen por correo', d: 'Envia un resumen de la conversacion al finalizar' },
    { k: 'transfer_to_agent' as const, l: 'Transferir a agente', d: 'Escala la conversacion a un agente humano' },
    { k: 'send_documents' as const, l: 'Solicitar documentos', d: 'Pide documentos al cliente cuando sea necesario' },
    { k: 'schedule_followup' as const, l: 'Programar seguimiento', d: 'Agrega un recordatorio de seguimiento automatico' },
  ];
  return <div className="space-y-3">{acts.map(a => (
    <label key={a.k} className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 cursor-pointer bg-white transition-all">
      <input type="checkbox" checked={s.allowed_actions_json[a.k]} onChange={e => set({ allowed_actions_json: { ...s.allowed_actions_json, [a.k]: e.target.checked } })} className="mt-0.5 accent-blue-600 w-4 h-4" />
      <div><p className="text-sm font-medium text-neutral-800">{a.l}</p><p className="text-xs text-neutral-400 mt-0.5">{a.d}</p></div>
    </label>
  ))}</div>;
}

function SConocimiento({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [exp, setExp] = useState<number|null>(null);
  const entries = s.knowledge_base_json;
  return <div className="space-y-5">
    <p className="text-xs text-neutral-500">Informacion que el asistente puede consultar para responder preguntas frecuentes.</p>
    <div className="space-y-2">
      {entries.length === 0 && <p className="text-xs text-neutral-400 italic">Sin entradas de conocimiento.</p>}
      {entries.map((e, i) => (
        <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-white">
            <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExp(exp === i ? null : i)}>
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0" /><span className="text-sm font-medium text-neutral-800">{e.title}</span><ChevronDown className={cn('w-4 h-4 text-neutral-400 ml-auto transition-transform', exp === i && 'rotate-180')} />
            </button>
            <button onClick={() => set({ knowledge_base_json: entries.filter((_, j) => j !== i) })} className="ml-3 p-1 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
          {exp === i && <div className="px-4 pb-4 bg-neutral-50 border-t border-neutral-100"><p className="text-xs text-neutral-600 whitespace-pre-wrap mt-3">{e.content}</p></div>}
        </div>
      ))}
    </div>
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Agregar entrada</p>
      <Field label="Titulo"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Cobertura de seguro de auto" className={ic} /></Field>
      <Field label="Contenido"><textarea rows={3} value={content} onChange={e => setContent(e.target.value)} placeholder="Describe la informacion..." className={cn(ic, 'resize-y')} /></Field>
      <button onClick={() => { if (title.trim() && content.trim()) { set({ knowledge_base_json: [...entries, { title: title.trim(), content: content.trim() }] }); setTitle(''); setContent(''); } }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> Agregar entrada</button>
    </div>
  </div>;
}

function SSimulador({ settings }: { settings: Settings }) {
  const [msgs, setMsgs] = useState<{ role: 'user'|'assistant'; text: string }[]>([]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const send = async () => {
    const text = input.trim(); if (!text || loading) return;
    setInput(''); setMsgs(m => [...m, { role: 'user', text }]); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-center-smart-assistant', { body: { test_mode: true, message: text, settings } });
      if (error) throw error;
      setMsgs(m => [...m, { role: 'assistant', text: data?.response ?? data?.message ?? JSON.stringify(data) }]);
    } catch { setMsgs(m => [...m, { role: 'assistant', text: '[Error al conectar con el asistente]' }]); }
    finally { setLoading(false); }
  };
  return <div className="flex flex-col space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700"><strong>Modo de prueba.</strong> Las respuestas no generan tramites ni se guardan.</div>
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 overflow-y-auto space-y-3 h-80">
      {msgs.length === 0 && <p className="text-xs text-neutral-400 text-center mt-8">Escribe un mensaje para probar el asistente con la configuracion actual.</p>}
      {msgs.map((m, i) => (
        <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div className={cn('max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm')}>{m.text}</div>
        </div>
      ))}
      {loading && <div className="flex justify-start"><div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-neutral-400 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Procesando...</div></div>}
      <div ref={ref} />
    </div>
    <div className="flex gap-2">
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Escribe un mensaje de prueba..." className={cn(ic, 'flex-1')} disabled={loading} />
      <button onClick={send} disabled={loading || !input.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
    </div>
  </div>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SectionId = 'estado'|'instrucciones'|'tono'|'intervencion'|'activacion'|'silencio'|'stop'|'reactivate'|'firma'|'acciones'|'conocimiento'|'simulador';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'estado', label: 'Estado General', icon: Settings },
  { id: 'instrucciones', label: 'Instrucciones Base', icon: PenLine },
  { id: 'tono', label: 'Tono y Personalidad', icon: MessageSquare },
  { id: 'intervencion', label: 'Nivel de Intervencion', icon: Sliders },
  { id: 'activacion', label: 'Reglas de Activacion', icon: Zap },
  { id: 'silencio', label: 'Reglas para no Intervenir', icon: VolumeX },
  { id: 'stop', label: 'Frases para Pausar', icon: StopCircle },
  { id: 'reactivate', label: 'Frases para Reactivar', icon: RefreshCw },
  { id: 'firma', label: 'Firma de Mensajes', icon: PenLine },
  { id: 'acciones', label: 'Acciones Permitidas', icon: ShieldCheck },
  { id: 'conocimiento', label: 'Base de Conocimiento', icon: BookOpen },
  { id: 'simulador', label: 'Simulador de Prueba', icon: FlaskConical },
];

const ACT_TYPES = [{ value: 'always', label: 'Siempre activo' }, { value: 'no_agent_available', label: 'Sin agente disponible' }, { value: 'keyword_match', label: 'Palabra clave', hasValue: true }, { value: 'time_window', label: 'Ventana de tiempo', hasValue: true }];
const SIL_TYPES = [{ value: 'agent_active', label: 'Agente activo' }, { value: 'keyword_match', label: 'Palabra clave', hasValue: true }, { value: 'tag_match', label: 'Etiqueta de contacto', hasValue: true }, { value: 'contact_type', label: 'Tipo de contacto', hasValue: true }];

export default function AsistenteEntrenamiento() {
  const { usuario } = useAuth();
  const [active, setActive] = useState<SectionId>('estado');
  const [s, setS] = useState<Settings>(DEF);
  const [rowId, setRowId] = useState<string|undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success'|'error'; msg: string }|null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('contact_center_smart_assistant_settings').select('*').is('office_id', null).maybeSingle();
      if (data) {
        setRowId(data.id);
        setS({ id: data.id, is_active: data.is_active ?? false, auto_activate_on_new_contact: data.auto_activate_on_new_contact ?? false, max_inactive_minutes: data.max_inactive_minutes ?? 10, default_language: data.default_language ?? 'es', base_instructions: data.base_instructions ?? '', tone_json: (data.tone_json as ToneJson) ?? DEF.tone_json, intervention_level: (data.intervention_level as Settings['intervention_level']) ?? 'balanced', confidence_threshold: data.confidence_threshold ?? 70, activation_rules_json: (data.activation_rules_json as Rule[]) ?? [], silence_rules_json: (data.silence_rules_json as Rule[]) ?? [], stop_phrases_json: (data.stop_phrases_json as string[]) ?? [], reactivate_phrases_json: (data.reactivate_phrases_json as string[]) ?? [], message_signature: data.message_signature ?? '- MOVI IA', allowed_actions_json: (data.allowed_actions_json as AllowedActions) ?? DEF.allowed_actions_json, knowledge_base_json: (data.knowledge_base_json as KnowledgeEntry[]) ?? [] });
      }
    })();
  }, []);

  const patch = (p: Partial<Settings>) => setS(prev => ({ ...prev, ...p }));

  const showToast = (type: 'success'|'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...(rowId ? { id: rowId } : {}), office_id: null, is_active: s.is_active, auto_activate_on_new_contact: s.auto_activate_on_new_contact, max_inactive_minutes: s.max_inactive_minutes, default_language: s.default_language, base_instructions: s.base_instructions, tone_json: s.tone_json, intervention_level: s.intervention_level, confidence_threshold: s.confidence_threshold, activation_rules_json: s.activation_rules_json, silence_rules_json: s.silence_rules_json, stop_phrases_json: s.stop_phrases_json, reactivate_phrases_json: s.reactivate_phrases_json, message_signature: s.message_signature, allowed_actions_json: s.allowed_actions_json, knowledge_base_json: s.knowledge_base_json, updated_by: usuario?.id, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('contact_center_smart_assistant_settings').upsert(payload).select('id').maybeSingle();
      if (error) throw error;
      if (data?.id && !rowId) setRowId(data.id);
      showToast('success', 'Configuracion guardada correctamente.');
    } catch (e: unknown) { showToast('error', (e as Error)?.message ?? 'Error al guardar.'); }
    finally { setSaving(false); }
  };

  const sec = SECTIONS.find(x => x.id === active)!;

  const body = () => {
    switch (active) {
      case 'estado': return <SEstado s={s} set={patch} />;
      case 'instrucciones': return <SInstrucciones s={s} set={patch} />;
      case 'tono': return <STono s={s} set={patch} />;
      case 'intervencion': return <SIntervencion s={s} set={patch} />;
      case 'activacion': return <RulesPanel rules={s.activation_rules_json} onAdd={r => patch({ activation_rules_json: [...s.activation_rules_json, r] })} onRemove={i => patch({ activation_rules_json: s.activation_rules_json.filter((_, j) => j !== i) })} types={ACT_TYPES} placeholder="Ej: cotizacion, hola..." />;
      case 'silencio': return <RulesPanel rules={s.silence_rules_json} onAdd={r => patch({ silence_rules_json: [...s.silence_rules_json, r] })} onRemove={i => patch({ silence_rules_json: s.silence_rules_json.filter((_, j) => j !== i) })} types={SIL_TYPES} placeholder="Ej: VIP, urgente..." />;
      case 'stop': return <PhrasesPanel phrases={s.stop_phrases_json} onChange={p => patch({ stop_phrases_json: p })} hint="Si el cliente escribe alguna de estas frases, el asistente se detendra y transferira al agente." />;
      case 'reactivate': return <PhrasesPanel phrases={s.reactivate_phrases_json} onChange={p => patch({ reactivate_phrases_json: p })} hint="Si el cliente escribe alguna de estas frases, el asistente se reactivara automaticamente." />;
      case 'firma': return <SFirma s={s} set={patch} />;
      case 'acciones': return <SAcciones s={s} set={patch} />;
      case 'conocimiento': return <SConocimiento s={s} set={patch} />;
      case 'simulador': return <SSimulador settings={s} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {toast && (
        <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {toast.msg}
        </div>
      )}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/centro-contacto/asistentes" className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600 shrink-0" />
              <div><h1 className="text-sm font-bold text-neutral-900">Entrenamiento del Asistente Inteligente</h1><p className="text-xs text-neutral-400 hidden sm:block">Configura el comportamiento, personalidad y reglas del asistente automatico</p></div>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </button>
        </div>
      </header>
      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col sm:flex-row gap-6 px-4 sm:px-6 py-6">
        <aside className="w-full sm:w-56 lg:w-60 shrink-0">
          <nav className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {SECTIONS.map((x, idx) => {
              const Icon = x.icon; const on = active === x.id;
              return <button key={x.id} onClick={() => setActive(x.id)} className={cn('w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left', idx !== 0 && 'border-t border-neutral-100', on ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900')}>
                <Icon className={cn('w-4 h-4 shrink-0', on ? 'text-blue-600' : 'text-neutral-400')} /><span className="flex-1 leading-tight">{x.label}</span>{on && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
              </button>;
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6 pb-5 border-b border-neutral-100">
              {(() => { const Icon = sec.icon; return <Icon className="w-5 h-5 text-blue-600 shrink-0" />; })()}
              <h2 className="text-base font-bold text-neutral-900">{sec.label}</h2>
            </div>
            {body()}
          </div>
          <div className="sm:hidden">
            <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
