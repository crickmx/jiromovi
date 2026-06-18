import { useState, useEffect } from 'react';
import { X, Search, UserPlus, CircleAlert as AlertCircle } from 'lucide-react';
import { buscarUsuariosParaCompartir, invitarMiembro } from '../../lib/crmUtils';
import type { SearchableUser, MemberRole } from '../../lib/crmTypes';
import { useAuth } from '../../contexts/AuthContext';

interface CompartirTableroModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  onMemberAdded: () => void;
}

export default function CompartirTableroModal({
  isOpen,
  onClose,
  boardId,
  boardName,
  onMemberAdded,
}: CompartirTableroModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [usuarios, setUsuarios] = useState<SearchableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const { usuario: user } = useAuth();

  useEffect(() => {
    if (searchQuery.length >= 2) {
      buscarUsuarios();
    } else {
      setUsuarios([]);
    }
  }, [searchQuery]);

  const buscarUsuarios = async () => {
    try {
      setLoading(true);
      setError('');
      const results = await buscarUsuariosParaCompartir(searchQuery);
      const filtrados = results.filter((u) => u.id !== user?.id);
      setUsuarios(filtrados);
    } catch (err: any) {
      console.error('Error buscando usuarios:', err);
      setError('Error al buscar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitar = async (userId: string, role: MemberRole) => {
    try {
      setInviting(true);
      setError('');
      await invitarMiembro(boardId, userId, role);
      onMemberAdded();
      setSearchQuery('');
      setUsuarios([]);
    } catch (err: any) {
      console.error('Error invitando miembro:', err);
      setError(err.message || 'Error al invitar miembro');
    } finally {
      setInviting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Compartir Tablero</h3>
            <p className="text-sm text-gray-600 mt-1">{boardName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar usuario para invitar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Solo se pueden invitar usuarios con rol Empleado, Gerente o Administrador
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
              </div>
            )}

            {!loading && searchQuery.length >= 2 && usuarios.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No se encontraron usuarios</p>
              </div>
            )}

            {!loading &&
              usuarios.map((usuario) => (
                <div
                  key={usuario.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-accent text-white flex items-center justify-center font-semibold">
                      {usuario.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {usuario.nombre_completo}
                      </p>
                      <p className="text-xs text-gray-600">
                        {usuario.oficina_nombre} • {usuario.rol}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      id={`role-${usuario.id}`}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-accent focus:border-accent"
                      defaultValue="viewer"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById(
                          `role-${usuario.id}`
                        ) as HTMLSelectElement;
                        const role = select.value as MemberRole;
                        handleInvitar(usuario.id, role);
                      }}
                      disabled={inviting}
                      className="px-3 py-1 bg-accent text-white rounded hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Invitar
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Roles disponibles:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>
                  <strong>Viewer:</strong> Solo puede ver el contenido del tablero
                </li>
                <li>
                  <strong>Editor:</strong> Puede editar contenido pero no gestionar miembros
                </li>
                <li>
                  <strong>Admin:</strong> Puede editar contenido y gestionar miembros
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
