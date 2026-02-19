import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Phone, Mail, ArrowLeft } from 'lucide-react';
import { obtenerContactos, eliminarContacto } from '../lib/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import type { CRMContacto } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';

export default function CRMContactos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contactos, setContactos] = useState<CRMContacto[]>([]);
  const [filteredContactos, setFilteredContactos] = useState<CRMContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [contactoEditar, setContactoEditar] = useState<CRMContacto | null>(null);

  useEffect(() => {
    cargarContactos();
  }, []);

  useEffect(() => {
    filtrarContactos();
  }, [contactos, searchTerm, filterEstatus]);

  const cargarContactos = async () => {
    try {
      setLoading(true);
      const data = await obtenerContactos();
      setContactos(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrarContactos = () => {
    let filtered = contactos;

    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.celular.includes(searchTerm) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterEstatus !== 'Todos') {
      filtered = filtered.filter((c) => c.estatus === filterEstatus);
    }

    setFilteredContactos(filtered);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este contacto?')) return;

    try {
      await eliminarContacto(id);
      cargarContactos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar contacto');
    }
  };

  const handleAgregarContacto = () => {
    setContactoEditar(null);
    setShowModal(true);
  };

  const handleEditarContacto = (contacto: CRMContacto) => {
    setContactoEditar(contacto);
    setShowModal(true);
  };

  const handleGuardado = () => {
    setShowModal(false);
    setContactoEditar(null);
    cargarContactos();
  };

  const getEstatusColor = (estatus: string) => {
    switch (estatus) {
      case 'Prospecto':
        return 'bg-primary-100 text-primary-800';
      case 'Cotización Presentada':
        return 'bg-yellow-100 text-yellow-800';
      case 'Negociación':
        return 'bg-orange-100 text-orange-800';
      case 'Cliente':
        return 'bg-green-100 text-green-800';
      case 'Perdido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver a Mi CRM
        </button>
      </div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-accent">Contactos</h1>
          <p className="text-gray-600 mt-1">Gestiona tus prospectos y clientes</p>
        </div>
        <button
          onClick={handleAgregarContacto}
          className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Agregar Contacto
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, celular o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterEstatus}
            onChange={(e) => setFilterEstatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Todos">Todos los estatus</option>
            <option value="Prospecto">Prospecto</option>
            <option value="Cotización Presentada">Cotización Presentada</option>
            <option value="Negociación">Negociación</option>
            <option value="Cliente">Cliente</option>
            <option value="Perdido">Perdido</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estatus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Fuente
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContactos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron contactos
                  </td>
                </tr>
              ) : (
                filteredContactos.map((contacto) => (
                  <tr key={contacto.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contacto.nombre_completo}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                          <Phone className="h-3 w-3" />
                          {contacto.celular}
                        </div>
                        {contacto.email && (
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <Mail className="h-3 w-3" />
                            {contacto.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className="text-sm text-gray-900">{contacto.tipo_contacto}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstatusColor(contacto.estatus)}`}
                      >
                        {contacto.estatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                      {contacto.fuente_origen || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/mi-crm/contactos/${contacto.id}`}
                          className="text-accent hover:text-primary-900"
                        >
                          <Eye className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => handleEditarContacto(contacto)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEliminar(contacto.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ContactoModal
          contacto={contactoEditar}
          onClose={() => setShowModal(false)}
          onSave={handleGuardado}
        />
      )}
    </div>
  );
}
