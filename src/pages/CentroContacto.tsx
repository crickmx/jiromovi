import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle, Mail, Search, Filter, Send, Phone, Building2,
  User, Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronLeft, RefreshCw, X, MessageSquare, Zap, Check,
  ListTodo, Plus, Link2, FileText, Image, Music, Video,
  Paperclip, UserX, UserPlus, Eye,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ConversationSummary {
  agent_user_id: string;
  agent_name: string;
  agent_email: string;
  agent_phone: string | null;
  agent_office_id: string | null;
  office_name: string | null;
  agent_rol: string;
  agent_activo: boolean;
  last_message_body: string;
  last_message_channel: string;
  last_message_at: string;
  last_message_status: string;
  total_messages: number;
  unread_count: number;
}

interface Message {
  id: string;
  agent_user_id: string;
  sender_user_id: string | null;
  sender_type: string;
  channel: string;
  message_type: string;
  direction: string;
  subject: string | null;
  body: string;
  html_body: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  source_module: string | null;
  source_event: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  attachment_urls?: Array<{ url?: string; type?: string; name?: string }> | null;
  read_at: string | null;
  sender_name?: string;
  attachments?: Attachment[];
  linked_task_id?: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  file_url: string | null;
  direction: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface TramiteOption {
  id: string;
  folio: string;
  instrucciones: string;
  prioridad: string;
  tipo_tramite: string;
  estatus_nombre: string;
  agente_nombre: string | null;
  fecha_creacion: string;
}

async function callApi(slug: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { success: false, error: 'Sesion no disponible' };
  const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, error: text }; }
}

