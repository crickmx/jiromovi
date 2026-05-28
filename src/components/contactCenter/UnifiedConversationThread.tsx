import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, ArrowLeft, Loader2, MoreVertical, CheckSquare, Square,
  Sparkles, Bot, FileText, FormInput, ListTodo, Plus, Smile,
  CheckCircle, Clock, Archive, X, ClipboardList, ExternalLink,
  Image as ImageIcon, FileAudio, FileVideo, File, Download, MapPin,
  Check, CheckCheck, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type UnifiedConversation, type UnifiedMessage,
  getConversationDisplayName, CHANNEL_LABELS, formatMoviPhone,
} from '@/lib/unifiedContactCenter';
import { ChannelBadge } from './ChannelBadge';

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

// ── Emoji categories ──────────────────────────────────────────────────────────
const EMOJIS = [
  '👍','👋','🙏','😊','❤️','✅','👏','💪','🎉','😍','🤝','💯','⭐',
  '📋','📞','💬','✨','😀','😅','😂','🙂','😇','🥰','🤩','😘','😋',
  '😛','🤑','🤗','🤔','🤐','😏','😒','😌','😔','😴','😷','🤒','😵',
  '🤠','🥳','😎','🤓','😕','😮','😲','😳','🥺','😦','😨','😰','😢',
  '😭','😱','😡','🤬','📱','💻','📄','📊','📈','🔒','🗓️','💼','🎯',
];

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  channel: string;
  variables: Array<{ name: string; label: string }>;
}

interface QuoteForm {
  id: string;
  title: string;
  category: string;
  slug: string | null;
  form_type: string;
}

interface OpenTicket {
  id: string;
  folio: string;
  instrucciones: string;
  tipo_tramite: string;
  estatus_nombre: string;
}

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: string;
  is_active: boolean;
}

interface SessionState {
  status: string;
  current_stage: string;
  assistant_name: string;
  captured_count: number;
  total_fields: number;
}

interface Props {
  conversation: UnifiedConversation;
  onBack?: () => void;
  currentUserId: string;
  participantNames: Record<string, string>;
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === 'read' || status === 'delivered') return <CheckCheck className="w-3 h-3 text-emerald-400" />;
  if (status === 'sent') return <Check className="w-3 h-3 text-neutral-400" />;
  if (status === 'failed') return <AlertCircle className="w-3 h-3 text-red-400" />;
  return null;
}

