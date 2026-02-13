import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Users,
  TrendingUp,
  AlertCircle,
  Calendar,
  DollarSign,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Building
} from 'lucide-react';

interface VendorStats {
  usuario_id: string;
  nombre_completo: string;
  email_laboral: string | null;
  vend_id: string;
  vend_nombre: string | null;
  oficina_id: string;
  oficina_nombre: string;
  total_polizas: number;
  total_prima_neta: number;
  total_prima_total: number;
  renovaciones_proximas: number;
  emitidas_mes_actual: number;
  ultima_sincronizacion: string | null;
}

interface GlobalStats {
  total_vendors: number;
  total_polizas: number;
  total_prima_neta: number;
  total_prima_total: number;
  total_renovaciones: number;
  total_emitidas_mes: number;
}

interface Metadata {
  user_rol: string;
  user_oficina_id: string;
  oficina_nombre: string;
  scope: 'all' | 'office';
  fetched_at: string;
}

export default function PanelVendedoresOficina() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorStats[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-office-vendors-production`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setVendors(result.vendors);
      setStats(result.stats);
      setMetadata(result.metadata);

    } catch (error: any) {
      console.error('[Panel Vendedores] Error:', error);
      alert('Error al cargar vendedores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-MX');
  };

  const filteredVendors = vendors.filter(v =>
    v.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email_laboral?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.oficina_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVerDetalle = (usuarioId: string) => {
    // Redirigir al perfil o a una vista detallada
    navigate(`/usuario/${usuarioId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-lg">Cargando vendedores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con metadata */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {metadata?.scope === 'all' ? 'Todos los Vendedores' : `Oficina: ${metadata?.oficina_nombre}`}
              </p>
              <p className="text-xs text-gray-600">
                Actualizado: {metadata ? formatDate(metadata.fetched_at) : '-'}
              </p>
            </div>
          </div>
          <button
            onClick={loadVendors}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 inline mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Vendedores</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_vendors || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Total Pólizas</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_polizas || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Prima Total</p>
              <p className="text-xl font-bold text-green-600">
                {stats ? formatCurrency(stats.total_prima_total) : '$0'}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Prima Neta</p>
              <p className="text-xl font-bold text-blue-600">
                {stats ? formatCurrency(stats.total_prima_neta) : '$0'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Por Renovar</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.total_renovaciones || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Emitidas Mes</p>
              <p className="text-2xl font-bold text-purple-600">{stats?.total_emitidas_mes || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Buscar por nombre, email u oficina..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Lista de Vendedores */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Oficina
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Pólizas
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Por Renovar
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Emitidas Mes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Prima Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <tr
                  key={vendor.usuario_id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {vendor.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {vendor.nombre_completo}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vendor.email_laboral || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {vendor.oficina_nombre}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      {vendor.total_polizas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      vendor.renovaciones_proximas > 0
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {vendor.renovaciones_proximas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                      {vendor.emitidas_mes_actual}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(vendor.total_prima_total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setExpandedVendor(
                        expandedVendor === vendor.usuario_id ? null : vendor.usuario_id
                      )}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {expandedVendor === vendor.usuario_id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron vendedores con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen por Vendedor (Expandible) */}
      {expandedVendor && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          {(() => {
            const vendor = vendors.find(v => v.usuario_id === expandedVendor);
            if (!vendor) return null;

            return (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Detalle: {vendor.nombre_completo}
                  </h3>
                  <button
                    onClick={() => setExpandedVendor(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-1">Pólizas Vigentes</p>
                    <p className="text-3xl font-bold text-blue-900">{vendor.total_polizas}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-700 mb-1">Por Renovar</p>
                    <p className="text-3xl font-bold text-orange-900">{vendor.renovaciones_proximas}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-700 mb-1">Emitidas Mes</p>
                    <p className="text-3xl font-bold text-purple-900">{vendor.emitidas_mes_actual}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 mb-1">Prima Total</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(vendor.total_prima_total)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Email:</span> {vendor.email_laboral || '-'}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Oficina:</span> {vendor.oficina_nombre}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Última Sincronización:</span>{' '}
                    {formatDate(vendor.ultima_sincronizacion)}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleVerDetalle(vendor.usuario_id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ver Perfil Completo
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
