import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, User, MapPin, FileText, Clock, MessageSquare, History } from 'lucide-react';
import { obtenerPedidoCompleto, actualizarEstatusPedido, agregarNotaPedido, obtenerEstatus } from '../lib/storeUtils';
import type { StorePedidoCompleto, StoreEstatusPedido } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function StorePedidoDetalle() {
  const { usuario } = useAuth();
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<StorePedidoCompleto | null>(null);
  const [estatus, setEstatus] = useState<StoreEstatusPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizandoEstatus, setActualizandoEstatus] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [agregandoNota, setAgregandoNota] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (pedidoId) {
      cargarDatos();
    }
  }, [pedidoId]);

  const cargarDatos = async () => {
    if (!pedidoId) return;

    try {
      setLoading(true);
      const [pedidoData, estatusData] = await Promise.all([
        obtenerPedidoCompleto(pedidoId),
        obtenerEstatus()
      ]);
      setPedido(pedidoData);
      setEstatus(estatusData);
    } catch (error) {
      console.error('Error cargando pedido:', error);
      alert('Error al cargar pedido');
      navigate('/store/mis-pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstatus = async (nuevoEstatusId: string) => {
    if (!pedidoId || !isAdmin) return;

    if (!confirm('¿Cambiar el estatus de este pedido?')) return;

    try {
      setActualizandoEstatus(true);
      await actualizarEstatusPedido(pedidoId, nuevoEstatusId);
      alert('Estatus actualizado exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando estatus:', error);
      alert('Error al actualizar estatus');
    } finally {
      setActualizandoEstatus(false);
    }
  };

  const handleAgregarNota = async () => {
    if (!pedidoId || !isAdmin || !nuevaNota.trim()) return;

    try {
      setAgregandoNota(true);
      await agregarNotaPedido(pedidoId, nuevaNota.trim());
      setNuevaNota('');
      alert('Nota agregada exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error agregando nota:', error);
      alert('Error al agregar nota');
    } finally {
      setAgregandoNota(false);
    }
  };

  const calcularTotal = () => {
    if (!pedido) return 0;
    return pedido.detalle.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!pedido) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Pedido no encontrado</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(isAdmin ? '/store/pedidos' : '/store/mis-pedidos')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{isAdmin ? 'Volver a Pedidos' : 'Volver a Mis Pedidos'}</span>
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Detalle de Pedido</h1>
            <p className="text-gray-600 mt-1 font-mono">ID: {pedido.id.substring(0, 16)}...</p>
          </div>
          <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${getEstatusColor(pedido.estatus?.nombre || 'Pendiente')}`}>
            {pedido.estatus?.nombre || 'Pendiente'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
              </h2>
              <div className="space-y-4">
                {pedido.detalle.map(item => (
                  <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <img
                      src={item.producto?.imagen_url}
                      alt={item.producto?.titulo}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.producto?.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">Cantidad: {item.cantidad}</p>
                      <p className="text-sm text-gray-600">Precio unitario: ${item.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${(item.precio_unitario * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${calcularTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {pedido.historial && pedido.historial.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Cambios
                </h2>
                <div className="space-y-3">
                  {pedido.historial.map(item => (
                    <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          Cambio a: <span className="font-semibold">{item.estatus?.nombre}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {item.usuario && (
                          <p className="text-xs text-gray-500">Por: {item.usuario.nombre}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </h2>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">Nombre:</span><br />
                  {pedido.usuario?.nombre}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">Fecha:</span><br />
                  {format(new Date(pedido.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>

            {pedido.direccion_entrega && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Entrega
                </h2>
                <p className="text-sm text-gray-600">{pedido.direccion_entrega}</p>
              </div>
            )}

            {pedido.notas_usuario && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notas del Cliente
                </h2>
                <p className="text-sm text-gray-600">{pedido.notas_usuario}</p>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Estatus</h2>
                <select
                  value={pedido.estatus_id}
                  onChange={(e) => handleCambiarEstatus(e.target.value)}
                  disabled={actualizandoEstatus}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {estatus.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Notas Internas
                </h2>

                {pedido.notas && pedido.notas.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {pedido.notas.map(nota => (
                      <div key={nota.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-900">{nota.nota}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {nota.admin?.nombre} - {format(new Date(nota.created_at), "d MMM yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={nuevaNota}
                  onChange={(e) => setNuevaNota(e.target.value)}
                  placeholder="Agregar nota interna..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
                  rows={3}
                />
                <button
                  onClick={handleAgregarNota}
                  disabled={agregandoNota || !nuevaNota.trim()}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {agregandoNota ? 'Agregando...' : 'Agregar Nota'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
