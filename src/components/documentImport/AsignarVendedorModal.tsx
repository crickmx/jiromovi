import { useState, useEffect } from 'react';
import { X, Search, User, CheckCircle } from 'lucide-react';
import { searchMoviUsers, assignVendorToUser } from '../../lib/documentImportUtils';
import type { UnmatchedVendorGroup } from '../../lib/documentImportTypes';

interface AsignarVendedorModalProps {
  group: UnmatchedVendorGroup;
  batchId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface MoviUser {
  id: string;
  nombre_completo: string;
  email: string;
}

export default function AsignarVendedorModal({
  group,
  batchId,
  onClose,
  onSuccess,
}: AsignarVendedorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MoviUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MoviUser | null>(null);
  const [saveMapping, setSaveMapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async () => {
    setSearching(true);
    try {
      const results = await searchMoviUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const result = await assignVendorToUser({
        batch_id: batchId,
        vendor_key: group.vendor_key,
        movi_user_id: selectedUser.id,
        save_mapping: saveMapping,
      });

      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error al asignar vendedor:', error);
      alert('Error al asignar el vendedor. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Asignar vendedor a usuario MOVI</h2>
            <p className="text-sm text-gray-600 mt-1">
              Busca y selecciona el usuario correcto
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Información del vendedor</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Tipo:</span>{' '}
                {group.type === 'email' ? 'Email' : group.type === 'name' ? 'Nombre' : 'Desconocido'}
              </p>
              {group.vendor_email_raw && (
                <p>
                  <span className="font-medium">Email detectado:</span> {group.vendor_email_raw}
                </p>
              )}
              {group.vendor_name_raw && (
                <p>
                  <span className="font-medium">Nombre detectado:</span> {group.vendor_name_raw}
                </p>
              )}
              <p>
                <span className="font-medium">Documentos afectados:</span> {group.document_count}
              </p>
            </div>

            {group.sample_documents.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-sm text-blue-900 mb-1">Documentos de ejemplo:</p>
                <div className="flex flex-wrap gap-2">
                  {group.sample_documents.slice(0, 5).map((doc, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-blue-800"
                    >
                      {doc}
                    </span>
                  ))}
                  {group.sample_documents.length > 5 && (
                    <span className="px-2 py-1 text-xs text-blue-600">
                      +{group.sample_documents.length - 5} más
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar usuario MOVI
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {searching && (
              <div className="mt-2 text-center text-gray-500 text-sm">
                Buscando...
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0 ${
                      selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{user.nombre_completo}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      {selectedUser?.id === user.id && (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && !searching && searchResults.length === 0 && (
              <div className="mt-2 text-center text-gray-500 text-sm p-4 bg-gray-50 rounded-lg">
                No se encontraron usuarios
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Usuario seleccionado</h4>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">{selectedUser.nombre_completo}</p>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="saveMapping"
              checked={saveMapping}
              onChange={(e) => setSaveMapping(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="saveMapping" className="text-sm text-gray-700 cursor-pointer">
              Guardar este mapeo para futuros eventos (recomendado)
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUser || loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Asignando...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Asignar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
