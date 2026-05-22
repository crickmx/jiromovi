import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, CreditCard as Edit, Trash2, Eye, Phone, Mail, ArrowLeft, LayoutGrid, List, Filter, UserPlus, X } from 'lucide-react';
import { obtenerContactos, eliminarContacto } from '../lib/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import type { CRMContacto } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';

type ViewMode = 'table' | 'cards';

const ESTATUS_OPTIONS = [
  { value: 'Todos', label: 'Todos los estatus' },
  { value: 'Prospecto', label: 'Prospecto' },
  { value: 'Cotización Presentada', label: 'Cotizacion Presentada' },
  { value: 'Negociación', label: 'Negociacion' },
  { value: 'Cliente', label: 'Cliente' },
  { value: 'Perdido', label: 'Perdido' },
];

export default function CRMContactos() {
  useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactos, setContactos] = useState<CRMContacto[]>([]);
  const [filteredContactos, setFilteredContactos] = useState<CRMContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [contactoEditar, setContactoEditar] = useState<CRMContacto | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    cargarContactos();
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      setActiveFilter(filterParam);
    }
    const openNew = searchParams.get('openNew');
    if (openNew === 'true') {
      setShowModal(true);
      searchParams.delete('openNew');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    filtrarContactos();
  }, [contactos, searchTerm, filterEstatus, activeFilter]);

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

    if (activeFilter === 'nuevos') {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      filtered = filtered.filter(
        (c) => c.estatus === 'Prospecto' && c.fecha_creacion >= hace24h
      );
    } else if (activeFilter === 'contactados') {
      filtered = filtered.filter(
        (c) => c.estatus !== 'Prospecto' && c.estatus !== 'Perdido'
      );
    } else if (activeFilter === 'sin_seguimiento') {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      filtered = filtered.filter(
        (c) => c.estatus === 'Prospecto' && (c.actualizado_en || c.fecha_creacion) < hace24h
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nombre_completo.toLowerCase().includes(term) ||
          c.celular?.includes(searchTerm) ||
          c.email?.toLowerCase().includes(term)
      );
    }

    if (filterEstatus !== 'Todos') {
      filtered = filtered.filter((c) => c.estatus === filterEstatus);
    }

    setFilteredContactos(filtered);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Seguro que deseas eliminar este contacto?')) return;
    try {
      await eliminarContacto(id);
      cargarContactos();
    } catch (error) {
      console.error('Error:', error);
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

  const clearActiveFilter = () => {
    setActiveFilter(null);
    searchParams.delete('filter');
    setSearchParams(searchParams, { replace: true });
  };

  const getEstatusColor = (estatus: string) => {
    switch (estatus) {
      case 'Prospecto': return 'bg-blue-100 text-blue-700';
      case 'Cotización Presentada': return 'bg-amber-100 text-amber-700';
      case 'Negociación': return 'bg-orange-100 text-orange-700';
      case 'Cliente': return 'bg-green-100 text-green-700';
      case 'Perdido': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getFilterLabel = (filter: string) => {
    switch (filter) {
      case 'nuevos': return 'Leads nuevos (24h)';
      case 'contactados': return 'Contactados';
      case 'sin_seguimiento': return 'Sin seguimiento (+24h)';
      default: return filter;
    }
  };

  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'hace minutos';
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Mi CRM
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Prospectos y Clientes</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filteredContactos.length} contactos</p>
          </div>
          <button
            onClick={handleAgregarContacto}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Active filter chip */}
      {activeFilter && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">{getFilterLabel(activeFilter)}</span>
            <button onClick={clearActiveFilter} className="hover:bg-blue-100 rounded-full p-0.5 transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, telefono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterEstatus}
              onChange={(e) => setFilterEstatus(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ESTATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="hidden sm:flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vista tabla"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 transition ${viewMode === 'cards' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vista tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredContactos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <UserPlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No se encontraron contactos</p>
          <p className="text-xs text-gray-400 mt-1">Ajusta los filtros o agrega un nuevo contacto</p>
          <button
            onClick={handleAgregarContacto}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
          >
            <Plus className="h-4 w-4" />
            Agregar Contacto
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <TableView
          contactos={filteredContactos}
          getEstatusColor={getEstatusColor}
          timeSince={timeSince}
          onEdit={handleEditarContacto}
          onDelete={handleEliminar}
          onView={(id) => navigate(`/mi-crm/contactos/${id}`)}
        />
      ) : (
        <CardsView
          contactos={filteredContactos}
          getEstatusColor={getEstatusColor}
          timeSince={timeSince}
          onEdit={handleEditarContacto}
          onDelete={handleEliminar}
          onView={(id) => navigate(`/mi-crm/contactos/${id}`)}
        />
      )}

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

function TableView({
  contactos, getEstatusColor, timeSince, onEdit, onDelete, onView,
}: {
  contactos: CRMContacto[];
  getEstatusColor: (e: string) => string;
  timeSince: (d: string) => string;
  onEdit: (c: CRMContacto) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Fuente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Creado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contactos.map((contacto) => (
              <tr
                key={contacto.id}
                className="hover:bg-gray-50/50 cursor-pointer transition"
                onClick={() => onView(contacto.id)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{contacto.nombre_completo}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contacto.celular && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />{contacto.celular}
                        </span>
                      )}
                      {contacto.email && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />{contacto.email}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-gray-600">{contacto.tipo_contacto}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEstatusColor(contacto.estatus)}`}>
                    {contacto.estatus}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-gray-500">{contacto.fuente_origen || '-'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-gray-400">{timeSince(contacto.fecha_creacion)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onView(contacto.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(contacto)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(contacto.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardsView({
  contactos, getEstatusColor, timeSince, onEdit, onDelete, onView,
}: {
  contactos: CRMContacto[];
  getEstatusColor: (e: string) => string;
  timeSince: (d: string) => string;
  onEdit: (c: CRMContacto) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {contactos.map((contacto) => (
        <div
          key={contacto.id}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm cursor-pointer transition group"
          onClick={() => onView(contacto.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{contacto.nombre_completo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{contacto.tipo_contacto}</p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${getEstatusColor(contacto.estatus)}`}>
              {contacto.estatus}
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {contacto.celular && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Phone className="h-3 w-3 text-gray-400" />
                <span>{contacto.celular}</span>
              </div>
            )}
            {contacto.email && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Mail className="h-3 w-3 text-gray-400" />
                <span className="truncate">{contacto.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              {contacto.fuente_origen || 'Sin fuente'} - {timeSince(contacto.fecha_creacion)}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(contacto)} className="p-1 rounded text-gray-400 hover:text-green-600 transition">
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(contacto.id)} className="p-1 rounded text-gray-400 hover:text-red-600 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
