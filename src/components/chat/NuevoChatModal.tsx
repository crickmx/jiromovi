import { useState, useEffect, useRef } from 'react';
import { Search, X, Check } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const [selectedUsuario, setSelectedUsuario] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
      setQuery('');
      setSelectedUsuario(null);
      setTimeout(() => inputRef.current?.focus(), 100);
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

  const handleSelect = (u: any) => {
    setSelectedUsuario(u);
    setQuery(`${u.nombre} ${u.apellidos}`);
  };

  const handleClear = () => {
    setSelectedUsuario(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleCreate = async () => {
    if (!selectedUsuario || !usuario) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
        p_user1_id: usuario.id,
        p_user2_id: selectedUsuario.id
      });

      if (error) throw error;
      onSuccess();
    } catch (error: any) {
      alert(`Error al crear chat: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showDropdown = query.trim().length > 0 && !selectedUsuario;

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
        className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Chat'}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Nuevo Chat" maxWidth="md" footer={footer}>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Buscar usuario
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedUsuario) setSelectedUsuario(null);
            }}
            placeholder="Nombre, puesto o rol..."
            className="w-full pl-9 pr-9 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Selected user chip */}
        {selectedUsuario && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold shrink-0">
              {selectedUsuario.nombre?.[0]}{selectedUsuario.apellidos?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">
                {selectedUsuario.nombre} {selectedUsuario.apellidos}
              </p>
              <p className="text-xs text-neutral-500">{selectedUsuario.puesto || selectedUsuario.rol}</p>
            </div>
            <Check className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
        )}

        {/* Results dropdown */}
        {showDropdown && (
          <div className="mt-1 border border-neutral-200 rounded-lg shadow-lg bg-white max-h-56 overflow-y-auto z-10">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-500">Sin resultados</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-left border-b border-neutral-100 last:border-b-0 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 text-xs flex items-center justify-center font-semibold shrink-0">
                    {u.nombre?.[0]}{u.apellidos?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {u.nombre} {u.apellidos}
                    </p>
                    <p className="text-xs text-neutral-500">{u.puesto || u.rol}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Empty state when no query and no selection */}
        {!query && !selectedUsuario && (
          <p className="mt-2 text-xs text-neutral-400">Escribe el nombre para buscar</p>
        )}
      </div>
    </BaseModal>
  );
}
