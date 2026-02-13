import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText, DollarSign, Calendar, AlertCircle, Download,
  RefreshCw, Filter, Search, X, TrendingUp, Clock, CheckCircle,
  FolderOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import * as XLSX from 'xlsx';

interface Poliza {
  id: string;
  id_documento: string;
  no_poliza: string;
  aseguradora: string;
  ramo: string;
  subramo: string;
  contratante: string;
  asegurado: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  prima_neta: number;
  prima_total: number;
}

interface Cobranza {
  id: string;
  cliente: string;
  no_poliza: string;
  id_documento: string;
  importe_pendiente: number;
  fecha_limite: string;
  dias_vencidos: number;
  status: string;
}

interface Renovacion {
  id_documento: string;
  no_poliza: string;
  aseguradora: string;
  ramo: string;
  contratante: string;
  vigencia_hasta: string;
  prima_total: number;
  dias_para_vencer: number;
  prioridad_renovacion: string;
}

interface Emision {
  id: string;
  id_documento: string;
  no_poliza: string;
  aseguradora: string;
  ramo: string;
  contratante: string;
  vigencia_desde: string;
  prima_total: number;
}

interface Filters {
  searchText: string;
  aseguradora: string;
  ramo: string;
  fechaDesde: string;
  fechaHasta: string;
  diasRenovacion: number;
}

