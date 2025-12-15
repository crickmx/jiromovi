import { useState, useEffect } from 'react';
import { X, Search, User, CheckCircle, FileText, Mail } from 'lucide-react';
import { getAllMoviUsers, searchMoviUsers, assignVendorToUser } from '../../lib/documentImportUtils';
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
  const [allUsers, setAllUsers] = useState<MoviUser[]>([]);
  const [searchResults, setSearchResults] = useState<MoviUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MoviUser | null>(null);
  const [saveMapping, setSaveMapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadAllUsers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults(allUsers);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, allUsers]);

  const loadAllUsers = async () => {
    setInitialLoading(true);
    try {
      const users = await getAllMoviUsers();
      setAllUsers(users);
      setSearchResults(users);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setInitialLoading(false);
    }
  };

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
        const mappingMessage = result.mapping_saved
          ? ' El mapeo ha sido guardado para futuras importaciones.'
          : '';

        alert(
          `Asignación completada exitosamente.\n\n` +
          `Vendedor: ${group.display_value}\n` +
          `Tipo: ${group.type === 'name' ? 'Nombre' : group.type === 'email' ? 'Email' : 'Desconocido'}\n` +
          `Usuario MOVI: ${selectedUser.nombre_completo}\n` +
          `Documentos actualizados: ${result.updated_count}` +
          mappingMessage
        );

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
          <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
              {group.type === 'name' ? (
                <User className="h-5 w-5" />
              ) : group.type === 'email' ? (
                <Mail className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              Vendedor detectado: {group.display_value}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">Documentos en este grupo</p>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold text-gray-900">{group.document_count}</span>
                </div>
              </div>

              {group.emails_detected && group.emails_detected.length > 0 && (
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-600 mb-1">Emails detectados</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <span className="text-2xl font-bold text-gray-900">{group.emails_detected.length}</span>
                  </div>
                </div>
              )}
            </div>

            {group.emails_detected && group.emails_detected.length > 0 && (
              <div className="mb-4 bg-white p-3 rounded-lg shadow-sm">
                <p className="font-medium text-sm text-gray-700 mb-2">Emails encontrados:</p>
                <div className="flex flex-wrap gap-2">
                  {group.emails_detected.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800"
                    >
                      <Mail className="h-3 w-3" />
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {group.example_documents && group.example_documents.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="font-medium text-sm text-gray-700 mb-3">
                  Preview de documentos (máximo 10):
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {group.example_documents.slice(0, 10).map((doc: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-2 bg-gray-50 border border-gray-200 rounded text-xs"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{doc.document_id}</p>
                        {doc.document_data && (
                          <div className="mt-1 text-gray-600 space-y-0.5">
                            {doc.document_data.aseguradora && (
                              <p>Aseguradora: {doc.document_data.aseguradora}</p>
                            )}
                            {doc.document_data.ramo && (
                              <p>Ramo: {doc.document_data.ramo}</p>
                            )}
                            {doc.document_data.prima && (
                              <p>Prima: ${Number(doc.document_data.prima).toLocaleString()}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {group.document_count > 10 && (
                  <p className="text-center text-xs text-gray-500 mt-2">
                    +{group.document_count - 10} documentos más serán actualizados
                  </p>
                )}
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

            {initialLoading && (
              <div className="mt-2 text-center text-gray-500 text-sm p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Cargando usuarios...
              </div>
            )}

            {!initialLoading && searching && (
              <div className="mt-2 text-center text-gray-500 text-sm">
                Buscando...
              </div>
            )}

            {!initialLoading && searchResults.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-600 mb-2">
                  {searchQuery ? `${searchResults.length} resultados` : `${searchResults.length} usuarios disponibles`}
                </p>
                <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
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
              </div>
            )}

            {!initialLoading && searchQuery && !searching && searchResults.length === 0 && (
              <div className="mt-2 text-center text-gray-500 text-sm p-4 bg-gray-50 rounded-lg">
                No se encontraron usuarios con "{searchQuery}"
              </div>
            )}

            {!initialLoading && !searchQuery && searchResults.length === 0 && (
              <div className="mt-2 text-center text-gray-500 text-sm p-4 bg-red-50 border border-red-200 rounded-lg">
                No hay usuarios disponibles en el sistema
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

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="saveMapping"
                checked={saveMapping}
                onChange={(e) => setSaveMapping(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="saveMapping" className="text-sm font-medium text-gray-900 cursor-pointer block mb-1">
                  Recordar esta asignación para futuros lotes
                </label>
                <p className="text-xs text-gray-600">
                  {group.type === 'name' ? (
                    `Cuando se active, el sistema recordará que documentos con el nombre "${group.display_value}" pertenecen a este usuario MOVI.`
                  ) : group.type === 'email' ? (
                    `Cuando se active, el sistema recordará que documentos con el email "${group.display_value}" pertenecen a este usuario MOVI.`
                  ) : (
                    `Cuando se active, el sistema recordará esta asignación para documentos similares.`
                  )}
                  {' '}En futuras importaciones, estos documentos se asignarán automáticamente.
                </p>
              </div>
            </div>
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
                Asignando {group.document_count} documentos...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Asignar y actualizar {group.document_count} documentos
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
