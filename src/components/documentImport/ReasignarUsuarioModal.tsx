import { useState, useEffect } from 'react';
import { X, Search, User, Mail, FileText, Save, AlertCircle } from 'lucide-react';
import type { MatchedVendorGroup } from '../../lib/documentImportTypes';
import { searchMoviUsers, reassignUserDocuments } from '../../lib/documentImportUtils';

interface ReasignarUsuarioModalProps {
  group: MatchedVendorGroup;
  batchId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface MoviUser {
  id: string;
  nombre_completo: string;
  email: string;
  rol?: string;
}

export default function ReasignarUsuarioModal({
  group,
  batchId,
  onClose,
  onSuccess,
}: ReasignarUsuarioModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<MoviUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MoviUser | null>(null);
  const [saveMapping, setSaveMapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    handleSearch();
  }, [searchQuery]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const results = await searchMoviUsers(searchQuery);
      // Filtrar para no mostrar el usuario actual
      const filtered = results.filter((u: MoviUser) => u.id !== group.movi_user_id);
      setUsers(filtered);
    } catch (err) {
      console.error('Error al buscar usuarios:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Por favor selecciona un usuario');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await reassignUserDocuments({
        batch_id: batchId,
        old_user_id: group.movi_user_id,
        new_user_id: selectedUser.id,
        save_mapping: saveMapping,
      });

      alert(
        `Reasignación exitosa!\n\n` +
        `${result.updated_count} documentos fueron reasignados de "${group.user_name}" a "${selectedUser.nombre_completo}".\n` +
        (saveMapping && result.mapping_saved
          ? `\nLos mapeos fueron actualizados para futuras importaciones.`
          : '')
      );

      onSuccess();
    } catch (err: any) {
      console.error('Error al reasignar:', err);
      setError(err.message || 'Error al reasignar los documentos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Reasignar documentos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary-900">Usuario actual</p>
                <p className="text-sm text-primary-800 mt-1">{group.user_name}</p>
                <p className="text-xs text-primary-700 mt-0.5">{group.user_email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <FileText className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="text-sm font-medium text-primary-900">
                    {group.document_count} documentos asignados
                  </span>
                </div>
              </div>
            </div>
          </div>

          {group.vendor_names_detected && group.vendor_names_detected.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Nombres de vendedores detectados:
              </p>
              <div className="flex flex-wrap gap-2">
                {group.vendor_names_detected.map((name, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {group.vendor_emails_detected && group.vendor_emails_detected.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Emails de vendedores detectados:
              </p>
              <div className="flex flex-wrap gap-2">
                {group.vendor_emails_detected.map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800"
                  >
                    <Mail className="h-3 w-3" />
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar nuevo usuario
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-accent"
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Selecciona el nuevo usuario
            </p>
            <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    {searchQuery ? 'No se encontraron usuarios' : 'Escribe para buscar usuarios'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 ${
                        selectedUser?.id === user.id ? 'bg-primary-50 border-l-4 border-accent' : ''
                      }`}
                    >
                      <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.nombre_completo}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      {selectedUser?.id === user.id && (
                        <div className="flex-shrink-0 h-5 w-5 bg-accent rounded-full flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={saveMapping}
                onChange={(e) => setSaveMapping(e.target.checked)}
                className="mt-1 h-4 w-4 text-accent rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">
                  Guardar mapeo para futuras importaciones
                </span>
                <p className="text-xs text-gray-600 mt-1">
                  Los nombres y emails de estos vendedores se asociarán automáticamente con el nuevo usuario en futuras importaciones
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition disabled:opacity-50 font-semibold min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedUser || loading}
              className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold min-h-[44px]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Reasignando...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Reasignar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
