import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, CreditCard as Edit2, Trash2, CheckCircle2, XCircle, Search, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { VendorMapping } from '../lib/vendorMappingTypes';

export default function MapeoVendedoresAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<VendorMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'name'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/');
      return;
    }
    loadMappings();
  }, [usuario, navigate]);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendor_mappings')
        .select('*, usuarios(nombre_completo, email_laboral, email_personal, nombre_sicas)')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setMappings(data || []);
    } catch (error) {
      console.error('Error al cargar mapeos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (mapping: VendorMapping) => {
    try {
      const newStatus = mapping.status === 'active' ? 'inactive' : 'active';

      const { error } = await supabase
        .from('vendor_mappings')
        .update({ status: newStatus })
        .eq('id', mapping.id);

      if (error) throw error;

      await loadMappings();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar el estado del mapeo');
    }
  };

  const handleDelete = async (mapping: VendorMapping) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar este mapeo?\n\n${
          mapping.source_type === 'email' ? 'Email' : 'Nombre'
        }: ${mapping.source_value}\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_mappings')
        .delete()
        .eq('id', mapping.id);

      if (error) throw error;

      await loadMappings();
    } catch (error) {
      console.error('Error al eliminar mapeo:', error);
      alert('Error al eliminar el mapeo');
    }
  };

  const filteredMappings = mappings.filter((mapping) => {
    const matchesSearch =
      searchQuery === '' ||
      mapping.source_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.usuarios?.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.usuarios?.email_laboral?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.usuarios?.email_personal?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || mapping.source_type === filterType;
    const matchesStatus = filterStatus === 'all' || mapping.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: mappings.length,
    active: mappings.filter((m) => m.status === 'active').length,
    inactive: mappings.filter((m) => m.status === 'inactive').length,
    byEmail: mappings.filter((m) => m.source_type === 'email').length,
    byName: mappings.filter((m) => m.source_type === 'name').length,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Administración de mapeos de vendedores"
          description="Gestiona las asignaciones guardadas entre vendedores externos y usuarios MOVI"
          icon={Link2}
          backTo="/configuracion"
          backLabel="Volver a Configuración"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Total</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{stats.total}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">Activos</p>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-1">{stats.active}</p>
        </div>

        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
            <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Inactivos</p>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{stats.inactive}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-primary-200">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            <p className="text-xs text-primary-700 font-medium">Por Email</p>
          </div>
          <p className="text-2xl font-bold text-primary-900 mt-1">{stats.byEmail}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-purple-700 font-medium">Por Nombre</p>
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-1">{stats.byName}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por email, nombre o usuario MOVI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="email">Por Email</option>
              <option value="name">Por Nombre</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-neutral-400 text-lg mb-2">No hay mapeos</p>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Intenta cambiar los filtros'
                : 'Los mapeos se crearán automáticamente al asignar vendedores'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Valor normalizado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Usuario MOVI asignado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Usuario SICAS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Actualizado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredMappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-neutral-50 dark:bg-neutral-800 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {mapping.source_type === 'email' ? (
                          <>
                            <Mail className="h-5 w-5 text-accent" />
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">Email</span>
                          </>
                        ) : (
                          <>
                            <User className="h-5 w-5 text-purple-600" />
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">Nombre</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-neutral-900 dark:text-white font-mono">{mapping.source_value}</p>
                    </td>
                    <td className="px-6 py-4">
                      {mapping.usuarios ? (
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {mapping.usuarios.nombre_completo}
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400">
                            {mapping.usuarios.email_laboral || mapping.usuarios.email_personal || 'Sin email'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400 dark:text-neutral-500">Usuario no encontrado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {mapping.usuarios?.nombre_sicas ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-neutral-900 dark:text-white font-medium">
                            {mapping.usuarios.nombre_sicas}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-neutral-300 dark:bg-neutral-600 rounded-full"></div>
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">Sin mapeo SICAS</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {mapping.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium rounded-full">
                          <XCircle className="h-3 w-3" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {new Date(mapping.updated_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(mapping)}
                          className={`p-2 rounded-lg transition ${
                            mapping.status === 'active'
                              ? 'hover:bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                              : 'hover:bg-green-100 text-green-600'
                          }`}
                          title={
                            mapping.status === 'active' ? 'Desactivar mapeo' : 'Activar mapeo'
                          }
                        >
                          {mapping.status === 'active' ? (
                            <XCircle className="h-5 w-5" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(mapping)}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
                          title="Eliminar mapeo"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
