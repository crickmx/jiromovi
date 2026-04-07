import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, UserPlus, CreditCard as Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { UserModal } from '../components/UserModal';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};
type Oficina = Database['public']['Tables']['oficinas']['Row'];

export function Directorio() {
  const { usuario: currentUser, refreshUsuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRol, setFilterRol] = useState<string>('');
  const [filterOficina, setFilterOficina] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isAdmin = currentUser?.rol === 'Administrador';
  const isGerente = currentUser?.rol === 'Gerente';
  const isReadOnly = !isAdmin && !isGerente;

  // Debug: mostrar info del usuario actual
  useEffect(() => {
    if (currentUser) {
      console.log('[DIRECTORIO] Usuario actual cargado:', {
        id: currentUser.id,
        email: currentUser.email_laboral,
        rol: currentUser.rol,
        isAdmin,
        isGerente,
        isReadOnly
      });
    }
  }, [currentUser, isAdmin, isGerente, isReadOnly]);

  useEffect(() => {
    loadData();
    // Forzar refresh del usuario para evitar cache
    if (refreshUsuario) {
      refreshUsuario();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let usuariosQuery = supabase
        .from('usuarios')
        .select('*, oficinas(nombre)')
        .eq('is_deleted', false)
        .order('nombre');

      // Gerentes solo ven usuarios de su oficina
      if (isGerente && currentUser?.oficina_id) {
        usuariosQuery = usuariosQuery.eq('oficina_id', currentUser.oficina_id);
      }

      const [usuariosRes, oficinasRes] = await Promise.all([
        usuariosQuery,
        supabase.from('oficinas').select('*').order('nombre'),
      ]);

      if (usuariosRes.data) setUsuarios(usuariosRes.data);
      if (oficinasRes.data) setOficinas(oficinasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (usuario: Usuario) => {
    setUserToDelete(usuario);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    if (deleteConfirmText !== 'ELIMINAR') {
      alert('Debes escribir "ELIMINAR" para confirmar');
      return;
    }

    try {
      // Usar supabase.functions.invoke() que maneja automáticamente la autenticación
      const { data: result, error: invokeError } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: userToDelete.id,
          reason: 'Eliminado desde el directorio por administrador'
        }
      });

      if (invokeError) {
        console.error('Delete user error:', invokeError);
        alert('Error al eliminar usuario: ' + invokeError.message);
        return;
      }

      if (!result?.success) {
        console.error('Delete user error response:', result);

        let errorMsg = 'Error al eliminar usuario';

        if (result.error_code === 'LAST_ADMIN') {
          errorMsg = 'No se puede eliminar el último administrador activo del sistema';
        } else if (result.error_code === 'CANNOT_DELETE_SELF') {
          errorMsg = 'No puedes eliminarte a ti mismo';
        } else if (result.error_code === 'USER_ALREADY_DELETED') {
          errorMsg = 'Este usuario ya está eliminado';
        } else if (result.error_code === 'USER_NOT_FOUND') {
          errorMsg = 'Usuario no encontrado';
        } else if (result.message) {
          errorMsg = result.message;
        } else if (result.error) {
          errorMsg = result.error;
        }

        if (result.details) {
          console.error('Error details:', result.details);
          errorMsg += '\n\nDetalles técnicos: ' + result.details;
        }

        alert(errorMsg);
      } else {
        alert('Usuario eliminado correctamente. El usuario ya no puede iniciar sesión.');
        setDeleteModalOpen(false);
        setUserToDelete(null);
        setDeleteConfirmText('');
        loadData();
      }
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      const errorMsg = error.message || 'Error de conexión al eliminar usuario';
      alert(errorMsg);
    }
  };

  const handleToggleActive = async (usuario: Usuario) => {
    // Verificar que el usuario actual es Admin (verificación adicional frontend)
    if (!isAdmin) {
      alert('Solo los Administradores pueden cambiar el estado de usuarios');
      return;
    }

    // Determinar el nuevo estado basado en el campo activo
    const nuevoActivo = !usuario.activo;

    try {
      // Call secure RPC function instead of direct update
      const { data, error } = await supabase
        .rpc('toggle_user_active_status', {
          p_user_id: usuario.id,
          p_activo: nuevoActivo
        });

      if (error) {
        console.error('Error al cambiar estado:', error);
        alert('Error: ' + error.message);
        return;
      }

      // Check response from function
      const result = data as { success: boolean; error?: string; message?: string; changed?: boolean };

      if (!result.success) {
        alert(result.error || 'Error desconocido');
        return;
      }

      // Show success message
      if (result.changed) {
        alert(result.message || 'Estado actualizado exitosamente');
      } else {
        alert(result.message || 'Sin cambios');
      }

      // Refresh data
      loadData();

    } catch (err) {
      console.error('Error inesperado:', err);
      alert('Error inesperado al cambiar estado del usuario');
    }
  };


  const filteredUsuarios = usuarios.filter((usuario) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === '' ||
      (usuario.nombre || '').toLowerCase().includes(searchLower) ||
      (usuario.apellidos || '').toLowerCase().includes(searchLower) ||
      (usuario.email_personal || '').toLowerCase().includes(searchLower) ||
      (usuario.email_laboral || '').toLowerCase().includes(searchLower) ||
      (usuario.celular_personal || '').includes(searchTerm) ||
      (usuario.celular_laboral || '').includes(searchTerm) ||
      (usuario.username || '').toLowerCase().includes(searchLower);

    const matchesRol = filterRol === '' || usuario.rol === filterRol;
    const matchesOficina = filterOficina === '' || usuario.oficina_id === filterOficina;

    return matchesSearch && matchesRol && matchesOficina;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Alerta si el usuario no tiene permisos pero el frontend dice que sí */}
      {!isAdmin && !isGerente && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Modo Solo Lectura</p>
              <p className="text-xs text-yellow-700 mt-1">No tienes permisos de administrador. Solo puedes ver la información.</p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Usuarios</h1>
              <p className="text-primary-100 mt-1 text-sm sm:text-base">
                {isGerente ? 'Gestiona usuarios de tu oficina' : 'Consulta el directorio de usuarios'}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
                setModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-white text-primary-700 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition w-full sm:w-auto justify-center"
            >
              <UserPlus className="w-5 h-5" />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              <option value="Administrador">Administrador</option>
              <option value="Gerente">Gerente</option>
              <option value="Empleado">Empleado</option>
              <option value="Agente">Agente</option>
            </select>

            {currentUser?.rol !== 'Gerente' && (
              <select
                value={filterOficina}
                onChange={(e) => setFilterOficina(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las oficinas</option>
                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={oficina.id}>
                    {oficina.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios
            </p>
            {/* Debug info */}
            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              Usuario: {currentUser?.email_laboral} | Rol: {currentUser?.rol} | isAdmin: {isAdmin ? 'Sí' : 'No'}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Oficina
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {usuario.imagen_perfil_url ? (
                        <img
                          src={usuario.imagen_perfil_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {usuario.nombre[0]}{usuario.apellidos[0]}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-slate-900">
                            {usuario.nombre} {usuario.apellidos}
                          </div>
                          {usuario.estado === 'pendiente' && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">{usuario.puesto}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.rol === 'Administrador'
                          ? 'bg-red-100 text-red-800'
                          : usuario.rol === 'Gerente'
                          ? 'bg-purple-100 text-purple-800'
                          : usuario.rol === 'Empleado'
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {usuario.oficinas?.nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggleActive(usuario)}
                        className="flex items-center space-x-2"
                      >
                        {usuario.activo ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                            <span className="text-sm text-slate-400 font-medium">Inactivo</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {usuario.activo ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                            <span className="text-sm text-slate-400 font-medium">Inactivo</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(usuario);
                          setModalOpen(true);
                        }}
                        className="flex items-center space-x-1 text-accent hover:text-primary-900 px-2 lg:px-3 py-2 hover:bg-primary-50 rounded-lg transition"
                        title={isReadOnly ? "Ver Usuario" : "Ver / Editar Usuario"}
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm font-medium hidden lg:inline">{isReadOnly ? 'Ver' : 'Ver / Editar'}</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClick(usuario)}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsuarios.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No se encontraron usuarios</p>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={() => {
            setModalOpen(false);
            setSelectedUser(null);
            loadData();
          }}
        />
      )}

      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Eliminar Usuario
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Esta acción bloqueará el acceso del usuario al sistema.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-slate-700">Nombre:</span>{' '}
                  <span className="text-slate-900">{userToDelete.nombre} {userToDelete.apellidos}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Email:</span>{' '}
                  <span className="text-slate-900">{userToDelete.email_laboral || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Rol:</span>{' '}
                  <span className="text-slate-900">{userToDelete.rol}</span>
                </div>
                {userToDelete.oficinas && (
                  <div>
                    <span className="font-semibold text-slate-700">Oficina:</span>{' '}
                    <span className="text-slate-900">{userToDelete.oficinas.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-yellow-900 mb-2 text-sm">Importante:</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>El usuario NO podrá iniciar sesión</li>
                <li>Se conservan todos sus datos históricos</li>
                <li>No se eliminarán sus registros en comisiones, pedidos, etc.</li>
                <li>Esta acción se registrará en el log de auditoría</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Escribe <span className="font-bold text-red-600">ELIMINAR</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="ELIMINAR"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'ELIMINAR'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar Usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
