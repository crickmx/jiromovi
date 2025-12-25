import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Download, Filter, Calendar, Settings, TrendingUp, Building, User, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import GraficaLinea from '../components/produccion/GraficaLinea';
import { groupProductionByVendor, type VendorProductionRecord } from '../lib/produccionVendorUtils';

export default function ProduccionPorVendedor() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [vendorRecords, setVendorRecords] = useState<VendorProductionRecord[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<VendorProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [lastImport, setLastImport] = useState<any>(null);

  const [filters, setFilters] = useState({
    searchVendor: '',
    mappingStatus: 'all', // all, mapped, unmapped
    dateFrom: '',
    dateTo: '',
    ramo: '',
    aseguradora: '',
  });

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadData();
  }, [usuario]);

  useEffect(() => {
    applyFilters();
  }, [vendorRecords, filters]);

  const loadData = async () => {
    if (!usuario) {
      console.log('[ProduccionPorVendedor] No hay usuario');
      return;
    }

    console.log('[ProduccionPorVendedor] Iniciando carga de datos...');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-production-sheets`;

      console.log('[ProduccionPorVendedor] Llamando a:', apiUrl);

      const headers = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });

      console.log('[ProduccionPorVendedor] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProduccionPorVendedor] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[ProduccionPorVendedor] Result:', { success: result.success, total: result.total });

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido');
      }

      if (!result.records || !Array.isArray(result.records)) {
        throw new Error('No se recibieron registros del servidor');
      }

      console.log('[ProduccionPorVendedor] Procesando', result.records.length, 'registros...');

      // Agrupar por vendedor
      const grouped = await groupProductionByVendor(result.records);
      console.log('[ProduccionPorVendedor] Agrupados en', grouped.length, 'vendedores');

      setVendorRecords(grouped);
      setLastImport({ imported_at: result.fetched_at });

      console.log('[ProduccionPorVendedor] Carga completada exitosamente');

    } catch (error: any) {
      console.error('[ProduccionPorVendedor] Error completo:', error);
      alert('Error al cargar los datos de producción:\n\n' + error.message + '\n\nAbre la consola del navegador (F12) para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vendorRecords];

    if (filters.searchVendor) {
      filtered = filtered.filter(v =>
        v.vend_nombre.toLowerCase().includes(filters.searchVendor.toLowerCase()) ||
        v.movi_user_name?.toLowerCase().includes(filters.searchVendor.toLowerCase())
      );
    }

    if (filters.mappingStatus === 'mapped') {
      filtered = filtered.filter(v => v.movi_user_id !== null);
    } else if (filters.mappingStatus === 'unmapped') {
      filtered = filtered.filter(v => v.movi_user_id === null);
    }

    if (filters.dateFrom || filters.dateTo || filters.ramo || filters.aseguradora) {
      filtered = filtered.map(vendor => {
        let filteredRegistros = [...vendor.registros];

        if (filters.dateFrom) {
          filteredRegistros = filteredRegistros.filter(r => r.fecha >= filters.dateFrom);
        }
        if (filters.dateTo) {
          filteredRegistros = filteredRegistros.filter(r => r.fecha <= filters.dateTo);
        }
        if (filters.ramo) {
          filteredRegistros = filteredRegistros.filter(r =>
            r.ramo_nombre.toLowerCase().includes(filters.ramo.toLowerCase())
          );
        }
        if (filters.aseguradora) {
          filteredRegistros = filteredRegistros.filter(r =>
            r.aseguradora_nombre.toLowerCase().includes(filters.aseguradora.toLowerCase())
          );
        }

        if (filteredRegistros.length === 0) return null;

        const totalImporte = filteredRegistros.reduce((sum, r) => sum + (r.importe_pesos || 0), 0);
        const totalConvenio = filteredRegistros.reduce((sum, r) => sum + (r.prima_convenio || 0), 0);
        const totalPonderada = filteredRegistros.reduce((sum, r) => sum + (r.prima_ponderada || 0), 0);
        const totalBono = filteredRegistros.reduce((sum, r) => sum + (r.bono || 0), 0);

        return {
          ...vendor,
          registros: filteredRegistros,
          total_records: filteredRegistros.length,
          total_importe_pesos: totalImporte,
          total_prima_convenio: totalConvenio,
          total_prima_ponderada: totalPonderada,
          total_bono: totalBono,
        };
      }).filter(v => v !== null) as VendorProductionRecord[];
    }

    setFilteredVendors(filtered);
  };

  const calculateKPIs = () => {
    const totalImporte = filteredVendors.reduce((sum, v) => sum + v.total_importe_pesos, 0);
    const totalConvenio = filteredVendors.reduce((sum, v) => sum + v.total_prima_convenio, 0);
    const totalPonderada = filteredVendors.reduce((sum, v) => sum + v.total_prima_ponderada, 0);
    const totalBono = filteredVendors.reduce((sum, v) => sum + v.total_bono, 0);
    const totalRecords = filteredVendors.reduce((sum, v) => sum + v.total_records, 0);

    const metricaPrincipal = totalImporte > 0 ? totalImporte : totalConvenio;
    const avgPerVendor = filteredVendors.length > 0 ? metricaPrincipal / filteredVendors.length : 0;

    const mappedVendors = filteredVendors.filter(v => v.movi_user_id !== null).length;
    const unmappedVendors = filteredVendors.filter(v => v.movi_user_id === null).length;

    return {
      totalImporte,
      totalConvenio,
      totalPonderada,
      totalBono,
      totalRecords,
      metricaPrincipal,
      avgPerVendor,
      totalVendors: filteredVendors.length,
      mappedVendors,
      unmappedVendors,
    };
  };

  const exportToExcel = () => {
    const dataToExport = filteredVendors.flatMap(vendor =>
      vendor.registros.map(r => ({
        'Vendedor': vendor.vend_nombre,
        'Usuario MOVI': vendor.movi_user_name || 'Sin asignar',
        'Oficina': vendor.oficina_nombre || '-',
        'Estado Mapeo': vendor.match_method === 'direct_name' ? 'Auto' :
                        vendor.match_method === 'mapping_name' ? 'Manual' : 'Sin asignar',
        'Fecha': r.fecha,
        'Dirección Regional': r.region_raw || '',
        'Gerencia': r.gerencia_nombre_raw || '',
        'Oficina Registro': r.desp_nombre_raw || '',
        'Ramo': r.ramo_nombre,
        'Subramo': r.subramo_nombre || '',
        'Aseguradora': r.aseguradora_nombre,
        'Importe Pesos': r.importe_pesos,
        'Prima Convenio': r.prima_convenio,
        'Prima Ponderada': r.prima_ponderada,
        'Bono': r.bono,
        'Convenio': r.convenio_flag ? 'Sí' : 'No',
      }))
    );

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción por Vendedor');
    XLSX.writeFile(wb, `Produccion_Por_Vendedor_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartDataByVendor = useMemo(() => {
    const useImporte = filteredVendors.some(v => v.total_importe_pesos > 0);

    return filteredVendors
      .map(v => ({
        label: v.movi_user_name || v.vend_nombre,
        value: useImporte ? v.total_importe_pesos : v.total_prima_convenio,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [filteredVendors]);

  const chartDataMappingStatus = useMemo(() => {
    const useImporte = filteredVendors.some(v => v.total_importe_pesos > 0);

    const mapped = filteredVendors
      .filter(v => v.movi_user_id !== null)
      .reduce((sum, v) => sum + (useImporte ? v.total_importe_pesos : v.total_prima_convenio), 0);

    const unmapped = filteredVendors
      .filter(v => v.movi_user_id === null)
      .reduce((sum, v) => sum + (useImporte ? v.total_importe_pesos : v.total_prima_convenio), 0);

    return [
      { label: 'Vendedores Asignados', value: mapped },
      { label: 'Vendedores Sin Asignar', value: unmapped },
    ].filter(d => d.value > 0);
  }, [filteredVendors]);

  const kpis = calculateKPIs();
  const formatCurrency = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
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
                Vista agrupada por VendNombre del Google Sheets
              </p>
              {lastImport && (
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Datos actualizados: {new Date(lastImport.imported_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <button
                  onClick={() => navigate('/produccion/configuracion')}
                  className="flex items-center space-x-2 bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configuración</span>
                </button>
              )}
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-primary-600 flex-shrink-0" />
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

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-primary-200">
            <p className="text-xs sm:text-sm text-primary-700 mb-1 font-medium">Vendedores</p>
            <p className="text-lg sm:text-2xl font-bold text-primary-900">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Buscar Vendedor
                </label>
                <input
                  type="text"
                  value={filters.searchVendor}
                  onChange={(e) => setFilters({ ...filters, searchVendor: e.target.value })}
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
                  onChange={(e) => setFilters({ ...filters, mappingStatus: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="mapped">Asignados</option>
                  <option value="unmapped">Sin asignar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Ramo
                </label>
                <input
                  type="text"
                  value={filters.ramo}
                  onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                  placeholder="Filtrar por ramo..."
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Aseguradora
                </label>
                <input
                  type="text"
                  value={filters.aseguradora}
                  onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                  placeholder="Filtrar por aseguradora..."
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {showFilters && (
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setFilters({
                  searchVendor: '',
                  mappingStatus: 'all',
                  dateFrom: '',
                  dateTo: '',
                  ramo: '',
                  aseguradora: '',
                })}
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

      {filteredVendors.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 mb-4 sm:mb-6">
            Análisis por Vendedor
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
            {filteredVendors.length} vendedor{filteredVendors.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="space-y-2">
          {filteredVendors.map((vendor) => {
            const isExpanded = expandedVendor === vendor.vend_nombre;
            const useImporte = vendor.total_importe_pesos > 0;
            const totalValue = useImporte ? vendor.total_importe_pesos : vendor.total_prima_convenio;

            return (
              <div key={vendor.vend_nombre} className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedVendor(isExpanded ? null : vendor.vend_nombre)}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <p className="text-xs text-neutral-600 mb-1">Importe Pesos</p>
                        <p className="text-sm font-bold text-green-700">
                          {formatCurrency(vendor.total_importe_pesos)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <p className="text-xs text-neutral-600 mb-1">Prima Convenio</p>
                        <p className="text-sm font-bold text-primary-700">
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
                          {vendor.registros.slice(0, 10).map((record, idx) => (
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
                      {vendor.registros.length > 10 && (
                        <p className="text-xs text-neutral-500 text-center mt-2">
                          Mostrando 10 de {vendor.registros.length} registros
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredVendors.length === 0 && (
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
      </div>
    </div>
  );
}
