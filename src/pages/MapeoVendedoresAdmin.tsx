import { useState, useEffect, useCallback } from 'react';
import { CircleCheck as CheckCircle2, Circle as XCircle, Search, Link2, Users, Save, X, Zap, UserCheck, TriangleAlert as AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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

interface PendingVendor {
  id: string;
  vend_nombre: string;
  vend_id: string;
  match_type: string;
  confidence_score: number;
  total_docs: number;
  total_prima_neta: number;
  match_details: any;
}

interface FuzzyMatch {
  vendor_id: string;
  vend_nombre: string;
  matched_user_id: string;
  matched_user_name: string;
  similarity_score: number;
  auto_confirmed: boolean;
}

type TabId = 'usuarios' | 'pendientes' | 'sincronizar';

export default function MapeoVendedoresAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>('usuarios');
  const [usuarios, setUsuarios] = useState<MoviUser[]>([]);
  const [pendingVendors, setPendingVendors] = useState<PendingVendor[]>([]);
  const [fuzzyMatches, setFuzzyMatches] = useState<FuzzyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingFuzzy, setLoadingFuzzy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSicas, setFilterSicas] = useState<'all' | 'vinculados' | 'solo_sicas' | 'solo_mapeo' | 'sin_vincular'>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkingVendorId, setLinkingVendorId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [confirmingMatches, setConfirmingMatches] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ confirmed: number; mappings: number } | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    if (activeTab === 'pendientes') loadPendingVendors();
    if (activeTab === 'sincronizar') runFuzzyMatch();
  }, [activeTab]);

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
      setError(err?.message || 'Error desconocido al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingVendors = async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from('sicas_vendor_user_mappings')
        .select('id, vend_nombre, vend_id, match_type, confidence_score, total_docs, total_prima_neta, match_details')
        .eq('status', 'pending_review')
        .is('movi_user_id', null)
        .order('vend_nombre', { ascending: true })
        .limit(500);

      if (error) throw error;
      setPendingVendors(data || []);
    } catch (err: any) {
      console.error('Error loading pending vendors:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const runFuzzyMatch = useCallback(async () => {
    setLoadingFuzzy(true);
    setConfirmResult(null);
    try {
      const { data, error } = await supabase.rpc('run_fuzzy_vendor_match', {
        p_threshold: threshold,
        p_auto_confirm_threshold: 0.92,
      });
      if (error) throw error;
      setFuzzyMatches(data || []);
    } catch (err: any) {
      console.error('Error running fuzzy match:', err);
    } finally {
      setLoadingFuzzy(false);
    }
  }, [threshold]);

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
      alert('Error al guardar el nombre SICAS');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkVendor = async (vendorId: string, userId: string) => {
    try {
      const { data, error } = await supabase.rpc('link_vendor_to_user', {
        p_vendor_id: vendorId,
        p_movi_user_id: userId,
        p_linked_by: null,
      });
      if (error) throw error;

      setPendingVendors(prev => prev.filter(v => v.id !== vendorId));
      setLinkingVendorId(null);
      setLinkSearch('');
      loadUsuarios();
    } catch (err: any) {
      alert('Error al vincular: ' + (err?.message || 'desconocido'));
    }
  };

  const handleConfirmMatches = async () => {
    setConfirmingMatches(true);
    try {
      const { data, error } = await supabase.rpc('confirm_fuzzy_matches', {
        p_threshold: 0.92,
      });
      if (error) throw error;
      const result = data?.[0];
      setConfirmResult({
        confirmed: result?.confirmed_count || 0,
        mappings: result?.vendor_mappings_created || 0,
      });
      runFuzzyMatch();
      loadUsuarios();
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'desconocido'));
    } finally {
      setConfirmingMatches(false);
    }
  };

  const handleLinkFromFuzzy = async (vendorId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('link_vendor_to_user', {
        p_vendor_id: vendorId,
        p_movi_user_id: userId,
        p_linked_by: null,
      });
      if (error) throw error;
      setFuzzyMatches(prev => prev.filter(m => m.vendor_id !== vendorId));
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'desconocido'));
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
      u.email_laboral?.toLowerCase().includes(q) ||
      u.email_personal?.toLowerCase().includes(q) ||
      u.nombre_sicas?.toLowerCase().includes(q);

    const matchesSicas =
      filterSicas === 'all' ||
      (filterSicas === 'vinculados' && (u.nombre_sicas || u.mappings_count > 0)) ||
      (filterSicas === 'solo_sicas' && u.nombre_sicas && u.mappings_count === 0) ||
      (filterSicas === 'solo_mapeo' && !u.nombre_sicas && u.mappings_count > 0) ||
      (filterSicas === 'sin_vincular' && !u.nombre_sicas && u.mappings_count === 0);

    return matchesSearch && matchesSicas;
  });

  const filteredPending = pendingVendors.filter(v => {
    if (!search) return true;
    return v.vend_nombre.toLowerCase().includes(search.toLowerCase());
  });

  const linkCandidates = usuarios.filter(u => {
    if (!linkSearch) return true;
    const q = linkSearch.toLowerCase();
    return u.nombre_completo.toLowerCase().includes(q) ||
      u.email_laboral?.toLowerCase().includes(q) ||
      u.nombre_sicas?.toLowerCase().includes(q);
  }).slice(0, 10);

  const stats = {
    total: usuarios.length,
    vinculados: usuarios.filter(u => u.nombre_sicas || u.mappings_count > 0).length,
    sinVincular: usuarios.filter(u => !u.nombre_sicas && u.mappings_count === 0).length,
    conSicas: usuarios.filter(u => u.nombre_sicas).length,
    conMapeos: usuarios.filter(u => u.mappings_count > 0).length,
    soloMapeo: usuarios.filter(u => !u.nombre_sicas && u.mappings_count > 0).length,
  };

  const tabs: { id: TabId; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'usuarios', label: 'Usuarios MOVI', icon: Users, count: stats.total },
    { id: 'pendientes', label: 'Vendedores Pendientes', icon: AlertTriangle, count: pendingVendors.length },
    { id: 'sincronizar', label: 'Auto-Sincronizar', icon: Zap, count: fuzzyMatches.length },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Mapeo Unificado SICAS"
          description="Vincula usuarios SICAS con usuarios MOVI. Sincroniza automaticamente o vincula manualmente."
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
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Vinculados</p>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-1">{stats.vinculados}</p>
          <p className="text-[10px] text-green-600/70 dark:text-green-400/50 mt-0.5">{stats.conSicas} SICAS + {stats.soloMapeo} solo mapeo</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Sin Vincular</p>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-300 mt-1">{stats.sinVincular}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Con Mapeos</p>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-1">{stats.conMapeos}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'usuarios' && (
        <UsuariosTab
          usuarios={filteredUsuarios}
          allUsuarios={usuarios}
          loading={loading}
          error={error}
          search={search}
          setSearch={setSearch}
          filterSicas={filterSicas}
          setFilterSicas={setFilterSicas}
          editingUserId={editingUserId}
          editValue={editValue}
          setEditValue={setEditValue}
          saving={saving}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          handleSaveSicas={handleSaveSicas}
          loadUsuarios={loadUsuarios}
          stats={stats}
        />
      )}

      {activeTab === 'pendientes' && (
        <PendientesTab
          vendors={filteredPending}
          loading={loadingPending}
          search={search}
          setSearch={setSearch}
          linkingVendorId={linkingVendorId}
          setLinkingVendorId={setLinkingVendorId}
          linkSearch={linkSearch}
          setLinkSearch={setLinkSearch}
          linkCandidates={linkCandidates}
          handleLinkVendor={handleLinkVendor}
          expandedVendor={expandedVendor}
          setExpandedVendor={setExpandedVendor}
          reload={loadPendingVendors}
        />
      )}

      {activeTab === 'sincronizar' && (
        <SincronizarTab
          matches={fuzzyMatches}
          loading={loadingFuzzy}
          confirming={confirmingMatches}
          confirmResult={confirmResult}
          threshold={threshold}
          setThreshold={setThreshold}
          runFuzzyMatch={runFuzzyMatch}
          handleConfirmMatches={handleConfirmMatches}
          handleLinkFromFuzzy={handleLinkFromFuzzy}
        />
      )}
    </div>
  );
}

