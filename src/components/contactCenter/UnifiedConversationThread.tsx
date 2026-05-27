import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  type UnifiedConversation, type UnifiedMessage,
  getConversationDisplayName, CHANNEL_LABELS,
} from '@/lib/unifiedContactCenter';
import { ChannelBadge } from './ChannelBadge';

interface Props {
  conversation: UnifiedConversation;
  onBack?: () => void;
  currentUserId: string;
  participantNames: Record<string, string>;
}

export function UnifiedConversationThread({ conversation, onBack, currentUserId, participantNames }: Props) {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { channel, sourceId } = conversation;

    try {
      if (channel === 'wa_movi') {
        // Group by contact_phone (sourceId is the phone or agent_user_id key)
        const isPhone = sourceId.includes('+') || /^\d{10,}/.test(sourceId);
        let query = supabase
          .from('contact_center_messages')
          .select('id, direction, body, created_at, status, metadata, attachment_urls, sender_type, sender_user_id, contact_name, contact_phone')
          .eq('channel', 'whatsapp')
          .order('created_at', { ascending: true });

        if (isPhone) {
          query = query.eq('contact_phone', sourceId);
        } else {
          query = query.eq('agent_user_id', sourceId);
        }

        const { data } = await query.limit(200);
        setMessages((data || []).map((m: any): UnifiedMessage => ({
          id: m.id,
          direction: m.direction === 'inbound' ? 'inbound' : 'outbound',
          messageType: m.metadata?.message_type || 'text',
          body: m.body || null,
          mediaUrl: m.metadata?.content_uri || null,
          mediaMime: null,
          mediaFilename: null,
          mediaThumbnail: null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          senderName: m.direction === 'inbound' ? (m.contact_name || m.contact_phone) : null,
          sentAt: m.created_at,
          status: m.status || 'sent',
        })));

      } else if (channel === 'wa_personal') {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('id, direction, message_type, content, media_url, media_filename, media_mime_type, media_thumbnail_url, media_caption, status, created_at, metadata')
          .eq('conversation_id', sourceId)
          .order('created_at', { ascending: true })
          .limit(200);

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
        })));

      } else if (channel === 'chat') {
        const { data } = await supabase
          .from('chat_mensajes')
          .select('id, remitente_id, mensaje, created_at, eliminado')
          .eq('chat_id', sourceId)
          .eq('eliminado', false)
          .order('created_at', { ascending: true })
          .limit(200);

        setMessages((data || []).map((m: any): UnifiedMessage => ({
          id: m.id,
          direction: m.remitente_id === currentUserId ? 'outbound' : 'inbound',
          messageType: 'text',
          body: m.mensaje || null,
          mediaUrl: null,
          mediaMime: null,
          mediaFilename: null,
          mediaThumbnail: null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          senderName: m.remitente_id !== currentUserId ? (participantNames[m.remitente_id] || null) : null,
          sentAt: m.created_at,
          status: 'sent',
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [conversation.id, conversation.channel, conversation.sourceId, currentUserId, participantNames]);

  useEffect(() => {
    loadMessages();
    setText('');
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime for this conversation
  useEffect(() => {
    const { channel, sourceId } = conversation;
    if (channel === 'wa_personal') {
      const ch = supabase
        .channel(`wa_thread_${sourceId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
          filter: `conversation_id=eq.${sourceId}`,
        }, () => loadMessages())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'chat') {
      const ch = supabase
        .channel(`chat_thread_${sourceId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chat_mensajes',
          filter: `chat_id=eq.${sourceId}`,
        }, () => loadMessages())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'wa_movi') {
      const ch = supabase
        .channel(`movi_thread_${sourceId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'contact_center_messages',
        }, () => loadMessages())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [conversation.id, loadMessages]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);

    try {
      const { channel, sourceId } = conversation;

      if (channel === 'wa_personal') {
        // Get conversation to get the phone
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('remote_phone')
          .eq('id', sourceId)
          .single();

        await supabase.functions.invoke('whatsapp-session', {
          body: { action: 'send-message', phone: conv?.remote_phone, message: body },
        });
        // Optimistic insert into whatsapp_messages
        await supabase.from('whatsapp_messages').insert({
          conversation_id: sourceId,
          user_id: currentUserId,
          direction: 'outbound',
          message_type: 'text',
          content: body,
          status: 'pending',
        });

      } else if (channel === 'wa_movi') {
        await supabase.functions.invoke('send-direct-whatsapp', {
          body: { phone: conversation.contactPhone, message: body },
        });
        await supabase.from('contact_center_messages').insert({
          agent_user_id: currentUserId,
          contact_phone: conversation.contactPhone,
          contact_name: conversation.contactName,
          channel: 'whatsapp',
          direction: 'outbound',
          sender_type: 'user',
          sender_user_id: currentUserId,
          body,
          status: 'pending',
          provider: 'wazzup',
        });

      } else if (channel === 'chat') {
        await supabase.from('chat_mensajes').insert({
          chat_id: sourceId,
          remitente_id: currentUserId,
          mensaje: body,
        });
      }

      await loadMessages();
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

  const name = getConversationDisplayName(conversation, participantNames);

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
          {conversation.contactPhone && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{conversation.contactPhone}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-neutral-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Sin mensajes</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showDate = !prev || new Date(msg.sentAt).toDateString() !== new Date(prev.sentAt).toDateString();
              const isOut = msg.direction === 'outbound';
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="px-3 py-1 bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400 text-[10px] rounded-full">
                        {new Date(msg.sentAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex mb-1.5', isOut ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] space-y-0.5', isOut ? 'items-end' : 'items-start')}>
                      {msg.senderName && !isOut && (
                        <p className="text-[10px] text-neutral-400 ml-1">{msg.senderName}</p>
                      )}
                      <div className={cn(
                        'rounded-2xl px-3 py-2 shadow-sm',
                        isOut
                          ? 'bg-accent text-white rounded-tr-sm'
                          : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700 rounded-tl-sm'
                      )}>
                        <MessageContent msg={msg} />
                      </div>
                      <p className={cn('text-[10px] text-neutral-400 px-1', isOut ? 'text-right' : 'text-left')}>
                        {new Date(msg.sentAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
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
        <p className="text-[10px] text-neutral-400 mt-1.5 text-center">
          Enviando por <strong>{CHANNEL_LABELS[conversation.channel]}</strong>
        </p>
      </div>
    </div>
  );
}

function MessageContent({ msg }: { msg: UnifiedMessage }) {
  if (msg.messageType === 'image' && msg.mediaUrl) {
    return (
      <div>
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={msg.mediaThumbnail || msg.mediaUrl}
            alt="imagen"
            className="max-w-[220px] rounded-lg object-cover border border-black/10"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </a>
        {msg.body && <p className="text-sm mt-1 leading-relaxed">{msg.body}</p>}
      </div>
    );
  }
  if (msg.messageType === 'audio' && msg.mediaUrl) {
    return (
      <audio controls className="max-w-[200px] h-8">
        <source src={msg.mediaUrl} type={msg.mediaMime || 'audio/ogg'} />
      </audio>
    );
  }
  if (msg.messageType === 'video' && msg.mediaUrl) {
    return (
      <video controls className="max-w-[220px] rounded-lg" poster={msg.mediaThumbnail || undefined}>
        <source src={msg.mediaUrl} type={msg.mediaMime || 'video/mp4'} />
      </video>
    );
  }
  if (msg.messageType === 'document') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="opacity-70">📄</span>
        <span className="truncate max-w-[180px]">{msg.mediaFilename || 'Documento'}</span>
        {msg.mediaUrl && (
          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100">↓</a>
        )}
      </div>
    );
  }
  return msg.body
    ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
    : <p className="text-sm opacity-50 italic">Mensaje multimedia</p>;
}
