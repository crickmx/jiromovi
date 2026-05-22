import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Settings, ShoppingBag } from 'lucide-react';
import {
  obtenerProductos,
  obtenerCategorias,
  agregarAlCarrito,
  obtenerCarrito
} from '../lib/storeUtils';
import type { StoreProducto, StoreCategoria } from '../lib/storeTypes';
import { ProductoCard } from '../components/store/ProductoCard';
import { ProductoDetalleModal } from '../components/store/ProductoDetalleModal';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import { trackStoreOpened, trackStoreProductViewed, trackStorePurchaseStarted } from '../lib/activityLogger';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

export default function Store() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const isAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.STORE);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<StoreProducto | null>(null);
  const [cantidadCarrito, setCantidadCarrito] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackStoreOpened();
  }, []);

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
      trackStorePurchaseStarted(producto.titulo);
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
        <LoadingState text="Cargando productos..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="MOVI Store"
          description="Explora nuestro catalogo de productos"
          icon={ShoppingCart}
          backTo="/dashboard"
          backLabel="Dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/store/pedidos')}>
                    <ShoppingBag className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Pedidos</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/store/admin')}>
                    <Settings className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </>
              )}
              {!isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/store/mis-pedidos')}>
                  <Package className="w-4 h-4 mr-1.5" />
                  Mis Pedidos
                </Button>
              )}
              <Button size="sm" onClick={() => navigate('/store/carrito')} className="relative">
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                Carrito
                {cantidadCarrito > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cantidadCarrito}
                  </span>
                )}
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoriaSeleccionada('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !categoriaSeleccionada
                ? 'bg-accent text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/10'
            }`}
          >
            Todas
          </button>

          {categorias.map(categoria => (
            <button
              key={categoria.id}
              onClick={() => setCategoriaSeleccionada(categoria.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                categoriaSeleccionada === categoria.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              {categoria.nombre}
            </button>
          ))}
        </div>

        {productos.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No hay productos disponibles"
            description={
              categoriaSeleccionada
                ? 'Intenta seleccionar otra categoria'
                : 'Vuelve pronto para ver nuevos productos'
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {productos.map(producto => (
              <ProductoCard
                key={producto.id}
                producto={producto}
                onAgregar={handleAgregarAlCarrito}
                onVerDetalle={(p) => {
                  setProductoSeleccionado(p);
                  trackStoreProductViewed(p.titulo, p.id);
                }}
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

