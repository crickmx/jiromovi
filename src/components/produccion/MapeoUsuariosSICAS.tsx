import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Link2, Unlink, CheckCircle, XCircle, Loader2, Users,
  Building2, ChevronDown, AlertTriangle, RefreshCw, X,
} from 'lucide-react';

interface MappedUser {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: string;
  oficina: string | null;
  oficina_id: string | null;
  id_sicas: string | null;
  nombre_sicas: string | null;
  has_mapping: boolean;
}

interface SicasVendor {
  id_sicas: string;
  nombre: string;
}

interface Props {
  callApi: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export default function MapeoUsuariosSICAS({ callApi }: Props) {
  const [users, setUsers] = useState<MappedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterMapping, setFilterMapping] = useState<'all' | 'mapped' | 'unmapped'>('all');

  // Vendor search state for the assignment dropdown
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState<SicasVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const vendorDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callApi({ action: 'list-users' });
      if (data.ok) {
        setUsers(data.users as MappedUser[]);
      } else {
        setError(data.error as string || 'Error al cargar usuarios');
      }
    } catch {
      setError('Error de conexion al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveUserId(null);
        setVendorSearch('');
        setVendorResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchVendors = useCallback(async (term: string) => {
    if (term.length < 2) {
      setVendorResults([]);
      return;
    }
    setLoadingVendors(true);
    try {
      const data = await callApi({ action: 'list-vendors', search: term });
      if (data.ok) {
        setVendorResults(data.vendors as SicasVendor[]);
      }
    } catch {
      // silent
    } finally {
      setLoadingVendors(false);
    }
  }, [callApi]);

  const handleVendorSearchChange = (val: string) => {
    setVendorSearch(val);
    if (vendorDebounceRef.current) clearTimeout(vendorDebounceRef.current);
    vendorDebounceRef.current = setTimeout(() => searchVendors(val), 400);
  };

  const assignVendor = async (userId: string, vendor: SicasVendor) => {
    setSaving(userId);
    setError(null);
    try {
      const data = await callApi({
        action: 'map-user',
        targetUserId: userId,
        sicasVendorId: vendor.id_sicas,
      });
      if (data.ok) {
        setSuccessMsg(data.message as string || 'Vinculo creado');
        setTimeout(() => setSuccessMsg(null), 3000);
        setActiveUserId(null);
        setVendorSearch('');
        setVendorResults([]);
        await loadUsers();
      } else {
        setError(data.error as string || 'Error al vincular usuario');
      }
    } catch {
      setError('Error de conexion al vincular.');
    } finally {
      setSaving(null);
    }
  };

  const unlinkUser = async (userId: string) => {
    if (!confirm('Se eliminara el vinculo SICAS de este usuario. Continuar?')) return;
    setSaving(userId);
    setError(null);
    try {
      const data = await callApi({ action: 'unmap-user', targetUserId: userId });
      if (data.ok) {
        setSuccessMsg('Vinculo eliminado');
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadUsers();
      } else {
        setError(data.error as string || 'Error al desvincular');
      }
    } catch {
      setError('Error de conexion al desvincular.');
    } finally {
      setSaving(null);
    }
  };

  // Filter users
  const filtered = users.filter(u => {
    const matchesSearch = !searchText ||
      `${u.nombre} ${u.apellidos} ${u.email} ${u.nombre_sicas || ''}`.toLowerCase().includes(searchText.toLowerCase());
    const matchesMapping =
      filterMapping === 'all' ||
      (filterMapping === 'mapped' && u.has_mapping) ||
      (filterMapping === 'unmapped' && !u.has_mapping);
    return matchesSearch && matchesMapping;
  });

  const mappedCount = users.filter(u => u.has_mapping).length;
  const unmappedCount = users.filter(u => !u.has_mapping).length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total usuarios</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Vinculados</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{mappedCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sin vincular</span>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unmappedCount}</p>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-800 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search and filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuario por nombre, email o vendedor SICAS..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
            {([['all', 'Todos'], ['mapped', 'Vinculados'], ['unmapped', 'Sin vincular']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterMapping(val)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMapping === val ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Oficina</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendedor SICAS</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No se encontraron usuarios</p>
                  </td>
                </tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{user.nombre} {user.apellidos}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-700 dark:text-gray-300 text-xs">{user.rol}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        {user.oficina ? (
                          <><Building2 className="w-3 h-3" />{user.oficina}</>
                        ) : (
                          <span className="text-gray-400 italic">Sin oficina</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 relative">
                      {user.has_mapping ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-xs">{user.nombre_sicas}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">ID: {user.id_sicas}</div>
                        </div>
                      ) : activeUserId === user.id ? (
                        <div ref={dropdownRef} className="relative">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Buscar vendedor..."
                              value={vendorSearch}
                              onChange={e => handleVendorSearchChange(e.target.value)}
                              className="w-full pl-7 pr-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400"
                            />
                          </div>
                          {(vendorResults.length > 0 || loadingVendors) && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {loadingVendors ? (
                                <div className="p-3 flex items-center gap-2 text-xs text-gray-500">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                                </div>
                              ) : (
                                vendorResults.map(v => (
                                  <button
                                    key={v.id_sicas}
                                    onClick={() => assignVendor(user.id, v)}
                                    disabled={saving === user.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900 dark:text-white">{v.nombre}</div>
                                    <div className="text-gray-500 dark:text-gray-400">ID: {v.id_sicas}</div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin vinculo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.has_mapping ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3" /> Vinculado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <XCircle className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {saving === user.id ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin mx-auto" />
                      ) : user.has_mapping ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setActiveUserId(user.id);
                              setVendorSearch('');
                              setVendorResults([]);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Cambiar vinculo"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => unlinkUser(user.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Desvincular"
                          >
                            <Unlink className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveUserId(user.id);
                            setVendorSearch('');
                            setVendorResults([]);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Vincular con vendedor SICAS"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
