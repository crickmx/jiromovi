import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Building,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PolizaVigente {
  id: string;
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  contratante: string | null;
  asegurado: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number | null;
  prima_total: number | null;
  synced_at: string;
}

interface Stats {
  total_polizas: number;
  total_prima_neta: number;
  total_prima_total: number;
  por_ramo: Record<string, { count: number; total: number }>;
  por_aseguradora: Record<string, { count: number; total: number }>;
}

type ViewMode = 'vigentes' | 'renovar' | 'emitidas';

export default function PanelAgenteProduccion() {
  const [loading, setLoading] = useState(true);
  const [noMapping, setNoMapping] = useState(false);
  const [polizas, setPolizas] = useState<PolizaVigente[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('vigentes');
  const [renovacionesCount, setRenovacionesCount] = useState(0);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 20;

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [ramoFilter, setRamoFilter] = useState('');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadPolizas();
  }, [viewMode, currentPage, searchTerm, ramoFilter, aseguradoraFilter]);

  const loadPolizas = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-sicas-polizas`;

      const params = new URLSearchParams({
        view: viewMode,
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(ramoFilter && { ramo: ramoFilter }),
        ...(aseguradoraFilter && { aseguradora: aseguradoraFilter }),
      });

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error === 'no_mapping') {
          setNoMapping(true);
          return;
        }
        throw new Error(result.error);
      }

      setPolizas(result.polizas);
      setStats(result.stats);
      setTotalPages(result.pagination.totalPages);
      setTotalRecords(result.pagination.total);
      setRenovacionesCount(result.widgets?.renovaciones_proximas || 0);
      setNoMapping(false);

    } catch (error: any) {
      console.error('[Panel Agente] Error:', error);
      alert('Error al cargar tus pólizas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (polizas.length === 0) return;

    const dataToExport = polizas.map(p => ({
      'No. Póliza': p.no_poliza || '-',
      'Aseguradora': p.aseguradora || '-',
      'Ramo': p.ramo || '-',
      'Subramo': p.subramo || '-',
      'Contratante': p.contratante || '-',
      'Asegurado': p.asegurado || '-',
      'Vigencia Desde': p.vigencia_desde || '-',
      'Vigencia Hasta': p.vigencia_hasta || '-',
      'Prima Neta': p.prima_neta || 0,
      'Prima Total': p.prima_total || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pólizas');
    XLSX.writeFile(wb, `mi-produccion-${viewMode}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX');
  };

  const getDiasParaVencer = (vigenciaHasta: string | null): number | null => {
    if (!vigenciaHasta) return null;
    const hoy = new Date();
    const vencimiento = new Date(vigenciaHasta);
    const diff = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getPrioridadColor = (dias: number | null): string => {
    if (dias === null) return 'text-gray-500';
    if (dias <= 7) return 'text-red-600 font-bold';
    if (dias <= 15) return 'text-orange-600 font-semibold';
    if (dias <= 30) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading && polizas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="ml-3 text-lg">Cargando tus pólizas...</span>
      </div>
    );
  }

  if (noMapping) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-8 w-8 text-yellow-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Vendedor SICAS no asignado
            </h3>
            <p className="text-gray-700 mb-4">
              Aún no tienes un vendedor SICAS vinculado a tu cuenta. Esto es necesario para ver tu producción individual.
            </p>
            <p className="text-gray-600">
              Por favor, contacta al administrador o gerente para que te asignen un vendedor SICAS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pólizas Vigentes</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_polizas || 0}</p>
            </div>
            <FileText className="h-10 w-10 text-accent" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Por Renovar (60d)</p>
              <p className="text-3xl font-bold text-orange-600">{renovacionesCount}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prima Total</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats?.total_prima_total || 0)}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prima Neta</p>
              <p className="text-2xl font-bold text-accent">
                {formatCurrency(stats?.total_prima_neta || 0)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-accent" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 p-4">
            <button
              onClick={() => { setViewMode('vigentes'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'vigentes'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="inline h-4 w-4 mr-2" />
              Pólizas Vigentes
            </button>
            <button
              onClick={() => { setViewMode('renovar'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'renovar'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="inline h-4 w-4 mr-2" />
              Por Renovar
              {renovacionesCount > 0 && (
                <span className="ml-2 px-2 py-1 bg-white text-orange-600 rounded-full text-xs font-bold">
                  {renovacionesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setViewMode('emitidas'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'emitidas'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="inline h-4 w-4 mr-2" />
              Emitidas Este Mes
            </button>
          </div>
        </div>

        {/* Barra de acciones */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por contratante, asegurado o no. póliza..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Filter className="h-4 w-4 inline mr-2" />
                Filtros
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadPolizas}
                disabled={loading}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 inline mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4 inline mr-2" />
                Exportar
              </button>
            </div>
          </div>

          {/* Filtros expandibles */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ramo</label>
                <select
                  value={ramoFilter}
                  onChange={(e) => { setRamoFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent"
                >
                  <option value="">Todos</option>
                  {stats && Object.keys(stats.por_ramo).map(ramo => (
                    <option key={ramo} value={ramo}>
                      {ramo} ({stats.por_ramo[ramo].count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aseguradora</label>
                <select
                  value={aseguradoraFilter}
                  onChange={(e) => { setAseguradoraFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent"
                >
                  <option value="">Todas</option>
                  {stats && Object.keys(stats.por_aseguradora).map(aseg => (
                    <option key={aseg} value={aseg}>
                      {aseg} ({stats.por_aseguradora[aseg].count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Tabla de pólizas */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">No. Póliza</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aseguradora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ramo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contratante</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vigencia</th>
                {viewMode === 'renovar' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Días</th>
                )}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Prima Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {polizas.map((poliza) => {
                const diasVencer = getDiasParaVencer(poliza.vigencia_hasta);
                return (
                  <tr key={poliza.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {poliza.no_poliza || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{poliza.aseguradora || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{poliza.ramo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="max-w-xs truncate" title={poliza.contratante || '-'}>
                        {poliza.contratante || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(poliza.vigencia_desde)} - {formatDate(poliza.vigencia_hasta)}
                    </td>
                    {viewMode === 'renovar' && (
                      <td className={`px-4 py-3 text-sm ${getPrioridadColor(diasVencer)}`}>
                        {diasVencer !== null ? `${diasVencer} días` : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(poliza.prima_total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {polizas.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No se encontraron pólizas con los filtros seleccionados</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              Mostrando {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalRecords)} de {totalRecords}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
