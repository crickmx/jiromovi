import { useState, useEffect } from 'react';
import { Mail, User, Trash2, CircleCheck as CheckCircle2, Circle as XCircle, Search, Link2, Users, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { supabase } from '../lib/supabase';
import type { VendorMapping } from '../lib/vendorMappingTypes';

interface MoviUser {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  email_laboral: string | null;
  email_personal: string | null;
  nombre_sicas: string | null;
  rol: string;
  oficina_id: string | null;
  oficinas?: { nombre: string } | null;
}

export default function MapeoVendedoresAdmin() {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'mappings'>('usuarios');

  // Mappings state
  const [mappings, setMappings] = useState<VendorMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [mappingSearch, setMappingSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'name'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Usuarios state
  const [usuarios, setUsuarios] = useState<MoviUser[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [filterSicas, setFilterSicas] = useState<'all' | 'con' | 'sin'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMappings();
    loadUsuarios();
  }, []);

  const loadMappings = async () => {
    setLoadingMappings(true);
    try {
      const { data, error } = await supabase
        .from('vendor_mappings')
        .select('*, usuarios!vendor_mappings_movi_user_id_fkey(nombre_completo, email_laboral, email_personal, nombre_sicas)')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error al cargar mapeos:', error);
        setMappings([]);
      } else {
        setMappings(data || []);
      }
    } catch (error) {
      console.error('Error al cargar mapeos:', error);
      setMappings([]);
    } finally {
      setLoadingMappings(false);
    }
  };

  const loadUsuarios = async () => {
    setLoadingUsuarios(true);
    setUsuariosError(null);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, email_personal, nombre_sicas, rol, oficina_id')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true })
        .limit(2000);

      if (error) throw error;

      if (!data || data.length === 0) {
        setUsuarios([]);
        setLoadingUsuarios(false);
        return;
      }

      // Try to fetch oficinas separately - don't fail if this part errors
      let oficinasMap: Record<string, string> = {};
      try {
        const oficinaIds = [...new Set(data.map(u => u.oficina_id).filter(Boolean))] as string[];
        if (oficinaIds.length > 0) {
          const { data: oficinas } = await supabase
            .from('oficinas')
            .select('id, nombre')
            .in('id', oficinaIds);
          if (oficinas) {
            oficinasMap = Object.fromEntries(oficinas.map(o => [o.id, o.nombre]));
          }
        }
      } catch (e) {
        // Non-critical: continue without oficina names
      }

      setUsuarios(data.map(u => ({
        ...u,
        nombre_completo: `${u.nombre} ${u.apellidos}`.trim(),
        oficinas: u.oficina_id && oficinasMap[u.oficina_id] ? { nombre: oficinasMap[u.oficina_id] } : null,
      })));
    } catch (error: any) {
      console.error('Error al cargar usuarios:', error);
      setUsuariosError(error?.message || 'Error desconocido al cargar usuarios');
    } finally {
      setLoadingUsuarios(false);
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
        `Eliminar mapeo?\n\n${mapping.source_type === 'email' ? 'Email' : 'Nombre'}: ${mapping.source_value}\n\nEsta accion no se puede deshacer.`
      )
    ) return;

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

  const handleSaveSicas = async (userId: string) => {
    setSaving(true);
    try {
      const value = editValue.trim() || null;
      const { error } = await supabase
        .from('usuarios')
        .update({ nombre_sicas: value })
        .eq('id', userId);

      if (error) throw error;

      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, nombre_sicas: value } : u));
      setEditingUserId(null);
      setEditValue('');
    } catch (error) {
      console.error('Error al guardar SICAS:', error);
      alert('Error al guardar el nombre SICAS');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user: MoviUser) => {
    setEditingUserId(user.id);
    setEditValue(user.nombre_sicas || '');
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditValue('');
  };

  const filteredMappings = mappings.filter((mapping) => {
    const matchesSearch =
      mappingSearch === '' ||
      mapping.source_value.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      mapping.usuarios?.nombre_completo.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      mapping.usuarios?.email_laboral?.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      mapping.usuarios?.email_personal?.toLowerCase().includes(mappingSearch.toLowerCase());

    const matchesType = filterType === 'all' || mapping.source_type === filterType;
    const matchesStatus = filterStatus === 'all' || mapping.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredUsuarios = usuarios.filter((u) => {
    const matchesSearch =
      userSearch === '' ||
      u.nombre_completo.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.nombre?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.apellidos?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email_laboral?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email_personal?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.nombre_sicas?.toLowerCase().includes(userSearch.toLowerCase());

    const matchesSicas =
      filterSicas === 'all' ||
      (filterSicas === 'con' && u.nombre_sicas) ||
      (filterSicas === 'sin' && !u.nombre_sicas);

    return matchesSearch && matchesSicas;
  });

  const userStats = {
    total: usuarios.length,
    conSicas: usuarios.filter(u => u.nombre_sicas).length,
    sinSicas: usuarios.filter(u => !u.nombre_sicas).length,
  };

  const mappingStats = {
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
          title="Mapeo de Usuarios SICAS"
          description="Asigna el usuario SICAS a cada usuario MOVI y gestiona mapeos de vendedores externos"
          icon={Link2}
          backTo="/configuracion"
          backLabel="Volver a Configuracion"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'usuarios'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios MOVI ({userStats.total})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('mappings')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'mappings'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Mapeos Vendedores ({mappingStats.total})
          </span>
        </button>
      </div>

      {activeTab === 'usuarios' ? (
        <UsuariosTab
          usuarios={filteredUsuarios}
          loading={loadingUsuarios}
          error={usuariosError}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          filterSicas={filterSicas}
          setFilterSicas={setFilterSicas}
          editingUserId={editingUserId}
          editValue={editValue}
          setEditValue={setEditValue}
          saving={saving}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          handleSaveSicas={handleSaveSicas}
          stats={userStats}
          onRetry={loadUsuarios}
        />
      ) : (
        <MappingsTab
          mappings={filteredMappings}
          loading={loadingMappings}
          searchQuery={mappingSearch}
          setSearchQuery={setMappingSearch}
          filterType={filterType}
          setFilterType={setFilterType}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          handleToggleStatus={handleToggleStatus}
          handleDelete={handleDelete}
          stats={mappingStats}
        />
      )}
    </div>
  );
}

function UsuariosTab({
  usuarios, loading, error, userSearch, setUserSearch, filterSicas, setFilterSicas,
  editingUserId, editValue, setEditValue, saving, startEdit, cancelEdit, handleSaveSicas, stats, onRetry,
}: {
  usuarios: MoviUser[];
  loading: boolean;
  error: string | null;
  userSearch: string;
  setUserSearch: (v: string) => void;
  filterSicas: 'all' | 'con' | 'sin';
  setFilterSicas: (v: 'all' | 'con' | 'sin') => void;
  editingUserId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  saving: boolean;
  startEdit: (u: MoviUser) => void;
  cancelEdit: () => void;
  handleSaveSicas: (id: string) => void;
  stats: { total: number; conSicas: number; sinSicas: number };
  onRetry: () => void;
}) {
  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Total Usuarios</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">Con SICAS asignado</p>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-1">{stats.conSicas}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-amber-700 font-medium">Sin SICAS</p>
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-1">{stats.sinSicas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario SICAS..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
              />
            </div>
          </div>
          <select
            value={filterSicas}
            onChange={(e) => setFilterSicas(e.target.value as any)}
            className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
          >
            <option value="all">Todos</option>
            <option value="con">Con SICAS</option>
            <option value="sin">Sin SICAS</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <XCircle className="h-16 w-16 text-red-300 mx-auto mb-4" />
            <p className="text-red-600 text-lg font-medium mb-2">Error al cargar usuarios</p>
            <p className="text-neutral-500 text-sm mb-4">{error}</p>
            <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
              Reintentar
            </button>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 text-lg">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Usuario MOVI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Oficina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase min-w-[250px]">
                    Usuario SICAS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-750 transition">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {u.nombre_completo}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {u.email_laboral || u.email_personal || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {u.oficinas?.nombre || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveSicas(u.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                            placeholder="Nombre en SICAS..."
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveSicas(u.id)}
                            disabled={saving}
                            className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition disabled:opacity-50"
                            title="Guardar"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="group flex items-center gap-2 w-full text-left"
                        >
                          {u.nombre_sicas ? (
                            <span className="flex items-center gap-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                {u.nombre_sicas}
                              </span>
                              <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition">
                                (editar)
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-neutral-400 hover:text-blue-600 transition">
                              <div className="h-2 w-2 bg-neutral-300 rounded-full"></div>
                              <span className="text-sm italic">Asignar SICAS...</span>
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-700 border-t border-neutral-200 dark:border-neutral-600 text-xs text-neutral-500">
              Mostrando {usuarios.length} usuarios
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MappingsTab({
  mappings, loading, searchQuery, setSearchQuery, filterType, setFilterType,
  filterStatus, setFilterStatus, handleToggleStatus, handleDelete, stats,
}: {
  mappings: VendorMapping[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterType: 'all' | 'email' | 'name';
  setFilterType: (v: 'all' | 'email' | 'name') => void;
  filterStatus: 'all' | 'active' | 'inactive';
  setFilterStatus: (v: 'all' | 'active' | 'inactive') => void;
  handleToggleStatus: (m: VendorMapping) => void;
  handleDelete: (m: VendorMapping) => void;
  stats: { total: number; active: number; inactive: number; byEmail: number; byName: number };
}) {
  return (
    <>
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
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-blue-700 font-medium">Por Email</p>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-1">{stats.byEmail}</p>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-teal-600" />
            <p className="text-xs text-teal-700 font-medium">Por Nombre</p>
          </div>
          <p className="text-2xl font-bold text-teal-900 mt-1">{stats.byName}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por email, nombre o usuario MOVI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            >
              <option value="all">Todos los tipos</option>
              <option value="email">Por Email</option>
              <option value="name">Por Nombre</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 text-lg mb-2">No hay mapeos</p>
            <p className="text-neutral-400 text-sm">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Intenta cambiar los filtros'
                : 'Los mapeos se crean automaticamente al asignar vendedores'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Valor normalizado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Usuario MOVI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Usuario SICAS</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Actualizado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-750 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {mapping.source_type === 'email' ? (
                          <>
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">Email</span>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 text-teal-600" />
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
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{mapping.usuarios.nombre_completo}</p>
                          <p className="text-xs text-neutral-500">{mapping.usuarios.email_laboral || mapping.usuarios.email_personal || 'Sin email'}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">Usuario no encontrado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {mapping.usuarios?.nombre_sicas ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">{mapping.usuarios.nombre_sicas}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-neutral-300 rounded-full"></div>
                          <span className="text-xs text-neutral-400 italic">Sin SICAS</span>
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full">
                          <XCircle className="h-3 w-3" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-500">
                        {new Date(mapping.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(mapping)}
                          className={`p-2 rounded-lg transition ${
                            mapping.status === 'active'
                              ? 'hover:bg-neutral-100 text-neutral-600'
                              : 'hover:bg-green-100 text-green-600'
                          }`}
                          title={mapping.status === 'active' ? 'Desactivar' : 'Activar'}
                        >
                          {mapping.status === 'active' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(mapping)}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
                          title="Eliminar"
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
    </>
  );
}