/* ============================================================
   USUARIOS TAB
============================================================ */

function UsuariosTab({
  usuarios, allUsuarios, loading, error, search, setSearch, filterSicas, setFilterSicas,
  editingUserId, editValue, setEditValue, saving, startEdit, cancelEdit, handleSaveSicas,
  loadUsuarios, stats,
}: any) {
  return (
    <>
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
            onChange={(e) => setFilterSicas(e.target.value)}
            className="px-4 py-2.5 border border-neutral-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
          >
            <option value="all">Todos los usuarios</option>
            <option value="vinculados">Vinculados (SICAS o mapeo)</option>
            <option value="sin_vincular">Sin vincular</option>
            <option value="solo_sicas">Solo SICAS (sin mapeo)</option>
            <option value="solo_mapeo">Solo mapeo (sin SICAS)</option>
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
        ) : usuarios.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No se encontraron usuarios con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Usuario MOVI</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Oficina</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[260px]">Usuario SICAS</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Mapeos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {usuarios.map((u: MoviUser) => (
                  <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{u.nombre_completo}</p>
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
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent) => {
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
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition"
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
                              <span className="text-sm font-medium text-neutral-900 dark:text-white">{u.nombre_sicas}</span>
                              <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition">(editar)</span>
                            </span>
                          ) : u.mappings_count > 0 ? (
                            <span className="flex items-center gap-2 text-blue-500 hover:text-blue-700 transition">
                              <div className="h-2 w-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                              <span className="text-sm italic">Tiene mapeo, asignar SICAS...</span>
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
                Mostrando {usuarios.length} de {allUsuarios.length} usuarios
              </span>
              <span className="text-xs text-neutral-400">
                {stats.vinculados} vinculados ({stats.conSicas} SICAS, {stats.conMapeos} mapeos)
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   PENDIENTES TAB
============================================================ */

function PendientesTab({
  vendors, loading, search, setSearch, linkingVendorId, setLinkingVendorId,
  linkSearch, setLinkSearch, linkCandidates, handleLinkVendor,
  expandedVendor, setExpandedVendor, reload,
}: any) {
  return (
    <>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm mb-6 p-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4.5 w-4.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar vendedor pendiente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <button
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-blue-600 mx-auto"></div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
            <p className="text-neutral-600 dark:text-neutral-300 font-medium">No hay vendedores pendientes</p>
            <p className="text-neutral-400 text-sm mt-1">Todos los vendedores SICAS han sido vinculados</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {vendors.map((v: PendingVendor) => (
              <div key={v.id} className="p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20 transition">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{v.vend_nombre}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          ID: {v.vend_id} | Docs: {v.total_docs} | Prima: ${v.total_prima_neta?.toLocaleString() || '0'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {linkingVendorId === v.id ? (
                      <button
                        onClick={() => { setLinkingVendorId(null); setLinkSearch(''); }}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => setLinkingVendorId(v.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5" />
                          Vincular
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 transition"
                    >
                      {expandedVendor === v.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Link selector */}
                {linkingVendorId === v.id && (
                  <div className="mt-3 ml-11 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                    <input
                      type="text"
                      placeholder="Buscar usuario MOVI para vincular..."
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white mb-2"
                      autoFocus
                    />
                    {linkSearch && (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {linkCandidates.map((u: MoviUser) => (
                          <button
                            key={u.id}
                            onClick={() => handleLinkVendor(v.id, u.id)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition flex items-center justify-between"
                          >
                            <span className="font-medium text-neutral-900 dark:text-white">{u.nombre_completo}</span>
                            <span className="text-xs text-neutral-500">{u.email_laboral || ''}</span>
                          </button>
                        ))}
                        {linkCandidates.length === 0 && (
                          <p className="text-xs text-neutral-500 text-center py-2">Sin resultados</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded details */}
                {expandedVendor === v.id && (
                  <div className="mt-3 ml-11 text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                    <p>Tipo match: {v.match_type}</p>
                    <p>Confianza: {v.confidence_score}%</p>
                    {v.match_details && Object.keys(v.match_details).length > 0 && (
                      <p>Detalles: {JSON.stringify(v.match_details)}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-700/50 border-t border-neutral-200 dark:border-neutral-600">
              <span className="text-xs text-neutral-500">
                {vendors.length} vendedores pendientes de vincular
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   SINCRONIZAR TAB
============================================================ */

function SincronizarTab({
  matches, loading, confirming, confirmResult, threshold, setThreshold,
  runFuzzyMatch, handleConfirmMatches, handleLinkFromFuzzy,
}: any) {
  const autoConfirmable = matches.filter((m: FuzzyMatch) => m.auto_confirmed);
  const manualReview = matches.filter((m: FuzzyMatch) => !m.auto_confirmed);

  return (
    <>
      {/* Controls */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm mb-6 p-5 border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
              Matching Automatico por Similitud de Nombre
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Compara los nombres de vendedores SICAS pendientes con usuarios MOVI usando pg_trgm.
              Los matches con 92%+ se pueden auto-confirmar.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Umbral minimo:</label>
              <select
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
              >
                <option value={0.6}>60%</option>
                <option value={0.65}>65%</option>
                <option value={0.7}>70%</option>
                <option value={0.75}>75%</option>
                <option value={0.8}>80%</option>
                <option value={0.85}>85%</option>
                <option value={0.9}>90%</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runFuzzyMatch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Buscar Matches
            </button>
            {autoConfirmable.length > 0 && (
              <button
                onClick={handleConfirmMatches}
                disabled={confirming}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {confirming ? 'Confirmando...' : `Auto-confirmar ${autoConfirmable.length}`}
              </button>
            )}
          </div>
        </div>

        {confirmResult && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              Sincronizacion completada: {confirmResult.confirmed} vendedores confirmados, {confirmResult.mappings} mapeos creados.
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-neutral-500">Ejecutando busqueda de similitud...</p>
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
            <p className="text-neutral-600 dark:text-neutral-300 font-medium">
              No hay matches pendientes con umbral de {Math.round(threshold * 100)}%
            </p>
            <p className="text-neutral-400 text-sm mt-1">Intenta bajar el umbral para encontrar mas coincidencias</p>
          </div>
        ) : (
          <div>
            {/* Auto-confirmable section */}
            {autoConfirmable.length > 0 && (
              <div>
                <div className="px-5 py-3 bg-green-50 dark:bg-green-900/10 border-b border-green-200 dark:border-green-800">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    Auto-confirmables ({autoConfirmable.length}) - Similitud 92%+
                  </p>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {autoConfirmable.map((m: FuzzyMatch) => (
                    <MatchRow key={m.vendor_id} match={m} onLink={handleLinkFromFuzzy} />
                  ))}
                </div>
              </div>
            )}

            {/* Manual review section */}
            {manualReview.length > 0 && (
              <div>
                <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 border-t">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Revision manual ({manualReview.length}) - Similitud {Math.round(threshold * 100)}%-91%
                  </p>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {manualReview.map((m: FuzzyMatch) => (
                    <MatchRow key={m.vendor_id} match={m} onLink={handleLinkFromFuzzy} />
                  ))}
                </div>
              </div>
            )}

            <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-700/50 border-t border-neutral-200 dark:border-neutral-600">
              <span className="text-xs text-neutral-500">
                {matches.length} matches encontrados | {autoConfirmable.length} auto-confirmables | {manualReview.length} revision manual
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MatchRow({ match, onLink }: { match: FuzzyMatch; onLink: (vendorId: string, userId: string) => void }) {
  const score = Math.round(match.similarity_score * 100);
  const scoreColor = score >= 92 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    : score >= 80 ? 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    : 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';

  return (
    <div className="px-5 py-3 flex items-center gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{match.vend_nombre}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Sugerido: <span className="font-medium text-neutral-700 dark:text-neutral-300">{match.matched_user_name}</span>
            </p>
          </div>
        </div>
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-md ${scoreColor}`}>
        {score}%
      </span>
      <button
        onClick={() => onLink(match.vendor_id, match.matched_user_id)}
        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition flex items-center gap-1.5"
      >
        <UserCheck className="h-3.5 w-3.5" />
        Confirmar
      </button>
    </div>
  );
}
