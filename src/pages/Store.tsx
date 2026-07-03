import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStoreAttentionCount } from '../hooks/useStoreAttentionCount';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Settings, ShoppingBag, CircleCheck as CheckCircle, Circle as XCircle, Wrench } from 'lucide-react';
import {
  obtenerProductos,
  obtenerCategorias,
  agregarAlCarrito,
  obtenerCarrito,
  tieneAccesoEquipoStore
} from '../lib/storeUtils';
import type { StoreProducto, StoreCategoria, TipoItem } from '../lib/storeTypes';
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

  const tienePermisoAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.STORE);
  const [tieneAccesoEquipo, setTieneAccesoEquipo] = useState(false);
  const isAdmin = tienePermisoAdmin || tieneAccesoEquipo;
  const storeAttentionCount = useStoreAttentionCount(usuario?.id);

  useEffect(() => {
    if (!usuario?.id || tienePermisoAdmin) return;
    tieneAccesoEquipoStore(usuario.id).then(setTieneAccesoEquipo);
  }, [usuario?.id, tienePermisoAdmin]);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoItem | ''>('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<StoreProducto | null>(null);
  const [cantidadCarrito, setCantidadCarrito] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  const productosFiltrados = useMemo(() => {
    if (!tipoFiltro) return productos;
    return productos.filter(p => p.tipo_item === tipoFiltro);
  }, [productos, tipoFiltro]);

  const handleAgregarAlCarrito = async (producto: StoreProducto, cantidad: number = 1, atributos?: Record<string, string>) => {
    if (!usuario?.id) return;

    try {
      trackStorePurchaseStarted(producto.titulo);
      await agregarAlCarrito(usuario.id, producto.id, cantidad, atributos);
      setCantidadCarrito(prev => prev + cantidad);
      showToast(`${producto.titulo} agregado al carrito`);
    } catch (error) {
      console.error('Error agregando al carrito:', error);
      showToast('Error al agregar producto al carrito', 'error');
    }
  };

  if (loading) {
    return (
      <>
        <LoadingState text="Cargando productos..." />
      </>
    );
  }

  return (
    <>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}
      <div className="space-y-5">
        <PageHeader
          title="MOVI Store"
          description="Explora nuestro catalogo de productos y servicios"
          icon={ShoppingCart}
          backTo="/dashboard"
          backLabel="Dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/store/pedidos')} className="relative">
                    <ShoppingBag className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Pedidos</span>
                    {storeAttentionCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                        <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" style={{ animationDuration: '2s' }} />
                        <span className="relative min-w-[16px] h-4 px-[3px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                          {storeAttentionCount > 99 ? '99+' : storeAttentionCount}
                        </span>
                      </span>
                    )}
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setTipoFiltro('')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                !tipoFiltro
                  ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-white/50 hover:text-neutral-800 dark:hover:text-white/70'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setTipoFiltro('producto')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                tipoFiltro === 'producto'
                  ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-white/50 hover:text-neutral-800 dark:hover:text-white/70'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Productos
            </button>
            <button
              onClick={() => setTipoFiltro('servicio')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                tipoFiltro === 'servicio'
                  ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-white/50 hover:text-neutral-800 dark:hover:text-white/70'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Servicios
            </button>
          </div>

          <div className="h-6 w-px bg-neutral-200 dark:bg-white/10 hidden sm:block" />

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
        </div>

        {productosFiltrados.length === 0 ? (
          <EmptyState
            icon={tipoFiltro === 'servicio' ? Wrench : Package}
            title={tipoFiltro === 'servicio' ? 'No hay servicios disponibles' : 'No hay productos disponibles'}
            description={
              categoriaSeleccionada || tipoFiltro
                ? 'Intenta cambiar los filtros'
                : 'Vuelve pronto para ver nuevos productos'
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {productosFiltrados.map(producto => (
              <ProductoCard
                key={producto.id}
                producto={producto}
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
    </>
  );
}
