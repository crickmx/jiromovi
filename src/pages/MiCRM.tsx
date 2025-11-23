import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  Shield,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Target,
  Clock,
} from 'lucide-react';
import {
  obtenerEstadisticasDashboard,
  obtenerDatosFunnel,
  obtenerTareasPendientes,
} from '../lib/crmUtils';
import type { DashboardStats, FunnelData } from '../lib/crmTypes';

export default function MiCRM() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [tareasPendientes, setTareasPendientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [statsData, funnelData, tareasData] = await Promise.all([
        obtenerEstadisticasDashboard(),
        obtenerDatosFunnel(),
        obtenerTareasPendientes(5),
      ]);
      setStats(statsData);
      setFunnel(funnelData);
      setTareasPendientes(tareasData);
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mi CRM</h1>
        <p className="text-gray-600 mt-1">Gestiona tus prospectos, clientes y ventas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Contactos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalContactos || 0}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clientes Activos</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats?.totalClientes || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cotizaciones</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {stats?.totalCotizaciones || 0}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pólizas Activas</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats?.totalPolizas || 0}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Embudo de Ventas</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Prospectos</span>
                  <span className="text-sm font-bold text-gray-900">{funnel?.prospectos || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${funnel?.prospectos ? (funnel.prospectos / (stats?.totalContactos || 1)) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Cotización Presentada</span>
                  <span className="text-sm font-bold text-gray-900">
                    {funnel?.cotizacionPresentada || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${funnel?.cotizacionPresentada ? (funnel.cotizacionPresentada / (stats?.totalContactos || 1)) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Negociación</span>
                  <span className="text-sm font-bold text-gray-900">
                    {funnel?.negociacion || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${funnel?.negociacion ? (funnel.negociacion / (stats?.totalContactos || 1)) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Clientes</span>
                  <span className="text-sm font-bold text-gray-900">{funnel?.clientes || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${funnel?.clientes ? (funnel.clientes / (stats?.totalContactos || 1)) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Tasa de Conversión</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.tasaConversion.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Prima Total</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${(stats?.primaTotal || 0).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-gray-600" />
              Tareas Pendientes
            </h2>
            <div className="space-y-3">
              {tareasPendientes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay tareas pendientes
                </p>
              ) : (
                tareasPendientes.map((tarea) => (
                  <Link
                    key={tarea.id}
                    to={`/mi-crm/contactos/${tarea.contacto_id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {tarea.tipo_actividad}
                    </p>
                    <p className="text-xs text-gray-600 mb-2">{tarea.descripcion}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {tarea.crm_contactos?.nombre_completo}
                      </span>
                      <span className="text-xs font-medium text-orange-600">
                        {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <Link
              to="/mi-crm/contactos"
              className="block w-full mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos los contactos
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/mi-crm/contactos"
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition"
        >
          <Users className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Contactos</h3>
          <p className="text-sm text-blue-100">Gestiona prospectos y clientes</p>
        </Link>

        <Link
          to="/mi-crm/reportes"
          className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition"
        >
          <Target className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Reportes</h3>
          <p className="text-sm text-purple-100">Analiza tu desempeño</p>
        </Link>

        <Link
          to="/mi-crm/configuracion"
          className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition"
        >
          <FileText className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-semibold mb-1">Configuración</h3>
          <p className="text-sm text-gray-100">Personaliza tu CRM</p>
        </Link>
      </div>
    </div>
  );
}
