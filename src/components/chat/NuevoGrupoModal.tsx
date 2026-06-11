import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
      setNombre('');
      setDescripcion('');
      setSelectedUsuarios([]);
      setQuery('');
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, rol, puesto')
      .not('rol', 'in', '("Agente","Cliente")')
      .neq('id', usuario?.id || '')
      .eq('activo', true)
      .order('nombre');

    if (data) setUsuarios(data);
  };

  const filtered = query.trim()
    ? usuarios.filter((u) => {
        const full = `${u.nombre} ${u.apellidos} ${u.puesto || ''} ${u.rol}`.toLowerCase();
        return full.includes(query.toLowerCase());
      })
    : usuarios;

  const toggleUsuario = (userId: string) => {
    setSelectedUsuarios((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const removeSelected = (userId: string) => {
    setSelectedUsuarios((prev) => prev.filter((id) => id !== userId));
  };

  const handleCreate = async () => {
    if (!nombre.trim() || selectedUsuarios.length === 0 || !usuario) return;

    setLoading(true);
    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          tipo: 'group',
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          creador_id: usuario.id,
          ultimo_mensaje_at: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) throw chatError;

      const { error: creadorError } = await supabase
        .from('chat_miembros')
        .insert({ chat_id: chat.id, usuario_id: usuario.id, rol_al_unirse: usuario.rol });

      if (creadorError) throw creadorError;

      const miembros = selectedUsuarios.map((userId) => ({
        chat_id: chat.id,
        usuario_id: userId,
        rol_al_unirse: usuarios.find((u) => u.id === userId)?.rol || 'Empleado'
      }));

      const { error: miembrosError } = await supabase.from('chat_miembros').insert(miembros);
      if (miembrosError) throw miembrosError;

      onSuccess();
    } catch (error: any) {
      alert(`Error al crear grupo: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedUsers = usuarios.filter((u) => selectedUsuarios.includes(u.id));

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
        className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Grupo'}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Nuevo Grupo" maxWidth="2xl" footer={footer}>
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
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Participantes ({selectedUsuarios.length})
          </label>

          {/* Selected chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                >
                  {u.nombre} {u.apellidos}
                  <button
                    onClick={() => removeSelected(u.id)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search box */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, puesto o rol..."
              className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* User list */}
          <div className="border border-neutral-200 rounded-lg max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-500">Sin resultados</p>
            ) : (
              filtered.map((u) => {
                const isSelected = selectedUsuarios.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-neutral-100 last:border-b-0 transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUsuario(u.id)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 text-xs flex items-center justify-center font-semibold shrink-0">
                      {u.nombre?.[0]}{u.apellidos?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {u.nombre} {u.apellidos}
                      </p>
                      <p className="text-xs text-neutral-500">{u.puesto || u.rol}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
