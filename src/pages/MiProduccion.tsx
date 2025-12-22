import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, FileText, Building, Download, AlertCircle, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import GraficaLinea from '../components/produccion/GraficaLinea';
import FiltrosProduccionAgente from '../components/produccion/FiltrosProduccionAgente';

interface ProductionFilters {
  fechaDesde: string;
  fechaHasta: string;
  ramos: string[];
  aseguradoras: string[];
}

interface ProductionRecord {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  concepto: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
}

interface KPIs {
  total_produccion: number;
  total_documentos: number;
  aseguradora_top: string | null;
  ramo_top: string | null;
}

interface ChartData {
  produccion_por_ramo: Array<{ ramo: string; total: number }>;
  produccion_por_aseguradora: Array<{ aseguradora: string; total: number }>;
  evolucion_temporal: Array<{ mes: string; total: number }>;
}

export default function MiProduccion() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [allRecordsForExport, setAllRecordsForExport] = useState<ProductionRecord[]>([]);
  const [fechaActualizacion, setFechaActualizacion] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [kpis, setKpis] = useState<KPIs>({
    total_produccion: 0,
    total_documentos: 0,
    aseguradora_top: null,
    ramo_top: null,
  });
  const [charts, setCharts] = useState<ChartData>({
    produccion_por_ramo: [],
    produccion_por_aseguradora: [],
    evolucion_temporal: [],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'fecha' | 'importe'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [filters, setFilters] = useState<ProductionFilters>({
    fechaDesde: '',
    fechaHasta: '',
    ramos: [],
    aseguradoras: [],
  });

  const [availableRamos, setAvailableRamos] = useState<string[]>([]);
  const [availableAseguradoras, setAvailableAseguradoras] = useState<string[]>([]);

  useEffect(() => {
    loadMyProduction();
  }, [usuario, filters, currentPage, pageSize]);

  const loadMyProduction = async () => {
    if (!usuario) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-production`;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(filters.fechaDesde && { fechaDesde: filters.fechaDesde }),
        ...(filters.fechaHasta && { fechaHasta: filters.fechaHasta }),
        ...(filters.ramos.length > 0 && { ramos: filters.ramos.join(',') }),
        ...(filters.aseguradoras.length > 0 && { aseguradoras: filters.aseguradoras.join(',') }),
      });

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setVendorName(result.vendor_nombre);
        setRecords(result.records || []);
        setKpis(result.kpis || {});
        setCharts(result.charts || {});
        setTotalPages(result.pagination?.totalPages || 0);
        setMessage(result.message || null);
        setFechaActualizacion(result.fecha_actualizacion || null);
        setBatchInfo(result.batch_info || null);

        if (currentPage === 1) {
          const allRecordsParams = new URLSearchParams({
            page: '1',
            limit: '10000',
            ...(filters.fechaDesde && { fechaDesde: filters.fechaDesde }),
            ...(filters.fechaHasta && { fechaHasta: filters.fechaHasta }),
            ...(filters.ramos.length > 0 && { ramos: filters.ramos.join(',') }),
            ...(filters.aseguradoras.length > 0 && { aseguradoras: filters.aseguradoras.join(',') }),
          });

          const allResponse = await fetch(`${apiUrl}?${allRecordsParams}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            }
          });

          if (allResponse.ok) {
            const allResult = await allResponse.json();
            if (allResult.success) {
              setAllRecordsForExport(allResult.records || []);

              const uniqueRamos = Array.from(new Set(allResult.records.map((r: ProductionRecord) => r.ramo_nombre))).sort();
              const uniqueAseguradoras = Array.from(new Set(allResult.records.map((r: ProductionRecord) => r.aseguradora_nombre))).sort();
              setAvailableRamos(uniqueRamos as string[]);
              setAvailableAseguradoras(uniqueAseguradoras as string[]);
            }
          }
        }
      }

    } catch (error: any) {
      console.error('[MiProduccion] Error:', error);

      // Determinar el mensaje de error apropiado
      let errorMessage = 'Error al cargar tu producción.';

      if (error.message?.includes('HTTP 500') || error.message?.includes('HTTP 503')) {
        errorMessage = 'No se pudo actualizar la información en este momento. Mostrando última versión disponible.';
      } else if (error.message?.includes('asociado')) {
        errorMessage = 'Tu producción está pendiente de asignación. Contacta al administrador.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      setMessage(errorMessage);
      setRecords([]);
      setKpis({
        total_produccion: 0,
        total_documentos: 0,
        aseguradora_top: null,
        ramo_top: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.aseguradora_nombre?.toLowerCase().includes(search) ||
        r.ramo_nombre?.toLowerCase().includes(search) ||
        r.subramo_nombre?.toLowerCase().includes(search)
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === 'fecha') {
        const dateA = new Date(a.fecha).getTime();
        const dateB = new Date(b.fecha).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const valA = a.importe_pesos > 0 ? a.importe_pesos : a.prima_convenio;
        const valB = b.importe_pesos > 0 ? b.importe_pesos : b.prima_convenio;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return filtered;
  }, [records, searchTerm, sortBy, sortOrder]);

  const exportToExcel = () => {
    if (allRecordsForExport.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const dataSheet = allRecordsForExport.map(record => ({
      'Fecha': new Date(record.fecha).toLocaleDateString('es-MX'),
      'Periodo': record.periodo_mes,
      'Aseguradora': record.aseguradora_nombre,
      'Ramo': record.ramo_nombre,
      'Subramo': record.subramo_nombre || '-',
      'Región': record.region_raw || '-',
      'Importe Pesos': record.importe_pesos,
      'Prima Convenio': record.prima_convenio,
      'Prima Ponderada': record.prima_ponderada,
      'Bono': record.bono,
      'Convenio': record.convenio_flag ? 'Sí' : 'No',
    }));

    const resumenSheet = [
      { 'Indicador': 'Producción Total', 'Valor': kpis.total_produccion },
      { 'Indicador': 'Total Documentos', 'Valor': kpis.total_documentos },
      { 'Indicador': 'Aseguradora Top', 'Valor': kpis.aseguradora_top || '-' },
      { 'Indicador': 'Ramo Top', 'Valor': kpis.ramo_top || '-' },
    ];

    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(dataSheet);
    const wsResumen = XLSX.utils.json_to_sheet(resumenSheet);

    XLSX.utils.book_append_sheet(wb, wsData, 'Documentos');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    const today = new Date().toISOString().split('T')[0];
    const filename = `produccion_${vendorName?.replace(/\s+/g, '_')}_${filters.fechaDesde || 'inicio'}_${filters.fechaHasta || today}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const handleRefreshCache = async () => {
    if (syncing) return;

    setSyncing(true);
    setMessage('Actualizando asignación de vendedores...');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!import.meta.env.VITE_SUPABASE_URL) {
        setMessage('Error de configuración: La URL de Supabase no está configurada. Verifica las variables de entorno.');
        return;
      }

      // Usar la función rápida que lee desde la base de datos
      const cacheApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-production-cache`;
      const cacheResponse = await fetch(cacheApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!cacheResponse.ok) {
        const contentType = cacheResponse.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error(`La función de actualización no está disponible (HTTP ${cacheResponse.status}). Verifica que las variables de entorno estén configuradas correctamente en Netlify.`);
        }
        throw new Error(`HTTP ${cacheResponse.status}: ${cacheResponse.statusText}`);
      }

      const cacheResult = await cacheResponse.json();

      if (cacheResult.success) {
        setMessage(null);
        // Recargar datos inmediatamente
        await loadMyProduction();
      } else {
        setMessage(`Error al actualizar: ${cacheResult.error || 'Error desconocido'}`);
      }
    } catch (error: any) {
      console.error('[MiProduccion] Error refreshing cache:', error);
      setMessage(`Error al actualizar: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncProduction = async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!import.meta.env.VITE_SUPABASE_URL) {
        setMessage('Error de configuración: La URL de Supabase no está configurada. Verifica las variables de entorno.');
        return;
      }

      // Paso 1: Sincronizar datos de Google Sheets
      setMessage('Sincronizando datos desde Google Sheets...');
      const syncApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-production-from-sheets`;
      const syncResponse = await fetch(syncApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!syncResponse.ok) {
        const contentType = syncResponse.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error(`La función de Supabase no está disponible (HTTP ${syncResponse.status}). Verifica que las variables de entorno estén configuradas correctamente en Netlify.`);
        }
        throw new Error(`HTTP ${syncResponse.status}: ${syncResponse.statusText}`);
      }

      const syncResult = await syncResponse.json();

      if (!syncResult.success) {
        setMessage(`Error en sincronización: ${syncResult.error || 'Error desconocido'}`);
        return;
      }

      // Paso 2: Actualizar cache de vendedores (función rápida desde DB)
      setMessage('Actualizando cache de vendedores...');
      const cacheApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-production-cache`;
      const cacheResponse = await fetch(cacheApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!cacheResponse.ok) {
        const contentType = cacheResponse.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error(`La función de actualización de cache no está disponible (HTTP ${cacheResponse.status}). Verifica que las variables de entorno estén configuradas correctamente en Netlify.`);
        }
        throw new Error(`HTTP ${cacheResponse.status}: ${cacheResponse.statusText}`);
      }

      const cacheResult = await cacheResponse.json();

      if (cacheResult.success) {
        setMessage(`Sincronización completada: ${syncResult.rows_inserted} registros insertados. Cache actualizado con ${cacheResult.synced_count} vendedores.`);
      } else {
        setMessage(`Datos sincronizados (${syncResult.rows_inserted} registros), pero hubo un problema al actualizar el cache de vendedores.`);
      }

      // Paso 3: Recargar datos
      await loadMyProduction();
    } catch (error: any) {
      console.error('[MiProduccion] Error syncing:', error);
      setMessage(`Error al sincronizar: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading && records.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando tu producción...</p>
        </div>
      </div>
    );
  }

  if (message && !vendorName) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Sin Vendedor Asignado
          </h2>
          <p className="text-neutral-700 mb-4">{message}</p>
          <p className="text-sm text-neutral-600 mb-6">
            Si ya tienes un vendedor asignado, intenta actualizar el sistema. Si el problema persiste, contacta al administrador.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRefreshCache}
              disabled={syncing}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Actualizar Sistema
                </>
              )}
            </button>
            {(usuario?.rol === 'admin' || usuario?.rol === 'gerente') && (
              <button
                onClick={handleSyncProduction}
                disabled={syncing}
                className="px-6 py-2.5 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar Google Sheets
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-display font-bold text-primary-600 mb-2">
                Mi Producción
              </h1>
              <p className="text-neutral-600">
                Resumen de tu producción como <span className="font-semibold text-primary-600">{vendorName}</span>
              </p>
              {fechaActualizacion && (
                <p className="text-sm text-neutral-500 mt-2">
                  Última actualización: <span className="font-medium">{new Date(fechaActualizacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </p>
              )}
            </div>

            {(usuario?.rol === 'admin' || usuario?.rol === 'gerente') && (
              <button
                onClick={handleSyncProduction}
                disabled={syncing}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  syncing
                    ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando...' : 'Recargar información'}</span>
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-700 font-medium">Producción Total</p>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(kpis.total_produccion)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-blue-700 font-medium">Documentos</p>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {kpis.total_documentos}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-orange-600" />
              <p className="text-sm text-orange-700 font-medium">Aseguradora Top</p>
            </div>
            <p className="text-sm font-bold text-orange-900 truncate" title={kpis.aseguradora_top || ''}>
              {kpis.aseguradora_top || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4 border border-teal-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <p className="text-sm text-teal-700 font-medium">Ramo Top</p>
            </div>
            <p className="text-sm font-bold text-teal-900 truncate" title={kpis.ramo_top || ''}>
              {kpis.ramo_top || '-'}
            </p>
          </div>
        </div>

        <FiltrosProduccionAgente
          filters={filters}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters);
            setCurrentPage(1);
          }}
          availableRamos={availableRamos}
          availableAseguradoras={availableAseguradoras}
        />
      </div>

      {charts.produccion_por_ramo.length > 0 && (
        <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">
            Análisis de Producción
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <GraficaColumnas
              data={charts.produccion_por_ramo.map(d => ({ label: d.ramo, value: d.total }))}
              title="Producción por Ramo"
              valueFormatter={formatCurrency}
              height={280}
            />
            <GraficaCircular
              data={charts.produccion_por_aseguradora.map(d => ({ label: d.aseguradora, value: d.total }))}
              title="Producción por Aseguradora"
              valueFormatter={formatCurrency}
              size={220}
            />
          </div>

          {charts.evolucion_temporal.length > 1 && (
            <div>
              <GraficaLinea
                data={charts.evolucion_temporal.map(d => ({ label: d.mes, value: d.total }))}
                title="Evolución Temporal"
                valueFormatter={formatCurrency}
                height={280}
              />
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">
            Lista de Documentos
          </h2>
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por aseguradora, ramo o subramo..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'fecha' | 'importe')}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="fecha">Por Fecha</option>
              <option value="importe">Por Importe</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">Aseguradora</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900">Ramo</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-900">Importe</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record, idx) => (
                  <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {new Date(record.fecha).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{record.aseguradora_nombre}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{record.ramo_nombre}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">
                      {formatCurrency(record.importe_pesos > 0 ? record.importe_pesos : record.prima_convenio)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    No se encontraron documentos con los filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
