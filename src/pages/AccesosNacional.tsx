import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Edit2, Trash2, ExternalLink, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AccesoNacional {
  id: string;
  aseguradora: string;
  usuario_1: string;
  usuario_2: string | null;
  contrasena: string;
  link: string;
  creado_por: string;
  fecha_creacion: string;
  ultima_edicion_por: string | null;
  fecha_ultima_edicion: string | null;
  creador_nombre?: string;
  editor_nombre?: string;
}

interface AccesoFormData {
  aseguradora: string;
  usuario_1: string;
  usuario_2: string;
  contrasena: string;
  link: string;
}

export function AccesosNacional() {
  const { usuario } = useAuth();
  const [accesos, setAccesos] = useState<AccesoNacional[]>([]);
  const [filteredAccesos, setFilteredAccesos] = useState<AccesoNacional[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAcceso, setEditingAcceso] = useState<AccesoNacional | null>(null);
  const [formData, setFormData] = useState<AccesoFormData>({
    aseguradora: '',
    usuario_1: '',
    usuario_2: '',
    contrasena: '',
    link: '',
  });
  const [sortField, setSortField] = useState<'aseguradora' | 'fecha_creacion' | 'fecha_ultima_edicion'>('aseguradora');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAcceso, setSelectedAcceso] = useState<AccesoNacional | null>(null);

  const canDelete = usuario?.rol === 'Administrador';

  useEffect(() => {
    fetchAccesos();
  }, []);

  useEffect(() => {
    filterAccesos();
  }, [searchTerm, accesos, sortField, sortDirection]);

  const fetchAccesos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accesos_nacional')
        .select(`
          *,
          creador:usuarios!accesos_nacional_creado_por_fkey(nombre, apellidos),
          editor:usuarios!accesos_nacional_ultima_edicion_por_fkey(nombre, apellidos)
        `)
        .order('aseguradora', { ascending: true });

      if (error) throw error;

      const accesosWithNames = data.map((acceso: any) => ({
        ...acceso,
        creador_nombre: acceso.creador ? `${acceso.creador.nombre} ${acceso.creador.apellidos}` : 'Desconocido',
        editor_nombre: acceso.editor ? `${acceso.editor.nombre} ${acceso.editor.apellidos}` : null,
      }));

      setAccesos(accesosWithNames);
    } catch (error: any) {
      console.error('Error fetching accesos:', error);
      showToast('Error al cargar los accesos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterAccesos = () => {
    let filtered = [...accesos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acceso) =>
          acceso.aseguradora.toLowerCase().includes(term) ||
          acceso.usuario_1.toLowerCase().includes(term) ||
          (acceso.usuario_2 && acceso.usuario_2.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'fecha_creacion' || sortField === 'fecha_ultima_edicion') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = aVal?.toLowerCase() || '';
        bVal = bVal?.toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredAccesos(filtered);
  };

  const handleSort = (field: 'aseguradora' | 'fecha_creacion' | 'fecha_ultima_edicion') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const openDetailsModal = (acceso: AccesoNacional) => {
    setSelectedAcceso(acceso);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedAcceso(null);
  };

  const openModal = (acceso?: AccesoNacional) => {
    if (acceso) {
      setEditingAcceso(acceso);
      setFormData({
        aseguradora: acceso.aseguradora,
        usuario_1: acceso.usuario_1,
        usuario_2: acceso.usuario_2 || '',
        contrasena: acceso.contrasena,
        link: acceso.link,
      });
    } else {
      setEditingAcceso(null);
      setFormData({
        aseguradora: '',
        usuario_1: '',
        usuario_2: '',
        contrasena: '',
        link: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAcceso(null);
    setFormData({
      aseguradora: '',
      usuario_1: '',
      usuario_2: '',
      contrasena: '',
      link: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.link.match(/^https?:\/\//)) {
      showToast('El link debe comenzar con http:// o https://', 'error');
      return;
    }

    try {
      if (editingAcceso) {
        const { error } = await supabase
          .from('accesos_nacional')
          .update({
            ...formData,
            usuario_2: formData.usuario_2 || null,
            ultima_edicion_por: usuario?.id,
            fecha_ultima_edicion: new Date().toISOString(),
          })
          .eq('id', editingAcceso.id);

        if (error) throw error;
        showToast('Cambios guardados', 'success');
      } else {
        const { error } = await supabase
          .from('accesos_nacional')
          .insert({
            ...formData,
            usuario_2: formData.usuario_2 || null,
            creado_por: usuario?.id,
          });

        if (error) throw error;
        showToast('Registro agregado correctamente', 'success');
      }

      closeModal();
      fetchAccesos();
    } catch (error: any) {
      console.error('Error saving acceso:', error);
      showToast('Error al guardar el registro', 'error');
    }
  };

  const handleDelete = async (acceso: AccesoNacional) => {
    if (!canDelete) {
      showToast('Solo los administradores pueden eliminar registros', 'error');
      return;
    }

    if (!confirm('¿Seguro que desea eliminar este acceso? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('accesos_nacional')
        .delete()
        .eq('id', acceso.id);

      if (error) throw error;

      showToast('Registro eliminado', 'success');
      fetchAccesos();
    } catch (error: any) {
      console.error('Error deleting acceso:', error);
      showToast('Error al eliminar el registro', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">Accesos Nacional</h1>
            <p className="text-neutral-600 mt-1">Credenciales compartidas de acceso nacional</p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar Acceso
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por Aseguradora, Usuario 1 o Usuario 2..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort('aseguradora')}
                  >
                    Aseguradora {sortField === 'aseguradora' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Usuario 1
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Usuario 2
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Contraseña
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Ingresar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Detalles
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredAccesos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      {searchTerm ? 'No se encontraron registros' : 'No hay accesos registrados'}
                    </td>
                  </tr>
                ) : (
                  filteredAccesos.map((acceso) => (
                    <tr key={acceso.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{acceso.aseguradora}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700">{acceso.usuario_1}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700">{acceso.usuario_2 || '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 font-mono">{acceso.contrasena}</td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={acceso.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Ingresar
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openDetailsModal(acceso)}
                          className="p-2 text-neutral-600 hover:text-primary-600 transition-colors rounded-lg hover:bg-neutral-100"
                          title="Ver detalles"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(acceso)}
                            className="p-1 text-neutral-600 hover:text-primary-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(acceso)}
                              className="p-1 text-neutral-600 hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-800">
                {editingAcceso ? 'Editar Acceso' : 'Agregar Nuevo Acceso'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Aseguradora <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.aseguradora}
                  onChange={(e) => setFormData({ ...formData, aseguradora: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Nombre de la aseguradora"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Usuario 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.usuario_1}
                    onChange={(e) => setFormData({ ...formData, usuario_1: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Primer usuario"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Usuario 2</label>
                  <input
                    type="text"
                    value={formData.usuario_2}
                    onChange={(e) => setFormData({ ...formData, usuario_2: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Segundo usuario (opcional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contrasena}
                  onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  placeholder="Contraseña"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://ejemplo.com"
                />
                <p className="text-xs text-neutral-500 mt-1">Debe comenzar con http:// o https://</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingAcceso ? 'Guardar Cambios' : 'Agregar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAcceso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-800">Detalles del Acceso</h2>
              <button
                onClick={closeDetailsModal}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-1">Aseguradora</h3>
                <p className="text-neutral-900">{selectedAcceso.aseguradora}</p>
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información de Creación</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Creado por:</span>
                    <span className="text-sm font-medium text-neutral-900">{selectedAcceso.creador_nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Fecha de creación:</span>
                    <span className="text-sm font-medium text-neutral-900">{formatDate(selectedAcceso.fecha_creacion)}</span>
                  </div>
                </div>
              </div>

              {selectedAcceso.fecha_ultima_edicion && (
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Última Edición</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Editado por:</span>
                      <span className="text-sm font-medium text-neutral-900">{selectedAcceso.editor_nombre || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Fecha de edición:</span>
                      <span className="text-sm font-medium text-neutral-900">{formatDate(selectedAcceso.fecha_ultima_edicion)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200">
              <button
                onClick={closeDetailsModal}
                className="w-full px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
