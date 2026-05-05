import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle, Mail, Search, Filter, Send, Phone, Building2,
  User, Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronLeft, RefreshCw, X, MessageSquare, Zap,
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
  sender_name?: string;
}

interface Oficina {
  id: string;
  nombre: string;
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

  // Message thread filters
  const [threadFilterChannel, setThreadFilterChannel] = useState<string>('');
  const [threadFilterType, setThreadFilterType] = useState<string>('');

  // Composer
  const [composerChannel, setComposerChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = usuario?.rol === 'Administrador';

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
      if (!error && data) setConversations(data);
    } catch { /* silent */ }
    setLoading(false);
  }, [usuario, filterChannel, filterType, filterOffice, searchQuery]);

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
          if (senders) {
            senderMap = Object.fromEntries(senders.map(s => [s.id, s.nombre_completo || 'Usuario']));
          }
        }
        setMessages(data.map(m => ({
          ...m,
          sender_name: m.sender_type === 'system' ? 'Sistema' : (m.sender_user_id ? senderMap[m.sender_user_id] || 'Usuario' : 'Sistema'),
        })));
      }
    } catch { /* silent */ }
    setLoadingMessages(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [threadFilterChannel, threadFilterType]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const { data: oficinasData } = supabase.from('oficinas').select('id, nombre').order('nombre');
    oficinasData?.then?.(undefined);
    supabase.from('oficinas').select('id, nombre').order('nombre').then(({ data }) => {
      if (data) setOficinas(data);
    });
  }, []);

  useEffect(() => {
    if (selectedAgent) loadMessages(selectedAgent.agent_user_id);
  }, [selectedAgent, loadMessages]);

  const handleSelectAgent = (conv: ConversationSummary) => {
    setSelectedAgent(conv);
    setComposerMessage('');
    setComposerSubject('');
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
        if (!result.success) {
          alert(result.error || 'No se pudo enviar el WhatsApp. Revisa la configuracion de Wazzup o el numero del agente.');
        }
      } else {
        const result = await callApi('send-contact-email', {
          agentUserId: selectedAgent.agent_user_id,
          subject: composerSubject.trim(),
          body: composerMessage.trim(),
        });
        if (!result.success) {
          alert(result.error || 'No se pudo enviar el correo. Revisa la configuracion de Resend o el correo del agente.');
        }
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
        await callApi('send-contact-whatsapp', {
          agentUserId: msg.agent_user_id,
          message: msg.body,
        });
      } else {
        await callApi('send-contact-email', {
          agentUserId: msg.agent_user_id,
          subject: msg.subject || 'Reenvio',
          body: msg.body,
        });
      }
      loadMessages(msg.agent_user_id);
    } catch { /* silent */ }
    setSending(false);
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

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

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
        </div>
        <button onClick={loadConversations} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Conversation List */}
        <div className={`w-full lg:w-80 xl:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 ${selectedAgent ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search and Filters */}
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
                {isAdmin && (
                  <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2 col-span-2">
                    <option value="">Todas oficinas</option>
                    {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Sin conversaciones</p>
                <p className="text-xs mt-1">Los mensajes enviados apareceran aqui</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.agent_user_id}
                  onClick={() => handleSelectAgent(conv)}
                  className={`w-full text-left p-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedAgent?.agent_user_id === conv.agent_user_id ? 'bg-teal-50 dark:bg-teal-900/20 border-l-2 border-l-teal-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{conv.agent_name?.charAt(0) || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{conv.agent_name}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ChannelIcon channel={conv.last_message_channel} size={12} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.last_message_body}</p>
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

        {/* Center Panel - Thread */}
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
                    <p className="text-[11px] text-gray-500">{selectedAgent.agent_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">Sin mensajes</div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} isAdmin={isAdmin} onRetry={handleRetry} formatDate={formatFullDate} />
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
                {composerChannel === 'whatsapp' && (
                  <p className="text-[10px] text-gray-400 mt-1">Max 550 caracteres. Enter para enviar.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Panel - Agent Card */}
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
    </div>
  );
}

function MessageBubble({ message, isAdmin, onRetry, formatDate }: { message: Message; isAdmin: boolean; onRetry: (id: string) => void; formatDate: (s: string) => string }) {
  const isSystem = message.sender_type === 'system';
  const isFailed = message.status === 'failed';

  return (
    <div className={`flex flex-col ${isSystem ? 'items-center' : 'items-end'}`}>
      {isSystem ? (
        <div className="max-w-[85%] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              {message.source_module || 'Sistema'} - {message.source_event || 'automatico'}
            </span>
            <ChannelIcon channel={message.channel} size={11} />
          </div>
          {message.subject && <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{message.subject}</p>}
          <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{message.body}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
            <StatusBadge status={message.status} />
          </div>
        </div>
      ) : (
        <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${isFailed ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-1">
            <ChannelIcon channel={message.channel} size={12} />
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{message.sender_name}</span>
            {message.message_type === 'automatic' && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">Auto</span>}
          </div>
          {message.subject && <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">{message.subject}</p>}
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.body}</p>
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
  );
}

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
    pending: { icon: Clock, color: 'text-gray-400', label: 'Pendiente' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Error' },
    cancelled: { icon: AlertCircle, color: 'text-gray-400', label: 'Cancelado' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] ${c.color}`}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  );
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
