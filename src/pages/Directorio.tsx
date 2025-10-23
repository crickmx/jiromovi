import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, UserPlus, Edit, Trash2, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { UserModal } from '../components/UserModal';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};
type Oficina = Database['public']['Tables']['oficinas']['Row'];

export function Directorio() {
  const navigate = useNavigate();
  const { usuario: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRol, setFilterRol] = useState<string>('');
  const [filterOficina, setFilterOficina] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let usuariosQuery = supabase
        .from('usuarios')
        .select('*, oficinas(nombre)')
        .order('nombre');

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

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      alert('Error al eliminar usuario');
    } else {
      loadData();
    }
  };

  const handleToggleActive = async (usuario: Usuario) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !usuario.activo, updated_at: new Date().toISOString() })
      .eq('id', usuario.id);

    if (error) {
      alert('Error al actualizar estado');
    } else {
      loadData();
    }
  };


  const filteredUsuarios = usuarios.filter((usuario) => {
    const matchesSearch =
      searchTerm === '' ||
      usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email_personal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email_laboral.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.celular_personal.includes(searchTerm) ||
      usuario.celular_laboral.includes(searchTerm) ||
      usuario.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRol = filterRol === '' || usuario.rol === filterRol;
    const matchesOficina = filterOficina === '' || usuario.oficina_id === filterOficina;

    return matchesSearch && matchesRol && matchesOficina;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Directorio de Usuarios</h1>
              <p className="text-blue-100 mt-1">
                {currentUser?.rol === 'Gerente'
                  ? 'Gestiona usuarios de tu oficina'
                  : 'Administra empleados y agentes'}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
                setModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition"
            >
              <UserPlus className="w-5 h-5" />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className={`grid grid-cols-1 ${currentUser?.rol === 'Gerente' ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
            <div className="md:col-span-2 relative">
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Contacto
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
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {usuario.nombre[0]}{usuario.apellidos[0]}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">
                          {usuario.nombre} {usuario.apellidos}
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
                          ? 'bg-blue-100 text-blue-800'
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
                    <div className="text-sm text-slate-900">{usuario.email_laboral || usuario.email_personal}</div>
                    <div className="text-sm text-slate-500">{usuario.celular_laboral || usuario.celular_personal}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigate(`/usuario/${usuario.id}`)}
                        className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition"
                        title="Ver Perfil"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(usuario);
                          setModalOpen(true);
                        }}
                        className="text-slate-600 hover:text-slate-900 p-2 hover:bg-slate-50 rounded-lg transition"
                        title="Editar Rápido"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(usuario.id)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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
    </div>
  );
}
