import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText, RefreshCw, Filter, Search, X, TrendingUp, Clock, CheckCircle,
  ChevronDown, ChevronUp, AlertCircle, FolderOpen, Calendar,
  Shield,
} from 'lucide-react';
import { SicasPoliza } from '../lib/misPolizasTypes';
import { PageHeader } from '@/components/ui/page-header';
import { SicasDigitalCenterViewer } from '@/components/sicasDigitalCenter/SicasDigitalCenterViewer';

interface Filters {
  searchText: string;
  estatus: 'vigente' | 'no_vigente' | 'todas';
  fecha_desde: string;
  fecha_hasta: string;
  tipo_fecha: 'vigencia' | 'captura' | 'emision';
  aseguradora: string;
  ramo: string;
  subramo: string;
  oficina_id: string;
  vendedor_nombre: string;
  sort_by: 'vigencia_desde' | 'vigencia_hasta' | 'fecha_captura' | 'prima_neta' | 'poliza';
  sort_order: 'asc' | 'desc';
}

export default function MisPolizas() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [polizas, setPolizas] = useState<SicasPoliza[]>([]);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const itemsPerPage = 50;

  // Estado del Centro Digital
  const [showCentroDigital, setShowCentroDigital] = useState(false);
  const [selectedPoliza, setSelectedPoliza] = useState<SicasPoliza | null>(null);

  const [filters, setFilters] = useState<Filters>({
    searchText: '',
    estatus: 'vigente',
    fecha_desde: '',
    fecha_hasta: '',
    tipo_fecha: 'vigencia',
    aseguradora: '',
    ramo: '',
    subramo: '',
    oficina_id: '',
    vendedor_nombre: '',
    sort_by: 'vigencia_hasta',
    sort_order: 'asc',
  });

  const puedeAdministrar = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const esAgente = usuario?.rol === 'Agente';

  useEffect(() => {
    if (usuario) {
      loadPolizas();
    }
  }, [usuario, currentPage, filters.estatus, filters.sort_by, filters.sort_order]);

  const loadPolizas = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-polizas-list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              searchText: filters.searchText || undefined,
              estatus: filters.estatus,
              fecha_desde: filters.fecha_desde || undefined,
              fecha_hasta: filters.fecha_hasta || undefined,
              tipo_fecha: filters.tipo_fecha,
              aseguradora: filters.aseguradora || undefined,
              ramo: filters.ramo || undefined,
              subramo: filters.subramo || undefined,
              oficina_id: filters.oficina_id || undefined,
              vendedor_nombre: filters.vendedor_nombre || undefined,
              sort_by: filters.sort_by,
              sort_order: filters.sort_order,
            },
            page: currentPage,
            items_per_page: itemsPerPage,
          }),
        }
      );

      const result = await response.json();
      console.log('[Mis Pólizas] Resultado:', result);

      if (result.success) {
        setPolizas(result.polizas || []);
        setTotalRecords(result.pagination?.total_records || 0);
        setTotalPages(result.pagination?.total_pages || 1);
      } else {
        throw new Error(result.error || 'Error al cargar pólizas');
      }
    } catch (error: any) {
      console.error('[Mis Pólizas] Error:', error);
      setSyncMessage({
        type: 'error',
        text: error.message || 'Error al cargar pólizas'
      });
      setPolizas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      console.log('[Mis Pólizas] Iniciando sincronización...');

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

      if (result.success) {
        setSyncMessage({
          type: 'success',
          text: `Sincronización exitosa: ${result.stats?.records_synced || 0} documentos actualizados`
        });
        await loadPolizas();
      } else {
        throw new Error(result.error || 'Error en sincronización');
      }
    } catch (error: any) {
      console.error('[Mis Pólizas] Error en sincronización:', error);
      setSyncMessage({
        type: 'error',
        text: error.message || 'Error al sincronizar con SICAS'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleVerCentroDigital = (poliza: SicasPoliza) => {
    setSelectedPoliza(poliza);
    setShowCentroDigital(true);
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadPolizas();
  };

  const clearFilters = () => {
    setFilters({
      searchText: '',
      estatus: 'vigente',
      fecha_desde: '',
      fecha_hasta: '',
      tipo_fecha: 'vigencia',
      aseguradora: '',
      ramo: '',
      subramo: '',
      oficina_id: '',
      vendedor_nombre: '',
      sort_by: 'vigencia_hasta',
      sort_order: 'asc',
    });
    setCurrentPage(1);
  };

  const stats = {
    totalPolizas: polizas.length,
    totalPrimaNeta: polizas.reduce((sum, p) => sum + (p.prima_neta || 0), 0),
    totalImporte: polizas.reduce((sum, p) => sum + (p.importe || 0), 0),
    vigentesProximos30Dias: polizas.filter(p => {
      if (!p.vigencia_hasta) return false;
      const diasHastaVencimiento = Math.ceil(
        (new Date(p.vigencia_hasta).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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

  const getEstatusColor = (poliza: SicasPoliza) => {
    if (!poliza.vigencia_hasta) return 'bg-neutral-100 text-neutral-800';
    const diasHastaVencimiento = Math.ceil(
      (new Date(poliza.vigencia_hasta).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (diasHastaVencimiento < 0) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    if (diasHastaVencimiento <= 30) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
  };

  const getEstatusText = (poliza: SicasPoliza) => {
    if (!poliza.vigencia_hasta) return 'Sin vigencia';
    const diasHastaVencimiento = Math.ceil(
      (new Date(poliza.vigencia_hasta).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (diasHastaVencimiento < 0) return `Vencida (${Math.abs(diasHastaVencimiento)} días)`;
    if (diasHastaVencimiento === 0) return 'Vence hoy';
    if (diasHastaVencimiento <= 30) return `Vence en ${diasHastaVencimiento} días`;
    return 'Vigente';
  };

  if (loading && polizas.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-white/60">Cargando pólizas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Mis Polizas"
          description="Consulta tus polizas vigentes y accede al Centro Digital"
          icon={Shield}
          actions={
            (puedeAdministrar || esGerente) ? (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            ) : undefined
          }
        />

        {syncMessage && (
          <div className={`p-4 rounded-lg ${
            syncMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300'
              : syncMessage.type === 'warning'
              ? 'bg-orange-50 border border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-900 dark:text-orange-300'
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

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-white/50">Total Pólizas</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalRecords}</p>
              </div>
              <FileText className="h-8 w-8 text-accent" />
            </div>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-white/50">Prima Neta Total</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(stats.totalPrimaNeta)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-white/50">Importe Total</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(stats.totalImporte)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-accent" />
            </div>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-white/50">Próximas a Vencer</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stats.vigentesProximos30Dias}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm border border-neutral-200 dark:border-white/10">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-neutral-500 dark:text-white/50" />
              <span className="font-semibold text-neutral-900 dark:text-white">Filtros</span>
            </div>
            {showFilters ? (
              <ChevronUp className="h-5 w-5 text-neutral-500 dark:text-white/50" />
            ) : (
              <ChevronDown className="h-5 w-5 text-neutral-500 dark:text-white/50" />
            )}
          </button>

          {showFilters && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-neutral-200 dark:border-white/10 pt-4">
              {/* Búsqueda general */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Búsqueda General
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                    placeholder="Póliza, cliente, ID..."
                    className="w-full pl-10 pr-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>

              {/* Estatus */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Estatus
                </label>
                <select
                  value={filters.estatus}
                  onChange={(e) => setFilters({ ...filters, estatus: e.target.value as any })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                >
                  <option value="vigente">Solo Vigentes</option>
                  <option value="no_vigente">Solo No Vigentes</option>
                  <option value="todas">Todas</option>
                </select>
              </div>

              {/* Aseguradora */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Aseguradora
                </label>
                <input
                  type="text"
                  value={filters.aseguradora}
                  onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                  placeholder="Filtrar por aseguradora"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                />
              </div>

              {/* Ramo */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Ramo
                </label>
                <input
                  type="text"
                  value={filters.ramo}
                  onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                  placeholder="Filtrar por ramo"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                />
              </div>

              {/* Fecha Desde */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={filters.fecha_desde}
                  onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                />
              </div>

              {/* Fecha Hasta */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={filters.fecha_hasta}
                  onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent dark:bg-white/5 dark:text-white"
                />
              </div>

              {/* Botones */}
              <div className="md:col-span-3 flex justify-end gap-2">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </button>
                <button
                  onClick={applyFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover transition-colors"
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabla de pólizas */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Pólizas ({totalRecords})
            </h2>
          </div>

          {polizas.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                No hay pólizas disponibles
              </h3>
              <p className="text-neutral-500 dark:text-white/50 mb-6">
                {puedeAdministrar || esGerente
                  ? 'Haz clic en "Sincronizar" para obtener pólizas de SICAS'
                  : 'No se encontraron pólizas para tu usuario'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Póliza
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Aseguradora / Ramo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Vigencia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Prima Neta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Estatus
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/60 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-white/5 divide-y divide-neutral-200 dark:divide-white/10">
                    {polizas.map((poliza) => (
                      <tr key={poliza.id} className="hover:bg-neutral-50 dark:hover:bg-white/5">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">
                            {poliza.poliza || 'N/A'}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-white/50">
                            {poliza.id_docto}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-900 dark:text-white">
                            {poliza.cliente || 'N/A'}
                          </div>
                          {poliza.vend_nombre && (
                            <div className="text-xs text-neutral-500 dark:text-white/50">
                              {poliza.vend_nombre}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-900 dark:text-white">
                            {poliza.compania || 'N/A'}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-white/50">
                            {poliza.ramo || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-neutral-400" />
                            <span>{formatDate(poliza.vigencia_desde)}</span>
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-white/50">
                            hasta {formatDate(poliza.vigencia_hasta)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-white">
                          {formatCurrency(poliza.prima_neta || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstatusColor(poliza)}`}>
                            {getEstatusText(poliza)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleVerCentroDigital(poliza)}
                            className="text-accent hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                          >
                            <FolderOpen className="h-5 w-5" />
                            <span>Centro Digital</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between">
                  <div className="text-sm text-neutral-500 dark:text-white/50">
                    Página {currentPage} de {totalPages} ({totalRecords} registros)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-neutral-300 dark:border-white/15 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-neutral-300 dark:border-white/15 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Centro Digital */}
      {selectedPoliza && (
        <SicasDigitalCenterViewer
          mode="modal"
          open={showCentroDigital}
          onClose={() => setShowCentroDigital(false)}
          params={{ entityType: 'document', idDocto: selectedPoliza.id_docto }}
          title={`${selectedPoliza.poliza || selectedPoliza.id_docto} — ${selectedPoliza.cliente || ''}`}
        />
      )}

    </div>
  );
}
