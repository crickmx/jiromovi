import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, RefreshCw, ArrowLeft, MoreVertical, Archive, CheckCircle, Clock,
  Loader2, Smartphone, MessageSquare, Smile, FileText, FormInput, Plus,
  Paperclip, Bot, Star, X, File,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type CCConversation, type CCMessage, type CCChannel,
  formatConversationName, CHANNEL_LABELS,
} from '@/lib/contactCenterTypes';
import { ChannelBadge } from './ChannelBadge';
import { MessageBubble } from './MessageBubble';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFn(slug: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'Apikey': supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

const EMOJIS = [
  '\u{1F44D}','\u{1F44B}','\u{1F64F}','\u{1F60A}','\u{2764}\u{FE0F}','\u{2705}','\u{1F44F}','\u{1F4AA}','\u{1F389}','\u{1F60D}','\u{1F91D}','\u{1F4AF}','\u{2B50}',
  '\u{1F4CB}','\u{1F4DE}','\u{1F4AC}','\u{2728}','\u{1F600}','\u{1F605}','\u{1F602}','\u{1F642}','\u{1F607}','\u{1F970}','\u{1F929}','\u{1F618}','\u{1F60B}',
  '\u{1F61B}','\u{1F911}','\u{1F917}','\u{1F914}','\u{1F910}','\u{1F60F}','\u{1F612}','\u{1F60C}','\u{1F614}','\u{1F634}','\u{1F637}','\u{1F912}','\u{1F635}',
  '\u{1F920}','\u{1F973}','\u{1F60E}','\u{1F913}','\u{1F615}','\u{1F62E}','\u{1F632}','\u{1F633}','\u{1F97A}','\u{1F626}','\u{1F628}','\u{1F630}','\u{1F622}',
  '\u{1F62D}','\u{1F631}','\u{1F621}','\u{1F92C}','\u{1F4F1}','\u{1F4BB}','\u{1F4C4}','\u{1F4CA}','\u{1F4C8}','\u{1F512}','\u{1F5D3}\u{FE0F}','\u{1F4BC}','\u{1F3AF}',
];

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  channel: string;
}

interface QuoteForm {
  id: string;
  title: string;
  category: string;
  slug: string | null;
  form_type: string;
}

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: string;
  is_active: boolean;
}

interface PendingAttachment {
  file: File;
  preview: string | null;
  uploading: boolean;
  error: string | null;
}

interface ConversationThreadProps {
  conversation: CCConversation;
  onBack?: () => void;
  onStatusChange?: (id: string, status: CCConversation['status']) => void;
}

const SEND_CHANNEL_OPTIONS: { value: CCChannel; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'wa_movi',     label: 'WA MOVI',     icon: Smartphone },
  { value: 'wa_personal', label: 'WA Personal', icon: Smartphone },
  { value: 'chat',        label: 'Chat',        icon: MessageSquare },
];

