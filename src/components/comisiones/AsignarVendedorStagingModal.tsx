import { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Usuario {
  id: string;
  nombre_completo: string;
  email_laboral: string;
  nombre_completo_norm: string;
}

interface AsignarVendedorStagingModalProps {
  vendorName: string;
  onClose: () => void;
  onAssign: (userId: string) => void;
}

export default function AsignarVendedorStagingModal({
  vendorName,
  onClose,
  onAssign
}: AsignarVendedorStagingModalProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState<Usuario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsuarios(usuarios);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsuarios(
        usuarios.filter(u =>
          u.nombre_completo.toLowerCase().includes(term) ||
          u.email_laboral.toLowerCase().includes(term) ||
          (u.nombre_completo_norm && u.nombre_completo_norm.includes(term))
        )
      );
    }
  }, [searchTerm, usuarios]);

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, email_laboral, nombre_completo_norm')
        .not('nombre_completo', 'is', null)
        .order('nombre_completo');

      if (error) throw error;

      setUsuarios(data || []);
      setFilteredUsuarios(data || []);
    } catch (error: any) {
      console.error('Error loading usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = () => {
    if (!selectedUserId) {
      alert('Por favor selecciona un usuario');
      return;
    }
    onAssign(selectedUserId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              Asignar Vendedor
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              Vendedor: <span className="font-semibold">{vendorName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-neutral-700" />
          </button>
        </div>

        <div className="p-6 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-neutral-600">
              Cargando usuarios...
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="text-center py-8 text-neutral-600">
              No se encontraron usuarios
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsuarios.map(usuario => (
                <button
                  key={usuario.id}
                  onClick={() => setSelectedUserId(usuario.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedUserId === usuario.id
                      ? 'border-accent bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedUserId === usuario.id
                        ? 'bg-accent'
                        : 'bg-neutral-200'
                    }`}>
                      <User className={`w-5 h-5 ${
                        selectedUserId === usuario.id
                          ? 'text-white'
                          : 'text-neutral-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-900">
                        {usuario.nombre_completo}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {usuario.email_laboral}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-colors font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUserId}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Asignar Usuario
          </button>
        </div>
      </div>
    </div>
  );
}
