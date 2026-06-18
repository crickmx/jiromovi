import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Users, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatMessages } from '../components/chat/ChatMessages';
import { NuevoChatModal } from '../components/chat/NuevoChatModal';
import { NuevoGrupoModal } from '../components/chat/NuevoGrupoModal';
import { ChatInfo } from '../components/chat/ChatInfo';

interface Chat {
  id: string;
  tipo: 'direct' | 'group';
  nombre: string | null;
  descripcion: string | null;
  ultimo_mensaje_at: string;
  created_at: string;
  miembros?: any[];
  ultimo_mensaje?: any;
}

export function Chat() {
  const { usuario } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNuevoChat, setShowNuevoChat] = useState(false);
  const [showNuevoGrupo, setShowNuevoGrupo] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Verificar acceso
  useEffect(() => {
    if (usuario && !['Administrador', 'Gerente', 'Empleado'].includes(usuario.rol)) {
      window.location.href = '/dashboard';
    }
  }, [usuario]);

  useEffect(() => {
    if (usuario) {
      loadChats();

      // Suscribirse a cambios en chats
      const subscription = supabase
        .channel('chats-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chats'
        }, () => {
          loadChats();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_mensajes'
        }, () => {
          loadChats();
          if (selectedChat) {
            loadChatDetails(selectedChat.id);
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [usuario]);

  const loadChats = async () => {
    if (!usuario) {
      console.log('[Chat] No hay usuario, saltando carga de chats');
      return;
    }

    console.log('[Chat] Cargando chats del usuario:', usuario.id);

    try {
      // Obtener chats donde el usuario es miembro (excluir eliminados y ocultos)
      const { data: miembros, error: miembrosError } = await supabase
        .from('chat_miembros')
        .select('chat_id')
        .eq('usuario_id', usuario.id)
        .eq('eliminado', false)
        .eq('oculto', false);

      if (miembrosError) {
        console.error('[Chat] Error cargando membresías:', miembrosError);
        setLoading(false);
        return;
      }

      console.log('[Chat] Membresías encontradas:', miembros?.length || 0);

      const chatIds = miembros?.map(m => m.chat_id) || [];

      if (chatIds.length === 0) {
        console.log('[Chat] Usuario no tiene chats');
        setChats([]);
        setLoading(false);
        return;
      }

      console.log('[Chat] IDs de chats:', chatIds);

      // Obtener detalles de los chats
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false });

      if (chatsError) {
        console.error('[Chat] Error cargando chats:', chatsError);
        setLoading(false);
        return;
      }

      console.log('[Chat] Chats cargados:', chatsData?.length);

      // Batch-load all members for all chats at once (avoids N+1)
      const { data: allMiembros } = await supabase
        .from('chat_miembros')
        .select(`
          chat_id,
          usuario_id,
          unido_at,
          usuarios (
            id,
            nombre,
            apellidos,
            rol,
            imagen_perfil_url
          )
        `)
        .in('chat_id', chatIds)
        .eq('eliminado', false);

      // Batch-load unread counts for current user
      const { data: unreadRows } = await supabase
        .from('chat_miembros')
        .select('chat_id, mensajes_no_leidos')
        .in('chat_id', chatIds)
        .eq('usuario_id', usuario.id);

      const miembrosByChat: Record<string, any[]> = {};
      const unreadByChat: Record<string, number> = {};
      (allMiembros || []).forEach(m => {
        if (!miembrosByChat[m.chat_id]) miembrosByChat[m.chat_id] = [];
        miembrosByChat[m.chat_id].push(m);
      });
      (unreadRows || []).forEach(r => {
        unreadByChat[r.chat_id] = r.mensajes_no_leidos || 0;
      });

      const enrichedChats = (chatsData || []).map(chat => ({
        ...chat,
        miembros: miembrosByChat[chat.id] || [],
        mensajes_no_leidos: unreadByChat[chat.id] || 0,
      }));

      console.log('[Chat] Chats enriquecidos:', enrichedChats.length);
      setChats(enrichedChats);
    } catch (error) {
      console.error('[Chat] Error general:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatDetails = async (chatId: string) => {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (data) {
      // Cargar miembros
      const { data: miembrosData } = await supabase
        .from('chat_miembros')
        .select(`
          usuario_id,
          unido_at,
          usuarios (
            id,
            nombre,
            apellidos,
            rol,
            imagen_perfil_url
          )
        `)
        .eq('chat_id', data.id);

      setSelectedChat({
        ...data,
        miembros: miembrosData || []
      });
    }
  };

  const handleChatSelect = (chat: Chat) => {
    console.log('[Chat] Chat seleccionado:', chat.id);
    setSelectedChat(chat);
    setShowChatInfo(false);
  };

  const handleChatCreated = () => {
    setShowNuevoChat(false);
    setShowNuevoGrupo(false);
    loadChats();
  };

  const handleChatDeleted = () => {
    // Recargar la lista de chats
    loadChats();
    // Si el chat eliminado era el seleccionado, deseleccionarlo
    setSelectedChat(null);
    setShowChatInfo(false);
  };

  const getChatName = (chat: Chat): string => {
    if (chat.tipo === 'group') {
      return chat.nombre || 'Grupo sin nombre';
    }

    // Para chats directos, mostrar el nombre del otro usuario
    const otherMember = chat.miembros?.find((m: any) => m.usuario_id !== usuario?.id);
    if (otherMember && otherMember.usuarios) {
      return `${otherMember.usuarios.nombre} ${otherMember.usuarios.apellidos || ''}`.trim();
    }

    return 'Chat directo';
  };

  const filteredChats = chats.filter(chat => {
    const chatName = getChatName(chat).toLowerCase();
    return chatName.includes(searchTerm.toLowerCase());
  });

  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  if (!usuario || !['Administrador', 'Gerente', 'Empleado'].includes(usuario.rol)) {
    return null;
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        'flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900',
        'w-full sm:w-80',
        mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
      )}>
        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-800 dark:text-white text-sm">Mensajes</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowNuevoChat(true)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat</span>
              </button>
              {usuario.rol !== 'Empleado' && (
                <button
                  onClick={() => setShowNuevoGrupo(true)}
                  className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  title="Nuevo grupo"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar chats..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col p-3 gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-2/3" />
                    <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
              </div>
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                {searchTerm ? 'Sin resultados' : 'Sin chats aun'}
              </p>
              {!searchTerm && (
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
                  Crea un nuevo chat para comunicarte con tu equipo
                </p>
              )}
            </div>
          ) : (
            <ChatSidebar
              chats={filteredChats}
              selectedChat={selectedChat}
              onSelectChat={(chat) => { handleChatSelect(chat); setMobileView('thread'); }}
              getChatName={getChatName}
              currentUserId={usuario.id}
              onChatDeleted={handleChatDeleted}
            />
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden',
        mobileView === 'list' ? 'hidden sm:flex' : 'flex'
      )}>
        {selectedChat ? (
          <ChatMessages
            chat={selectedChat}
            getChatName={getChatName}
            onShowInfo={() => setShowChatInfo(true)}
            onBack={() => setMobileView('list')}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Selecciona un chat
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">
              Elige una conversacion del panel izquierdo para ver los mensajes.
            </p>
          </div>
        )}
      </div>

      {/* Info Panel */}
      {showChatInfo && selectedChat && (
        <ChatInfo
          chat={selectedChat}
          onClose={() => setShowChatInfo(false)}
          onUpdate={() => {
            loadChats();
            if (selectedChat) {
              loadChatDetails(selectedChat.id);
            }
          }}
        />
      )}

      {/* Modales */}
      {showNuevoChat && (
        <NuevoChatModal
          isOpen={showNuevoChat}
          onClose={() => setShowNuevoChat(false)}
          onSuccess={handleChatCreated}
        />
      )}

      {showNuevoGrupo && (
        <NuevoGrupoModal
          isOpen={showNuevoGrupo}
          onClose={() => setShowNuevoGrupo(false)}
          onSuccess={handleChatCreated}
        />
      )}
    </div>
  );
}
export default Chat;
