import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Filter, X, Settings, ShoppingBag, ArrowLeft } from 'lucide-react';
import {
  obtenerProductos,
  obtenerCategorias,
  agregarAlCarrito,
  obtenerCarrito
} from '../lib/storeUtils';
import type { StoreProducto, StoreCategoria } from '../lib/storeTypes';
import { ProductoCard } from '../components/store/ProductoCard';
import { ProductoDetalleModal } from '../components/store/ProductoDetalleModal';

export default function Store() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const isAdmin = usuario?.rol === 'Administrador';
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<StoreProducto | null>(null);
  const [cantidadCarrito, setCantidadCarrito] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [categoriaSeleccionada]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [productosData, categoriasData, carritoData] = await Promise.all([
        obtenerProductos(categoriaSeleccionada || undefined),
        obtenerCategorias(),
        usuario?.id ? obtenerCarrito(usuario.id) : Promise.resolve([])
      ]);

      setProductos(productosData);
      setCategorias(categoriasData);
      setCantidadCarrito(carritoData.reduce((sum, item) => sum + item.cantidad, 0));
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarAlCarrito = async (producto: StoreProducto, cantidad: number = 1) => {
    if (!usuario?.id) return;

    try {
      await agregarAlCarrito(usuario.id, producto.id, cantidad);
      setCantidadCarrito(prev => prev + cantidad);
      alert(`${producto.titulo} agregado al carrito`);
    } catch (error) {
      console.error('Error agregando al carrito:', error);
      alert('Error al agregar producto al carrito');
    }
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
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Volver al Dashboard</span>
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Store MOVI</h1>
            <p className="text-gray-600 mt-1">Explora nuestro catálogo de productos</p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/store/pedidos')}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Gestión de Pedidos</span>
                </button>

                <button
                  onClick={() => navigate('/store/admin')}
                  className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm"
                >
                  <Settings className="w-5 h-5" />
                  <span>Administrar</span>
                </button>
              </>
            )}

            {!isAdmin && (
              <button
                onClick={() => navigate('/store/mis-pedidos')}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
              >
                <Package className="w-5 h-5" />
                <span>Mis Pedidos</span>
              </button>
            )}

            <button
              onClick={() => navigate('/store/carrito')}
              className="relative flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Carrito</span>
              {cantidadCarrito > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {cantidadCarrito}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Categorías:</span>
          </div>

          <button
            onClick={() => setCategoriaSeleccionada('')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !categoriaSeleccionada
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>

          {categorias.map(categoria => (
            <button
              key={categoria.id}
              onClick={() => setCategoriaSeleccionada(categoria.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                categoriaSeleccionada === categoria.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {categoria.nombre}
            </button>
          ))}
        </div>

        {productos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No hay productos disponibles
            </h3>
            <p className="text-gray-500">
              {categoriaSeleccionada
                ? 'Intenta seleccionar otra categoría'
                : 'Vuelve pronto para ver nuevos productos'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productos.map(producto => (
              <ProductoCard
                key={producto.id}
                producto={producto}
                onAgregar={handleAgregarAlCarrito}
                onVerDetalle={setProductoSeleccionado}
              />
            ))}
          </div>
        )}

        {productoSeleccionado && (
          <ProductoDetalleModal
            producto={productoSeleccionado}
            onClose={() => setProductoSeleccionado(null)}
            onAgregar={handleAgregarAlCarrito}
          />
        )}
      </div>
    </Layout>
  );
}
