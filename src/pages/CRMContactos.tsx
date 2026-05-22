import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, CreditCard as Edit, Trash2, Eye, Phone, Mail, LayoutGrid, List, Filter, UserPlus, Users, X } from 'lucide-react';
import { obtenerContactos, eliminarContacto } from '../lib/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import type { CRMContacto } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';
import { PageHeader } from '@/components/ui/page-header';

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
      default: return 'bg-neutral-100 text-neutral-700';
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Prospectos y Clientes"
        description={`${filteredContactos.length} contactos`}
        icon={Users}
        backTo="/mi-crm"
        backLabel="Mi CRM"
        actions={
          <button
            onClick={handleAgregarContacto}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-sm font-medium shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Contacto
          </button>
        }
      />

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
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-white/40" />
            <input
              type="text"
              placeholder="Buscar por nombre, telefono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterEstatus}
              onChange={(e) => setFilterEstatus(e.target.value)}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            >
              {ESTATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="hidden sm:flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition ${viewMode === 'table' ? 'bg-accent/10 text-accent' : 'text-neutral-400 dark:text-white/40 hover:text-neutral-600 dark:hover:text-white/70'}`}
                title="Vista tabla"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 transition ${viewMode === 'cards' ? 'bg-accent/10 text-accent' : 'text-neutral-400 dark:text-white/40 hover:text-neutral-600 dark:hover:text-white/70'}`}
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
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 py-16 text-center">
          <UserPlus className="h-10 w-10 text-neutral-300 dark:text-white/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-600 dark:text-white/70">No se encontraron contactos</p>
          <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Ajusta los filtros o agrega un nuevo contacto</p>
          <button
            onClick={handleAgregarContacto}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent bg-accent/10 rounded-lg hover:bg-accent/15 transition"
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
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Contacto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden md:table-cell">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Estatus</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">Fuente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">Creado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {contactos.map((contacto) => (
              <tr
                key={contacto.id}
                className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 cursor-pointer transition"
                onClick={() => onView(contacto.id)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{contacto.nombre_completo}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contacto.celular && (
                        <span className="text-xs text-neutral-500 dark:text-white/50 flex items-center gap-1">
                          <Phone className="h-3 w-3" />{contacto.celular}
                        </span>
                      )}
                      {contacto.email && (
                        <span className="text-xs text-neutral-500 dark:text-white/50 flex items-center gap-1">
                          <Mail className="h-3 w-3" />{contacto.email}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-neutral-600 dark:text-white/60">{contacto.tipo_contacto}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEstatusColor(contacto.estatus)}`}>
                    {contacto.estatus}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-neutral-500 dark:text-white/50">{contacto.fuente_origen || '-'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-neutral-400 dark:text-white/40">{timeSince(contacto.fecha_creacion)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onView(contacto.id)}
                      className="p-1.5 rounded-md text-neutral-400 dark:text-white/40 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(contacto)}
                      className="p-1.5 rounded-md text-neutral-400 dark:text-white/40 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(contacto.id)}
                      className="p-1.5 rounded-md text-neutral-400 dark:text-white/40 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
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
          className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-accent/40 hover:shadow-sm cursor-pointer transition group"
          onClick={() => onView(contacto.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{contacto.nombre_completo}</p>
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">{contacto.tipo_contacto}</p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${getEstatusColor(contacto.estatus)}`}>
              {contacto.estatus}
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {contacto.celular && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-white/60">
                <Phone className="h-3 w-3 text-neutral-400 dark:text-white/40" />
                <span>{contacto.celular}</span>
              </div>
            )}
            {contacto.email && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-white/60">
                <Mail className="h-3 w-3 text-neutral-400 dark:text-white/40" />
                <span className="truncate">{contacto.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] text-neutral-400 dark:text-white/40">
              {contacto.fuente_origen || 'Sin fuente'} - {timeSince(contacto.fecha_creacion)}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(contacto)} className="p-1 rounded text-neutral-400 dark:text-white/40 hover:text-green-600 transition">
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(contacto.id)} className="p-1 rounded text-neutral-400 dark:text-white/40 hover:text-red-600 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
