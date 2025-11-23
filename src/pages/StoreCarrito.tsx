import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Package } from 'lucide-react';
import {
  obtenerCarrito,
  actualizarCantidadCarrito,
  eliminarDelCarrito,
  crearPedido
} from '../lib/storeUtils';
import type { StoreCarritoItem } from '../lib/storeTypes';

export default function StoreCarrito() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [carrito, setCarrito] = useState<StoreCarritoItem[]>([]);
  const [notasUsuario, setNotasUsuario] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarCarrito();
  }, []);

  const cargarCarrito = async () => {
    if (!usuario?.id) return;

    try {
      setLoading(true);
      const data = await obtenerCarrito(usuario.id);
      setCarrito(data);
    } catch (error) {
      console.error('Error cargando carrito:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarCantidad = async (id: string, cantidad: number) => {
    try {
      await actualizarCantidadCarrito(id, cantidad);
      await cargarCarrito();
    } catch (error) {
      console.error('Error actualizando cantidad:', error);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este producto del carrito?')) return;

    try {
      await eliminarDelCarrito(id);
      await cargarCarrito();
    } catch (error) {
      console.error('Error eliminando producto:', error);
    }
  };

  const handleRealizarPedido = async () => {
    if (!usuario?.id || carrito.length === 0) return;

    try {
      setProcesando(true);
      await crearPedido(usuario.id, carrito, notasUsuario, direccionEntrega);
      alert('Pedido realizado exitosamente');
      navigate('/store/mis-pedidos');
    } catch (error) {
      console.error('Error creando pedido:', error);
      alert('Error al crear el pedido');
    } finally {
      setProcesando(false);
    }
  };

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + (item.producto!.precio * item.cantidad), 0);
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/store')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Volver al catálogo</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Mi Carrito</h1>
        </div>

        {carrito.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Tu carrito está vacío
            </h3>
            <p className="text-gray-500 mb-6">Agrega productos para comenzar tu pedido</p>
            <button
              onClick={() => navigate('/store')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Explorar productos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {carrito.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-4">
                    <img
                      src={item.producto!.imagen_url}
                      alt={item.producto!.titulo}
                      className="w-24 h-24 object-cover rounded-lg"
                    />

                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {item.producto!.titulo}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        ${item.producto!.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleActualizarCantidad(item.id, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="text-lg font-medium text-gray-900 w-8 text-center">
                          {item.cantidad}
                        </span>

                        <button
                          onClick={() => handleActualizarCantidad(item.id, item.cantidad + 1)}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleEliminar(item.id)}
                          className="ml-auto text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ${(item.producto!.precio * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-4">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Resumen del Pedido</h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notasUsuario}
                      onChange={(e) => setNotasUsuario(e.target.value)}
                      placeholder="Instrucciones especiales..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dirección de entrega (opcional)
                    </label>
                    <textarea
                      value={direccionEntrega}
                      onChange={(e) => setDireccionEntrega(e.target.value)}
                      placeholder="Ingresa tu dirección..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      ${calcularTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-blue-600">
                      ${calcularTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleRealizarPedido}
                  disabled={procesando}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {procesando ? 'Procesando...' : 'Realizar Pedido'}
                </button>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Los pedidos son procesados internamente
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
