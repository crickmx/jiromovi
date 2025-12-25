import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatSidebarProps {
  chats: any[];
  selectedChat: any;
  onSelectChat: (chat: any) => void;
  getChatName: (chat: any) => string;
  currentUserId: string;
}

export function ChatSidebar({ chats, selectedChat, onSelectChat, getChatName }: ChatSidebarProps) {
  return (
    <div className="divide-y divide-neutral-200">
      {chats.map((chat) => {
        const isSelected = selectedChat?.id === chat.id;
        const lastMessage = chat.ultimo_mensaje;

        return (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat)}
            className={`w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors ${
              isSelected ? 'bg-primary-50 border-l-4 border-primary-600' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-neutral-900 truncate">
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
        );
      })}
    </div>
  );
}
