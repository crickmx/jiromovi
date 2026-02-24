import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Plus,
  Users,
  Crown,
  Shield,
  Edit,
  Eye,
  Share2,
  MoreVertical,
  Trash2,
  Edit3,
  ArrowRight,
} from 'lucide-react';
import { listarTableros, crearTablero, eliminarTablero, renombrarTablero } from '../../lib/crmUtils';
import type { CRMBoardListItem } from '../../lib/crmTypes';
import { useAuth } from '../../contexts/AuthContext';
import CompartirTableroModal from './CompartirTableroModal';
import GestionMiembrosTablero from './GestionMiembrosTablero';

export default function TablerosSeccion() {
  const navigate = useNavigate();
  const [tableros, setTableros] = useState<CRMBoardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [creandoTablero, setCreandoTablero] = useState(false);
  const [nombreNuevoTablero, setNombreNuevoTablero] = useState('');
  const [compartirModalOpen, setCompartirModalOpen] = useState(false);
  const [miembrosModalOpen, setMiembrosModalOpen] = useState(false);
  const [tableroSeleccionado, setTableroSeleccionado] = useState<CRMBoardListItem | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditar, setNombreEditar] = useState('');
  const { user, usuario } = useAuth();

  const rolPermitido = usuario?.rol && ['Empleado', 'Gerente', 'Administrador'].includes(usuario.rol);
  const esAgente = usuario?.rol === 'Agente';

  useEffect(() => {
    if (rolPermitido) {
      cargarTableros();
    } else {
      setLoading(false);
    }
  }, [rolPermitido]);

  const cargarTableros = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await listarTableros();
      setTableros(data);
    } catch (err: any) {
      console.error('Error cargando tableros:', err);
      setError(err.message || 'Error al cargar tableros');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearTablero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevoTablero.trim()) return;

    try {
      await crearTablero(nombreNuevoTablero, usuario?.oficina_id);
      setNombreNuevoTablero('');
      setCreandoTablero(false);
      await cargarTableros();
    } catch (err) {
      console.error('Error creando tablero:', err);
      alert('Error al crear tablero');
    }
  };

  const handleEliminarTablero = async (boardId: string) => {
    if (!confirm('¿Estás seguro de eliminar este tablero? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await eliminarTablero(boardId);
      await cargarTableros();
      setMenuAbierto(null);
    } catch (err) {
      console.error('Error eliminando tablero:', err);
      alert('Error al eliminar tablero');
    }
  };

  const handleRenombrarTablero = async (boardId: string) => {
    if (!nombreEditar.trim()) return;

    try {
      await renombrarTablero(boardId, nombreEditar);
      await cargarTableros();
      setEditando(null);
      setNombreEditar('');
      setMenuAbierto(null);
    } catch (err) {
      console.error('Error renombrando tablero:', err);
      alert('Error al renombrar tablero');
    }
  };

  const handleCompartir = (tablero: CRMBoardListItem) => {
    setTableroSeleccionado(tablero);
    setCompartirModalOpen(true);
    setMenuAbierto(null);
  };

  const handleVerMiembros = (tablero: CRMBoardListItem) => {
    setTableroSeleccionado(tablero);
    setMiembrosModalOpen(true);
    setMenuAbierto(null);
  };

  const handleAbrirTablero = (boardId: string) => {
    navigate(`/mi-crm/tareas?board=${boardId}`);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'editor':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Admin';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  };

  // Debug: Siempre mostrar información del usuario
  if (!usuario) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
        <p className="text-sm text-yellow-800 text-center">
          Cargando perfil de usuario...
        </p>
      </div>
    );
  }

  if (esAgente) {
    return null;
  }

  if (!rolPermitido) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 text-center mb-2">
          Los tableros compartidos están disponibles solo para Empleados, Gerentes y Administradores.
        </p>
        <p className="text-xs text-gray-500 text-center">
          Tu rol actual: {usuario?.rol || 'No definido'}
        </p>
      </div>
    );
  }

  const misTableros = tableros.filter((t) => t.is_owner);
  const tablerosCompartidos = tableros.filter((t) => !t.is_owner);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <LayoutGrid className="h-5 w-5 mr-2 text-accent" />
            Mis Tableros
          </h2>
          <button
            onClick={() => setCreandoTablero(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition flex items-center text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Tablero
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {creandoTablero && (
          <form onSubmit={handleCrearTablero} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del tablero
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={nombreNuevoTablero}
                onChange={(e) => setNombreNuevoTablero(e.target.value)}
                placeholder="Ej: Clientes Corporativos 2024"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                autoFocus
              />
              <button
                type="submit"
                disabled={!nombreNuevoTablero.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreandoTablero(false);
                  setNombreNuevoTablero('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          </div>
        ) : misTableros.length === 0 ? (
          <div className="text-center py-8">
            <LayoutGrid className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No tienes tableros todavía</p>
            <p className="text-xs text-gray-500 mt-1">Crea tu primer tablero para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {misTableros.map((tablero) => (
              <div
                key={tablero.board_id}
                className="p-4 border border-gray-200 rounded-lg hover:border-accent transition bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  {editando === tablero.board_id ? (
                    <input
                      type="text"
                      value={nombreEditar}
                      onChange={(e) => setNombreEditar(e.target.value)}
                      onBlur={() => handleRenombrarTablero(tablero.board_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenombrarTablero(tablero.board_id);
                        if (e.key === 'Escape') {
                          setEditando(null);
                          setNombreEditar('');
                        }
                      }}
                      className="flex-1 px-2 py-1 border border-accent rounded focus:ring-2 focus:ring-accent"
                      autoFocus
                    />
                  ) : (
                    <h3 className="font-semibold text-gray-900">{tablero.board_name}</h3>
                  )}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMenuAbierto(menuAbierto === tablero.board_id ? null : tablero.board_id)
                      }
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-600" />
                    </button>
                    {menuAbierto === tablero.board_id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => {
                            setEditando(tablero.board_id);
                            setNombreEditar(tablero.board_name);
                            setMenuAbierto(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-sm"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Renombrar
                        </button>
                        <button
                          onClick={() => handleCompartir(tablero)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-sm"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Compartir
                        </button>
                        <button
                          onClick={() => handleVerMiembros(tablero)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-sm"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Ver miembros ({tablero.members_count})
                        </button>
                        <button
                          onClick={() => handleEliminarTablero(tablero.board_id)}
                          className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center text-sm border-t"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center space-x-1">
                    {getRoleIcon(tablero.my_role)}
                    <span>{getRoleLabel(tablero.my_role)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3" />
                    <span>{tablero.members_count}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Actualizado {new Date(tablero.updated_at).toLocaleDateString('es-MX')}
                  </p>
                  <button
                    onClick={() => handleAbrirTablero(tablero.board_id)}
                    className="px-3 py-1.5 bg-accent text-white rounded hover:bg-accent/90 transition flex items-center text-xs"
                  >
                    Abrir
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {tablerosCompartidos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Share2 className="h-5 w-5 mr-2 text-accent" />
            Tableros Compartidos Conmigo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tablerosCompartidos.map((tablero) => (
              <div
                key={tablero.board_id}
                className="p-4 border border-gray-200 rounded-lg hover:border-accent transition bg-gradient-to-br from-blue-50 to-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{tablero.board_name}</h3>
                  <button
                    onClick={() => handleVerMiembros(tablero)}
                    className="p-1 hover:bg-white rounded transition"
                  >
                    <Users className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <div className="flex items-center space-x-1">
                    {getRoleIcon(tablero.my_role)}
                    <span>{getRoleLabel(tablero.my_role)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3" />
                    <span>{tablero.members_count}</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">
                    Propietario: {tablero.owner_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {tablero.owner_office}
                    </p>
                    <button
                      onClick={() => handleAbrirTablero(tablero.board_id)}
                      className="px-3 py-1.5 bg-accent text-white rounded hover:bg-accent/90 transition flex items-center text-xs"
                    >
                      Abrir
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tableroSeleccionado && (
        <>
          <CompartirTableroModal
            isOpen={compartirModalOpen}
            onClose={() => {
              setCompartirModalOpen(false);
              setTableroSeleccionado(null);
            }}
            boardId={tableroSeleccionado.board_id}
            boardName={tableroSeleccionado.board_name}
            onMemberAdded={cargarTableros}
          />

          {miembrosModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Miembros del Tablero</h3>
                    <p className="text-sm text-gray-600 mt-1">{tableroSeleccionado.board_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMiembrosModalOpen(false);
                      setTableroSeleccionado(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    <Edit3 className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <GestionMiembrosTablero
                    boardId={tableroSeleccionado.board_id}
                    myRole={tableroSeleccionado.my_role}
                    onMembersChanged={cargarTableros}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
