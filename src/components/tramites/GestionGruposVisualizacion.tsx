import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, CreditCard as Edit, Trash2, X, Check, UserPlus, UserMinus, Search } from 'lucide-react';

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  oficina_id: string | null;
  activo: boolean;
}

interface Miembro {
  usuario_id: string;
  nombre_completo: string;
  oficina_nombre: string | null;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  oficina_nombre: string | null;
}

export function GestionGruposVisualizacion() {
  const { usuario } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showMiembrosModal, setShowMiembrosModal] = useState(false);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [searchUsuario, setSearchUsuario] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color: '#6366f1'
  });

  const coloresDisponibles = [
    { value: '#10b981', label: 'Verde' },
    { value: '#3b82f6', label: 'Azul' },
    { value: '#8b5cf6', label: 'Morado' },
    { value: '#f59e0b', label: 'Naranja' },
    { value: '#ef4444', label: 'Rojo' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#ec4899', label: 'Rosa' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadGrupos(), loadUsuarios()]);
    setLoading(false);
  };

  const loadGrupos = async () => {
    const { data, error } = await supabase
      .from('tramites_grupos_visualizacion')
      .select('*')
      .order('nombre');

    if (error) {
      console.error('Error loading grupos:', error);
      return;
    }

    setGrupos(data || []);
  };

  const loadUsuarios = async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nombre,
        apellidos,
        oficinas(nombre)
      `)
      .eq('estado', 'Activo')
      .order('nombre');

    if (error) {
      console.error('Error loading usuarios:', error);
      return;
    }

    const formattedUsuarios = data?.map(u => ({
      id: u.id,
      nombre_completo: `${u.nombre || ''} ${u.apellidos || ''}`.trim().toUpperCase(),
      oficina_nombre: (u.oficinas as any)?.nombre || null
    })) || [];

    setUsuarios(formattedUsuarios);
  };

  const loadMiembros = async (grupoId: string) => {
    const { data, error } = await supabase.rpc('get_grupo_miembros', {
      p_grupo_id: grupoId
    });

    if (error) {
      console.error('Error loading miembros:', error);
      return;
    }

    setMiembros(data || []);
  };

  const handleCrearGrupo = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('tramites_grupos_visualizacion')
      .insert({
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        color: formData.color,
        oficina_id: usuario?.oficina_id
      });

    if (error) {
      alert('Error al crear grupo: ' + error.message);
      return;
    }

    setShowNuevoModal(false);
    setFormData({ nombre: '', descripcion: '', color: '#6366f1' });
    loadGrupos();
  };

  const handleEditarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoSeleccionado) return;

    const { error } = await supabase
      .from('tramites_grupos_visualizacion')
      .update({
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        color: formData.color
      })
      .eq('id', grupoSeleccionado.id);

    if (error) {
      alert('Error al editar grupo: ' + error.message);
      return;
    }

    setShowEditarModal(false);
    setGrupoSeleccionado(null);
    setFormData({ nombre: '', descripcion: '', color: '#6366f1' });
    loadGrupos();
  };

  const handleEliminarGrupo = async (grupoId: string) => {
    if (!confirm('¿Eliminar este grupo? Se removerán todos sus miembros.')) return;

    const { error } = await supabase
      .from('tramites_grupos_visualizacion')
      .delete()
      .eq('id', grupoId);

    if (error) {
      alert('Error al eliminar grupo: ' + error.message);
      return;
    }

    loadGrupos();
  };

  const handleAgregarMiembro = async (usuarioId: string) => {
    if (!grupoSeleccionado) return;

    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .insert({
        grupo_id: grupoSeleccionado.id,
        usuario_id: usuarioId
      });

    if (error) {
      if (error.code === '23505') {
        alert('Este usuario ya está en el grupo');
      } else {
        alert('Error al agregar miembro: ' + error.message);
      }
      return;
    }

    loadMiembros(grupoSeleccionado.id);
  };

  const handleRemoverMiembro = async (usuarioId: string) => {
    if (!grupoSeleccionado) return;

    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .delete()
      .eq('grupo_id', grupoSeleccionado.id)
      .eq('usuario_id', usuarioId);

    if (error) {
      alert('Error al remover miembro: ' + error.message);
      return;
    }

    loadMiembros(grupoSeleccionado.id);
  };

  const openEditarModal = (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    setFormData({
      nombre: grupo.nombre,
      descripcion: grupo.descripcion || '',
      color: grupo.color
    });
    setShowEditarModal(true);
  };

  const openMiembrosModal = async (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    await loadMiembros(grupo.id);
    setShowMiembrosModal(true);
  };

  const usuariosDisponibles = usuarios.filter(
    u => !miembros.some(m => m.usuario_id === u.id) &&
         u.nombre_completo.toLowerCase().includes(searchUsuario.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Grupos de Visualización</h3>
        <button
          onClick={() => setShowNuevoModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition"
        >
          <Plus className="h-4 w-4" />
          Nuevo Grupo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {grupos.map(grupo => (
          <div
            key={grupo.id}
            className="border rounded-lg p-4 hover:shadow-md transition"
            style={{ borderLeftWidth: '4px', borderLeftColor: grupo.color }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{grupo.nombre}</h4>
                {grupo.descripcion && (
                  <p className="text-sm text-gray-600 mt-1">{grupo.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openMiembrosModal(grupo)}
                  className="p-1.5 hover:bg-gray-100 rounded transition"
                  title="Ver miembros"
                >
                  <Users className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => openEditarModal(grupo)}
                  className="p-1.5 hover:bg-gray-100 rounded transition"
                  title="Editar"
                >
                  <Edit className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => handleEliminarGrupo(grupo.id)}
                  className="p-1.5 hover:bg-red-50 rounded transition"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nuevo Grupo */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Nuevo Grupo</h3>
              <button
                onClick={() => setShowNuevoModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCrearGrupo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {coloresDisponibles.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`h-10 rounded-lg border-2 transition ${
                        formData.color === color.value ? 'border-gray-900 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNuevoModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition"
                >
                  Crear Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Grupo */}
      {showEditarModal && grupoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Editar Grupo</h3>
              <button
                onClick={() => setShowEditarModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditarGrupo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {coloresDisponibles.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`h-10 rounded-lg border-2 transition ${
                        formData.color === color.value ? 'border-gray-900 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditarModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Miembros */}
      {showMiembrosModal && grupoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Miembros del Grupo</h3>
                <p className="text-sm text-gray-600 mt-1">{grupoSeleccionado.nombre}</p>
              </div>
              <button
                onClick={() => setShowMiembrosModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Miembros Actuales */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Miembros Actuales ({miembros.length})
                </h4>
                {miembros.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay miembros en este grupo
                  </p>
                ) : (
                  <div className="space-y-2">
                    {miembros.map(miembro => (
                      <div
                        key={miembro.usuario_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{miembro.nombre_completo}</p>
                          {miembro.oficina_nombre && (
                            <p className="text-xs text-gray-600">{miembro.oficina_nombre}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoverMiembro(miembro.usuario_id)}
                          className="p-1.5 hover:bg-red-100 rounded transition"
                          title="Remover del grupo"
                        >
                          <UserMinus className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agregar Usuarios */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Agregar Usuarios
                </h4>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar usuarios..."
                    value={searchUsuario}
                    onChange={(e) => setSearchUsuario(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {usuariosDisponibles.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay usuarios disponibles
                    </p>
                  ) : (
                    usuariosDisponibles.map(usuario => (
                      <div
                        key={usuario.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{usuario.nombre_completo}</p>
                          {usuario.oficina_nombre && (
                            <p className="text-xs text-gray-600">{usuario.oficina_nombre}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAgregarMiembro(usuario.id)}
                          className="p-1.5 hover:bg-green-100 rounded transition"
                          title="Agregar al grupo"
                        >
                          <UserPlus className="h-4 w-4 text-green-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t">
              <button
                onClick={() => setShowMiembrosModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
