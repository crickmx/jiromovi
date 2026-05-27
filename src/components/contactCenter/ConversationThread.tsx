import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, RefreshCw, ArrowLeft, MoreVertical, Archive, CheckCircle, Clock, Loader2, Smartphone, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type CCConversation, type CCMessage, type CCChannel,
  formatConversationName, CHANNEL_LABELS,
} from '@/lib/contactCenterTypes';
import { ChannelBadge } from './ChannelBadge';
import { MessageBubble } from './MessageBubble';

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
    // Realtime subscription
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
      // Insert outbound message into cc_messages
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

      // Fire-and-forget: actually send via existing connectors
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
          body: { action: 'send-message', phone: conversation.contact_phone, message: body },
        });
      }

      // Update conversation last_message
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
        <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
          {/* Channel selector for reply */}
          {conversation.channel !== 'chat' && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-neutral-400">Responder por:</span>
              {SEND_CHANNEL_OPTIONS.filter(o => o.value === conversation.channel || o.value === conversation.channel).slice(0, 2).map(opt => (
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
          <div className="flex items-end gap-2">
            <textarea
              ref={textRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva linea)`}
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
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5 text-center">
            Enviando por <strong>{CHANNEL_LABELS[sendChannel]}</strong>
          </p>
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
    </div>
  );
}