// ── Media bubble ──────────────────────────────────────────────────────────────
function MediaBubble({ msg }: { msg: UnifiedMessage }) {
  const type = msg.messageType;

  if (type === 'image' && msg.mediaUrl) {
    return (
      <div className="space-y-1">
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={msg.mediaThumbnail || msg.mediaUrl}
            alt="imagen"
            className="max-w-[220px] rounded-lg object-cover border border-black/10"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </a>
        {msg.body && <p className="text-sm leading-relaxed mt-1">{msg.body}</p>}
      </div>
    );
  }
  if (type === 'sticker' && msg.mediaUrl) {
    return <img src={msg.mediaUrl} alt="sticker" className="w-20 h-20 object-contain" />;
  }
  if (type === 'audio') {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <FileAudio className="w-4 h-4 opacity-70 flex-shrink-0" />
        {msg.mediaUrl
          ? <audio controls className="max-w-[180px] h-8"><source src={msg.mediaUrl} type={msg.mediaMime || 'audio/ogg'} /></audio>
          : <span className="text-xs opacity-60">Audio no disponible</span>}
      </div>
    );
  }
  if (type === 'video') {
    return (
      <div className="space-y-1">
        {msg.mediaUrl
          ? <video controls className="max-w-[220px] rounded-lg" poster={msg.mediaThumbnail || undefined}><source src={msg.mediaUrl} type={msg.mediaMime || 'video/mp4'} /></video>
          : <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg"><FileVideo className="w-4 h-4 opacity-60" /><span className="text-xs opacity-70">[Video no disponible]</span></div>}
        {msg.body && <p className="text-sm">{msg.body}</p>}
      </div>
    );
  }
  if (type === 'document') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg max-w-[220px]">
        <File className="w-5 h-5 opacity-70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{msg.mediaFilename || 'Documento'}</p>
          {msg.mediaMime && <p className="text-[10px] opacity-60">{msg.mediaMime}</p>}
        </div>
        {msg.mediaUrl && <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 opacity-70 hover:opacity-100" /></a>}
      </div>
    );
  }
  if (type === 'location') {
    const mapsUrl = msg.locationLat && msg.locationLng ? `https://maps.google.com/?q=${msg.locationLat},${msg.locationLng}` : null;
    return (
      <a href={mapsUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg hover:bg-black/15">
        <MapPin className="w-4 h-4 opacity-70" />
        <span className="text-xs">{msg.locationLabel || 'Ver ubicacion'}</span>
      </a>
    );
  }
  if (type === 'system') {
    return <p className="text-xs opacity-70 italic">{msg.body || '[Mensaje del sistema]'}</p>;
  }
  return msg.body ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p> : <p className="text-xs opacity-50 italic">Multimedia</p>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function UnifiedConversationThread({ conversation, onBack, currentUserId, participantNames }: Props) {
  const { usuario } = useAuth();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Panels / modals
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);
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
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketInstructions, setTicketInstructions] = useState('');

  // Automatic/AI mode
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [autoSession, setAutoSession] = useState<SessionState | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const isMoviChannel = conversation.channel === 'wa_movi';
  const name = getConversationDisplayName(conversation, participantNames);

  // ── Load messages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { channel, sourceId } = conversation;
    try {
      if (channel === 'wa_movi') {
        const isPhone = !sourceId.startsWith('agent:');
        let q = supabase
          .from('contact_center_messages')
          .select('id, direction, body, created_at, status, metadata, attachment_urls, sender_type, sender_user_id, contact_name, contact_phone, read_at')
          .eq('channel', 'whatsapp')
          .order('created_at', { ascending: true });

        if (isPhone) q = q.eq('contact_phone', sourceId);
        else q = q.eq('agent_user_id', sourceId.replace('agent:', ''));

        const { data } = await q.limit(300);

        // Resolve sender names for outbound
        const senderIds = [...new Set((data || []).filter(m => m.direction === 'outbound' && m.sender_user_id).map(m => m.sender_user_id))];
        const senderMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: users } = await supabase.from('usuarios').select('id, nombres, apellido_paterno').in('id', senderIds);
          for (const u of users || []) senderMap[u.id] = `${u.nombres} ${u.apellido_paterno}`.trim();
        }

        setMessages((data || []).map((m: any): UnifiedMessage => {
          const meta = (m.metadata as Record<string, unknown>) || {};
          const mediaUri = (meta.content_uri as string) || null;
          const msgType = (meta.message_type as string) || 'text';
          const atts = m.attachment_urls && Array.isArray(m.attachment_urls) ? m.attachment_urls : [];
          const firstAtt = atts[0];

          return {
            id: m.id,
            direction: m.direction === 'inbound' ? 'inbound' : 'outbound',
            messageType: msgType,
            body: m.body || null,
            mediaUrl: mediaUri || (firstAtt?.url) || null,
            mediaMime: null,
            mediaFilename: firstAtt?.name || null,
            mediaThumbnail: null,
            locationLat: null,
            locationLng: null,
            locationLabel: null,
            senderName: m.direction === 'inbound'
              ? (m.contact_name || (meta.contact_name as string) || m.contact_phone || 'Cliente')
              : (m.sender_type === 'system' ? 'Sistema' : senderMap[m.sender_user_id] || 'Asesor'),
            sentAt: m.created_at,
            status: m.status || 'sent',
            raw: m,
          };
        }));

        // Mark as read
        if (conversation.agentUserId) {
          await supabase.rpc('mark_contact_messages_read', {
            p_agent_user_id: conversation.agentUserId,
            p_user_id: currentUserId,
          }).catch(() => {});
        }

      } else if (channel === 'wa_personal') {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('id, direction, message_type, content, media_url, media_filename, media_mime_type, media_thumbnail_url, media_caption, status, created_at')
          .eq('conversation_id', sourceId)
          .order('created_at', { ascending: true })
          .limit(300);

        setMessages((data || []).map((m: any): UnifiedMessage => ({
          id: m.id,
          direction: m.direction,
          messageType: m.message_type || 'text',
          body: m.content || m.media_caption || null,
          mediaUrl: m.media_url || null,
          mediaMime: m.media_mime_type || null,
          mediaFilename: m.media_filename || null,
          mediaThumbnail: m.media_thumbnail_url || null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          senderName: null,
          sentAt: m.created_at,
          status: m.status || 'sent',
          raw: m,
        })));

      } else if (channel === 'chat') {
        const { data } = await supabase
          .from('chat_mensajes')
          .select('id, remitente_id, mensaje, created_at')
          .eq('chat_id', sourceId)
          .eq('eliminado', false)
          .order('created_at', { ascending: true })
          .limit(300);

        setMessages((data || []).map((m: any): UnifiedMessage => ({
          id: m.id,
          direction: m.remitente_id === currentUserId ? 'outbound' : 'inbound',
          messageType: 'text',
          body: m.mensaje || null,
          mediaUrl: null, mediaMime: null, mediaFilename: null, mediaThumbnail: null,
          locationLat: null, locationLng: null, locationLabel: null,
          senderName: m.remitente_id !== currentUserId ? (participantNames[m.remitente_id] || null) : null,
          sentAt: m.created_at,
          status: 'sent',
          raw: m,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [conversation.id, conversation.channel, conversation.sourceId, currentUserId, participantNames, conversation.agentUserId]);

  useEffect(() => { loadMessages(); setText(''); setSelectionMode(false); setSelectedIds(new Set()); }, [loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Realtime
  useEffect(() => {
    const { channel, sourceId } = conversation;
    if (channel === 'wa_personal') {
      const ch = supabase.channel(`wa_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${sourceId}` }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'chat') {
      const ch = supabase.channel(`chat_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `chat_id=eq.${sourceId}` }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'wa_movi') {
      const ch = supabase.channel(`movi_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_center_messages' }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [conversation.id, loadMessages]);

  // Close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Load auto mode state for WA MOVI ───────────────────────────────────────
  useEffect(() => {
    if (!isMoviChannel || !conversation.agentUserId) return;
    callEdgeFn('contact-center-assistant-process', {
      action: 'get_session_state',
      agent_user_id: conversation.agentUserId,
    }).then(d => {
      if (d?.mode === 'automatic' && d?.active_session) {
        setAutoMode(true);
        setAutoSession(d.active_session);
      } else {
        setAutoMode(false);
        setAutoSession(null);
      }
    }).catch(() => {});
  }, [conversation.id, isMoviChannel, conversation.agentUserId]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const { channel, sourceId } = conversation;
      if (channel === 'wa_movi') {
        if (conversation.contactPhone) {
          await callEdgeFn('send-contact-whatsapp', { phone: conversation.contactPhone, message: body, agent_user_id: currentUserId });
        }
      } else if (channel === 'wa_personal') {
        const { data: conv } = await supabase.from('whatsapp_conversations').select('remote_phone').eq('id', sourceId).single();
        await supabase.functions.invoke('whatsapp-session', { body: { action: 'send-message', phone: conv?.remote_phone, message: body } });
        await supabase.from('whatsapp_messages').insert({ conversation_id: sourceId, user_id: currentUserId, direction: 'outbound', message_type: 'text', content: body, status: 'pending' });
      } else if (channel === 'chat') {
        await supabase.from('chat_mensajes').insert({ chat_id: sourceId, remitente_id: currentUserId, mensaje: body });
      }
      await loadMessages();
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ── Load templates ──────────────────────────────────────────────────────────
  const openPlantillas = async () => {
    setShowPlantillas(true);
    if (templates.length > 0) return;
    setTmplLoading(true);
    const { data } = await supabase.from('message_templates').select('id, name, category, content, channel, variables').eq('is_active', true).order('category');
    setTemplates((data || []).filter(t => t.channel === 'whatsapp' || t.channel === 'both'));
    setTmplLoading(false);
  };

  const applyTemplate = (t: Template) => {
    const agentName = usuario ? `${usuario.nombres} ${usuario.apellido_paterno}`.trim() : 'Asesor';
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    let content = t.content
      .replace(/\{\{nombre_agente\}\}/g, agentName)
      .replace(/\{\{nombre_contacto\}\}/g, name)
      .replace(/\{\{fecha\}\}/g, today);
    setText(content);
    setShowPlantillas(false);
  };

  // ── Load forms ──────────────────────────────────────────────────────────────
  const openForms = async () => {
    setShowForms(true);
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

  // ── Create ticket ───────────────────────────────────────────────────────────
  const openCreateTicket = () => {
    const selected = messages.filter(m => selectedIds.has(m.id));
    const ctx = selected.length > 0 ? selected.map(m => m.body).filter(Boolean).join('\n') : messages.slice(-3).map(m => m.body).filter(Boolean).join('\n');
    setTicketInstructions(ctx.slice(0, 500));
    setShowCreateTicket(true);
  };

  const createTicket = async () => {
    if (!ticketInstructions.trim() || creatingTicket) return;
    setCreatingTicket(true);
    try {
      const selectedMsgs = messages.filter(m => selectedIds.has(m.id));
      await callEdgeFn('create-task-from-contact-messages', {
        agent_user_id: conversation.agentUserId || currentUserId,
        contact_phone: conversation.contactPhone,
        contact_name: name,
        messages: (selectedMsgs.length > 0 ? selectedMsgs : messages.slice(-5)).map(m => ({
          id: m.id, body: m.body, direction: m.direction, created_at: m.sentAt,
        })),
        instrucciones: ticketInstructions,
        tipo_tramite: 'Atencion_General',
        prioridad: 'media',
      });
      setShowCreateTicket(false);
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch { /* ignore */ } finally {
      setCreatingTicket(false);
    }
  };

  // ── Add to existing ticket ──────────────────────────────────────────────────
  const openAddTicket = async () => {
    setShowAddTicket(true);
    setTicketLoading(true);
    const result = await callEdgeFn('get-agent-open-tickets', { agent_user_id: currentUserId }).catch(() => ({ tickets: [] }));
    setOpenTickets(result?.tickets || []);
    setTicketLoading(false);
  };

  const addToTicket = async (ticketId: string) => {
    const selected = messages.filter(m => selectedIds.has(m.id));
    await callEdgeFn('add-contact-messages-to-task', {
      ticket_id: ticketId,
      agent_user_id: currentUserId,
      messages: (selected.length > 0 ? selected : messages.slice(-3)).map(m => ({ id: m.id, body: m.body, direction: m.direction, created_at: m.sentAt })),
    }).catch(() => {});
    setShowAddTicket(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ── Assistants / Auto mode ──────────────────────────────────────────────────
  const openAssistants = async () => {
    setShowAssistants(true);
    setAutoLoading(true);
    const { data } = await supabase.from('contact_center_assistants').select('id, nombre, descripcion, source, is_active').eq('is_active', true).order('nombre').catch(() => ({ data: [] }));
    setAssistants((data as CcAssistant[]) || []);
    setAutoLoading(false);
  };

  const startAutoMode = async (assistantId: string) => {
    if (!conversation.agentUserId) return;
    setShowAssistants(false);
    setAutoLoading(true);
    const result = await callEdgeFn('contact-center-assistant-process', {
      action: 'start_session',
      agent_user_id: conversation.agentUserId,
      assistant_id: assistantId,
    }).catch(() => null);
    if (result?.session_id) {
      setAutoMode(true);
      setAutoSession({ status: 'active', current_stage: result.stage, assistant_name: result.assistant_name, captured_count: 0, total_fields: result.total_fields });
    }
    setAutoLoading(false);
  };

  const stopAutoMode = async () => {
    if (!conversation.agentUserId) return;
    await callEdgeFn('contact-center-assistant-process', { action: 'cancel_session', agent_user_id: conversation.agentUserId }).catch(() => {});
    setAutoMode(false);
    setAutoSession(null);
  };

  const filteredTemplates = templates.filter(t => !tmplSearch || t.name.toLowerCase().includes(tmplSearch.toLowerCase()) || t.content.toLowerCase().includes(tmplSearch.toLowerCase()));
  const filteredForms = forms.filter(f => !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase()));
  const filteredTickets = openTickets.filter(t => !ticketSearch || t.folio.toLowerCase().includes(ticketSearch.toLowerCase()) || t.instrucciones?.toLowerCase().includes(ticketSearch.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 relative">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {selectionMode ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{selectedIds.size} seleccionados</span>
            <button onClick={openCreateTicket} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90">
              <Plus className="w-3 h-3" /> Crear tramite
            </button>
            <button onClick={openAddTicket} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50">
              <ListTodo className="w-3 h-3" /> Agregar a tramite
            </button>
            <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="ml-auto p-1.5 text-neutral-400 hover:text-neutral-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">{name}</p>
                <ChannelBadge channel={conversation.channel} size="sm" />
                {autoMode && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Bot className="w-2.5 h-2.5" /> Auto activo
                  </span>
                )}
              </div>
              {conversation.contactPhone && (
                <p className="text-[11px] text-neutral-400">{formatMoviPhone(conversation.contactPhone)}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* IA + Auto buttons — always visible for WA MOVI */}
              {isMoviChannel && (
                <>
                  <button
                    onClick={openAssistants}
                    title="Modo IA"
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      autoMode
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-emerald-300 hover:text-emerald-600'
                    )}
                  >
                    <Sparkles className="w-3 h-3" /> IA
                  </button>
                  <button
                    onClick={autoMode ? stopAutoMode : openAssistants}
                    title={autoMode ? 'Desactivar modo automatico' : 'Activar modo automatico'}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      autoMode
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-emerald-300 hover:text-emerald-600'
                    )}
                  >
                    <Bot className="w-3 h-3" /> Auto{autoMode && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                </>
              )}
              {/* Selection mode */}
              <button onClick={() => setSelectionMode(true)} title="Seleccionar mensajes" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                <CheckSquare className="w-4 h-4" />
              </button>
              {/* Menu */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setShowMenu(v => !v)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg z-20 py-1 text-xs">
                    <button onClick={() => { setSelectionMode(true); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <CheckSquare className="w-3.5 h-3.5 text-neutral-400" /> Seleccionar mensajes
                    </button>
                    <button onClick={() => { openCreateTicket(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <Plus className="w-3.5 h-3.5 text-accent" /> Crear tramite
                    </button>
                    <button onClick={() => { openAddTicket(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <ListTodo className="w-3.5 h-3.5 text-neutral-400" /> Agregar a tramite
                    </button>
                    {isMoviChannel && (
                      <button onClick={() => { openAssistants(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                        <Bot className="w-3.5 h-3.5 text-violet-500" /> Modo IA
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Auto mode banner ─────────────────────────────────────── */}
      {autoMode && autoSession && (
        <div className="flex-shrink-0 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/15 border-b border-emerald-100 dark:border-emerald-800/30">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{autoSession.assistant_name}</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">Auto activo</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 bg-emerald-100 dark:bg-emerald-800/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${autoSession.total_fields > 0 ? (autoSession.captured_count / autoSession.total_fields) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex-shrink-0 tabular-nums">
                  {autoSession.captured_count}/{autoSession.total_fields} campos
                </span>
              </div>
            </div>
            <button onClick={stopAutoMode} className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium flex-shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
              Detener
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0" onClick={() => { setShowEmoji(false); }}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-neutral-300 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <p className="text-sm text-neutral-400">Sin mensajes todavia</p>
          </div>
        ) : messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showDate = !prev || new Date(msg.sentAt).toDateString() !== new Date(prev.sentAt).toDateString();
          const isOut = msg.direction === 'outbound';
          const isSystem = msg.messageType === 'system';
          const isSelected = selectedIds.has(msg.id);

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[11px] rounded-full">{msg.body}</span>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400 text-[10px] rounded-full">
                    {new Date(msg.sentAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}
              <div
                className={cn('flex mb-1 group', isOut ? 'justify-end' : 'justify-start', selectionMode && 'cursor-pointer')}
                onClick={selectionMode ? () => toggleSelect(msg.id) : undefined}
              >
                {selectionMode && (
                  <div className="flex items-end pb-2 mr-2">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-accent" />
                      : <Square className="w-4 h-4 text-neutral-300" />}
                  </div>
                )}
                <div className={cn('max-w-[78%]', isSelected && 'ring-2 ring-accent/40 rounded-2xl')}>
                  {msg.senderName && !isOut && (
                    <p className="text-[10px] text-neutral-400 ml-1 mb-0.5">{msg.senderName}</p>
                  )}
                  <div className={cn(
                    'rounded-2xl px-3 py-2 shadow-sm text-sm',
                    isOut
                      ? 'bg-accent text-white rounded-tr-sm'
                      : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700 rounded-tl-sm'
                  )}>
                    <MediaBubble msg={msg} />
                  </div>
                  <div className={cn('flex items-center gap-1 mt-0.5 px-1', isOut ? 'justify-end' : 'justify-start')}>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(msg.sentAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                    {isOut && <StatusIcon status={msg.status} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Composer ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-3 py-2.5 relative">
        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-2">
          <button onClick={() => setShowEmoji(v => !v)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors" title="Emojis">
            <Smile className="w-4 h-4" />
          </button>
          <button onClick={openPlantillas} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Plantillas">
            <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Plantilla</span>
          </button>
          <button onClick={openForms} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Formularios">
            <FormInput className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Formulario</span>
          </button>
          <button onClick={openCreateTicket} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Crear tramite">
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tramite</span>
          </button>
          {isMoviChannel && (
            <button
              onClick={autoMode ? stopAutoMode : openAssistants}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-[11px] font-medium ml-1',
                autoMode
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-emerald-600'
              )}
              title="Modo IA / Automatico"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{autoMode ? 'Auto activo' : 'Modo IA'}</span>
            </button>
          )}
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div className="absolute bottom-full left-3 mb-1 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-2">
            <div className="grid grid-cols-10 gap-0.5 max-h-28 overflow-y-auto">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { setText(prev => prev + e); setShowEmoji(false); }} className="text-lg p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 leading-none">
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
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-neutral-400 max-h-24 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1 text-center">
          {CHANNEL_LABELS[conversation.channel]}
          {text.length > 450 && <span className="ml-2 text-amber-500">{text.length}/550</span>}
        </p>
      </div>

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

      {/* ── Agregar a tramite modal ──────────────────────────────── */}
      {showAddTicket && (
        <Modal title="Agregar a tramite existente" onClose={() => setShowAddTicket(false)}>
          <input value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} placeholder="Buscar tramite..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {ticketLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredTickets.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin tramites abiertos</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {filteredTickets.map(t => (
                  <button key={t.id} onClick={() => addToTicket(t.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t.folio}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{t.estatus_nombre}</span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">{t.instrucciones}</p>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Asistentes / Modo IA modal ───────────────────────────── */}
      {showAssistants && (
        <Modal title="Asistentes IA" onClose={() => setShowAssistants(false)}>
          <p className="text-xs text-neutral-500 mb-3">Selecciona un asistente para activar el modo automatico en esta conversacion.</p>
          {autoLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : assistants.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin asistentes configurados</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {assistants.map(a => (
                  <button key={a.id} onClick={() => startAutoMode(a.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-violet-500 flex-shrink-0" />
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
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-sm bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}
