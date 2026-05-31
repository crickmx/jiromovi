import { useEffect, useState } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, UserPlus, CreditCard as Edit, Trash2, ToggleLeft, ToggleRight, Users, ListFilter as Filter, Send, CircleCheck as CheckCircle, Eye } from 'lucide-react';
import { UserModal } from '../components/UserModal';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};
type Oficina = Database['public']['Tables']['oficinas']['Row'];

export function Directorio() {
  const { usuario: currentUser, reloadUsuario: refreshUsuario } = useAuth();
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
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);
  const [accessSentId, setAccessSentId] = useState<string | null>(null);
  const { startImpersonation } = useImpersonation();

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

  const handleSendAccess = async (usuario: Usuario) => {
    if (!usuario.email_laboral || sendingAccessId) return;
    setSendingAccessId(usuario.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${supabaseUrl}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: usuario.email_laboral, platform: 'movi' }),
      });
      setAccessSentId(usuario.id);
      setTimeout(() => setAccessSentId(null), 5000);
    } catch {
      // silent
    } finally {
      setSendingAccessId(null);
    }
  };

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
    return <LoadingState text="Cargando directorio..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        description={isGerente ? 'Gestiona usuarios de tu oficina' : 'Directorio de usuarios del sistema'}
        icon={Users}
        badge={isReadOnly ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Solo lectura
          </span>
        ) : undefined}
        actions={
          <Button size="sm" onClick={() => { setSelectedUser(null); setModalOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Nuevo
          </Button>
        }
      />

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-white/30" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-neutral-400 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
              />
            </div>

            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
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
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
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

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500 dark:text-white/40">
              {filteredUsuarios.length} de {usuarios.length} usuarios
            </p>
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
                    <div className="flex justify-end items-center space-x-2">
                      {(isAdmin || isGerente) && usuario.estado === 'activo' && (
                        <button
                          onClick={() => handleSendAccess(usuario)}
                          disabled={sendingAccessId === usuario.id || accessSentId === usuario.id}
                          className={`flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 ${
                            accessSentId === usuario.id
                              ? 'text-green-700 bg-green-50'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="Enviar código de acceso al correo y WhatsApp"
                        >
                          {accessSentId === usuario.id
                            ? <><CheckCircle className="w-4 h-4" /><span className="hidden lg:inline">Enviado</span></>
                            : sendingAccessId === usuario.id
                            ? <><span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" /></>
                            : <><Send className="w-4 h-4" /><span className="hidden lg:inline">Enviar acceso</span></>
                          }
                        </button>
                      )}
                      {isAdmin && usuario.id !== currentUser?.id && usuario.rol !== 'Administrador' && (
                        <button
                          onClick={async () => {
                            const ok = await startImpersonation({ platform: 'movi', userId: usuario.id });
                            if (ok) window.location.href = '/dashboard';
                          }}
                          className="flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-lg text-sm font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition"
                          title="Ver como este usuario"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden xl:inline">Ver como</span>
                        </button>
                      )}
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
