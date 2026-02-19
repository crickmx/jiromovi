import { X, Users, UserPlus, UserMinus } from 'lucide-react';

interface ChatInfoProps {
  chat: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function ChatInfo({ chat, onClose }: ChatInfoProps) {
  return (
    <div className="w-80 border-l border-neutral-200 bg-white flex flex-col">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <h3 className="font-bold text-neutral-900">Información del chat</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-100 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Tipo de chat */}
          <div>
            <p className="text-sm font-semibold text-neutral-700 mb-2">Tipo</p>
            <p className="text-neutral-900">
              {chat.tipo === 'group' ? 'Grupo' : 'Chat directo'}
            </p>
          </div>

          {/* Miembros */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-neutral-700">
                Participantes ({chat.miembros?.length || 0})
              </p>
              {chat.tipo === 'group' && (
                <button
                  className="p-1 text-accent hover:bg-primary-50 rounded transition-colors"
                  title="Agregar participante"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {chat.miembros?.map((miembro: any) => (
                <div
                  key={miembro.usuario_id}
                  className="flex items-center justify-between p-2 hover:bg-neutral-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">
                        {miembro.usuarios?.nombre} {miembro.usuarios?.apellidos}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {miembro.usuarios?.rol}
                      </p>
                    </div>
                  </div>
                  {chat.tipo === 'group' && (
                    <button
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remover"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
