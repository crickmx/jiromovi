import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';

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
      console.log('[NuevoChatModal] Creando chat con:', selectedUsuario);

      const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
        p_user1_id: usuario.id,
        p_user2_id: selectedUsuario
      });

      if (error) {
        console.error('[NuevoChatModal] Error RPC:', error);
        throw error;
      }

      console.log('[NuevoChatModal] Chat creado/encontrado:', data);
      onSuccess();
    } catch (error: any) {
      console.error('[NuevoChatModal] Error:', error);
      alert(`Error al crear chat: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const footer = (
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
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Chat"
      maxWidth="md"
      footer={footer}
    >
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

    </BaseModal>
  );
}
