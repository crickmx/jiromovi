import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText, RefreshCw, Filter, Search, X, TrendingUp, Clock, CheckCircle,
  ChevronDown, ChevronUp, Info, AlertCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

interface SicasDocument {
  id: string;
  id_docto: string;
  poliza: string;
  compania: string;
  ramo: string;
  subramo: string;
  cliente: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  prima_neta: number;
  importe: number;
  vend_nombre: string;
  desp_nombre: string;
  synced_at: string;
}

interface Filters {
  searchText: string;
  aseguradora: string;
  ramo: string;
}

export default function MiProduccionSICAS() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [documents, setDocuments] = useState<SicasDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<SicasDocument[]>([]);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    searchText: '',
    aseguradora: '',
    ramo: '',
  });
  const [expandedPoliza, setExpandedPoliza] = useState<string | null>(null);

  const puedeAdministrarSicas = usuario ? tienePermisoAdminEnModulo(usuario, MODULOS.SICAS) : false;

  useEffect(() => {
    if (usuario) {
      loadDocuments();
      loadLastSyncInfo();
    }
  }, [usuario]);

  useEffect(() => {
    applyFilters();
  }, [documents, filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      // Leer directamente de la tabla espejo
      let query = supabase
        .from('sicas_documents')
        .select('*')
        .order('synced_at', { ascending: false });

      // Si no es admin, filtrar por usuario
      if (!puedeAdministrarSicas) {
        query = query.eq('usuario_id', usuario?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('[SICAS] Documentos cargados:', data?.length || 0);
      setDocuments(data || []);
    } catch (error) {
      console.error('[SICAS] Error al cargar documentos:', error);
      setSyncMessage({
        type: 'error',
        text: 'Error al cargar documentos desde la base de datos'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLastSyncInfo = async () => {
    try {
      const { data } = await supabase
        .from('sicas_sync_cursors')
        .select('last_success_at')
        .eq('module', 'documents')
        .single();

      if (data?.last_success_at) {
        setLastSync(new Date(data.last_success_at).toLocaleString('es-MX'));
      }
    } catch (error) {
      console.log('[SICAS] No hay información de sincronización previa');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      console.log('[SICAS] Iniciando sincronización...');

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-sync-polizas-vigentes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      console.log('[SICAS] Resultado de sincronización:', result);

      if (result.success) {
        setSyncMessage({
          type: 'success',
          text: `Sincronización exitosa: ${result.stats?.records_synced || 0} documentos actualizados`
        });

        // Recargar documentos
        await loadDocuments();
        await loadLastSyncInfo();
      } else {
        throw new Error(result.error || 'Error en sincronización');
      }
    } catch (error: any) {
      console.error('[SICAS] Error en sincronización:', error);
      setSyncMessage({
        type: 'error',
        text: error.message || 'Error al sincronizar con SICAS'
      });
    } finally {
      setSyncing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...documents];

    // Filtro de búsqueda general
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.poliza?.toLowerCase().includes(search) ||
        doc.cliente?.toLowerCase().includes(search) ||
        doc.id_docto?.toLowerCase().includes(search)
      );
    }

    // Filtro por aseguradora
    if (filters.aseguradora) {
      filtered = filtered.filter(doc =>
        doc.compania?.toLowerCase().includes(filters.aseguradora.toLowerCase())
      );
    }

    // Filtro por ramo
    if (filters.ramo) {
      filtered = filtered.filter(doc =>
        doc.ramo?.toLowerCase().includes(filters.ramo.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  };

  const clearFilters = () => {
    setFilters({
      searchText: '',
      aseguradora: '',
      ramo: '',
    });
  };

  // Calcular estadísticas
  const stats = {
    totalDocumentos: documents.length,
    totalPrimaNeta: documents.reduce((sum, doc) => sum + (doc.prima_neta || 0), 0),
    totalImporte: documents.reduce((sum, doc) => sum + (doc.importe || 0), 0),
    vigentesProximos30Dias: documents.filter(doc => {
      if (!doc.vigencia_hasta) return false;
      const diasHastaVencimiento = Math.ceil(
        (new Date(doc.vigencia_hasta).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return diasHastaVencimiento >= 0 && diasHastaVencimiento <= 30;
    }).length,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando datos de SICAS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                Mi Producción SICAS
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Consulta tus pólizas vigentes sincronizadas desde SICAS
              </p>
              {lastSync && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Última sincronización: {lastSync}
                </p>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>

          {/* Mensajes de sincronización */}
          {syncMessage && (
            <div className={`mt-4 p-4 rounded-lg ${
              syncMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300'
                : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {syncMessage.type === 'success' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span className="font-medium">{syncMessage.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Documentos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDocumentos}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Prima Neta Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalPrimaNeta)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Importe Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalImporte)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Próximas a Vencer</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.vigentesProximos30Dias}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white">Filtros</span>
            </div>
            {showFilters ? (
              <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          {showFilters && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Búsqueda General
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                    placeholder="Póliza, cliente, ID..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Aseguradora
                </label>
                <input
                  type="text"
                  value={filters.aseguradora}
                  onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                  placeholder="Filtrar por aseguradora"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ramo
                </label>
                <input
                  type="text"
                  value={filters.ramo}
                  onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                  placeholder="Filtrar por ramo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {(filters.searchText || filters.aseguradora || filters.ramo) && (
                <div className="md:col-span-3 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabla de documentos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pólizas Vigentes ({filteredDocuments.length})
            </h2>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {documents.length === 0 ? 'No hay documentos sincronizados' : 'No se encontraron resultados'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {documents.length === 0
                  ? 'Haz clic en "Sincronizar" para obtener tus pólizas de SICAS'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Póliza
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Aseguradora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ramo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vigencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Prima Neta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {doc.poliza || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.id_docto}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {doc.cliente || 'N/A'}
                        </div>
                        {doc.vend_nombre && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.vend_nombre}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {doc.compania || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {doc.ramo || 'N/A'}
                        </div>
                        {doc.subramo && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.subramo}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div>{formatDate(doc.vigencia_desde)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          hasta {formatDate(doc.vigencia_hasta)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(doc.prima_neta || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setExpandedPoliza(expandedPoliza === doc.id ? null : doc.id)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Info className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
