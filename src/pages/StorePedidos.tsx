import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, Filter, Download, Search, Calendar, ArrowLeft } from 'lucide-react';
import { obtenerTodosPedidos } from '../lib/storeUtils';
import type { StorePedido } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function StorePedidos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<StorePedido[]>([]);
  const [pedidosFiltrados, setPedidosFiltrados] = useState<StorePedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/store');
      return;
    }
    cargarPedidos();
  }, [usuario]);

  useEffect(() => {
    aplicarFiltros();
  }, [pedidos, filtroEstatus, busqueda]);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      console.log('🔍 Administrador cargando TODOS los pedidos del sistema...');
      const data = await obtenerTodosPedidos();
      console.log(`✅ Pedidos cargados: ${data.length} pedidos de ${new Set(data.map(p => p.usuario_id)).size} usuarios diferentes`);
      setPedidos(data);
    } catch (error) {
      console.error('❌ Error cargando pedidos:', error);
      alert('Error al cargar pedidos. Verifica la consola para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let resultado = [...pedidos];

    if (filtroEstatus) {
      resultado = resultado.filter(p => p.estatus_id === filtroEstatus);
    }

    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.id.toLowerCase().includes(busquedaLower) ||
        p.usuario?.nombre?.toLowerCase().includes(busquedaLower)
      );
    }

    setPedidosFiltrados(resultado);
  };

  const getEstatusColor = (estatusNombre: string) => {
    const colors: Record<string, string> = {
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Procesando': 'bg-blue-100 text-blue-800',
      'Enviado': 'bg-purple-100 text-purple-800',
      'Entregado': 'bg-green-100 text-green-800',
      'Cancelado': 'bg-red-100 text-red-800'
    };
    return colors[estatusNombre] || 'bg-gray-100 text-gray-800';
  };

  const estatusUnicos = Array.from(new Set(pedidos.map(p => p.estatus?.nombre).filter(Boolean)));

  const calcularEstadisticas = () => {
    const total = pedidosFiltrados.length;
    const pendientes = pedidosFiltrados.filter(p => p.estatus?.nombre === 'Pendiente').length;
    const procesando = pedidosFiltrados.filter(p => p.estatus?.nombre === 'Procesando').length;
    const entregados = pedidosFiltrados.filter(p => p.estatus?.nombre === 'Entregado').length;

    return { total, pendientes, procesando, entregados };
  };

  const stats = calcularEstadisticas();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/store')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Volver al Store</span>
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-600">Gestión de Pedidos</h1>
            <p className="text-gray-600 mt-1">
              Administra todos los pedidos del Store
              {pedidos.length > 0 && (
                <span className="ml-2 text-sm font-semibold text-blue-600">
                  • {pedidos.length} pedidos de {new Set(pedidos.map(p => p.usuario_id)).size} usuarios
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pedidos</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600 mt-1">{stats.pendientes}</p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Procesando</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{stats.procesando}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Entregados</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{stats.entregados}</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por ID o cliente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filtroEstatus}
                onChange={(e) => setFiltroEstatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estatus</option>
                {estatusUnicos.map(estatus => (
                  <option key={estatus} value={pedidos.find(p => p.estatus?.nombre === estatus)?.estatus_id}>
                    {estatus}
                  </option>
                ))}
              </select>
            </div>

            {pedidosFiltrados.length > 0 && (
              <button
                onClick={() => alert('Función de exportar en desarrollo')}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <Download className="w-5 h-5" />
                Exportar
              </button>
            )}
          </div>
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {busqueda || filtroEstatus ? 'No se encontraron pedidos' : 'No hay pedidos aún'}
            </h3>
            <p className="text-gray-500">
              {busqueda || filtroEstatus ? 'Intenta con otros filtros' : 'Los pedidos aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ID Pedido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estatus
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pedidosFiltrados.map(pedido => (
                    <tr key={pedido.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          {pedido.id.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{pedido.usuario?.nombre || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {format(new Date(pedido.created_at), "d MMM yyyy", { locale: es })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          ${pedido.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getEstatusColor(pedido.estatus?.nombre || 'Pendiente')}`}>
                          {pedido.estatus?.nombre || 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => navigate(`/store/pedido/${pedido.id}`)}
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Mostrando {pedidosFiltrados.length} de {pedidos.length} pedidos
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
