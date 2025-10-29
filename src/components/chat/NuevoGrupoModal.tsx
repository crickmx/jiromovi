import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';

interface NuevoGrupoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NuevoGrupoModal({ isOpen, onClose, onSuccess }: NuevoGrupoModalProps) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedUsuarios, setSelectedUsuarios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
      setNombre('');
      setDescripcion('');
      setSelectedUsuarios([]);
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, rol')
      .in('rol', ['Administrador', 'Gerente', 'Empleado'])
      .neq('id', usuario?.id || '')
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setUsuarios(data);
    }
  };

  const toggleUsuario = (userId: string) => {
    setSelectedUsuarios(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!nombre.trim() || selectedUsuarios.length === 0 || !usuario) return;

    setLoading(true);

    try {
      // Crear grupo
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          tipo: 'group',
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          creador_id: usuario.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Agregar creador
      await supabase.from('chat_miembros').insert({
        chat_id: chat.id,
        usuario_id: usuario.id,
        rol_al_unirse: usuario.rol
      });

      // Agregar miembros seleccionados
      const miembros = selectedUsuarios.map(userId => ({
        chat_id: chat.id,
        usuario_id: userId,
        rol_al_unirse: usuarios.find(u => u.id === userId)?.rol || 'Empleado'
      }));

      await supabase.from('chat_miembros').insert(miembros);

      onSuccess();
    } catch (error) {
      console.error('[NuevoGrupoModal] Error:', error);
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
        disabled={!nombre.trim() || selectedUsuarios.length === 0 || loading}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Grupo'}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Grupo"
      maxWidth="2xl"
      footer={footer}
    >
      <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Nombre del grupo *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Equipo de Ventas"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional del grupo"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Agregar participantes ({selectedUsuarios.length})
            </label>
            <div className="border border-neutral-300 rounded-lg max-h-64 overflow-y-auto">
              {usuarios.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center p-3 hover:bg-neutral-50 cursor-pointer border-b border-neutral-200 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsuarios.includes(u.id)}
                    onChange={() => toggleUsuario(u.id)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-neutral-900">
                      {u.nombre} {u.apellidos}
                    </p>
                    <p className="text-sm text-neutral-600">{u.rol}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
      </div>
    </BaseModal>
  );
}
