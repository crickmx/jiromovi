import { useState, useEffect } from 'react';
import { CircleCheck as CheckCircle2, Circle as XCircle, Search, Link2, Users, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { supabase } from '../lib/supabase';

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
  oficina_nombre: string | null;
  mappings_count: number;
}

export default function MapeoVendedoresAdmin() {
  const [usuarios, setUsuarios] = useState<MoviUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSicas, setFilterSicas] = useState<'all' | 'con' | 'sin'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, email_personal, nombre_sicas, rol, oficina_id')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true })
        .limit(2000);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setUsuarios([]);
        setLoading(false);
        return;
      }

      let oficinasMap: Record<string, string> = {};
      let mappingsCountMap: Record<string, number> = {};

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
      } catch {}

      try {
        const { data: mappings } = await supabase
          .from('vendor_mappings')
          .select('movi_user_id')
          .eq('status', 'active');
        if (mappings) {
          for (const m of mappings) {
            mappingsCountMap[m.movi_user_id] = (mappingsCountMap[m.movi_user_id] || 0) + 1;
          }
        }
      } catch {}

      setUsuarios(data.map(u => ({
        ...u,
        nombre_completo: `${u.nombre} ${u.apellidos}`.trim(),
        oficina_nombre: u.oficina_id && oficinasMap[u.oficina_id] ? oficinasMap[u.oficina_id] : null,
        mappings_count: mappingsCountMap[u.id] || 0,
      })));
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
      setError(err?.message || 'Error desconocido al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSicas = async (userId: string) => {
    setSaving(true);
    try {
      const value = editValue.trim() || null;
      const { error: saveError } = await supabase
        .from('usuarios')
        .update({ nombre_sicas: value })
        .eq('id', userId);

      if (saveError) throw saveError;

      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, nombre_sicas: value } : u));
      setEditingUserId(null);
      setEditValue('');
    } catch (err) {
      console.error('Error al guardar SICAS:', err);
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

  const filteredUsuarios = usuarios.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      search === '' ||
      u.nombre_completo.toLowerCase().includes(q) ||
      u.nombre?.toLowerCase().includes(q) ||
      u.apellidos?.toLowerCase().includes(q) ||
      u.email_laboral?.toLowerCase().includes(q) ||
      u.email_personal?.toLowerCase().includes(q) ||
      u.nombre_sicas?.toLowerCase().includes(q);

    const matchesSicas =
      filterSicas === 'all' ||
      (filterSicas === 'con' && u.nombre_sicas) ||
      (filterSicas === 'sin' && !u.nombre_sicas);

    return matchesSearch && matchesSicas;
  });

  const stats = {
    total: usuarios.length,
    conSicas: usuarios.filter(u => u.nombre_sicas).length,
    sinSicas: usuarios.filter(u => !u.nombre_sicas).length,
    conMapeos: usuarios.filter(u => u.mappings_count > 0).length,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Mapeo de Usuarios SICAS"
          description="Asigna el usuario SICAS a cada usuario MOVI para vincular su produccion"
          icon={Link2}
          backTo="/configuracion"
          backLabel="Volver a Configuracion"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Total Usuarios</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 p-4 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Con SICAS</p>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-1">{stats.conSicas}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Sin SICAS</p>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-300 mt-1">{stats.sinSicas}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Con Mapeos</p>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-1">{stats.conMapeos}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm mb-6 p-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4.5 w-4.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario SICAS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <select
            value={filterSicas}
            onChange={(e) => setFilterSicas(e.target.value as any)}
            className="px-4 py-2.5 border border-neutral-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
          >
            <option value="all">Todos los usuarios</option>
            <option value="con">Con SICAS asignado</option>
            <option value="sin">Sin SICAS</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm overflow-hidden border border-neutral-200 dark:border-neutral-700">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-neutral-500">Cargando usuarios...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <XCircle className="h-12 w-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-600 font-medium mb-1">Error al cargar usuarios</p>
            <p className="text-neutral-500 text-sm mb-4">{error}</p>
            <button onClick={loadUsuarios} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
              Reintentar
            </button>
          </div>
        ) : filteredUsuarios.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No se encontraron usuarios con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Usuario MOVI
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Oficina
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[260px]">
                    Usuario SICAS
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Mapeos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {filteredUsuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {u.nombre_completo}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">
                        {u.email_laboral || u.email_personal || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]">
                        {u.oficina_nombre || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-5 py-3">
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
                              <div className="h-2 w-2 bg-green-500 rounded-full flex-shrink-0"></div>
                              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                {u.nombre_sicas}
                              </span>
                              <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition">
                                (editar)
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-neutral-400 hover:text-blue-600 transition">
                              <div className="h-2 w-2 bg-neutral-300 rounded-full flex-shrink-0"></div>
                              <span className="text-sm italic">Asignar SICAS...</span>
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {u.mappings_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                          <Link2 className="h-3 w-3" />
                          {u.mappings_count}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-300 dark:text-neutral-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-700/50 border-t border-neutral-200 dark:border-neutral-600 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios
              </span>
              <span className="text-xs text-neutral-400">
                {stats.conSicas} mapeados con SICAS
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
