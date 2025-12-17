import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Download, Filter, Calendar, Settings, RefreshCw, Building, User, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';

interface VendorCacheRecord {
  id: string;
  vend_nombre: string;
  vend_nombre_normalized: string;
  movi_user_id: string | null;
  movi_user_name: string | null;
  oficina_nombre: string | null;
  match_method: 'direct_name' | 'mapping_name' | 'none';
  total_records: number;
  total_importe_pesos: number;
  total_prima_convenio: number;
  total_prima_ponderada: number;
  total_bono: number;
}

interface CacheMetadata {
  last_fetched_at: string;
  last_fetch_duration_ms: number;
  total_records: number;
  total_vendors: number;
  ttl_minutes: number;
  is_valid: boolean;
  minutes_until_expiry: number;
}

interface VendorDetails {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
}

export default function ProduccionPorVendedorOptimizado() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorCacheRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [vendorDetails, setVendorDetails] = useState<Map<string, VendorDetails[]>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Map<string, boolean>>(new Map());
  const [showFilters, setShowFilters] = useState(true);
  const [metadata, setMetadata] = useState<CacheMetadata | null>(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalVendors, setTotalVendors] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState({
    searchVendor: '',
    mappingStatus: 'all',
    sortBy: 'total',
    sortOrder: 'desc',
  });

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadVendors();
  }, [usuario, currentPage, pageSize, filters]);

  const loadVendors = async (forceRefresh = false) => {
    if (!usuario) return;

    console.log('[ProduccionOptimizado] Cargando vendedores...');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-production-vendors-cached`;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(filters.searchVendor && { search: filters.searchVendor }),
        ...(filters.mappingStatus !== 'all' && { mappingStatus: filters.mappingStatus }),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...(forceRefresh && { forceRefresh: 'true' }),
      });

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido');
      }

      console.log('[ProduccionOptimizado] Vendedores cargados:', result.vendors.length);
      console.log('[ProduccionOptimizado] Performance:', result.performance);

      setVendors(result.vendors);
      setTotalVendors(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setMetadata(result.metadata);

    } catch (error: any) {
      console.error('[ProduccionOptimizado] Error:', error);
      alert('Error al cargar los datos de producción:\n\n' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadVendorDetails = async (vendNombre: string) => {
    if (vendorDetails.has(vendNombre)) {
      return;
    }

    console.log('[ProduccionOptimizado] Cargando detalles para:', vendNombre);
    setLoadingDetails(new Map(loadingDetails).set(vendNombre, true));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-vendor-production-details`;

      const params = new URLSearchParams({
        vendNombre,
        page: '1',
        limit: '1000',
      });

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const newDetails = new Map(vendorDetails);
        newDetails.set(vendNombre, result.records);
        setVendorDetails(newDetails);
        console.log('[ProduccionOptimizado] Detalles cargados:', result.records.length, 'registros');
      }

    } catch (error: any) {
      console.error('[ProduccionOptimizado] Error al cargar detalles:', error);
    } finally {
      const newLoadingDetails = new Map(loadingDetails);
      newLoadingDetails.delete(vendNombre);
      setLoadingDetails(newLoadingDetails);
    }
  };

  const handleExpandVendor = async (vendNombre: string) => {
    if (expandedVendor === vendNombre) {
      setExpandedVendor(null);
    } else {
      setExpandedVendor(vendNombre);
      await loadVendorDetails(vendNombre);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVendors(true);
  };

  const calculateKPIs = () => {
    const totalImporte = vendors.reduce((sum, v) => sum + v.total_importe_pesos, 0);
    const totalConvenio = vendors.reduce((sum, v) => sum + v.total_prima_convenio, 0);
    const totalPonderada = vendors.reduce((sum, v) => sum + v.total_prima_ponderada, 0);
    const totalBono = vendors.reduce((sum, v) => sum + v.total_bono, 0);

    const metricaPrincipal = totalImporte > 0 ? totalImporte : totalConvenio;

    const mappedVendors = vendors.filter(v => v.movi_user_id !== null).length;
    const unmappedVendors = vendors.filter(v => v.movi_user_id === null).length;

    return {
      totalImporte,
      totalConvenio,
      totalPonderada,
      totalBono,
      metricaPrincipal,
      totalVendors: totalVendors,
      mappedVendors,
      unmappedVendors,
    };
  };

  const exportToExcel = async () => {
    alert('Exportando todos los datos...');

    // Cargar todos los vendedores sin paginación
    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-production-vendors-cached`;

    const params = new URLSearchParams({
      page: '1',
      limit: '10000',
    });

    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();
    const allVendors = result.vendors || [];

    const dataToExport = allVendors.map((vendor: VendorCacheRecord) => ({
      'Vendedor': vendor.vend_nombre,
      'Usuario MOVI': vendor.movi_user_name || 'Sin asignar',
      'Oficina': vendor.oficina_nombre || '-',
      'Estado Mapeo': vendor.match_method === 'direct_name' ? 'Auto' :
                      vendor.match_method === 'mapping_name' ? 'Manual' : 'Sin asignar',
      'Total Registros': vendor.total_records,
      'Importe Pesos': vendor.total_importe_pesos,
      'Prima Convenio': vendor.total_prima_convenio,
      'Prima Ponderada': vendor.total_prima_ponderada,
      'Bono': vendor.total_bono,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción por Vendedor');
    XLSX.writeFile(wb, `Produccion_Por_Vendedor_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartDataByVendor = useMemo(() => {
    const useImporte = vendors.some(v => v.total_importe_pesos > 0);

    return vendors
      .slice(0, 15)
      .map(v => ({
        label: v.movi_user_name || v.vend_nombre,
        value: useImporte ? v.total_importe_pesos : v.total_prima_convenio,
      }));
  }, [vendors]);

  const chartDataMappingStatus = useMemo(() => {
    const useImporte = vendors.some(v => v.total_importe_pesos > 0);

    const mapped = vendors
      .filter(v => v.movi_user_id !== null)
      .reduce((sum, v) => sum + (useImporte ? v.total_importe_pesos : v.total_prima_convenio), 0);

    const unmapped = vendors
      .filter(v => v.movi_user_id === null)
      .reduce((sum, v) => sum + (useImporte ? v.total_importe_pesos : v.total_prima_convenio), 0);

    return [
      { label: 'Vendedores Asignados', value: mapped },
      { label: 'Vendedores Sin Asignar', value: unmapped },
    ].filter(d => d.value > 0);
  }, [vendors]);

  const kpis = calculateKPIs();
  const formatCurrency = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading && vendors.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando producción por vendedor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 mb-1 sm:mb-2">
                Producción por Vendedor
              </h1>
              <p className="text-sm sm:text-base text-neutral-600">
                Vista optimizada con cache y paginación
              </p>
              {metadata && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 text-xs text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Última actualización: {new Date(metadata.last_fetched_at).toLocaleString('es-MX')}</span>
                  </div>
                  {metadata.is_valid && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span>Cache válido ({metadata.minutes_until_expiry.toFixed(1)} min restantes)</span>
                    </div>
                  )}
                  <span>Duración carga: {metadata.last_fetch_duration_ms}ms</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm sm:text-base disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/produccion/configuracion')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configuración</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200">
            <p className="text-xs sm:text-sm text-green-700 mb-1 font-medium">Producción Total</p>
            <p className="text-lg sm:text-2xl font-bold text-green-900 truncate">
              ${(kpis.metricaPrincipal / 1000000).toFixed(1)}M
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
            <p className="text-xs sm:text-sm text-blue-700 mb-1 font-medium">Vendedores</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-900">
              {kpis.totalVendors}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-teal-200">
            <p className="text-xs sm:text-sm text-teal-700 mb-1 font-medium">Asignados</p>
            <p className="text-lg sm:text-2xl font-bold text-teal-900">
              {kpis.mappedVendors}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-orange-200">
            <p className="text-xs sm:text-sm text-orange-700 mb-1 font-medium">Sin Asignar</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-900">
              {kpis.unmappedVendors}
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full mb-3 sm:mb-4"
          >
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600" />
              <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">Filtros</h3>
            </div>
            <span className="text-neutral-600 text-sm sm:text-base">
              {showFilters ? '−' : '+'}
            </span>
          </button>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Buscar Vendedor
                </label>
                <input
                  type="text"
                  value={filters.searchVendor}
                  onChange={(e) => {
                    setFilters({ ...filters, searchVendor: e.target.value });
                    setCurrentPage(1);
                  }}
                  placeholder="Nombre o usuario MOVI..."
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Estado de Mapeo
                </label>
                <select
                  value={filters.mappingStatus}
                  onChange={(e) => {
                    setFilters({ ...filters, mappingStatus: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="mapped">Asignados</option>
                  <option value="unmapped">Sin asignar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Ordenar por
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="total">Producción Total</option>
                  <option value="name">Nombre</option>
                  <option value="records">Registros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Registros por página
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          )}

          {showFilters && (
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setFilters({
                    searchVendor: '',
                    mappingStatus: 'all',
                    sortBy: 'total',
                    sortOrder: 'desc',
                  });
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
              >
                Limpiar
              </button>

              <button
                onClick={exportToExcel}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium sm:ml-auto"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {vendors.length > 0 && chartDataByVendor.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 mb-4 sm:mb-6">
            Análisis por Vendedor (Top 15)
          </h2>

          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <GraficaColumnas
                data={chartDataByVendor}
                title="Top 15 Vendedores"
                valueFormatter={formatCurrency}
                height={280}
              />
              <GraficaCircular
                data={chartDataMappingStatus}
                title="Vendedores por Estado de Mapeo"
                valueFormatter={formatCurrency}
                size={220}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">
            Lista de Vendedores
          </h2>
          <span className="text-xs sm:text-sm text-neutral-600">
            Mostrando {vendors.length} de {totalVendors} vendedores
          </span>
        </div>

        <div className="space-y-2">
          {vendors.map((vendor) => {
            const isExpanded = expandedVendor === vendor.vend_nombre;
            const isLoadingDetails = loadingDetails.get(vendor.vend_nombre) === true;
            const details = vendorDetails.get(vendor.vend_nombre);
            const useImporte = vendor.total_importe_pesos > 0;
            const totalValue = useImporte ? vendor.total_importe_pesos : vendor.total_prima_convenio;

            return (
              <div key={vendor.id} className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => handleExpandVendor(vendor.vend_nombre)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div className="sm:col-span-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {vendor.vend_nombre}
                      </p>
                      {vendor.movi_user_name && (
                        <p className="text-xs text-teal-600 flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {vendor.movi_user_name}
                        </p>
                      )}
                      {vendor.oficina_nombre && (
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {vendor.oficina_nombre}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Producción</p>
                      <p className="text-sm font-bold text-green-700">
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Registros</p>
                      <p className="text-sm font-semibold text-neutral-900">
                        {vendor.total_records.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-neutral-400 ml-2 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-400 ml-2 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                    {isLoadingDetails ? (
                      <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : details ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <p className="text-xs text-neutral-600 mb-1">Importe Pesos</p>
                            <p className="text-sm font-bold text-green-700">
                              {formatCurrency(vendor.total_importe_pesos)}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <p className="text-xs text-neutral-600 mb-1">Prima Convenio</p>
                            <p className="text-sm font-bold text-blue-700">
                              {formatCurrency(vendor.total_prima_convenio)}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <p className="text-xs text-neutral-600 mb-1">Prima Ponderada</p>
                            <p className="text-sm font-bold text-teal-700">
                              {formatCurrency(vendor.total_prima_ponderada)}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-neutral-200">
                            <p className="text-xs text-neutral-600 mb-1">Bono</p>
                            <p className="text-sm font-bold text-orange-700">
                              {formatCurrency(vendor.total_bono)}
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-neutral-100">
                                <th className="px-2 py-2 text-left font-semibold">Fecha</th>
                                <th className="px-2 py-2 text-left font-semibold">Oficina</th>
                                <th className="px-2 py-2 text-left font-semibold">Ramo</th>
                                <th className="px-2 py-2 text-left font-semibold">Aseguradora</th>
                                <th className="px-2 py-2 text-right font-semibold">Importe</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.slice(0, 10).map((record, idx) => (
                                <tr key={idx} className="border-t border-neutral-200">
                                  <td className="px-2 py-2">{new Date(record.fecha).toLocaleDateString('es-MX')}</td>
                                  <td className="px-2 py-2">{record.desp_nombre_raw}</td>
                                  <td className="px-2 py-2">{record.ramo_nombre}</td>
                                  <td className="px-2 py-2">{record.aseguradora_nombre}</td>
                                  <td className="px-2 py-2 text-right font-semibold text-green-700">
                                    {formatCurrency(record.importe_pesos > 0 ? record.importe_pesos : record.prima_convenio)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {details.length > 10 && (
                            <p className="text-xs text-neutral-500 text-center mt-2">
                              Mostrando 10 de {details.length} registros
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-neutral-500 py-4">
                        No se pudieron cargar los detalles
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {vendors.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <Users className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              No hay vendedores para mostrar
            </h3>
            <p className="text-neutral-600 mb-4">
              Ajusta los filtros para ver vendedores
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-neutral-600">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
