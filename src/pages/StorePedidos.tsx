import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, Filter, Download, Search, Calendar, ArrowLeft, Trash2 } from 'lucide-react';
import { obtenerTodosPedidos, eliminarPedido } from '../lib/storeUtils';
import type { StorePedido } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export default function StorePedidos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<StorePedido[]>([]);
  const [pedidosFiltrados, setPedidosFiltrados] = useState<StorePedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [pedidoAEliminar, setPedidoAEliminar] = useState<StorePedido | null>(null);
  const [eliminando, setEliminando] = useState(false);

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
        p.folio_oc?.toLowerCase().includes(busquedaLower) ||
        p.usuario?.nombre?.toLowerCase().includes(busquedaLower)
      );
    }

    setPedidosFiltrados(resultado);
  };

  const handleEliminarPedido = async () => {
    if (!pedidoAEliminar) return;

    try {
      setEliminando(true);
      await eliminarPedido(pedidoAEliminar.id);
      await cargarPedidos();
      setPedidoAEliminar(null);
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      alert('Error al eliminar el pedido. Por favor intenta de nuevo.');
    } finally {
      setEliminando(false);
    }
  };

  const getEstatusColor = (estatusNombre: string) => {
    const colors: Record<string, string> = {
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Procesando': 'bg-primary-100 text-primary-800',
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

  const exportarAExcel = () => {
    // Crear una fila por cada producto en cada pedido
    const datosExportar: any[] = [];

    pedidosFiltrados.forEach(pedido => {
      const detalles = pedido.detalles || [];
      console.log('📦 Pedido:', pedido.folio_oc, 'Detalles:', detalles.length, detalles);

      if (detalles.length === 0) {
        // Si no hay detalles, crear una fila con la información del pedido
        datosExportar.push({
          'Folio OC': pedido.folio_oc || 'Pendiente',
          'Estado': pedido.estatus?.nombre || 'Pendiente',
          'Fecha Pedido': format(new Date(pedido.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
          'Nombre Completo': pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A',
          'Usuario SICAS': pedido.usuario?.nombre_sicas || 'Sin usuario SICAS relacionado',
          'Oficina': pedido.usuario?.oficina || 'N/A',
          'Teléfono': pedido.usuario?.celular_laboral || pedido.usuario?.celular_personal || 'N/A',
          'Email': pedido.usuario?.email_laboral || 'N/A',
          'Dirección Entrega': pedido.direccion_entrega || 'No especificada',
          'Forma de Pago': pedido.forma_pago || 'N/A',
          'Método de Pago': pedido.metodo_pago === 'Otro'
            ? `Otro: ${pedido.metodo_pago_otro_detalle || 'N/A'}`
            : (pedido.metodo_pago || 'N/A'),
          'Responsable de Pago': pedido.responsable_pago
            ? (pedido.responsable_pago.nombre_completo || pedido.responsable_pago.nombre || 'N/A')
            : 'N/A',
          'Código Producto': 'N/A',
          'Producto': 'Sin productos',
          'Descripción Producto': 'N/A',
          'Cantidad': 0,
          'Precio Unitario': 0,
          'Subtotal': 0,
          'Total Pedido': pedido.total || 0,
          'Observaciones OC': pedido.observaciones_oc || '',
          'OC Generada Por': pedido.oc_generada_por_usuario?.nombre_completo || 'N/A',
          'Fecha Generación OC': pedido.oc_generada_en
            ? format(new Date(pedido.oc_generada_en), 'dd/MM/yyyy HH:mm', { locale: es })
            : 'N/A',
          'Notas Usuario': pedido.notas_usuario || ''
        });
      } else {
        // Crear una fila por cada producto
        detalles.forEach(detalle => {
          const subtotal = detalle.cantidad * detalle.precio_unitario;

          datosExportar.push({
            'Folio OC': pedido.folio_oc || 'Pendiente',
            'Estado': pedido.estatus?.nombre || 'Pendiente',
            'Fecha Pedido': format(new Date(pedido.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
            'Nombre Completo': pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A',
            'Usuario SICAS': pedido.usuario?.nombre_sicas || 'Sin usuario SICAS relacionado',
            'Oficina': pedido.usuario?.oficina || 'N/A',
            'Teléfono': pedido.usuario?.celular_laboral || pedido.usuario?.celular_personal || 'N/A',
            'Email': pedido.usuario?.email_laboral || 'N/A',
            'Dirección Entrega': pedido.direccion_entrega || 'No especificada',
            'Forma de Pago': pedido.forma_pago || 'N/A',
            'Método de Pago': pedido.metodo_pago === 'Otro'
              ? `Otro: ${pedido.metodo_pago_otro_detalle || 'N/A'}`
              : (pedido.metodo_pago || 'N/A'),
            'Responsable de Pago': pedido.responsable_pago
              ? (pedido.responsable_pago.nombre_completo || pedido.responsable_pago.nombre || 'N/A')
              : 'N/A',
            'Código Producto': detalle.producto?.codigo || 'N/A',
            'Producto': detalle.producto?.nombre || 'N/A',
            'Descripción Producto': detalle.producto?.descripcion || 'N/A',
            'Cantidad': detalle.cantidad,
            'Precio Unitario': detalle.precio_unitario,
            'Subtotal': subtotal,
            'Total Pedido': pedido.total || 0,
            'Observaciones OC': pedido.observaciones_oc || '',
            'OC Generada Por': pedido.oc_generada_por_usuario?.nombre_completo || 'N/A',
            'Fecha Generación OC': pedido.oc_generada_en
              ? format(new Date(pedido.oc_generada_en), 'dd/MM/yyyy HH:mm', { locale: es })
              : 'N/A',
            'Notas Usuario': pedido.notas_usuario || ''
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);

    const columnWidths = [
      { wch: 15 }, // Folio OC
      { wch: 12 }, // Estado
      { wch: 18 }, // Fecha Pedido
      { wch: 30 }, // Nombre Completo
      { wch: 35 }, // Usuario SICAS
      { wch: 20 }, // Oficina
      { wch: 15 }, // Teléfono
      { wch: 30 }, // Email
      { wch: 40 }, // Dirección Entrega
      { wch: 15 }, // Forma de Pago
      { wch: 20 }, // Método de Pago
      { wch: 25 }, // Responsable de Pago
      { wch: 15 }, // Código Producto
      { wch: 35 }, // Producto
      { wch: 40 }, // Descripción Producto
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Precio Unitario
      { wch: 15 }, // Subtotal
      { wch: 15 }, // Total Pedido
      { wch: 40 }, // Observaciones OC
      { wch: 25 }, // OC Generada Por
      { wch: 18 }, // Fecha Generación OC
      { wch: 40 }  // Notas Usuario
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

    const fechaExportacion = format(new Date(), 'dd-MM-yyyy_HHmm', { locale: es });
    const nombreArchivo = `MOVI_Store_Pedidos_${fechaExportacion}.xlsx`;

    XLSX.writeFile(workbook, nombreArchivo);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
          <span className="font-medium">Volver a MOVI Store</span>
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-600">Gestión de Pedidos</h1>
            <p className="text-gray-600 mt-1">
              Administra todos los pedidos de MOVI Store
              {pedidos.length > 0 && (
                <span className="ml-2 text-sm font-semibold text-primary-600">
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
              <Package className="w-8 h-8 text-primary-600" />
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
                <p className="text-xl sm:text-2xl font-bold text-primary-600 mt-1">{stats.procesando}</p>
              </div>
              <Package className="w-8 h-8 text-primary-600" />
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
                placeholder="Buscar por folio, ID o cliente..."
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
                onClick={exportarAExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                title="Exportar pedidos a Excel"
              >
                <Download className="w-5 h-5" />
                Exportar Excel
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
                        {pedido.folio_oc ? (
                          <span className="text-sm font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded">
                            {pedido.folio_oc}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A'}
                          </span>
                          <span className="text-xs text-gray-500">
                            SICAS: {pedido.usuario?.nombre_sicas || 'Sin usuario SICAS relacionado'}
                          </span>
                        </div>
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
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => navigate(`/store/pedido/${pedido.id}`)}
                            className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-800 font-medium transition-colors"
                            title="Ver detalle del pedido"
                          >
                            <Eye className="w-4 h-4" />
                            Ver
                          </button>
                          <button
                            onClick={() => setPedidoAEliminar(pedido)}
                            className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800 font-medium transition-colors"
                            title="Eliminar pedido"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
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

      {pedidoAEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Pedido</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                Estás a punto de eliminar el siguiente pedido:
              </p>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">
                  Folio: {pedidoAEliminar.folio_oc || 'Pendiente'}
                </p>
                <p className="text-sm text-gray-700">
                  Cliente: {pedidoAEliminar.usuario?.nombre || 'N/A'}
                </p>
                <p className="text-sm text-gray-700">
                  Total: ${pedidoAEliminar.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Se eliminarán todos los datos relacionados con este pedido, incluyendo detalles,
              notas administrativas e historial de cambios.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setPedidoAEliminar(null)}
                disabled={eliminando}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarPedido}
                disabled={eliminando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {eliminando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
