import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
import {
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  Search,
  Send,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCheck,
  Check,
  AlertCircle,
  Plus,
  FileText,
  User,
  Tag,
  Archive,
  Settings,
  Zap,
  RefreshCw,
  Phone,
  Image as ImageIcon,
  X
} from 'lucide-react';

interface WhatsAppSession {
  id: string;
  user_id: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_pending';
  phone_number: string | null;
  device_name: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  last_activity_at: string | null;
  error_message: string | null;
}

interface Conversation {
  id: string;
  remote_phone: string;
  remote_name: string | null;
  remote_avatar_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_group: boolean;
  group_name: string | null;
  crm_contact_id: string | null;
  tramite_id: string | null;
  tags: string[];
  is_archived: boolean;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_filename: string | null;
  status: string;
  is_internal_note: boolean;
  created_at: string;
}

interface QuickTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
}

type ActiveView = 'inbox' | 'connection' | 'templates';

export default function MiWhatsApp() {
  const { usuario } = useAuth();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callEdgeFunction = async (action: string, extra?: Record<string, unknown>) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) return null;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authSession.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!resp.ok) return null;
    return resp.json();
  };

  useEffect(() => {
    if (usuario) loadSessionAndConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [usuario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessionAndConversations = async () => {
    if (!usuario) return;
    setLoading(true);

    const [statusResult, { data: tplData }] = await Promise.all([
      callEdgeFunction('get-status'),
      supabase.from('whatsapp_quick_templates').select('*').eq('user_id', usuario.id).order('sort_order'),
    ]);

    if (statusResult) {
      setSession(statusResult.session);
      setProviderConfigured(statusResult.provider_configured);
      if (statusResult.session?.status === 'connected' || statusResult.session?.status === 'disconnected') {
        setQrCode(null);
      }
    }

    const convsResult = await callEdgeFunction('get-conversations');
    setConversations(convsResult?.conversations || []);
    setTemplates(tplData || []);
    setLoading(false);
  };

  const loadMessages = useCallback(async (conversationId: string) => {
    const result = await callEdgeFunction('get-messages', { conversationId });
    setMessages(result?.messages || []);
  }, []);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
    loadMessages(conv.id);
    if (conv.unread_count > 0) {
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !usuario) return;
    const text = messageInput.trim();
    setMessageInput('');

    const newMsg: Message = {
      id: crypto.randomUUID(),
      direction: 'outbound',
      message_type: 'text',
      content: text,
      media_url: null,
      media_filename: null,
      status: 'pending',
      is_internal_note: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);

    const result = await callEdgeFunction('send-message', {
      to: selectedConversation.remote_phone,
      message: text,
    });

    if (result?.success) {
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'sent' } : m));
      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() } : c
      ));
    } else {
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'failed' } : m));
    }
  };

  const startQrPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    pollRef.current = setInterval(async () => {
      const result = await callEdgeFunction('get-qr');
      if (result) {
        if (result.connected) {
          setQrCode(null);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          loadSessionAndConversations();
        } else if (result.qr_code) {
          setQrCode(result.qr_code);
        }
      }
    }, 5000);
  };

  const handleConnect = async () => {
    if (!usuario) return;
    const result = await callEdgeFunction('connect');
    if (result) {
      setProviderMessage(result.message || null);
      if (result.qr_code) {
        setQrCode(result.qr_code);
      }
      if (result.provider === 'evolution') {
        startQrPolling();
      }
      // Reload session state
      const status = await callEdgeFunction('get-status');
      if (status?.session) setSession(status.session);
    }
  };

  const handleDisconnect = async () => {
    if (!usuario) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    setQrCode(null);
    await callEdgeFunction('disconnect');
    loadSessionAndConversations();
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim() || !usuario) return;
    await supabase.from('whatsapp_quick_templates').insert({
      user_id: usuario.id,
      name: newTemplateName.trim(),
      content: newTemplateContent.trim(),
    });
    setNewTemplateName('');
    setNewTemplateContent('');
    loadSessionAndConversations();
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from('whatsapp_quick_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return !c.is_archived;
    const q = searchQuery.toLowerCase();
    return (
      (c.remote_name?.toLowerCase().includes(q) ||
       c.remote_phone.includes(q) ||
       c.last_message_text?.toLowerCase().includes(q)) &&
      !c.is_archived
    );
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />;
      case 'sent': return <Check className="w-3.5 h-3.5 text-neutral-400" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-neutral-300" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="w-8 h-8 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isConnected = session?.status === 'connected';

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Top bar with status + nav */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            isConnected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-white/5'
          )}>
            <Smartphone className={cn('w-4.5 h-4.5', isConnected ? 'text-emerald-600' : 'text-neutral-400')} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">Mi WhatsApp</h1>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-emerald-500' : session?.status === 'connecting' || session?.status === 'qr_pending' ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300'
              )} />
              <span className="text-[11px] text-neutral-500 dark:text-white/40">
                {isConnected ? `Conectado${session.phone_number ? ` - ${session.phone_number}` : ''}` :
                 session?.status === 'qr_pending' ? 'Esperando escaneo...' :
                 session?.status === 'connecting' ? 'Conectando...' :
                 session?.status === 'error' ? 'Error de conexion' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[
            { key: 'inbox' as ActiveView, icon: MessageSquare, label: 'Conversaciones' },
            { key: 'connection' as ActiveView, icon: QrCode, label: 'Conexion' },
            { key: 'templates' as ActiveView, icon: Zap, label: 'Plantillas' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                activeView === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'connection' && (
          <ConnectionPanel
            session={session}
            qrCode={qrCode}
            providerConfigured={providerConfigured}
            providerMessage={providerMessage}
            polling={polling}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRefresh={loadSessionAndConversations}
          />
        )}
        {activeView === 'templates' && (
          <TemplatesPanel
            templates={templates}
            newName={newTemplateName}
            newContent={newTemplateContent}
            onNameChange={setNewTemplateName}
            onContentChange={setNewTemplateContent}
            onSave={handleSaveTemplate}
            onDelete={handleDeleteTemplate}
            onUseTemplate={(content) => { setMessageInput(content); setActiveView('inbox'); }}
          />
        )}
        {activeView === 'inbox' && (
          <div className="h-full flex">
            {/* Conversation list */}
            <div className={cn(
              'w-full md:w-[340px] lg:w-[380px] border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900',
              showMobileChat ? 'hidden md:flex' : 'flex'
            )}>
              {/* Search */}
              <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar conversaciones..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400/40 transition-all"
                  />
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {!isConnected && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-neutral-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <WifiOff className="w-6 h-6 text-neutral-300 dark:text-white/20" />
                    </div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-white/60 mb-1">WhatsApp no conectado</p>
                    <p className="text-xs text-neutral-400 dark:text-white/30 mb-4">Conecta tu WhatsApp para ver tus conversaciones</p>
                    <button
                      onClick={() => setActiveView('connection')}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Conectar ahora
                    </button>
                  </div>
                )}
                {isConnected && filteredConversations.length === 0 && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-white/60 mb-1">
                      {searchQuery ? 'Sin resultados' : 'Sin conversaciones'}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-white/30">
                      {searchQuery ? 'Intenta con otro termino' : 'Las conversaciones apareceran aqui cuando recibas mensajes'}
                    </p>
                  </div>
                )}
                {isConnected && filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors border-b border-neutral-100/60 dark:border-white/[0.04]',
                      selectedConversation?.id === conv.id && 'bg-emerald-50/50 dark:bg-emerald-900/10'
                    )}
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      {conv.remote_avatar_url ? (
                        <img src={conv.remote_avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                          {conv.remote_name || conv.remote_phone}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-white/30 flex-shrink-0">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-neutral-500 dark:text-white/40 truncate">
                          {conv.last_message_text || 'Sin mensajes'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="flex-shrink-0 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {conv.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-white/40 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className={cn(
              'flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950',
              !showMobileChat ? 'hidden md:flex' : 'flex'
            )}>
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-9 h-9 text-emerald-300" />
                    </div>
                    <p className="text-base font-semibold text-neutral-600 dark:text-white/50">Selecciona una conversacion</p>
                    <p className="text-sm text-neutral-400 dark:text-white/30 mt-1">Elige un chat del panel izquierdo para comenzar</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => { setShowMobileChat(false); setSelectedConversation(null); }}
                      className="md:hidden p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-white/60" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                        {selectedConversation.remote_name || selectedConversation.remote_phone}
                      </h3>
                      <p className="text-[11px] text-neutral-400 dark:text-white/30">{selectedConversation.remote_phone}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedConversation.crm_contact_id && (
                        <span className="text-[9px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">CRM</span>
                      )}
                      {selectedConversation.tramite_id && (
                        <span className="text-[9px] px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full font-medium">Tramite</span>
                      )}
                      <button className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg">
                        <MoreVertical className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                    {messages.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-sm text-neutral-400 dark:text-white/30">No hay mensajes en esta conversacion</p>
                      </div>
                    )}
                    {messages.map(msg => (
                      <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                          msg.is_internal_note
                            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30'
                            : msg.direction === 'outbound'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700'
                        )}>
                          {msg.is_internal_note && (
                            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Nota interna</span>
                          )}
                          {msg.content && (
                            <p className={cn(
                              'text-sm leading-relaxed whitespace-pre-wrap',
                              msg.direction === 'outbound' && !msg.is_internal_note ? 'text-white' : 'text-neutral-800 dark:text-white/80'
                            )}>
                              {msg.content}
                            </p>
                          )}
                          {msg.media_url && (
                            <div className="mt-1.5">
                              {msg.message_type === 'image' ? (
                                <img src={msg.media_url} alt="" className="rounded-lg max-w-full max-h-48 object-cover" />
                              ) : (
                                <div className="flex items-center gap-2 p-2 bg-white/20 rounded-lg">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-xs truncate">{msg.media_filename || 'Archivo'}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={cn(
                            'flex items-center gap-1.5 mt-1',
                            msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                          )}>
                            <span className={cn(
                              'text-[10px]',
                              msg.direction === 'outbound' && !msg.is_internal_note ? 'text-white/60' : 'text-neutral-400 dark:text-white/30'
                            )}>
                              {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.direction === 'outbound' && !msg.is_internal_note && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message input */}
                  <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-3 flex-shrink-0">
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="p-2.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors flex-shrink-0"
                        title="Plantillas rapidas"
                      >
                        <Zap className="w-5 h-5 text-neutral-400" />
                      </button>
                      <button className="p-2.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors flex-shrink-0" title="Adjuntar archivo">
                        <Paperclip className="w-5 h-5 text-neutral-400" />
                      </button>
                      <div className="flex-1 relative">
                        <textarea
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                          }}
                          placeholder="Escribe un mensaje..."
                          rows={1}
                          className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400/40 resize-none transition-all"
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim()}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:dark:bg-white/5 text-white disabled:text-neutral-400 rounded-xl transition-colors flex-shrink-0"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Quick templates dropdown */}
                    {showTemplates && templates.length > 0 && (
                      <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 max-h-40 overflow-y-auto">
                        {templates.map(tpl => (
                          <button
                            key={tpl.id}
                            onClick={() => { setMessageInput(tpl.content); setShowTemplates(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors"
                          >
                            <span className="text-xs font-medium text-neutral-700 dark:text-white/70">{tpl.name}</span>
                            <p className="text-[11px] text-neutral-400 dark:text-white/30 truncate mt-0.5">{tpl.content}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connection Panel ─────────────────────────────────────────────
function ConnectionPanel({ session, qrCode, providerConfigured, providerMessage, polling, onConnect, onDisconnect, onRefresh }: {
  session: WhatsAppSession | null;
  qrCode: string | null;
  providerConfigured: boolean;
  providerMessage: string | null;
  polling: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  const isConnected = session?.status === 'connected';
  const isQrPending = session?.status === 'qr_pending';
  const isConnecting = session?.status === 'connecting';
  const isError = session?.status === 'error';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Provider status banner */}
        {!providerConfigured && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Servidor de WhatsApp no configurado</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {providerMessage || 'Se requiere configurar Evolution API (EVOLUTION_API_URL y EVOLUTION_API_KEY) para habilitar la conexion QR. Contacta al administrador del sistema.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status card */}
        <div className={cn(
          'rounded-2xl border p-6',
          isConnected ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40' :
          isError ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40' :
          'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
        )}>
          <div className="flex items-center gap-4 mb-4">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center',
              isConnected ? 'bg-emerald-100 dark:bg-emerald-800/30' :
              isError ? 'bg-red-100 dark:bg-red-800/30' :
              'bg-neutral-100 dark:bg-white/5'
            )}>
              {isConnected ? <Wifi className="w-7 h-7 text-emerald-600" /> :
               isError ? <AlertCircle className="w-7 h-7 text-red-600" /> :
               <WifiOff className="w-7 h-7 text-neutral-400" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {isConnected ? 'WhatsApp Conectado' :
                 isQrPending ? 'Esperando escaneo QR' :
                 isConnecting ? 'Conectando...' :
                 isError ? 'Error de conexion' : 'WhatsApp Desconectado'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-white/40">
                {isConnected && session?.phone_number ? `Numero: ${session.phone_number}` :
                 isConnected ? 'Sesion activa' :
                 isError && session?.error_message ? session.error_message :
                 'Conecta tu WhatsApp personal para usar la bandeja'}
              </p>
            </div>
          </div>

          {isConnected && session?.connected_at && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-4">
              Conectado desde: {new Date(session.connected_at).toLocaleString('es-MX')}
            </div>
          )}

          <div className="flex items-center gap-3">
            {!isConnected && (
              <button
                onClick={onConnect}
                disabled={!providerConfigured}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:dark:bg-neutral-700 text-white disabled:text-neutral-500 rounded-xl text-sm font-medium transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {isQrPending || isConnecting ? 'Reintentar' : 'Conectar WhatsApp'}
              </button>
            )}
            {isConnected && (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <WifiOff className="w-4 h-4" />
                Desconectar
              </button>
            )}
            <button
              onClick={onRefresh}
              className="p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              title="Actualizar estado"
            >
              <RefreshCw className={cn('w-4 h-4 text-neutral-500', polling && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* QR code area */}
        {(isQrPending || isConnecting) && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-8 text-center">
            <div className="w-64 h-64 mx-auto bg-white rounded-2xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {qrCode ? (
                <img
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR Code"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-4">
                  {polling ? (
                    <>
                      <div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-neutral-500 dark:text-white/40">Generando codigo QR...</p>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-16 h-16 text-neutral-200 dark:text-white/10 mx-auto mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-white/30">
                        Presiona "Conectar WhatsApp" para generar el codigo QR
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {qrCode && (
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Esperando escaneo...</span>
                </div>
              </div>
            )}

            <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-2">Escanea el codigo QR</h3>
            <ol className="text-left text-xs text-neutral-500 dark:text-white/40 space-y-1.5 max-w-xs mx-auto">
              <li>1. Abre WhatsApp en tu celular</li>
              <li>2. Toca Menu o Configuracion</li>
              <li>3. Selecciona "Dispositivos vinculados"</li>
              <li>4. Toca "Vincular un dispositivo"</li>
              <li>5. Apunta la camara hacia el codigo QR</li>
            </ol>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-neutral-400" />
            Informacion importante
          </h3>
          <ul className="text-xs text-neutral-500 dark:text-white/40 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              Tu sesion de WhatsApp es personal y privada. Nadie mas puede ver tus conversaciones.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              Si cierras sesion desde tu celular, la conexion en MOVI se desconectara automaticamente.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              Los mensajes se sincronizan en tiempo real mientras la sesion este activa.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              Puedes vincular conversaciones con tu CRM y tramites para seguimiento integrado.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Templates Panel ──────────────────────────────────────────────
function TemplatesPanel({ templates, newName, newContent, onNameChange, onContentChange, onSave, onDelete, onUseTemplate }: {
  templates: QuickTemplate[];
  newName: string;
  newContent: string;
  onNameChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onUseTemplate: (content: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Create template */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            Nueva plantilla rapida
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <textarea
              value={newContent}
              onChange={e => onContentChange(e.target.value)}
              placeholder="Contenido del mensaje. Variables: {nombre_cliente}, {nombre_usuario}, {telefono_usuario}, {email_usuario}, {tipo_seguro}, {fecha_vencimiento}"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
            <button
              onClick={onSave}
              disabled={!newName.trim() || !newContent.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:dark:bg-white/5 text-white disabled:text-neutral-400 rounded-xl text-sm font-medium transition-colors"
            >
              Guardar plantilla
            </button>
          </div>
        </div>

        {/* Existing templates */}
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">Mis plantillas ({templates.length})</h3>
          {templates.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50">
              <Zap className="w-8 h-8 text-neutral-300 dark:text-white/20 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-white/40">No tienes plantillas aun</p>
              <p className="text-xs text-neutral-400 dark:text-white/30 mt-1">Crea tu primera plantilla para agilizar tus respuestas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(tpl => (
                <div key={tpl.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-neutral-800 dark:text-white">{tpl.name}</h4>
                      <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 line-clamp-2">{tpl.content}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onUseTemplate(tpl.content)}
                        className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="Usar plantilla"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                      <button
                        onClick={() => onDelete(tpl.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variable reference */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-neutral-400" />
            Variables disponibles
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { var: '{nombre_cliente}', desc: 'Nombre del cliente' },
              { var: '{nombre_usuario}', desc: 'Tu nombre' },
              { var: '{telefono_usuario}', desc: 'Tu telefono' },
              { var: '{email_usuario}', desc: 'Tu email' },
              { var: '{tipo_seguro}', desc: 'Tipo de seguro' },
              { var: '{fecha_vencimiento}', desc: 'Fecha vencimiento' },
              { var: '{liga_seguwallet}', desc: 'Liga Seguwallet' },
              { var: '{liga_formulario}', desc: 'Liga formulario' },
            ].map(v => (
              <div key={v.var} className="text-xs">
                <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">{v.var}</code>
                <span className="text-neutral-400 dark:text-white/30 ml-1.5">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
