import { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NuevoChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NuevoChatModal({ isOpen, onClose, onSuccess }: NuevoChatModalProps) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, rol, puesto')
      .in('rol', ['Administrador', 'Gerente', 'Empleado'])
      .neq('id', usuario?.id || '')
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setUsuarios(data);
    }
  };

  const handleCreate = async () => {
    if (!selectedUsuario || !usuario) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
        p_user1_id: usuario.id,
        p_user2_id: selectedUsuario
      });

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('[NuevoChatModal] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-strong max-w-md w-full mx-4">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-neutral-900">Nuevo Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Seleccionar usuario
            </label>
            <select
              value={selectedUsuario}
              onChange={(e) => setSelectedUsuario(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccionar --</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos} - {u.puesto || u.rol}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedUsuario || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
