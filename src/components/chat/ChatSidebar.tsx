import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ChatSidebarProps {
  chats: any[];
  selectedChat: any;
  onSelectChat: (chat: any) => void;
  getChatName: (chat: any) => string;
  currentUserId: string;
  onChatDeleted?: () => void;
}

export function ChatSidebar({ chats, selectedChat, onSelectChat, getChatName, currentUserId, onChatDeleted }: ChatSidebarProps) {
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();

    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación? Esta acción no se puede deshacer.')) {
      return;
    }

    setDeletingChatId(chatId);

    try {
      const { error } = await supabase.rpc('eliminar_chat', {
        p_chat_id: chatId,
        p_usuario_id: currentUserId
      });

      if (error) throw error;

      // Notificar al componente padre que se eliminó el chat
      if (onChatDeleted) {
        onChatDeleted();
      }
    } catch (error) {
      console.error('Error al eliminar chat:', error);
      alert('Error al eliminar la conversación. Por favor intenta de nuevo.');
    } finally {
      setDeletingChatId(null);
    }
  };

  return (
    <div className="divide-y divide-neutral-200">
      {chats.map((chat) => {
        const isSelected = selectedChat?.id === chat.id;
        const lastMessage = chat.ultimo_mensaje;
        const isDeleting = deletingChatId === chat.id;
        const isHovered = hoveredChatId === chat.id;

        return (
          <div
            key={chat.id}
            className="relative group"
            onMouseEnter={() => setHoveredChatId(chat.id)}
            onMouseLeave={() => setHoveredChatId(null)}
          >
            <button
              onClick={() => onSelectChat(chat)}
              disabled={isDeleting}
              className={`w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors ${
                isSelected ? 'bg-primary-50 border-l-4 border-accent' : ''
              } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-neutral-900 truncate pr-8">
                  {getChatName(chat)}
                </h3>
                {chat.ultimo_mensaje_at && (
                  <span className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(chat.ultimo_mensaje_at), {
                      addSuffix: true,
                      locale: es
                    })}
                  </span>
                )}
              </div>
              {lastMessage && (
                <p className="text-sm text-neutral-600 truncate">
                  {lastMessage.eliminado ? (
                    <span className="italic">Este mensaje fue eliminado</span>
                  ) : (
                    lastMessage.mensaje
                  )}
                </p>
              )}
            </button>

            {/* Botón de eliminar */}
            {isHovered && !isDeleting && (
              <button
                onClick={(e) => handleDeleteChat(e, chat.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-all shadow-sm border border-neutral-200 z-10"
                title="Eliminar conversación"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
