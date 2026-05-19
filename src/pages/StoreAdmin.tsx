import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, CreditCard as Edit, Trash2, Eye, EyeOff, Upload, X, FolderOpen, ArrowLeft, DollarSign } from 'lucide-react';
import {
  obtenerTodosProductos,
  obtenerTodasCategorias,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagenProducto,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} from '../lib/storeUtils';
import { supabase } from '../lib/supabase';
import type { StoreProducto, StoreCategoria, StoreProductoCostoExtra } from '../lib/storeTypes';
import { TIPO_GASTO_OPTIONS } from '../lib/storeTypes';
import { BaseModal } from '../components/BaseModal';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

export default function StoreAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<'productos' | 'categorias'>('productos');

  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoEditando, setProductoEditando] = useState<StoreProducto | null>(null);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<StoreCategoria | null>(null);

  const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

  const getImageUrl = (imagenUrl: string) => {
    if (!imagenUrl) return PLACEHOLDER_SVG;

    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
      return imagenUrl;
    }

    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
  };

  useEffect(() => {
    if (!tienePermisoAdminEnModulo(usuario, MODULOS.STORE)) {
      navigate('/store');
      return;
    }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [productosData, categoriasData] = await Promise.all([
        obtenerTodosProductos(),
        obtenerTodasCategorias()
      ]);
      setProductos(productosData);
      setCategorias(categoriasData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearProducto = () => {
    setProductoEditando(null);
    setShowProductoModal(true);
  };

  const handleEditarProducto = (producto: StoreProducto) => {
    setProductoEditando(producto);
    setShowProductoModal(true);
  };

  const handleEliminarProducto = async (producto: StoreProducto) => {
    if (!confirm(`¿Eliminar el producto "${producto.titulo}"?`)) return;

    try {
      await eliminarProducto(producto.id);
      alert('Producto eliminado exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error eliminando producto:', error);
      alert('Error al eliminar producto. Puede que tenga pedidos asociados.');
    }
  };

  const handleToggleActivoProducto = async (producto: StoreProducto) => {
    try {
      await actualizarProducto(producto.id, { activo: !producto.activo });
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando producto:', error);
    }
  };

  const handleCrearCategoria = () => {
    setCategoriaEditando(null);
    setShowCategoriaModal(true);
  };

  const handleEditarCategoria = (categoria: StoreCategoria) => {
    setCategoriaEditando(categoria);
    setShowCategoriaModal(true);
  };

  const handleEliminarCategoria = async (categoria: StoreCategoria) => {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;

    try {
      await eliminarCategoria(categoria.id);
      alert('Categoría eliminada exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar categoría. Puede que tenga productos asociados.');
    }
  };

  const handleToggleActivoCategoria = async (categoria: StoreCategoria) => {
    try {
      await actualizarCategoria(categoria.id, { activo: !categoria.activo });
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando categoría:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-accent">Administración de MOVI Store</h1>
            <p className="text-gray-600 mt-1">Gestiona productos y categorías</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setVistaActual('productos')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              vistaActual === 'productos'
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Package className="w-5 h-5 inline mr-2" />
            Productos
          </button>

          <button
            onClick={() => setVistaActual('categorias')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              vistaActual === 'categorias'
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FolderOpen className="w-5 h-5 inline mr-2" />
            Categorías
          </button>
        </div>

        {vistaActual === 'productos' ? (
          <div>
            <div className="flex justify-end mb-6">
              <button
                onClick={handleCrearProducto}
                className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Nuevo Producto
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imagen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productos.map(producto => (
                      <tr key={producto.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <img
                            src={getImageUrl(producto.imagen_url)}
                            alt={producto.titulo}
                            className="w-16 h-16 object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = PLACEHOLDER_SVG;
                            }}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{producto.titulo}</div>
                          <div className="text-sm text-gray-500 line-clamp-1">{producto.descripcion}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{producto.categoria?.nombre}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            ${(producto.costo_base || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">
                            ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {producto.costo_base > 0 ? (
                            <span className={`text-sm font-medium ${
                              ((producto.precio - producto.costo_base) / producto.precio * 100) > 30
                                ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {((producto.precio - producto.costo_base) / producto.precio * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleActivoProducto(producto)}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                              producto.activo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {producto.activo ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {producto.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditarProducto(producto)}
                              className="text-accent hover:text-primary-800 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEliminarProducto(producto)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-6">
              <button
                onClick={handleCrearCategoria}
                className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Nueva Categoría
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categorias.map(categoria => (
                <div key={categoria.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{categoria.nombre}</h3>
                      {categoria.descripcion && (
                        <p className="text-sm text-gray-600">{categoria.descripcion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActivoCategoria(categoria)}
                      className={`ml-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                        categoria.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {categoria.activo ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {categoria.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditarCategoria(categoria)}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary-50 text-accent px-4 py-2 rounded-lg hover:bg-primary-100 transition-colors font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminarCategoria(categoria)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showProductoModal && (
          <ProductoModal
            producto={productoEditando}
            categorias={categorias}
            onClose={() => {
              setShowProductoModal(false);
              setProductoEditando(null);
            }}
            onGuardar={async () => {
              await cargarDatos();
              setShowProductoModal(false);
              setProductoEditando(null);
            }}
          />
        )}

        {showCategoriaModal && (
          <CategoriaModal
            categoria={categoriaEditando}
            onClose={() => {
              setShowCategoriaModal(false);
              setCategoriaEditando(null);
            }}
            onGuardar={async () => {
              await cargarDatos();
              setShowCategoriaModal(false);
              setCategoriaEditando(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

interface ProductoModalProps {
  producto: StoreProducto | null;
  categorias: StoreCategoria[];
  onClose: () => void;
  onGuardar: () => void;
}

function ProductoModal({ producto, categorias, onClose, onGuardar }: ProductoModalProps) {
  const [titulo, setTitulo] = useState(producto?.titulo || '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '');
  const [precio, setPrecio] = useState(producto?.precio.toString() || '');
  const [costoBase, setCostoBase] = useState(producto?.costo_base?.toString() || '0');
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id || '');
  const [imagenUrl, setImagenUrl] = useState(producto?.imagen_url || '');
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  // Costos extras
  const [costosExtras, setCostosExtras] = useState<StoreProductoCostoExtra[]>([]);
  const [newCostoConcepto, setNewCostoConcepto] = useState('');
  const [newCostoTipo, setNewCostoTipo] = useState('otro');
  const [newCostoDescripcion, setNewCostoDescripcion] = useState('');
  const [newCostoMonto, setNewCostoMonto] = useState('');

  useEffect(() => {
    if (producto?.id) loadCostosExtras();
  }, [producto?.id]);

  async function loadCostosExtras() {
    if (!producto) return;
    const { data } = await supabase
      .from('store_producto_costos_extras')
      .select('*')
      .eq('producto_id', producto.id)
      .order('created_at');
    if (data) setCostosExtras(data);
  }

  async function addCostoExtra() {
    if (!producto?.id || !newCostoConcepto || !newCostoMonto) return;
    const { data, error } = await supabase
      .from('store_producto_costos_extras')
      .insert({
        producto_id: producto.id,
        concepto: newCostoConcepto,
        tipo: newCostoTipo,
        descripcion: newCostoDescripcion || null,
        monto: parseFloat(newCostoMonto),
      })
      .select()
      .single();
    if (!error && data) {
      setCostosExtras(prev => [...prev, data]);
      setNewCostoConcepto('');
      setNewCostoTipo('otro');
      setNewCostoDescripcion('');
      setNewCostoMonto('');
    }
  }

  async function removeCostoExtra(id: string) {
    await supabase.from('store_producto_costos_extras').delete().eq('id', id);
    setCostosExtras(prev => prev.filter(c => c.id !== id));
  }

  const totalCostosExtras = costosExtras.reduce((sum, c) => sum + c.monto, 0);
  const costoReal = (parseFloat(costoBase) || 0) + totalCostosExtras;
  const precioNum = parseFloat(precio) || 0;
  const gananciaUnidad = precioNum - costoReal;
  const margenPct = precioNum > 0 ? (gananciaUnidad / precioNum) * 100 : 0;

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGuardar = async () => {
    if (!titulo || !descripcion || !precio || !categoriaId) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!producto && !imagenFile) {
      alert('Por favor selecciona una imagen');
      return;
    }

    try {
      setGuardando(true);

      let finalImagenUrl = imagenUrl;

      if (imagenFile) {
        finalImagenUrl = await subirImagenProducto(imagenFile);
      }

      const datos = {
        titulo,
        descripcion,
        precio: parseFloat(precio),
        costo_base: parseFloat(costoBase) || 0,
        categoria_id: categoriaId,
        imagen_url: finalImagenUrl,
        activo
      };

      if (producto) {
        await actualizarProducto(producto.id, datos);
        alert('Producto actualizado exitosamente');
      } else {
        await crearProducto(datos);
        alert('Producto creado exitosamente');
      }

      onGuardar();
    } catch (error: any) {
      console.error('Error guardando producto:', error);
      const errorMsg = error?.message || error?.error_description || 'Error desconocido';
      alert(`Error al guardar producto: ${errorMsg}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={producto ? 'Editar Producto' : 'Nuevo Producto'}
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titulo *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre del producto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripcion *
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Descripcion detallada del producto"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio de venta *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Costo base (adquisicion)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costoBase}
              onChange={(e) => setCostoBase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categoria *
          </label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona una categoria</option>
            {categorias.filter(c => c.activo).map(categoria => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Imagen {!producto && '*'}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImagenChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {imagenUrl && (
            <div className="mt-3">
              <img
                src={imagenUrl}
                alt="Preview"
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Costos extras section - only for existing products */}
        {producto && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Costos extras fijos
            </h4>
            <p className="text-xs text-gray-500">Costos que siempre aplican: empaque, comision, etc.</p>

            {costosExtras.length > 0 && (
              <ul className="space-y-1.5">
                {costosExtras.map(c => (
                  <li key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800">{c.concepto}</span>
                      <span className="text-xs text-gray-400 ml-2">({TIPO_GASTO_OPTIONS.find(t => t.value === c.tipo)?.label || c.tipo})</span>
                      {c.descripcion && <p className="text-xs text-gray-400 truncate">{c.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-semibold text-gray-700">${c.monto.toFixed(2)}</span>
                      <button onClick={() => removeCostoExtra(c.id)} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <input
                  type="text"
                  value={newCostoConcepto}
                  onChange={e => setNewCostoConcepto(e.target.value)}
                  placeholder="Concepto"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={newCostoTipo}
                  onChange={e => setNewCostoTipo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                >
                  {TIPO_GASTO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCostoMonto}
                  onChange={e => setNewCostoMonto(e.target.value)}
                  placeholder="$0.00"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={addCostoExtra}
                  disabled={!newCostoConcepto || !newCostoMonto}
                  className="w-full px-2 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>

            {/* Live cost summary */}
            <div className="bg-blue-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Costo base:</span>
                <span>${(parseFloat(costoBase) || 0).toFixed(2)}</span>
              </div>
              {totalCostosExtras > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>+ Costos extras:</span>
                  <span>${totalCostosExtras.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-800 border-t border-blue-200 pt-1">
                <span>= Costo real:</span>
                <span>${costoReal.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-semibold ${gananciaUnidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                <span>Ganancia/unidad:</span>
                <span>${gananciaUnidad.toFixed(2)} ({margenPct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="activo" className="text-sm font-medium text-gray-700">
            Producto activo (visible en el catalogo)
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : producto ? 'Actualizar' : 'Crear'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

interface CategoriaModalProps {
  categoria: StoreCategoria | null;
  onClose: () => void;
  onGuardar: () => void;
}

function CategoriaModal({ categoria, onClose, onGuardar }: CategoriaModalProps) {
  const [nombre, setNombre] = useState(categoria?.nombre || '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion || '');
  const [activo, setActivo] = useState(categoria?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre) {
      alert('Por favor ingresa un nombre');
      return;
    }

    try {
      setGuardando(true);

      const datos = {
        nombre,
        descripcion,
        activo
      };

      if (categoria) {
        await actualizarCategoria(categoria.id, datos);
        alert('Categoría actualizada exitosamente');
      } else {
        await crearCategoria(datos);
        alert('Categoría creada exitosamente');
      }

      onGuardar();
    } catch (error) {
      console.error('Error guardando categoría:', error);
      alert('Error al guardar categoría');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={categoria ? 'Editar Categoría' : 'Nueva Categoría'}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre de la categoría"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Descripción de la categoría"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo-cat"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="activo-cat" className="text-sm font-medium text-gray-700">
            Categoría activa
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : categoria ? 'Actualizar' : 'Crear'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