export default function CentroContacto() {
  const { usuario } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterOffice, setFilterOffice] = useState<string>('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);

  // Thread filters
  const [threadFilterChannel, setThreadFilterChannel] = useState<string>('');
  const [threadFilterType, setThreadFilterType] = useState<string>('');

  // Composer
  const [composerChannel, setComposerChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [sending, setSending] = useState(false);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Task modals
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showAddToTaskModal, setShowAddToTaskModal] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Attachment preview
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canFilterOffice = isAdmin || isGerente;

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_contact_center_summary', {
        p_user_id: usuario.id,
        p_channel: filterChannel || null,
        p_message_type: filterType || null,
        p_office_id: filterOffice || null,
        p_search: searchQuery || null,
        p_limit: 100,
        p_offset: 0,
      });
      if (!error && data) {
        let filtered = data as ConversationSummary[];
        if (filterUnassigned) {
          filtered = filtered.filter(c => {
            const meta = c as unknown as Record<string, unknown>;
            return meta.agent_activo === false || (c.last_message_status === 'received' && !c.agent_email);
          });
        }
        setConversations(filtered);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [usuario, filterChannel, filterType, filterOffice, searchQuery, filterUnassigned]);

  // Load messages
  const loadMessages = useCallback(async (agentId: string) => {
    setLoadingMessages(true);
    try {
      let query = supabase
        .from('contact_center_messages')
        .select('*')
        .eq('agent_user_id', agentId)
        .order('created_at', { ascending: true });

      if (threadFilterChannel) query = query.eq('channel', threadFilterChannel);
      if (threadFilterType) query = query.eq('message_type', threadFilterType);

      const { data } = await query.limit(500);

      if (data) {
        const senderIds = [...new Set(data.filter(m => m.sender_user_id).map(m => m.sender_user_id))];
        let senderMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: senders } = await supabase
            .from('usuarios')
            .select('id, nombre_completo')
            .in('id', senderIds);
          if (senders) senderMap = Object.fromEntries(senders.map(s => [s.id, s.nombre_completo || 'Usuario']));
        }

        // Load attachments for messages
        const msgIds = data.map(m => m.id);
        const { data: attachments } = await supabase
          .from('contact_center_attachments')
          .select('id, message_id, file_name, file_type, mime_type, file_url, direction')
          .in('message_id', msgIds);

        const attachMap: Record<string, Attachment[]> = {};
        if (attachments) {
          for (const att of attachments) {
            if (!attachMap[att.message_id]) attachMap[att.message_id] = [];
            attachMap[att.message_id].push(att);
          }
        }

        // Load task links for messages
        const { data: taskLinks } = await supabase
          .from('task_contact_center_items')
          .select('contact_center_message_id, task_id')
          .in('contact_center_message_id', msgIds)
          .not('task_id', 'is', null);

        const taskLinkMap: Record<string, string> = {};
        if (taskLinks) {
          for (const link of taskLinks) {
            if (link.contact_center_message_id) {
              taskLinkMap[link.contact_center_message_id] = link.task_id;
            }
          }
        }

        setMessages(data.map(m => {
          let atts = attachMap[m.id] || [];
          // Fallback: synthesize from attachment_urls JSONB if no records in attachments table
          if (atts.length === 0 && m.attachment_urls && Array.isArray(m.attachment_urls)) {
            atts = (m.attachment_urls as Array<{ url?: string; type?: string; name?: string }>).filter(a => a.url).map((a, i) => ({
              id: `${m.id}_synth_${i}`,
              file_name: a.name || 'Archivo',
              file_type: a.type || 'document',
              mime_type: null,
              file_url: a.url || null,
              direction: m.direction,
            }));
          }
          // Fallback: use metadata.content_uri for old messages
          if (atts.length === 0 && (m.metadata as Record<string, unknown>)?.content_uri) {
            const meta = m.metadata as Record<string, unknown>;
            const mType = (meta.message_type as string) || 'document';
            atts = [{
              id: `${m.id}_meta`,
              file_name: mType === 'image' ? 'Imagen' : mType === 'video' ? 'Video' : mType === 'audio' ? 'Audio' : 'Archivo',
              file_type: mType === 'sticker' ? 'image' : mType,
              mime_type: null,
              file_url: meta.content_uri as string,
              direction: m.direction,
            }];
          }
          return {
            ...m,
            sender_name: m.direction === 'inbound'
              ? ((m.metadata as Record<string, unknown>)?.sender_name as string || 'Agente')
              : (m.sender_type === 'system' ? 'Sistema' : (m.sender_user_id ? senderMap[m.sender_user_id] || 'Usuario' : 'Sistema')),
            attachments: atts,
            linked_task_id: taskLinkMap[m.id] || null,
          };
        }));

        // Mark messages as read and update local unread count
        if (usuario) {
          await supabase.rpc('mark_contact_messages_read', {
            p_agent_user_id: agentId,
            p_user_id: usuario.id,
          });
          setConversations(prev =>
            prev.map(c =>
              c.agent_user_id === agentId ? { ...c, unread_count: 0 } : c
            )
          );
        }
      }
    } catch { /* silent */ }
    setLoadingMessages(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [threadFilterChannel, threadFilterType, usuario]);

  // Initial load
  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    supabase.from('oficinas').select('id, nombre').order('nombre').then(({ data }) => {
      if (data) setOficinas(data);
    });
  }, []);

  useEffect(() => {
    if (selectedAgent) loadMessages(selectedAgent.agent_user_id);
  }, [selectedAgent, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('contact-center-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contact_center_messages',
      }, (payload) => {
        const newMsg = payload.new as Message;
        // Update conversation list
        loadConversations();
        // If we're viewing this agent's thread, add the message
        if (selectedAgent && newMsg.agent_user_id === selectedAgent.agent_user_id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            let realtimeAtts: Attachment[] = [];
            const rawPayload = payload.new as Record<string, unknown>;
            if (rawPayload.attachment_urls && Array.isArray(rawPayload.attachment_urls)) {
              realtimeAtts = (rawPayload.attachment_urls as Array<{ url?: string; type?: string; name?: string }>).filter(a => a.url).map((a, i) => ({
                id: `${newMsg.id}_rt_${i}`,
                file_name: a.name || 'Archivo',
                file_type: a.type || 'document',
                mime_type: null,
                file_url: a.url || null,
                direction: newMsg.direction,
              }));
            } else if ((newMsg.metadata as Record<string, unknown>)?.content_uri) {
              const meta = newMsg.metadata as Record<string, unknown>;
              const mType = (meta.message_type as string) || 'document';
              realtimeAtts = [{
                id: `${newMsg.id}_rt_meta`,
                file_name: mType === 'image' ? 'Imagen' : mType === 'video' ? 'Video' : mType === 'audio' ? 'Audio' : 'Archivo',
                file_type: mType === 'sticker' ? 'image' : mType,
                mime_type: null,
                file_url: meta.content_uri as string,
                direction: newMsg.direction,
              }];
            }
            const enriched: Message = {
              ...newMsg,
              sender_name: newMsg.direction === 'inbound'
                ? ((newMsg.metadata as Record<string, unknown>)?.sender_name as string || 'Agente')
                : 'Sistema',
              attachments: realtimeAtts,
            };
            return [...prev, enriched];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
          // Mark as read immediately
          if (usuario && newMsg.direction === 'inbound') {
            supabase.rpc('mark_contact_messages_read', {
              p_agent_user_id: newMsg.agent_user_id,
              p_user_id: usuario.id,
            });
            setConversations(prev =>
              prev.map(c =>
                c.agent_user_id === newMsg.agent_user_id ? { ...c, unread_count: 0 } : c
              )
            );
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedAgent, usuario, loadConversations]);

  const handleSelectAgent = (conv: ConversationSummary) => {
    setSelectedAgent(conv);
    setComposerMessage('');
    setComposerSubject('');
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleSend = async () => {
    if (!selectedAgent || sending) return;
    if (composerChannel === 'email' && (!composerSubject.trim() || !composerMessage.trim())) return;
    if (composerChannel === 'whatsapp' && !composerMessage.trim()) return;

    setSending(true);
    try {
      if (composerChannel === 'whatsapp') {
        const result = await callApi('send-contact-whatsapp', {
          agentUserId: selectedAgent.agent_user_id,
          message: composerMessage.trim(),
        });
        if (!result.success) alert(result.error || 'No se pudo enviar el WhatsApp.');
      } else {
        const result = await callApi('send-contact-email', {
          agentUserId: selectedAgent.agent_user_id,
          subject: composerSubject.trim(),
          body: composerMessage.trim(),
        });
        if (!result.success) alert(result.error || 'No se pudo enviar el correo.');
      }
      setComposerMessage('');
      setComposerSubject('');
      loadMessages(selectedAgent.agent_user_id);
      loadConversations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al enviar');
    }
    setSending(false);
  };

  const handleRetry = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.status !== 'failed') return;
    setSending(true);
    try {
      if (msg.channel === 'whatsapp') {
        await callApi('send-contact-whatsapp', { agentUserId: msg.agent_user_id, message: msg.body });
      } else {
        await callApi('send-contact-email', { agentUserId: msg.agent_user_id, subject: msg.subject || 'Reenvio', body: msg.body });
      }
      loadMessages(msg.agent_user_id);
    } catch { /* silent */ }
    setSending(false);
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const isUnassigned = selectedAgent && selectedAgent.last_message_status === 'received' && !selectedAgent.agent_email;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {selectedAgent && (
            <button onClick={() => setSelectedAgent(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <MessageSquare className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Centro de Contacto</h1>
          {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0) > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
            </span>
          )}
        </div>
        <button onClick={loadConversations} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`w-full lg:w-80 xl:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 ${selectedAgent ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button onClick={() => setShowFilters(!showFilters)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${showFilters ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2">
                  <option value="">Todos canales</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="system">Sistema</option>
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2">
                  <option value="">Todo tipo</option>
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatico</option>
                </select>
                {canFilterOffice && (
                  <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2 col-span-2">
                    <option value="">Todas oficinas</option>
                    {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                )}
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={filterUnassigned} onChange={e => setFilterUnassigned(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <UserX className="w-3.5 h-3.5" /> No asignados
                </label>
              </div>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Sin conversaciones</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.agent_user_id}
                  onClick={() => handleSelectAgent(conv)}
                  className={`w-full text-left p-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedAgent?.agent_user_id === conv.agent_user_id ? 'bg-teal-50 dark:bg-teal-900/20 border-l-2 border-l-teal-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0 relative">
                      <span className="text-white text-xs font-bold">{conv.agent_name?.charAt(0) || '?'}</span>
                      {(conv.unread_count || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${(conv.unread_count || 0) > 0 ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>{conv.agent_name}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ChannelIcon channel={conv.last_message_channel} size={12} />
                        {conv.last_message_status === 'received' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                        <p className={`text-xs truncate ${(conv.unread_count || 0) > 0 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{conv.last_message_body}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {conv.office_name && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{conv.office_name}</span>}
                        <span className="text-[10px] text-gray-400">{conv.total_messages} msgs</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center Panel */}
        <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 ${!selectedAgent ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedAgent ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecciona un agente para ver la conversacion</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{selectedAgent.agent_name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAgent.agent_name}</p>
                    <p className="text-[11px] text-gray-500">{selectedAgent.agent_email || selectedAgent.agent_phone || 'Sin datos'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isUnassigned && (isAdmin || isGerente) && (
                    <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                      <UserPlus className="w-3 h-3" /> Asignar
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) cancelSelection(); }}
                    className={`p-1.5 rounded text-[11px] ${selectionMode ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    title="Seleccionar mensajes"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <select value={threadFilterChannel} onChange={e => setThreadFilterChannel(e.target.value)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-1.5">
                    <option value="">Todos</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="system">Sistema</option>
                  </select>
                  <select value={threadFilterType} onChange={e => setThreadFilterType(e.target.value)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-1.5">
                    <option value="">Todo</option>
                    <option value="manual">Manual</option>
                    <option value="automatic">Auto</option>
                  </select>
                  <button onClick={() => setShowAgentPanel(!showAgentPanel)} className="hidden xl:block p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                    <User className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Selection toolbar */}
              {selectionMode && selectedMessageIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-200 dark:border-teal-800">
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                    {selectedMessageIds.size} {selectedMessageIds.size === 1 ? 'mensaje seleccionado' : 'mensajes seleccionados'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCreateTaskModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                      <Plus className="w-3 h-3" /> Crear tramite
                    </button>
                    <button onClick={() => setShowAddToTaskModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-gray-800 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors">
                      <Link2 className="w-3 h-3" /> Agregar a tramite
                    </button>
                    <button onClick={cancelSelection} className="p-1.5 rounded hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loadingMessages ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">Sin mensajes</div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isAdmin={isAdmin}
                      onRetry={handleRetry}
                      formatDate={formatFullDate}
                      selectionMode={selectionMode}
                      isSelected={selectedMessageIds.has(msg.id)}
                      onToggleSelect={() => toggleMessageSelection(msg.id)}
                      linkedTaskId={msg.linked_task_id}
                      onPreviewAttachment={setPreviewAttachment}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setComposerChannel('whatsapp')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${composerChannel === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={() => setComposerChannel('email')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${composerChannel === 'email' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Correo
                  </button>
                </div>

                {composerChannel === 'email' && (
                  <input
                    type="text"
                    value={composerSubject}
                    onChange={e => setComposerSubject(e.target.value)}
                    placeholder="Asunto del correo..."
                    className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    value={composerMessage}
                    onChange={e => setComposerMessage(e.target.value)}
                    placeholder={composerChannel === 'whatsapp' ? 'Escribe un mensaje...' : 'Cuerpo del correo...'}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && composerChannel === 'whatsapp') { e.preventDefault(); handleSend(); } }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !composerMessage.trim() || (composerChannel === 'email' && !composerSubject.trim())}
                    className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                {composerChannel === 'whatsapp' && <p className="text-[10px] text-gray-400 mt-1">Max 550 caracteres. Enter para enviar.</p>}
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        {selectedAgent && showAgentPanel && (
          <div className="hidden xl:flex w-72 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Ficha del Agente</h3>
                <button onClick={() => setShowAgentPanel(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-3">
                <span className="text-white text-lg font-bold">{selectedAgent.agent_name?.charAt(0)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white text-center">{selectedAgent.agent_name}</p>
              <p className="text-xs text-gray-500 text-center mt-0.5">{selectedAgent.agent_rol}</p>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow icon={Mail} label="Correo" value={selectedAgent.agent_email || 'Sin correo'} />
              <InfoRow icon={Phone} label="Telefono" value={selectedAgent.agent_phone || 'Sin telefono'} />
              <InfoRow icon={Building2} label="Oficina" value={selectedAgent.office_name || 'Sin asignar'} />
              <InfoRow icon={MessageSquare} label="Total mensajes" value={String(selectedAgent.total_messages)} />
              <InfoRow icon={Eye} label="No leidos" value={String(selectedAgent.unread_count || 0)} />
              <InfoRow icon={Clock} label="Ultimo contacto" value={selectedAgent.last_message_at ? formatTime(selectedAgent.last_message_at) : 'Nunca'} />
              <div className="pt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${selectedAgent.agent_activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedAgent.agent_activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {selectedAgent.agent_activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateTaskModal && selectedAgent && (
        <CreateTaskModal
          agentUserId={selectedAgent.agent_user_id}
          agentName={selectedAgent.agent_name}
          selectedMessages={messages.filter(m => selectedMessageIds.has(m.id))}
          onClose={() => setShowCreateTaskModal(false)}
          onSuccess={() => { setShowCreateTaskModal(false); cancelSelection(); }}
        />
      )}

      {/* Add to Task Modal */}
      {showAddToTaskModal && selectedAgent && (
        <AddToTaskModal
          agentUserId={selectedAgent.agent_user_id}
          agentName={selectedAgent.agent_name}
          selectedMessages={messages.filter(m => selectedMessageIds.has(m.id))}
          onClose={() => setShowAddToTaskModal(false)}
          onSuccess={() => { setShowAddToTaskModal(false); cancelSelection(); }}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedAgent && (
        <AssignConversationModal
          currentAgentId={selectedAgent.agent_user_id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => { setShowAssignModal(false); loadConversations(); }}
        />
      )}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// MessageBubble Component
// ============================================================

function MessageBubble({ message, isAdmin, onRetry, formatDate, selectionMode, isSelected, onToggleSelect, linkedTaskId, onPreviewAttachment }: {
  message: Message; isAdmin: boolean; onRetry: (id: string) => void; formatDate: (s: string) => string;
  selectionMode: boolean; isSelected: boolean; onToggleSelect: () => void; linkedTaskId?: string | null;
  onPreviewAttachment?: (att: Attachment) => void;
}) {
  const isInbound = message.direction === 'inbound';
  const isSystem = message.sender_type === 'system' && !isInbound;
  const isFailed = message.status === 'failed';

  const align = isInbound ? 'items-start' : (isSystem ? 'items-center' : 'items-end');

  return (
    <div className={`flex flex-col ${align} group`}>
      <div className={`flex items-start gap-2 ${isInbound ? '' : 'flex-row-reverse'}`}>
        {selectionMode && (
          <button onClick={onToggleSelect} className={`mt-2 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'}`}>
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        )}

        {isSystem && !isInbound ? (
          <div className="max-w-[85%] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{message.source_module || 'Sistema'} - {message.source_event || 'automatico'}</span>
              <ChannelIcon channel={message.channel} size={11} />
            </div>
            {message.subject && <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{message.subject}</p>}
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{message.body}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
              <StatusBadge status={message.status} />
            </div>
          </div>
        ) : isInbound ? (
          <div className={`max-w-[75%] rounded-xl rounded-tl-sm px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm ${isSelected ? 'ring-2 ring-teal-500' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon channel={message.channel} size={12} />
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">{message.sender_name}</span>
              <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 py-0.5 rounded">Recibido</span>
              {linkedTaskId && (
                <span className="text-[9px] bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                  <ListTodo className="w-2.5 h-2.5" /> Vinculado
                </span>
              )}
            </div>
            {message.subject && <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">{message.subject}</p>}
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.body}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map(att => (
                  <AttachmentChip key={att.id} attachment={att} onPreview={onPreviewAttachment} />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
              <StatusBadge status={message.status} />
            </div>
          </div>
        ) : (
          <div className={`max-w-[75%] rounded-xl rounded-tr-sm px-3.5 py-2.5 ${isFailed ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'} ${isSelected ? 'ring-2 ring-teal-500' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon channel={message.channel} size={12} />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{message.sender_name}</span>
              {message.message_type === 'automatic' && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">Auto</span>}
              {linkedTaskId && (
                <span className="text-[9px] bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                  <ListTodo className="w-2.5 h-2.5" /> Vinculado
                </span>
              )}
            </div>
            {message.subject && <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">{message.subject}</p>}
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.body}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map(att => (
                  <AttachmentChip key={att.id} attachment={att} onPreview={onPreviewAttachment} />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 gap-3">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={message.status} />
                {isFailed && (
                  <button onClick={() => onRetry(message.id)} className="text-[10px] text-red-600 hover:text-red-700 font-medium flex items-center gap-0.5">
                    <RefreshCw className="w-3 h-3" /> Reintentar
                  </button>
                )}
              </div>
            </div>
            {isFailed && isAdmin && message.error_message && (
              <p className="mt-1.5 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/10 rounded px-2 py-1">{message.error_message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// AttachmentChip
// ============================================================

function AttachmentChip({ attachment, onPreview }: { attachment: Attachment; onPreview?: (att: Attachment) => void }) {
  const iconMap: Record<string, typeof FileText> = { image: Image, audio: Music, video: Video, document: FileText };
  const Icon = iconMap[attachment.file_type] || Paperclip;
  const isImage = attachment.file_type === 'image';
  const isVideo = attachment.file_type === 'video';
  const isAudio = attachment.file_type === 'audio';

  if (isImage && attachment.file_url) {
    return (
      <div className="mt-1">
        <div
          className="relative group cursor-pointer rounded-lg overflow-hidden max-w-[220px] border border-gray-200 dark:border-gray-700"
          onClick={() => onPreview?.(attachment)}
        >
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="w-full max-h-[180px] object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[220px]">{attachment.file_name}</p>
      </div>
    );
  }

  if (isAudio && attachment.file_url) {
    return (
      <div className="mt-1 max-w-[250px]">
        <audio controls className="w-full h-8" preload="none">
          <source src={attachment.file_url} type={attachment.mime_type || 'audio/ogg'} />
        </audio>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{attachment.file_name}</p>
      </div>
    );
  }

  if (isVideo && attachment.file_url) {
    return (
      <div className="mt-1">
        <div
          className="relative group cursor-pointer rounded-lg overflow-hidden max-w-[220px] border border-gray-200 dark:border-gray-700 bg-black"
          onClick={() => onPreview?.(attachment)}
        >
          <video className="w-full max-h-[150px] object-cover" preload="metadata">
            <source src={attachment.file_url} type={attachment.mime_type || 'video/mp4'} />
          </video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <Video className="w-5 h-5 text-gray-800" />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[220px]">{attachment.file_name}</p>
      </div>
    );
  }

  return (
    <a
      href={attachment.file_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{attachment.file_name}</span>
    </a>
  );
}

function AttachmentPreviewModal({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const isImage = attachment.file_type === 'image';
  const isVideo = attachment.file_type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center z-10 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        {isImage && (
          <img
            src={attachment.file_url || ''}
            alt={attachment.file_name}
            className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        )}
        {isVideo && (
          <video controls autoPlay className="max-w-[85vw] max-h-[80vh] rounded-lg shadow-2xl">
            <source src={attachment.file_url || ''} type={attachment.mime_type || 'video/mp4'} />
          </video>
        )}
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-sm text-white/80">{attachment.file_name}</span>
          <a
            href={attachment.file_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-md transition-colors"
          >
            Descargar
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Create Task Modal
// ============================================================

function CreateTaskModal({ agentUserId, agentName, selectedMessages, onClose, onSuccess }: {
  agentUserId: string; agentName: string; selectedMessages: Message[];
  onClose: () => void; onSuccess: () => void;
}) {
  const [instrucciones, setInstrucciones] = useState(() => {
    const header = `Informacion agregada desde Centro de Contacto:\nAgente: ${agentName}\nCanal: WhatsApp\nFecha de captura: ${new Date().toLocaleString('es-MX')}\n\nMensajes seleccionados:\n`;
    const msgs = selectedMessages.map((m, i) =>
      `${i + 1}. [${new Date(m.created_at).toLocaleString('es-MX')}] ${m.direction === 'inbound' ? agentName : (m.sender_name || 'Usuario')}:\n${m.body}`
    ).join('\n\n');
    return header + msgs;
  });
  const [tipoTramite, setTipoTramite] = useState('cotizacion_emision');
  const [prioridad, setPrioridad] = useState('Media');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!instrucciones.trim()) return;
    setSaving(true);
    const result = await callApi('create-task-from-contact-messages', {
      agentUserId,
      messageIds: selectedMessages.map(m => m.id),
      attachmentIds: selectedMessages.flatMap(m => (m.attachments || []).map(a => a.id)),
      task: {
        instrucciones: instrucciones.trim(),
        tipo_tramite: tipoTramite,
        prioridad,
      },
    });
    setSaving(false);
    if (result.success) {
      alert(`Tramite ${result.folio || ''} creado correctamente con los mensajes seleccionados.`);
      onSuccess();
    } else {
      alert(result.error || 'Error al crear el tramite');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Crear tramite desde mensajes</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedMessages.length} mensaje(s) de {agentName}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Tipo de tramite</label>
              <select value={tipoTramite} onChange={e => setTipoTramite(e.target.value)} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3">
                <option value="cotizacion_emision">Cotizacion / Emision</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Prioridad</label>
              <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3">
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Instrucciones</label>
            <textarea value={instrucciones} onChange={e => setInstrucciones(e.target.value)} rows={8} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !instrucciones.trim()} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Creando...' : 'Crear tramite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Add to Task Modal
// ============================================================

function AddToTaskModal({ agentUserId, agentName, selectedMessages, onClose, onSuccess }: {
  agentUserId: string; agentName: string; selectedMessages: Message[];
  onClose: () => void; onSuccess: () => void;
}) {
  const { usuario } = useAuth();
  const [tramites, setTramites] = useState<TramiteOption[]>([]);
  const [loadingTramites, setLoadingTramites] = useState(true);
  const [searchTramite, setSearchTramite] = useState('');
  const [selectedTramiteId, setSelectedTramiteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!usuario) return;
      setLoadingTramites(true);
      const { data } = await supabase
        .from('tickets')
        .select(`
          id, folio, instrucciones, prioridad, tipo_tramite, created_at,
          ticket_estatus(nombre),
          agente:usuarios!tickets_agente_usuario_id_fkey(nombre_completo)
        `)
        .eq('cerrado', false)
        .eq('tipo_tramite', 'cotizacion_emision')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setTramites(data.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          folio: (t.folio as string) || '',
          instrucciones: (t.instrucciones as string) || '',
          prioridad: (t.prioridad as string) || 'Media',
          tipo_tramite: (t.tipo_tramite as string) || '',
          estatus_nombre: (t.ticket_estatus as Record<string, string>)?.nombre || '',
          agente_nombre: (t.agente as Record<string, string>)?.nombre_completo || null,
          fecha_creacion: t.created_at as string,
        })));
      }
      setLoadingTramites(false);
    })();
  }, [usuario]);

  const filteredTramites = tramites.filter(t =>
    !searchTramite ||
    t.folio.toLowerCase().includes(searchTramite.toLowerCase()) ||
    t.instrucciones.toLowerCase().includes(searchTramite.toLowerCase()) ||
    (t.agente_nombre || '').toLowerCase().includes(searchTramite.toLowerCase())
  );

  const handleAdd = async () => {
    if (!selectedTramiteId) return;
    setSaving(true);
    const commentText = `Informacion agregada desde Centro de Contacto:\nAgente: ${agentName}\nCanal: WhatsApp\nAgregado por: ${usuario?.nombre_completo || 'Usuario'}\nFecha: ${new Date().toLocaleString('es-MX')}\n\nMensajes seleccionados:\n` +
      selectedMessages.map((m, i) =>
        `${i + 1}. [${new Date(m.created_at).toLocaleString('es-MX')}] ${m.direction === 'inbound' ? agentName : (m.sender_name || 'Usuario')}:\n${m.body}`
      ).join('\n\n');

    const result = await callApi('add-contact-messages-to-task', {
      agentUserId,
      ticketId: selectedTramiteId,
      messageIds: selectedMessages.map(m => m.id),
      attachmentIds: selectedMessages.flatMap(m => (m.attachments || []).map(a => a.id)),
      commentText,
    });
    setSaving(false);
    if (result.success) {
      alert('Mensajes agregados correctamente al tramite.');
      onSuccess();
    } else {
      alert(result.error || 'Error al agregar mensajes');
    }
  };

  const estatusColor = (estatus: string) => {
    if (estatus === 'Iniciado') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (estatus === 'En proceso') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Agregar a tramite existente</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedMessages.length} mensaje(s) de {agentName}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTramite}
              onChange={e => setSearchTramite(e.target.value)}
              placeholder="Buscar por folio, instrucciones o agente..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            {loadingTramites ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
            ) : filteredTramites.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No se encontraron tramites abiertos</p>
            ) : (
              filteredTramites.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTramiteId(t.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${selectedTramiteId === t.id ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">{t.folio}</span>
                    {t.agente_nombre && <span className="text-[10px] text-gray-500 dark:text-gray-400">- {t.agente_nombre}</span>}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mt-0.5">{t.instrucciones}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${estatusColor(t.estatus_nombre)}`}>{t.estatus_nombre}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.prioridad === 'Alta' ? 'bg-red-100 text-red-700' : t.prioridad === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{t.prioridad}</span>
                    <span className="text-[10px] text-gray-400">{new Date(t.fecha_creacion).toLocaleDateString('es-MX')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleAdd} disabled={saving || !selectedTramiteId} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Agregando...' : 'Agregar a tramite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Assign Conversation Modal
// ============================================================

function AssignConversationModal({ currentAgentId, onClose, onSuccess }: {
  currentAgentId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; nombre_completo: string; rol: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { usuario } = useAuth();

  useEffect(() => {
    supabase.from('usuarios').select('id, nombre_completo, rol').eq('activo', true).neq('id', currentAgentId).order('nombre_completo').then(({ data }) => {
      if (data) setUsers(data);
    });
  }, [currentAgentId]);

  const filtered = users.filter(u => !search || u.nombre_completo?.toLowerCase().includes(search.toLowerCase()));

  const handleAssign = async () => {
    if (!selectedUserId || !usuario) return;
    setSaving(true);
    const { error } = await supabase.rpc('assign_unassigned_conversation', {
      p_old_agent_id: currentAgentId,
      p_new_agent_id: selectedUserId,
      p_assigned_by: usuario.id,
    });
    setSaving(false);
    if (!error) {
      alert('Conversacion asignada correctamente.');
      onSuccess();
    } else {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Asignar conversacion</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar agente..." className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
          <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            {filtered.slice(0, 30).map(u => (
              <button key={u.id} onClick={() => setSelectedUserId(u.id)} className={`w-full text-left p-2 rounded-lg text-sm ${selectedUserId === u.id ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}`}>
                <span className="text-gray-800 dark:text-gray-200">{u.nombre_completo}</span>
                <span className="text-[10px] text-gray-400 ml-2">{u.rol}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleAssign} disabled={saving || !selectedUserId} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  if (channel === 'whatsapp') return <MessageCircle style={{ width: size, height: size }} className="text-green-500" />;
  if (channel === 'email') return <Mail style={{ width: size, height: size }} className="text-blue-500" />;
  return <Zap style={{ width: size, height: size }} className="text-amber-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    sent: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Enviado' },
    delivered: { icon: CheckCircle2, color: 'text-blue-500', label: 'Entregado' },
    read: { icon: CheckCircle2, color: 'text-teal-500', label: 'Leido' },
    received: { icon: CheckCircle2, color: 'text-green-500', label: 'Recibido' },
    pending: { icon: Clock, color: 'text-gray-400', label: 'Pendiente' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Error' },
    cancelled: { icon: AlertCircle, color: 'text-gray-400', label: 'Cancelado' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return <span className={`flex items-center gap-0.5 text-[10px] ${c.color}`}><Icon className="w-3 h-3" /> {c.label}</span>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400 uppercase">{label}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300 break-all">{value}</p>
      </div>
    </div>
  );
}