export function ConversationThread({ conversation, onBack, onStatusChange }: ConversationThreadProps) {
  const { usuario } = useAuth();
  const [messages, setMessages] = useState<CCMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [sendChannel, setSendChannel] = useState<CCChannel>(conversation.channel);
  const [showMenu, setShowMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Toolbar state
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showAssistants, setShowAssistants] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tmplSearch, setTmplSearch] = useState('');
  const [tmplLoading, setTmplLoading] = useState(false);

  // Forms
  const [forms, setForms] = useState<QuoteForm[]>([]);
  const [formSearch, setFormSearch] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Ticket creation
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketInstructions, setTicketInstructions] = useState('');

  // AI/Auto mode
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  // File attachment
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cc_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: true });
    setMessages((data as CCMessage[]) || []);
    setLoading(false);
  }, [conversation.id]);

  useEffect(() => {
    loadMessages();
    setSendChannel(conversation.channel);
  }, [conversation.id, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`cc_messages_${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cc_messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, payload => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new as CCMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sendMessage = async () => {
    if (!text.trim() || sending || !usuario) return;
    const body = text.trim();
    setText('');
    setSending(true);

    try {
      const { data: newMsg, error } = await supabase.from('cc_messages').insert({
        conversation_id: conversation.id,
        channel: sendChannel,
        direction: 'outbound',
        message_type: 'text',
        body,
        sender_name: `${usuario.nombres} ${usuario.apellido_paterno}`.trim(),
        sender_user_id: usuario.id,
        sent_at: new Date().toISOString(),
        status: 'pending',
      }).select().single();

      if (!error && newMsg) {
        setMessages(prev => [...prev, newMsg as CCMessage]);
      }

      if (sendChannel === 'wa_movi' && conversation.contact_phone) {
        supabase.functions.invoke('send-direct-whatsapp', {
          body: { phone: conversation.contact_phone, message: body },
        }).then(({ data }) => {
          if (data?.provider_message_id && newMsg) {
            supabase.from('cc_messages').update({
              status: 'sent',
              external_message_id: data.provider_message_id,
            }).eq('id', (newMsg as CCMessage).id);
          }
        });
      } else if (sendChannel === 'wa_personal' && conversation.contact_phone) {
        supabase.functions.invoke('whatsapp-session', {
          body: { action: 'send-message', to: conversation.contact_phone, message: body },
        });
      }

      await supabase.from('cc_conversations').update({
        last_message: body,
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation.id);

    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateStatus = async (status: CCConversation['status']) => {
    await supabase.from('cc_conversations').update({ status }).eq('id', conversation.id);
    onStatusChange?.(conversation.id, status);
    setShowMenu(false);
  };

  // ── Toolbar actions ─────────────────────────────────────────────────────────

  const openPlantillas = async () => {
    setShowPlantillas(true);
    setShowEmoji(false);
    setShowForms(false);
    if (templates.length > 0) return;
    setTmplLoading(true);
    const { data } = await supabase.from('message_templates').select('id, name, category, content, channel').eq('is_active', true).order('category');
    setTemplates((data || []).filter(t => t.channel === 'whatsapp' || t.channel === 'both'));
    setTmplLoading(false);
  };

  const applyTemplate = (t: Template) => {
    const agentName = usuario ? `${usuario.nombres} ${usuario.apellido_paterno}`.trim() : 'Asesor';
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    const contactName = formatConversationName(conversation);
    const content = t.content
      .replace(/\{\{nombre_agente\}\}/g, agentName)
      .replace(/\{\{nombre_contacto\}\}/g, contactName)
      .replace(/\{\{fecha\}\}/g, today);
    setText(content);
    setShowPlantillas(false);
  };

  const openForms = async () => {
    setShowForms(true);
    setShowEmoji(false);
    setShowPlantillas(false);
    if (forms.length > 0) return;
    setFormLoading(true);
    const { data } = await supabase.from('quote_form_templates').select('id, title, category, slug, form_type').eq('is_active', true).order('category');
    setForms(data || []);
    setFormLoading(false);
  };

  const sendFormLink = (form: QuoteForm) => {
    const base = import.meta.env.VITE_APP_URL || 'https://app.movi.digital';
    const url = `${base}/tramites/formularios/nuevo/${form.slug || form.form_type}`;
    setText(`Te comparto el formulario de cotizacion:\n*${form.title}*\n${url}`);
    setShowForms(false);
  };

  const openCreateTicket = () => {
    const ctx = messages.slice(-3).map(m => m.body).filter(Boolean).join('\n');
    setTicketInstructions(ctx.slice(0, 500));
    setShowCreateTicket(true);
  };

  const createTicket = async () => {
    if (!ticketInstructions.trim() || creatingTicket) return;
    setCreatingTicket(true);
    try {
      await callEdgeFn('create-task-from-contact-messages', {
        agent_user_id: usuario?.id,
        contact_phone: conversation.contact_phone,
        contact_name: formatConversationName(conversation),
        messages: messages.slice(-5).map(m => ({
          id: m.id, body: m.body, direction: m.direction, created_at: m.sent_at,
        })),
        instrucciones: ticketInstructions,
        tipo_tramite: 'Atencion_General',
        prioridad: 'media',
      });
      setShowCreateTicket(false);
    } catch { /* ignore */ } finally {
      setCreatingTicket(false);
    }
  };

  const openAssistants = async () => {
    setShowAssistants(true);
    setAutoLoading(true);
    const { data } = await supabase.from('contact_center_assistants').select('id, nombre, descripcion, source, is_active').eq('is_active', true).order('nombre');
    setAssistants((data as CcAssistant[]) || []);
    setAutoLoading(false);
  };

  const startAutoMode = async (assistantId: string) => {
    setShowAssistants(false);
    setAutoLoading(true);
    const result = await callEdgeFn('contact-center-assistant-process', {
      action: 'start_session',
      agent_user_id: usuario?.id,
      assistant_id: assistantId,
    }).catch(() => null);
    if (result?.session_id) {
      setAutoMode(true);
    }
    setAutoLoading(false);
  };

  const stopAutoMode = async () => {
    await callEdgeFn('contact-center-assistant-process', { action: 'cancel_session', agent_user_id: usuario?.id }).catch(() => {});
    setAutoMode(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setPendingAttachment({ file, preview, uploading: false, error: null });
    e.target.value = '';
  };

  const sendAttachment = async () => {
    if (!pendingAttachment || !conversation.contact_phone) return;
    setPendingAttachment(prev => prev ? { ...prev, uploading: true } : null);
    setSending(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pendingAttachment.file);
      });

      await callEdgeFn('whatsapp-session', {
        action: 'send-media',
        to: conversation.contact_phone,
        mediaBase64: base64,
        mimeType: pendingAttachment.file.type,
        filename: pendingAttachment.file.name,
        caption: text.trim() || undefined,
      });
      setPendingAttachment(null);
      setText('');
      await loadMessages();
    } catch (err: any) {
      setPendingAttachment(prev => prev ? { ...prev, uploading: false, error: err?.message || 'Error al enviar' } : null);
    } finally {
      setSending(false);
    }
  };

  const filteredTemplates = templates.filter(t => !tmplSearch || t.name.toLowerCase().includes(tmplSearch.toLowerCase()) || t.content.toLowerCase().includes(tmplSearch.toLowerCase()));
  const filteredForms = forms.filter(f => !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase()));

  const name = formatConversationName(conversation);

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">{name}</p>
            <ChannelBadge channel={conversation.channel} size="sm" />
          </div>
          {conversation.contact_phone && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{conversation.contact_phone}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadMessages}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400"
            title="Actualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg z-10 py-1 text-xs">
                {conversation.status !== 'open' && (
                  <button onClick={() => updateStatus('open')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Marcar abierta
                  </button>
                )}
                {conversation.status !== 'pending' && (
                  <button onClick={() => updateStatus('pending')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Marcar pendiente
                  </button>
                )}
                {conversation.status !== 'closed' && (
                  <button onClick={() => updateStatus('closed')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left text-neutral-500">
                    <CheckCircle className="w-3.5 h-3.5" /> Cerrar conversacion
                  </button>
                )}
                {conversation.status !== 'archived' && (
                  <button onClick={() => updateStatus('archived')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left text-neutral-500">
                    <Archive className="w-3.5 h-3.5" /> Archivar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-neutral-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mb-3" />
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Sin mensajes todavia</p>
            <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">Los mensajes sincronizados aparecen aqui</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showDate = !prev || new Date(msg.sent_at).toDateString() !== new Date(prev.sent_at).toDateString();
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400 text-[10px] rounded-full">
                        {new Date(msg.sent_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    senderName={msg.sender_name || undefined}
                    showSender={conversation.is_group}
                  />
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Composer */}
      {conversation.status !== 'closed' && conversation.status !== 'archived' ? (
        <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3 relative">
          {/* Channel selector */}
          {conversation.channel !== 'chat' && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-neutral-400">Responder por:</span>
              {SEND_CHANNEL_OPTIONS.filter(o => o.value === 'wa_movi' || o.value === 'wa_personal').map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSendChannel(opt.value)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all',
                    sendChannel === opt.value
                      ? 'bg-accent text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  )}
                >
                  <opt.icon className="w-2.5 h-2.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
          />

          {/* Pending attachment preview */}
          {pendingAttachment && (
            <div className="mb-2 flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              {pendingAttachment.preview ? (
                <img src={pendingAttachment.preview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <File className="w-5 h-5 text-blue-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{pendingAttachment.file.name}</p>
                <p className="text-[10px] text-neutral-400">{(pendingAttachment.file.size / 1024).toFixed(0)} KB</p>
                {pendingAttachment.error && <p className="text-[10px] text-red-500">{pendingAttachment.error}</p>}
              </div>
              <button onClick={() => setPendingAttachment(null)} className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-1 mb-2">
            <button onClick={() => { setShowEmoji(v => !v); setShowPlantillas(false); setShowForms(false); }} className={cn('p-1.5 rounded-lg transition-colors', showEmoji ? 'bg-accent/10 text-accent' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600')} title="Emojis">
              <Smile className="w-4 h-4" />
            </button>
            <button onClick={openPlantillas} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Plantillas">
              <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Plantillas</span>
            </button>
            <button onClick={openForms} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Formularios">
              <FormInput className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Formularios</span>
            </button>
            <button onClick={openCreateTicket} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Crear tramite">
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tramite</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Archivo</span>
            </button>
            <button
              onClick={autoMode ? stopAutoMode : openAssistants}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-[11px] font-medium ml-auto',
                autoMode
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-emerald-600'
              )}
              title="Modo IA / Automatico"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{autoMode ? 'Auto activo' : 'IA'}</span>
            </button>
          </div>

          {/* Emoji picker */}
          {showEmoji && (
            <div className="absolute bottom-full left-3 mb-1 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-2">
              <div className="grid grid-cols-10 gap-0.5 max-h-28 overflow-y-auto">
                {EMOJIS.map((e, i) => (
                  <button key={i} onClick={() => { setText(prev => prev + e); setShowEmoji(false); }} className="text-lg p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 leading-none">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-neutral-400 max-h-24 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={pendingAttachment ? sendAttachment : sendMessage}
              disabled={(!text.trim() && !pendingAttachment) || sending}
              className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Enter para enviar, Shift+Enter para nueva linea
            </p>
            <p className="text-[10px] text-neutral-400">
              {CHANNEL_LABELS[sendChannel]}
              {text.length > 450 && <span className="ml-2 text-amber-500">{text.length}/550</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-neutral-400">Conversacion {conversation.status === 'closed' ? 'cerrada' : 'archivada'}</span>
          <button
            onClick={() => updateStatus('open')}
            className="text-xs text-accent hover:underline font-medium"
          >
            Reabrir
          </button>
        </div>
      )}

      {/* ── Plantillas modal ─────────────────────────────────────── */}
      {showPlantillas && (
        <Modal title="Plantillas de mensaje" onClose={() => setShowPlantillas(false)}>
          <input value={tmplSearch} onChange={e => setTmplSearch(e.target.value)} placeholder="Buscar plantilla..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {tmplLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredTemplates.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin plantillas disponibles</p>
            : <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredTemplates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{t.category}</span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{t.content}</p>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Formularios modal ────────────────────────────────────── */}
      {showForms && (
        <Modal title="Formularios de cotizacion" onClose={() => setShowForms(false)}>
          <input value={formSearch} onChange={e => setFormSearch(e.target.value)} placeholder="Buscar formulario..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {formLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredForms.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin formularios</p>
            : <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredForms.map(f => (
                  <button key={f.id} onClick={() => sendFormLink(f)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{f.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{f.category}</span>
                    </div>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Crear tramite modal ──────────────────────────────────── */}
      {showCreateTicket && (
        <Modal title="Crear tramite" onClose={() => setShowCreateTicket(false)}>
          <p className="text-xs text-neutral-500 mb-2">Instrucciones para el tramite (resumen de la conversacion):</p>
          <textarea
            value={ticketInstructions}
            onChange={e => setTicketInstructions(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCreateTicket(false)} className="flex-1 px-4 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-600 hover:bg-neutral-50">Cancelar</button>
            <button onClick={createTicket} disabled={creatingTicket || !ticketInstructions.trim()} className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50">
              {creatingTicket ? 'Creando...' : 'Crear tramite'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Asistentes / Modo IA modal ───────────────────────────── */}
      {showAssistants && (
        <Modal title="Asistentes IA" onClose={() => setShowAssistants(false)}>
          <p className="text-xs text-neutral-500 mb-3">Selecciona un asistente para activar el modo automatico.</p>
          {autoLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : assistants.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin asistentes configurados</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {assistants.map(a => (
                  <button key={a.id} onClick={() => startAutoMode(a.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{a.nombre}</p>
                        {a.descripcion && <p className="text-[11px] text-neutral-500 mt-0.5">{a.descripcion}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}
    </div>
  );
}

// ── Reusable modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
