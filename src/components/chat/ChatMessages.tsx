import { useState, useEffect, useRef } from 'react';
import { Info, Send, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatMessagesProps {
  chat: any;
  getChatName: (chat: any) => string;
  onShowInfo: () => void;
}

export function ChatMessages({ chat, getChatName, onShowInfo }: ChatMessagesProps) {
  const { usuario } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat) {
      loadMessages();

      // Suscribirse a nuevos mensajes
      const subscription = supabase
        .channel(`chat-${chat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `chat_id=eq.${chat.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [chat]);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_mensajes')
      .select(`
        *,
        usuarios:remitente_id (
          id,
          nombre,
          apellidos,
          imagen_perfil_url
        )
      `)
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatMessages] Error cargando mensajes:', error);
    } else {
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !usuario) return;

    const { error } = await supabase
      .from('chat_mensajes')
      .insert({
        chat_id: chat.id,
        remitente_id: usuario.id,
        mensaje: newMessage.trim()
      });

    if (error) {
      console.error('[ChatMessages] Error enviando mensaje:', error);
    } else {
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">{getChatName(chat)}</h2>
          <p className="text-sm text-neutral-600">
            {chat.miembros?.length || 0} participantes
          </p>
        </div>
        <button
          onClick={onShowInfo}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <Info className="w-5 h-5 text-neutral-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50">
        {loading ? (
          <div className="text-center text-neutral-600">Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            <p>No hay mensajes aún</p>
            <p className="text-sm mt-2">Sé el primero en escribir</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.remitente_id === usuario?.id;
            const sender = message.usuarios;

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-lg ${isMine ? 'order-2' : 'order-1'}`}>
                  {!isMine && sender && (
                    <p className="text-xs text-neutral-600 mb-1 px-3">
                      {sender.nombre} {sender.apellidos}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isMine
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-neutral-900 border border-neutral-200'
                    }`}
                  >
                    {message.eliminado ? (
                      <p className="italic text-sm opacity-70">
                        Este mensaje fue eliminado
                      </p>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words">{message.mensaje}</p>
                        {message.editado && (
                          <p className="text-xs opacity-70 mt-1">(editado)</p>
                        )}
                      </>
                    )}
                  </div>
                  <p
                    className={`text-xs text-neutral-500 mt-1 px-3 ${
                      isMine ? 'text-right' : 'text-left'
                    }`}
                  >
                    {format(new Date(message.created_at), 'HH:mm', { locale: es })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-neutral-200 p-4">
        <div className="flex items-end space-x-2">
          <button
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Adjuntar archivo"
          >
            <Paperclip className="w-5 h-5 text-neutral-600" />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