export default function MiProduccionSICAS() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('polizas');
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sicasDiagnostic, setSicasDiagnostic] = useState<{
    responsenbr: string;
    responsetxt: string;
    message: string;
  } | null>(null);

  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [cobranza, setCobranza] = useState<Cobranza[]>([]);
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [emisionesDelMes, setEmisionesDelMes] = useState<Emision[]>([]);
  const [hasNoData, setHasNoData] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    searchText: '',
    aseguradora: '',
    ramo: '',
    fechaDesde: '',
    fechaHasta: '',
    diasRenovacion: 30,
  });

  const [expandedPoliza, setExpandedPoliza] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) {
      loadData();
    }
  }, [usuario]);

  useEffect(() => {
    // Detectar si no hay datos después de cargar
    if (!loading) {
      const noData = polizas.length === 0 && cobranza.length === 0 &&
                     renovaciones.length === 0 && emisionesDelMes.length === 0;
      setHasNoData(noData);
    }
  }, [loading, polizas, cobranza, renovaciones, emisionesDelMes]);

  const loadData = async () => {
    setLoading(true);
    setSyncMessage(null);
    try {
      await Promise.all([
        loadPolizasVigentes(),
        loadCobranzaPendiente(),
        loadRenovaciones(),
        loadEmisionesDelMes(),
      ]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPolizasVigentes = async () => {
    const { data, error } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*')
      .order('vigencia_hasta', { ascending: true });

    if (!error && data) {
      setPolizas(data);
    } else if (error) {
      console.error('Error al cargar pólizas:', error);
    }
  };

  const loadCobranzaPendiente = async () => {
    const { data, error } = await supabase
      .from('sicas_cobranza_pendiente')
      .select('*')
      .order('dias_vencidos', { ascending: false });

    if (!error && data) {
      setCobranza(data);
    } else if (error) {
      console.error('Error al cargar cobranza:', error);
    }
  };

  const loadRenovaciones = async () => {
    const { data, error } = await supabase
      .from('sicas_renovaciones_proximas')
      .select('*')
      .lte('dias_para_vencer', filters.diasRenovacion)
      .order('dias_para_vencer', { ascending: true });

    if (!error && data) {
      setRenovaciones(data);
    } else if (error) {
      console.error('Error al cargar renovaciones:', error);
    }
  };

  const loadEmisionesDelMes = async () => {
    const { data, error } = await supabase
      .from('sicas_emitidas_mes_actual')
      .select('*')
      .order('vigencia_desde', { ascending: false });

    if (!error && data) {
      setEmisionesDelMes(data);
    } else if (error) {
      console.error('Error al cargar emisiones:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setSicasDiagnostic(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-sync-manual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ syncType: 'completa' }),
        }
      );

      const result = await response.json();

      // Verificar si hay errores en los resultados
      const hasErrors = result.results?.errors?.length > 0;
      const polizasCount = result.results?.polizas_vigentes || result.polizas_vigentes || 0;
      const cobranzaCount = result.results?.cobranza_pendiente || result.cobranza_pendiente || 0;

      if (response.ok && !hasErrors) {
        // Verificar si SICAS devolvió un error interno (metadata con mensaje de error)
        const metadata = result.results?.metadata || result.metadata;
        const hasInternalError = metadata?.message?.includes('Error en Ejecución') ||
                                 metadata?.message?.includes('Proceso Interno') ||
                                 metadata?.message?.includes('Variable de objeto');

        if (hasInternalError) {
          setSicasDiagnostic({
            responsenbr: metadata.responsenbr || '0',
            responsetxt: metadata.responsetxt || 'SUCESS',
            message: metadata.message || 'Error desconocido',
          });
          setSyncMessage({
            type: 'error',
            text: 'SICAS devolvió un error interno. Ver diagnóstico abajo.'
          });
        } else if (polizasCount === 0 && cobranzaCount === 0) {
          setSyncMessage({
            type: 'error',
            text: 'No se encontraron datos en SICAS. Verifica que existan registros.'
          });
        } else {
          setSyncMessage({
            type: 'success',
            text: `Sincronización completada: ${polizasCount} pólizas, ${cobranzaCount} cobranzas`
          });
        }
        await loadData();
      } else {
        const errorMsg = hasErrors
          ? result.results.errors.join(', ')
          : result.error || 'Error desconocido';

        setSyncMessage({
          type: 'error',
          text: `Error en sincronización: ${errorMsg}`
        });
      }
    } catch (error: any) {
      console.error('Error al sincronizar:', error);
      setSyncMessage({
        type: 'error',
        text: `Error de conexión: ${error.message || 'No se pudo conectar con SICAS'}`
      });
    } finally {
      setSyncing(false);
    }
  };

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredPolizas = polizas.filter(p => {
    if (filters.searchText && !p.contratante?.toLowerCase().includes(filters.searchText.toLowerCase()) &&
        !p.no_poliza?.toLowerCase().includes(filters.searchText.toLowerCase())) return false;
    if (filters.aseguradora && p.aseguradora !== filters.aseguradora) return false;
    if (filters.ramo && p.ramo !== filters.ramo) return false;
    if (filters.fechaDesde && p.vigencia_desde < filters.fechaDesde) return false;
    if (filters.fechaHasta && p.vigencia_hasta > filters.fechaHasta) return false;
    return true;
  });

  const filteredCobranza = cobranza.filter(c => {
    if (filters.searchText && !c.cliente?.toLowerCase().includes(filters.searchText.toLowerCase()) &&
        !c.no_poliza?.toLowerCase().includes(filters.searchText.toLowerCase())) return false;
    return true;
  });

  const filteredRenovaciones = renovaciones.filter(r => {
    if (filters.searchText && !r.contratante?.toLowerCase().includes(filters.searchText.toLowerCase()) &&
        !r.no_poliza?.toLowerCase().includes(filters.searchText.toLowerCase())) return false;
    if (filters.aseguradora && r.aseguradora !== filters.aseguradora) return false;
    if (filters.ramo && r.ramo !== filters.ramo) return false;
    return true;
  });

  const filteredEmisiones = emisionesDelMes.filter(e => {
    if (filters.searchText && !e.contratante?.toLowerCase().includes(filters.searchText.toLowerCase()) &&
        !e.no_poliza?.toLowerCase().includes(filters.searchText.toLowerCase())) return false;
    if (filters.aseguradora && e.aseguradora !== filters.aseguradora) return false;
    if (filters.ramo && e.ramo !== filters.ramo) return false;
    return true;
  });

  const totalPolizas = filteredPolizas.length;
  const totalCobranza = filteredCobranza.reduce((sum, c) => sum + (c.importe_pendiente || 0), 0);
  const totalRenovaciones = filteredRenovaciones.length;
  const totalEmisiones = filteredEmisiones.reduce((sum, e) => sum + (e.prima_total || 0), 0);

  const aseguradorasUnicas = Array.from(new Set(polizas.map(p => p.aseguradora).filter(Boolean)));
  const ramosUnicos = Array.from(new Set(polizas.map(p => p.ramo).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Mi Producción SICAS</h1>
            <p className="text-neutral-600 mt-1">Consulta tus pólizas, cobranza y renovaciones</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            syncMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-start gap-3">
              {syncMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{syncMessage.text}</p>
              </div>
              <button
                onClick={() => setSyncMessage(null)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {sicasDiagnostic && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  Diagnóstico: Error en Reporte SICAS H03117
                </h3>
                <p className="text-amber-800 mb-4">
                  La conexión a SICAS funciona correctamente, pero el reporte no devuelve datos.
                </p>

                <div className="bg-white rounded-lg p-4 mb-4 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="font-semibold text-amber-900 min-w-[140px]">Código de respuesta:</span>
                    <span className="text-amber-800">{sicasDiagnostic.responsenbr}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-amber-900 min-w-[140px]">Estado:</span>
                    <span className="text-amber-800">{sicasDiagnostic.responsetxt}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-amber-900 min-w-[140px]">Mensaje de SICAS:</span>
                    <span className="text-amber-800">{sicasDiagnostic.message}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Causa Probable:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                    <li>El reporte H03117 no está disponible para tu usuario</li>
                    <li>Tu usuario no tiene permisos para este reporte</li>
                    <li>Existe un problema interno en SICAS</li>
                    <li>Se requiere usar un código de reporte diferente</li>
                  </ul>
                </div>

                <div className="bg-amber-100 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Acción Requerida
                  </h4>
                  <p className="text-sm text-amber-800 mb-3">
                    Contacta al proveedor de SICAS con la siguiente información:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 mb-3">
                    <li><strong>Código de reporte:</strong> H03117</li>
                    <li><strong>Mensaje de error:</strong> "{sicasDiagnostic.message}"</li>
                    <li><strong>Solicitud:</strong> Código correcto para obtener pólizas vigentes</li>
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">
                    Una vez que tengas el código correcto, actualízalo en: Admin {'>'} SICAS {'>'} Configuración
                  </p>
                </div>

                <button
                  onClick={() => setSicasDiagnostic(null)}
                  className="mt-4 text-sm text-amber-700 hover:text-amber-900 underline"
                >
                  Cerrar diagnóstico
                </button>
              </div>
            </div>
          </div>
        )}

        {hasNoData && !loading && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  No hay datos de producción disponibles
                </h3>
                <p className="text-blue-800 mb-4">
                  Para visualizar tus pólizas, cobranza y renovaciones, primero debes sincronizar
                  los datos desde SICAS. Este proceso consultará el sistema SICAS y guardará
                  la información en caché para consulta rápida.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Sincronizando desde SICAS...' : 'Sincronizar Ahora'}
                  </button>
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-4 py-2 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span>La sincronización puede tardar 1-2 minutos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Filtros</h3>
              <button
                onClick={() => setFilters({
                  searchText: '',
                  aseguradora: '',
                  ramo: '',
                  fechaDesde: '',
                  fechaHasta: '',
                  diasRenovacion: 30,
                })}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Limpiar filtros
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                    placeholder="Cliente o póliza..."
                    className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Aseguradora</label>
                <select
                  value={filters.aseguradora}
                  onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Todas</option>
                  {aseguradorasUnicas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Ramo</label>
                <select
                  value={filters.ramo}
                  onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {ramosUnicos.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {activeTab === 'renovaciones' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Días para vencimiento</label>
                  <select
                    value={filters.diasRenovacion}
                    onChange={(e) => {
                      setFilters({ ...filters, diasRenovacion: parseInt(e.target.value) });
                      loadRenovaciones();
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="7">7 días</option>
                    <option value="15">15 días</option>
                    <option value="30">30 días</option>
                    <option value="45">45 días</option>
                    <option value="60">60 días</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Pólizas Vigentes</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{totalPolizas}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Cobranza Pendiente</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  ${totalCobranza.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Por Renovar</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{totalRenovaciones}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Emisiones del Mes</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  ${totalEmisiones.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-lg border border-neutral-200">
          <TabsList className="w-full grid grid-cols-4 border-b border-neutral-200">
            <TabsTrigger value="polizas" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pólizas Vigentes
            </TabsTrigger>
            <TabsTrigger value="cobranza" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Cobranza Pendiente
            </TabsTrigger>
            <TabsTrigger value="renovaciones" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Por Renovar
            </TabsTrigger>
            <TabsTrigger value="emitidas" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Emitidas del Mes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="polizas" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">
                {filteredPolizas.length} póliza{filteredPolizas.length !== 1 ? 's' : ''} vigente{filteredPolizas.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => exportToExcel(filteredPolizas, 'polizas_vigentes')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
            </div>
            <div className="space-y-2">
              {filteredPolizas.map(poliza => (
                <div key={poliza.id} className="border border-neutral-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedPoliza(expandedPoliza === poliza.id ? null : poliza.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-neutral-900">{poliza.no_poliza}</p>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {poliza.aseguradora}
                        </span>
                        <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-full">
                          {poliza.ramo}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{poliza.contratante}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                        <span>Vigencia: {new Date(poliza.vigencia_desde).toLocaleDateString('es-MX')} - {new Date(poliza.vigencia_hasta).toLocaleDateString('es-MX')}</span>
                        <span className="font-semibold text-green-700">
                          ${poliza.prima_total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    {expandedPoliza === poliza.id ? (
                      <ChevronUp className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    )}
                  </button>

                  {expandedPoliza === poliza.id && (
                    <div className="border-t border-neutral-200 bg-neutral-50 p-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-neutral-600">Asegurado</p>
                          <p className="text-sm font-medium text-neutral-900">{poliza.asegurado || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-600">Subramo</p>
                          <p className="text-sm font-medium text-neutral-900">{poliza.subramo || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-600">Prima Neta</p>
                          <p className="text-sm font-medium text-neutral-900">
                            ${poliza.prima_neta?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-600">Prima Total</p>
                          <p className="text-sm font-medium text-green-700">
                            ${poliza.prima_total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Ver Centro Digital
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cobranza" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">
                {filteredCobranza.length} cobranza{filteredCobranza.length !== 1 ? 's' : ''} pendiente{filteredCobranza.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => exportToExcel(filteredCobranza, 'cobranza_pendiente')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
            </div>
            <div className="space-y-2">
              {filteredCobranza.map(cobro => (
                <div key={cobro.id} className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-neutral-900">{cobro.no_poliza}</p>
                        {cobro.dias_vencidos > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            {cobro.dias_vencidos} días vencidos
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{cobro.cliente}</p>
                      {cobro.fecha_limite && (
                        <p className="text-xs text-neutral-500 mt-1">
                          Límite: {new Date(cobro.fecha_limite).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        ${cobro.importe_pendiente?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-neutral-500">{cobro.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="renovaciones" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">
                {filteredRenovaciones.length} póliza{filteredRenovaciones.length !== 1 ? 's' : ''} por renovar
              </h3>
              <button
                onClick={() => exportToExcel(filteredRenovaciones, 'renovaciones_proximas')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
            </div>
            <div className="space-y-2">
              {filteredRenovaciones.map((renovacion, index) => (
                <div key={index} className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-neutral-900">{renovacion.no_poliza}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          renovacion.prioridad_renovacion === 'alta'
                            ? 'bg-red-100 text-red-700'
                            : renovacion.prioridad_renovacion === 'media'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {renovacion.dias_para_vencer} días
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {renovacion.aseguradora}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{renovacion.contratante}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Vence: {new Date(renovacion.vigencia_hasta).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-700">
                        ${renovacion.prima_total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-neutral-500">{renovacion.ramo}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="emitidas" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">
                {filteredEmisiones.length} póliza{filteredEmisiones.length !== 1 ? 's' : ''} emitida{filteredEmisiones.length !== 1 ? 's' : ''} este mes
              </h3>
              <button
                onClick={() => exportToExcel(filteredEmisiones, 'emitidas_mes')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
            </div>
            <div className="space-y-2">
              {filteredEmisiones.map(emision => (
                <div key={emision.id} className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-neutral-900">{emision.no_poliza}</p>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {emision.aseguradora}
                        </span>
                        <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-full">
                          {emision.ramo}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{emision.contratante}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Emitida: {new Date(emision.vigencia_desde).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-700">
                        ${emision.prima_total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
