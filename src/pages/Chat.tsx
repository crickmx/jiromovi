import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Users, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

      // Enriquecer con información de miembros y último mensaje
      const enrichedChats = await Promise.all(
        (chatsData || []).map(async (chat) => {
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
            .eq('chat_id', chat.id);

          // Cargar último mensaje
          const { data: ultimoMensaje } = await supabase
            .from('chat_mensajes')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...chat,
            miembros: miembrosData || [],
            ultimo_mensaje: ultimoMensaje
          };
        })
      );

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

  if (!usuario || !['Administrador', 'Gerente', 'Empleado'].includes(usuario.rol)) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-accent">Chat</h1>
              <p className="text-sm text-neutral-600">Mensajería interna en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowNuevoChat(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Chat</span>
            </button>

            {usuario.rol !== 'Empleado' && (
              <button
                onClick={() => setShowNuevoGrupo(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-accent text-accent rounded-lg hover:bg-primary-50 transition-all"
              >
                <Users className="w-5 h-5" />
                <span>Nuevo Grupo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-80 border-r border-neutral-200 bg-white flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-neutral-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar chats..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-neutral-600">Cargando chats...</div>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageSquare className="w-16 h-16 text-neutral-300 mb-4" />
                <p className="text-neutral-600 mb-2">No tienes chats aún</p>
                <p className="text-sm text-neutral-500">
                  Crea un nuevo chat o grupo para comenzar
                </p>
              </div>
            ) : (
              <ChatSidebar
                chats={filteredChats}
                selectedChat={selectedChat}
                onSelectChat={handleChatSelect}
                getChatName={getChatName}
                currentUserId={usuario.id}
                onChatDeleted={handleChatDeleted}
              />
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              <ChatMessages
                chat={selectedChat}
                getChatName={getChatName}
                onShowInfo={() => setShowChatInfo(true)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-neutral-100">
              <div className="text-center">
                <MessageSquare className="w-24 h-24 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-600 mb-2">
                  Selecciona un chat
                </h3>
                <p className="text-neutral-500">
                  Elige una conversación para ver los mensajes
                </p>
              </div>
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
      </div>

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
