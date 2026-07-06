import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Store, Package, Plus, Pencil as Edit, Trash2, Eye, EyeOff, X, FolderOpen, DollarSign, Tag, Download, Upload, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Wrench, Users, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import {
  obtenerTodosProductos,
  obtenerTodasCategorias,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagenProducto,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  exportarProductosExcel,
  importarProductosExcel,
  setupMarketingPremiumProductos,
  tieneAccesoEquipoStore
} from '../lib/storeUtils';
import type { ResultadoCargaMasiva } from '../lib/storeUtils';
import { obtenerCamposTramiteTipo, obtenerMapeoCamposTrigger, guardarMapeoCampoTrigger, PLACEHOLDERS_TRIGGER_PEDIDO } from '../lib/storeUtils';
import type { StoreTramiteTriggerCampo } from '../lib/storeUtils';
import { supabase } from '../lib/supabase';
import type { StoreProducto, StoreCategoria, StoreProductoCostoExtra, StoreProductoAtributo, StoreProductoAtributoOpcion, TipoItem, Disponibilidad } from '../lib/storeTypes';
import { TIPO_GASTO_OPTIONS } from '../lib/storeTypes';
import { BaseModal } from '../components/BaseModal';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

export default function StoreAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<'productos' | 'categorias' | 'equipos' | 'triggers'>('productos');

  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoEditando, setProductoEditando] = useState<StoreProducto | null>(null);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<StoreCategoria | null>(null);

  // Inline edit en tabla de productos
  const [inlineEdit, setInlineEdit] = useState<{ id: string; campo: 'precio' | 'stock'; valor: string } | null>(null);

  // Carga masiva
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<ResultadoCargaMasiva | null>(null);
  const [exportando, setExportando] = useState(false);

  const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

  const getImageUrl = (imagenUrl: string) => {
    if (!imagenUrl) return PLACEHOLDER_SVG;

    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
      return imagenUrl;
    }

    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
  };

  useEffect(() => {
    (async () => {
      if (!usuario) return;
      const tieneAcceso = tienePermisoAdminEnModulo(usuario, MODULOS.STORE) || await tieneAccesoEquipoStore(usuario.id);
      if (!tieneAcceso) { navigate('/store'); return; }
      cargarDatos();
      setupMarketingPremiumProductos().catch(() => {});
    })();
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

  const handleInlineEditSave = async () => {
    if (!inlineEdit) return;
    const val = parseFloat(inlineEdit.valor);
    if (isNaN(val) || val < 0) { setInlineEdit(null); return; }
    const patch = inlineEdit.campo === 'precio' ? { precio: val } : { stock: Math.round(val) };
    try {
      await actualizarProducto(inlineEdit.id, patch);
      setProductos(prev => prev.map(p => p.id === inlineEdit.id ? { ...p, ...patch } : p));
    } catch (e) { console.error(e); }
    setInlineEdit(null);
  };

  const handleToggleActivoProducto = async (producto: StoreProducto) => {
    try {
      await actualizarProducto(producto.id, { activo: !producto.activo });
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando producto:', error);
    }
  };

  const handleExportarExcel = async () => {
    try {
      setExportando(true);
      await exportarProductosExcel(productos);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar productos');
    } finally {
      setExportando(false);
    }
  };

  const handleImportarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportando(true);
      setResultadoImport(null);
      const resultado = await importarProductosExcel(file, categorias);
      setResultadoImport(resultado);
      await cargarDatos();
    } catch (error: any) {
      console.error('Error importando:', error);
      alert('Error al procesar el archivo: ' + (error.message || ''));
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Administración de MOVI Store"
          description="Gestiona productos, servicios y categorías"
          icon={Store}
          backTo="/store"
          backLabel="Volver a MOVI Store"
          className="mb-8"
        />

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setVistaActual('productos')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              vistaActual === 'productos'
                ? 'bg-accent text-white'
                : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
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
                : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
            }`}
          >
            <FolderOpen className="w-5 h-5 inline mr-2" />
            Categorías
          </button>

          {tienePermisoAdminEnModulo(usuario, MODULOS.STORE) && (
            <button
              onClick={() => setVistaActual('equipos')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                vistaActual === 'equipos'
                  ? 'bg-accent text-white'
                  : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
              }`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              Equipos
            </button>
          )}

          <button
            onClick={() => setVistaActual('triggers')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              vistaActual === 'triggers'
                ? 'bg-accent text-white'
                : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
            }`}
          >
            <Zap className="w-5 h-5 inline mr-2" />
            Triggers
          </button>
        </div>

        {vistaActual === 'productos' ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportarExcel}
                  disabled={exportando}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exportando ? 'Exportando...' : 'Descargar Excel'}
                </button>
                <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {importando ? 'Importando...' : 'Cargar Excel'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportarExcel}
                    disabled={importando}
                    className="hidden"
                  />
                </label>
              </div>
              <button
                onClick={handleCrearProducto}
                className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Nuevo Producto
              </button>
            </div>

            {resultadoImport && (
              <div className="mb-6 p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-white/80 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Resultado de importacion
                </h4>
                <div className="flex items-center gap-6 text-sm mb-2">
                  <span className="text-green-600 font-medium">{resultadoImport.creados} creados</span>
                  <span className="text-blue-600 font-medium">{resultadoImport.actualizados} actualizados</span>
                  {resultadoImport.errores.length > 0 && (
                    <span className="text-red-600 font-medium">{resultadoImport.errores.length} errores</span>
                  )}
                </div>
                {resultadoImport.errores.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {resultadoImport.errores.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Fila {err.fila}: {err.mensaje}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setResultadoImport(null)}
                  className="mt-3 text-xs text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70 underline"
                >
                  Cerrar
                </button>
              </div>
            )}

            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
                  <thead className="bg-neutral-50 dark:bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Imagen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Costo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Precio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Margen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Disponibilidad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Estado</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200 dark:divide-white/10">
                    {productos.map(producto => (
                      <tr key={producto.id} className="hover:bg-neutral-50 dark:bg-white/5">
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
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">{producto.titulo}</div>
                          <div className="text-sm text-neutral-500 dark:text-white/50 line-clamp-1">{producto.descripcion}</div>
                          {producto.tipo_item === 'servicio' && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                              <Wrench className="w-3 h-3" /> Servicio
                            </span>
                          )}
                          {producto.tipo_item === 'producto' && producto.disponibilidad === 'por_pedido' && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                              Por pedido
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-900 dark:text-white">{producto.categoria?.nombre}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-600 dark:text-white/60">
                            ${(producto.costo_base || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {inlineEdit?.id === producto.id && inlineEdit.campo === 'precio' ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              autoFocus
                              value={inlineEdit.valor}
                              onChange={e => setInlineEdit({ ...inlineEdit, valor: e.target.value })}
                              onBlur={handleInlineEditSave}
                              onKeyDown={e => { if (e.key === 'Enter') handleInlineEditSave(); if (e.key === 'Escape') setInlineEdit(null); }}
                              className="w-24 px-2 py-1 text-sm border border-accent rounded focus:outline-none focus:ring-2 focus:ring-accent dark:bg-neutral-800 dark:text-white"
                            />
                          ) : (
                            <button
                              onClick={() => setInlineEdit({ id: producto.id, campo: 'precio', valor: String(producto.precio) })}
                              className="text-sm font-semibold text-neutral-900 dark:text-white hover:text-accent transition-colors group flex items-center gap-1"
                              title="Clic para editar precio"
                            >
                              ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              <Edit className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </button>
                          )}
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
                            <span className="text-xs text-neutral-400 dark:text-white/40">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {producto.disponibilidad === 'por_pedido' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                              Siempre disponible
                            </span>
                          ) : inlineEdit?.id === producto.id && inlineEdit.campo === 'stock' ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              autoFocus
                              value={inlineEdit.valor}
                              onChange={e => setInlineEdit({ ...inlineEdit, valor: e.target.value })}
                              onBlur={handleInlineEditSave}
                              onKeyDown={e => { if (e.key === 'Enter') handleInlineEditSave(); if (e.key === 'Escape') setInlineEdit(null); }}
                              className="w-20 px-2 py-1 text-sm border border-accent rounded focus:outline-none focus:ring-2 focus:ring-accent dark:bg-neutral-800 dark:text-white"
                            />
                          ) : (
                            <button
                              onClick={() => setInlineEdit({ id: producto.id, campo: 'stock', valor: String(producto.stock) })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full hover:ring-2 hover:ring-accent/40 transition-all cursor-pointer ${
                                producto.stock === 0
                                  ? 'bg-red-100 text-red-800'
                                  : producto.stock <= producto.stock_umbral
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-green-800'
                              }`}
                              title="Clic para editar stock"
                            >
                              {producto.stock} uds
                              <Edit className="w-2.5 h-2.5 opacity-50" />
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleActivoProducto(producto)}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                              producto.activo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/80'
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
        ) : vistaActual === 'categorias' ? (
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
                <div key={categoria.id} className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">{categoria.nombre}</h3>
                      {categoria.descripcion && (
                        <p className="text-sm text-neutral-600 dark:text-white/60">{categoria.descripcion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActivoCategoria(categoria)}
                      className={`ml-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                        categoria.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/80'
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
        ) : vistaActual === 'equipos' ? (
          <EquiposAccesoPanel />
        ) : (
          <TriggersPanel />
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
    </>
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
  const [tipoItem, setTipoItem] = useState<TipoItem>(producto?.tipo_item || 'producto');
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>(producto?.disponibilidad || 'por_existencia');
  const [stock, setStock] = useState(producto?.stock?.toString() || '0');
  const [stockUmbral, setStockUmbral] = useState(producto?.stock_umbral?.toString() || '5');
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [tipo, setTipo] = useState(producto?.tipo ?? '');
  const [guardando, setGuardando] = useState(false);

  // Costos extras
  const [costosExtras, setCostosExtras] = useState<StoreProductoCostoExtra[]>([]);
  const [newCostoConcepto, setNewCostoConcepto] = useState('');
  const [newCostoTipo, setNewCostoTipo] = useState('otro');
  const [newCostoDescripcion, setNewCostoDescripcion] = useState('');
  const [newCostoMonto, setNewCostoMonto] = useState('');

  // Atributos
  const [atributos, setAtributos] = useState<StoreProductoAtributo[]>([]);
  const [newAtributoNombre, setNewAtributoNombre] = useState('');
  const [newOpcionValues, setNewOpcionValues] = useState<Record<string, string>>({});
  const [newOpcionPrices, setNewOpcionPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    if (producto?.id) loadCostosExtras();
    if (producto?.id) loadAtributos();
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

  async function loadAtributos() {
    if (!producto) return;
    const { data } = await supabase
      .from('store_producto_atributos')
      .select('*, opciones:store_producto_atributo_opciones(*)')
      .eq('producto_id', producto.id)
      .order('orden');
    if (data) {
      const sorted = data.map((a: any) => ({
        ...a,
        opciones: (a.opciones || []).sort((x: any, y: any) => x.orden - y.orden)
      }));
      setAtributos(sorted as StoreProductoAtributo[]);
    }
  }

  async function addAtributo() {
    if (!producto?.id || !newAtributoNombre.trim()) return;
    const { data, error } = await supabase
      .from('store_producto_atributos')
      .insert({
        producto_id: producto.id,
        nombre: newAtributoNombre.trim(),
        orden: atributos.length
      })
      .select()
      .single();
    if (!error && data) {
      setAtributos(prev => [...prev, { ...data, opciones: [] } as StoreProductoAtributo]);
      setNewAtributoNombre('');
    }
  }

  async function removeAtributo(id: string) {
    await supabase.from('store_producto_atributos').delete().eq('id', id);
    setAtributos(prev => prev.filter(a => a.id !== id));
  }

  async function addOpcion(atributoId: string) {
    const valor = (newOpcionValues[atributoId] || '').trim();
    if (!valor) return;
    const atributo = atributos.find(a => a.id === atributoId);
    const orden = atributo?.opciones?.length || 0;
    const precioRaw = (newOpcionPrices[atributoId] || '').trim();
    const precio = precioRaw ? parseFloat(precioRaw) : null;
    const { data, error } = await supabase
      .from('store_producto_atributo_opciones')
      .insert({ atributo_id: atributoId, valor, orden, ...(precio != null && !isNaN(precio) ? { precio } : {}) })
      .select()
      .single();
    if (!error && data) {
      setAtributos(prev => prev.map(a =>
        a.id === atributoId
          ? { ...a, opciones: [...(a.opciones || []), data as StoreProductoAtributoOpcion] }
          : a
      ));
      setNewOpcionValues(prev => ({ ...prev, [atributoId]: '' }));
      setNewOpcionPrices(prev => ({ ...prev, [atributoId]: '' }));
    }
  }

  async function removeOpcion(atributoId: string, opcionId: string) {
    await supabase.from('store_producto_atributo_opciones').delete().eq('id', opcionId);
    setAtributos(prev => prev.map(a =>
      a.id === atributoId
        ? { ...a, opciones: (a.opciones || []).filter(o => o.id !== opcionId) }
        : a
    ));
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
        tipo_item: tipoItem,
        disponibilidad,
        stock: disponibilidad === 'por_existencia' ? (parseInt(stock) || 0) : 0,
        stock_umbral: disponibilidad === 'por_existencia' ? (parseInt(stockUmbral) || 5) : 0,
        activo,
        tipo: tipo || null,
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
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Titulo *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre del producto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Descripcion *
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Descripcion detallada del producto"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
              Precio de venta *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
              Costo base (adquisicion)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costoBase}
              onChange={(e) => setCostoBase(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
              Tipo de item *
            </label>
            <select
              value={tipoItem}
              onChange={(e) => {
                const val = e.target.value as TipoItem;
                setTipoItem(val);
                if (val === 'servicio') setDisponibilidad('por_pedido');
              }}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
              Disponibilidad *
            </label>
            <select
              value={disponibilidad}
              onChange={(e) => setDisponibilidad(e.target.value as Disponibilidad)}
              disabled={tipoItem === 'servicio'}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="por_existencia">Por existencia (stock)</option>
              <option value="por_pedido">Por pedido (siempre disponible)</option>
            </select>
          </div>
        </div>

        {disponibilidad === 'por_existencia' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                Existencia (stock)
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                Umbral pocas existencias
              </label>
              <input
                type="number"
                min="0"
                value={stockUmbral}
                onChange={(e) => setStockUmbral(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="5"
              />
            </div>
          </div>
        )}

        {disponibilidad === 'por_pedido' && (
          <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20">
            <p className="text-sm text-sky-700 dark:text-sky-300 font-medium">
              {tipoItem === 'servicio'
                ? 'Los servicios no manejan existencia, se entregan por pedido.'
                : 'Este producto no maneja stock. Siempre aparecera como disponible.'
              }
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Categoria *
          </label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
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
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Imagen {!producto && '*'}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImagenChange}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
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
          <div className="border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-neutral-800 dark:text-white/80 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Costos extras fijos
            </h4>
            <p className="text-xs text-neutral-500 dark:text-white/50">Costos que siempre aplican: empaque, comision, etc.</p>

            {costosExtras.length > 0 && (
              <ul className="space-y-1.5">
                {costosExtras.map(c => (
                  <li key={c.id} className="flex items-center justify-between bg-neutral-50 dark:bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-800 dark:text-white/80">{c.concepto}</span>
                      <span className="text-xs text-neutral-400 dark:text-white/40 ml-2">({TIPO_GASTO_OPTIONS.find(t => t.value === c.tipo)?.label || c.tipo})</span>
                      {c.descripcion && <p className="text-xs text-neutral-400 dark:text-white/40 truncate">{c.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-semibold text-neutral-700 dark:text-white/70">${c.monto.toFixed(2)}</span>
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
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={newCostoTipo}
                  onChange={e => setNewCostoTipo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
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
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
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
              <div className="flex justify-between text-neutral-600 dark:text-white/60">
                <span>Costo base:</span>
                <span>${(parseFloat(costoBase) || 0).toFixed(2)}</span>
              </div>
              {totalCostosExtras > 0 && (
                <div className="flex justify-between text-neutral-600 dark:text-white/60">
                  <span>+ Costos extras:</span>
                  <span>${totalCostosExtras.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-neutral-800 dark:text-white/80 border-t border-blue-200 dark:border-blue-700 pt-1">
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

        {/* Atributos section - only for existing products */}
        {producto && (
          <div className="border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-neutral-800 dark:text-white/80 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Atributos / Variantes
            </h4>
            <p className="text-xs text-neutral-500 dark:text-white/50">Define opciones como Talla, Color, etc. que el comprador selecciona.</p>

            {atributos.length > 0 && (
              <div className="space-y-3">
                {atributos.map(attr => (
                  <div key={attr.id} className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-800 dark:text-white/80">{attr.nombre}</span>
                      <button onClick={() => removeAtributo(attr.id)} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(attr.opciones || []).map(opt => (
                        <span key={opt.id} className="inline-flex items-center gap-1 bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/15 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-white/70">
                          {opt.valor}
                          {opt.precio != null && (
                            <span className="text-accent font-semibold ml-0.5">${opt.precio.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</span>
                          )}
                          <button onClick={() => removeOpcion(attr.id, opt.id)} className="text-neutral-400 hover:text-red-500 ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOpcionValues[attr.id] || ''}
                        onChange={e => setNewOpcionValues(prev => ({ ...prev, [attr.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcion(attr.id); } }}
                        placeholder="Nueva opcion..."
                        className="flex-1 px-2.5 py-1.5 text-xs border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
                      />
                      <input
                        type="number"
                        value={newOpcionPrices[attr.id] || ''}
                        onChange={e => setNewOpcionPrices(prev => ({ ...prev, [attr.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcion(attr.id); } }}
                        placeholder="Precio"
                        min="0"
                        className="w-20 px-2.5 py-1.5 text-xs border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
                      />
                      <button
                        onClick={() => addOpcion(attr.id)}
                        disabled={!(newOpcionValues[attr.id] || '').trim()}
                        className="px-2.5 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newAtributoNombre}
                onChange={e => setNewAtributoNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAtributo(); } }}
                placeholder="Nuevo atributo (ej: Talla, Color...)"
                className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white"
              />
              <button
                onClick={addAtributo}
                disabled={!newAtributoNombre.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </div>
        )}

        {/* Vinculación con funciones del sistema */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-white/70">
            Vinculación con el sistema <span className="text-neutral-400 font-normal">(opcional)</span>
          </label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-white/15 rounded-lg bg-white dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Sin vinculación (producto normal)</option>
            <option value="marketing_premium_mensual">Marketing Premium — Plan Mensual ($200/mes)</option>
            <option value="marketing_premium_anual">Marketing Premium — Plan Anual ($2,000/año)</option>
          </select>
          {tipo && (
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Al marcar el pedido como "Entregado", se activará automáticamente el Plan MKT Premium del usuario.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="activo" className="text-sm font-medium text-neutral-700 dark:text-white/70">
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
            className="flex-1 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-6 py-3 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors font-medium"
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
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre de la categoría"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg dark:bg-white/5 dark:text-white focus:ring-2 focus:ring-blue-500"
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
          <label htmlFor="activo-cat" className="text-sm font-medium text-neutral-700 dark:text-white/70">
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
            className="flex-1 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-6 py-3 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

// ───────────────────────────────────────────────────────
// Panel: Equipos con acceso al store
// ───────────────────────────────────────────────────────
interface GrupoVisibilizacion {
  id: string;
  nombre: string;
  color: string | null;
  activo: boolean;
}

function EquiposAccesoPanel() {
  const [grupos, setGrupos] = useState<GrupoVisibilizacion[]>([]);
  const [equiposConAcceso, setEquiposConAcceso] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [gruposRes, accesoRes] = await Promise.all([
      supabase.from('tramites_grupos_visualizacion').select('id, nombre, color, activo').eq('activo', true).order('nombre'),
      supabase.from('store_equipos_acceso').select('grupo_id'),
    ]);
    setGrupos(gruposRes.data ?? []);
    setEquiposConAcceso(new Set((accesoRes.data ?? []).map((r: { grupo_id: string }) => r.grupo_id)));
    setLoading(false);
  };

  const toggleAcceso = async (grupoId: string, tieneAcceso: boolean) => {
    setGuardando(grupoId);
    if (tieneAcceso) {
      await supabase.from('store_equipos_acceso').delete().eq('grupo_id', grupoId);
      setEquiposConAcceso(prev => { const s = new Set(prev); s.delete(grupoId); return s; });
    } else {
      await supabase.from('store_equipos_acceso').insert({ grupo_id: grupoId });
      setEquiposConAcceso(prev => new Set([...prev, grupoId]));
    }
    setGuardando(null);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando equipos...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Equipos con acceso al store</h2>
        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
          Los miembros de estos equipos pueden ver y editar todos los pedidos del store, y reciben notificaciones.
        </p>
      </div>
      <div className="space-y-3 max-w-xl">
        {grupos.length === 0 && (
          <div className="text-sm text-neutral-400">No hay equipos configurados. Crea equipos en Tramites &rarr; Equipos.</div>
        )}
        {grupos.map(grupo => {
          const tieneAcceso = equiposConAcceso.has(grupo.id);
          return (
            <div key={grupo.id} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: grupo.color ?? '#6b7280' }} />
                <span className="font-medium text-neutral-900 dark:text-white">{grupo.nombre}</span>
              </div>
              <button
                disabled={guardando === grupo.id}
                onClick={() => toggleAcceso(grupo.id, tieneAcceso)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${tieneAcceso ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-accent text-white hover:bg-accent-hover'}`}
              >
                {tieneAcceso
                  ? <><EyeOff className="w-4 h-4" /><span className="ml-1.5">Quitar acceso</span></>
                  : <><Eye className="w-4 h-4" /><span className="ml-1.5">Dar acceso</span></>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────
// Panel: Triggers store → tramites
// ───────────────────────────────────────────────────────
interface StoreTrigger {
  id: string;
  nombre: string;
  estatus_destino_id: string;
  ticket_tipo_id: string;
  descripcion_template: string;
  activo: boolean;
  metodo_pago_filtro: string[] | null;
  forma_pago_filtro: string[] | null;
}
const METODO_PAGO_OC_OPCIONES = ['Cargo a Oficina', 'Cargo a Bono de Agente', 'Pago Directo', 'Descuento de Comisiones', 'Cargo a Nómina', 'Otro'];
const FORMA_PAGO_OC_OPCIONES = ['Contado', '2 Parcialidades', '12 Meses'];
interface StoreEstatusRow { id: string; nombre: string; }
interface TicketTipoRow { id: string; nombre: string; value: string; }

function TriggersPanel() {
  const [triggers, setTriggers] = useState<StoreTrigger[]>([]);
  const [estatusList, setEstatusList] = useState<StoreEstatusRow[]>([]);
  const [tiposList, setTiposList] = useState<TicketTipoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<StoreTrigger | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [estatusDestinoId, setEstatusDestinoId] = useState('');
  const [ticketTipoId, setTicketTipoId] = useState('');
  const [descripcionTemplate, setDescripcionTemplate] = useState('');
  const [activoTrigger, setActivoTrigger] = useState(true);
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState<string[]>([]);
  const [formaPagoFiltro, setFormaPagoFiltro] = useState<string[]>([]);
  const [camposTipo, setCamposTipo] = useState<{ id: string; label: string; tipo: string }[]>([]);
  const [mapeoCampos, setMapeoCampos] = useState<Record<string, { fuente: 'vacio' | 'template' | 'adjunto_oc'; valor_template: string }>>({});

  // Campos que se autollenan solos (área/equipo por reglas de asignación, creado_por por quien
  // dispara el estatus, estatus siempre inicia en "Iniciado", asignado_a por las reglas de equipo)
  // -- no tiene sentido dejar que el admin los mapee manualmente aquí.
  const SISTEMA_KEYS_AUTOMATICOS = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'creado_por', 'estatus', 'asignado_a'];

  useEffect(() => {
    if (!ticketTipoId) { setCamposTipo([]); return; }
    obtenerCamposTramiteTipo(ticketTipoId).then(data => {
      setCamposTipo((data ?? [])
        .filter((c: any) => !SISTEMA_KEYS_AUTOMATICOS.includes(c.sistema_key ?? ''))
        .map((c: any) => ({ id: c.id, label: c.label, tipo: c.tipo })));
    });
  }, [ticketTipoId]);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [triggersRes, estatusRes, tiposRes] = await Promise.all([
      supabase.from('store_tramite_triggers').select('*').order('created_at'),
      supabase.from('store_estatus_pedidos').select('id, nombre').eq('activo', true).order('orden'),
      supabase.from('ticket_tipos').select('id, nombre:label, value').eq('activo', true).order('label'),
    ]);
    setTriggers(triggersRes.data ?? []);
    setEstatusList(estatusRes.data ?? []);
    setTiposList(tiposRes.data ?? []);
    setLoading(false);
  };

  const abrirFormNuevo = () => {
    setEditando(null);
    setNombre('');
    setEstatusDestinoId(estatusList[0]?.id ?? '');
    setTicketTipoId(tiposList[0]?.id ?? '');
    setDescripcionTemplate('Pedido {{folio}} cambio a {{estatus}} -- revisar y dar seguimiento.');
    setActivoTrigger(true);
    setMetodoPagoFiltro([]);
    setFormaPagoFiltro([]);
    setMapeoCampos({});
    setShowForm(true);
  };

  const abrirFormEditar = async (t: StoreTrigger) => {
    setEditando(t);
    setNombre(t.nombre);
    setEstatusDestinoId(t.estatus_destino_id);
    setTicketTipoId(t.ticket_tipo_id);
    setDescripcionTemplate(t.descripcion_template);
    setActivoTrigger(t.activo);
    setMetodoPagoFiltro(t.metodo_pago_filtro ?? []);
    setFormaPagoFiltro(t.forma_pago_filtro ?? []);
    const mapeoExistente = await obtenerMapeoCamposTrigger(t.id);
    const mapeoRecord: Record<string, { fuente: 'vacio' | 'template' | 'adjunto_oc'; valor_template: string }> = {};
    mapeoExistente.forEach((m: StoreTramiteTriggerCampo) => {
      mapeoRecord[m.campo_id] = { fuente: m.fuente, valor_template: m.valor_template ?? '' };
    });
    setMapeoCampos(mapeoRecord);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !estatusDestinoId || !ticketTipoId) return;
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      estatus_destino_id: estatusDestinoId,
      ticket_tipo_id: ticketTipoId,
      descripcion_template: descripcionTemplate,
      activo: activoTrigger,
      metodo_pago_filtro: metodoPagoFiltro.length > 0 ? metodoPagoFiltro : null,
      forma_pago_filtro: formaPagoFiltro.length > 0 ? formaPagoFiltro : null,
    };
    let triggerId = editando?.id ?? null;
    if (editando) {
      await supabase.from('store_tramite_triggers').update(payload).eq('id', editando.id);
    } else {
      const { data: nuevoTrigger } = await supabase.from('store_tramite_triggers').insert(payload).select().single();
      triggerId = nuevoTrigger?.id ?? null;
    }
    if (triggerId) {
      for (const campo of camposTipo) {
        const m = mapeoCampos[campo.id];
        await guardarMapeoCampoTrigger({
          trigger_id: triggerId,
          campo_id: campo.id,
          fuente: m?.fuente ?? 'vacio',
          valor_template: m?.valor_template || null,
        });
      }
    }
    setGuardando(false);
    setShowForm(false);
    await cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('Eliminar este trigger?')) return;
    await supabase.from('store_tramite_triggers').delete().eq('id', id);
    await cargar();
  };

  const toggleActivo = async (t: StoreTrigger) => {
    await supabase.from('store_tramite_triggers').update({ activo: !t.activo }).eq('id', t.id);
    await cargar();
  };

  const getNombreEstatus = (id: string) => estatusList.find(e => e.id === id)?.nombre ?? id;
  const getNombreTipo = (id: string) => tiposList.find(t => t.id === id)?.nombre ?? id;

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando triggers...</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Triggers automaticos</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
            Cuando un pedido cambia a cierto estatus, se crea automaticamente un tramite vinculado.
          </p>
        </div>
        <button
          onClick={abrirFormNuevo}
          className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /><span className="ml-1">Nuevo trigger</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-6">
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">
            {editando ? 'Editar trigger' : 'Nuevo trigger'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre del trigger</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Pedido confirmado"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Cuando cambia a estatus</label>
                <select
                  value={estatusDestinoId}
                  onChange={e => setEstatusDestinoId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">Selecciona estatus...</option>
                  {estatusList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Crea tramite de tipo</label>
                <select
                  value={ticketTipoId}
                  onChange={e => setTicketTipoId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                >
                  <option value="">Selecciona tipo...</option>
                  {tiposList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Y el método de pago es <span className="text-neutral-400 font-normal">(opcional, elige varios)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {METODO_PAGO_OC_OPCIONES.map(m => {
                    const checked = metodoPagoFiltro.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodoPagoFiltro(prev => checked ? prev.filter(x => x !== m) : [...prev, m])}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          checked
                            ? 'bg-accent text-white border-accent'
                            : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/10 hover:border-accent'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Y la forma de pago es <span className="text-neutral-400 font-normal">(opcional, elige varias)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FORMA_PAGO_OC_OPCIONES.map(f => {
                    const checked = formaPagoFiltro.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormaPagoFiltro(prev => checked ? prev.filter(x => x !== f) : [...prev, f])}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          checked
                            ? 'bg-accent text-white border-accent'
                            : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/10 hover:border-accent'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-white/50 -mt-2">
              Sin ninguno seleccionado = cualquier método/forma. Puedes marcar varios para que el mismo
              trigger aplique a todos ellos, ej. "Descuento de Comisiones" y "Cargo a Bono de Agente"
              disparando el mismo tipo de trámite. Para acciones distintas según el estatus, sigue
              haciendo falta un trigger por estatus.
            </p>

            {camposTipo.length > 0 && (
              <div className="border border-neutral-200 dark:border-white/10 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-white/70">
                  Autollenado de campos del formulario
                </p>
                <p className="text-xs text-neutral-500 dark:text-white/50">
                  Elige de donde sale el valor de cada campo al crearse el tramite. Los campos sin
                  autollenado quedan vacios para que el equipo los complete manualmente.
                </p>
                {camposTipo.map(campo => {
                  const esAdjunto = campo.tipo === 'adjunto' || campo.tipo === 'archivos_adjuntos';
                  const m = mapeoCampos[campo.id] ?? { fuente: 'vacio' as const, valor_template: '' };
                  return (
                    <div key={campo.id} className="border-t border-neutral-100 dark:border-white/5 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-800 dark:text-white/80 flex-1 min-w-0 truncate">{campo.label}</span>
                        <select
                          value={m.fuente}
                          onChange={e => setMapeoCampos(prev => ({
                            ...prev,
                            [campo.id]: { fuente: e.target.value as 'vacio' | 'template' | 'adjunto_oc', valor_template: prev[campo.id]?.valor_template ?? '' },
                          }))}
                          className="px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white shrink-0"
                        >
                          <option value="vacio">No autollenar</option>
                          {esAdjunto
                            ? <option value="adjunto_oc">Adjuntar PDF de Orden de Compra</option>
                            : <option value="template">Plantilla de texto</option>}
                        </select>
                      </div>
                      {m.fuente === 'template' && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={m.valor_template}
                            onChange={e => setMapeoCampos(prev => ({ ...prev, [campo.id]: { fuente: 'template', valor_template: e.target.value } }))}
                            placeholder="Ej: Pedido {{folio}} de {{cliente}} por {{monto_total}}"
                            className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                          <div className="flex flex-wrap gap-1">
                            {PLACEHOLDERS_TRIGGER_PEDIDO.map(p => (
                              <button
                                key={p.key}
                                type="button"
                                title={p.label}
                                onClick={() => setMapeoCampos(prev => ({
                                  ...prev,
                                  [campo.id]: { fuente: 'template', valor_template: `${prev[campo.id]?.valor_template ?? ''}${p.key}` },
                                }))}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/20"
                              >
                                {p.key}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Plantilla de descripcion</label>
              <textarea
                value={descripcionTemplate}
                onChange={e => setDescripcionTemplate(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trigger-activo-chk"
                checked={activoTrigger}
                onChange={e => setActivoTrigger(e.target.checked)}
                className="w-4 h-4 text-accent rounded"
              />
              <label htmlFor="trigger-activo-chk" className="text-sm text-neutral-700 dark:text-white/70">Trigger activo</label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={guardar}
              disabled={guardando || !nombre.trim() || !estatusDestinoId || !ticketTipoId}
              className="bg-accent text-white px-5 py-2 rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-5 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">No hay triggers configurados. Crea uno para empezar.</div>
      ) : (
        <div className="space-y-3">
          {triggers.map(trigger => (
            <div
              key={trigger.id}
              className={`flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border px-5 py-4 ${trigger.activo ? 'border-neutral-200 dark:border-white/10' : 'border-neutral-100 dark:border-white/5 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 flex-shrink-0 ${trigger.activo ? 'text-yellow-500' : 'text-neutral-400'}`} />
                  <span className="font-medium text-neutral-900 dark:text-white truncate">{trigger.nombre}</span>
                  {!trigger.activo && (
                    <span className="text-xs bg-neutral-100 dark:bg-white/10 text-neutral-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 dark:text-white/50">
                  Estatus: <strong>{getNombreEstatus(trigger.estatus_destino_id)}</strong> &middot; Tramite: <strong>{getNombreTipo(trigger.ticket_tipo_id)}</strong>
                  {!!trigger.metodo_pago_filtro?.length && <> &middot; Método: <strong>{trigger.metodo_pago_filtro.join(', ')}</strong></>}
                  {!!trigger.forma_pago_filtro?.length && <> &middot; Forma: <strong>{trigger.forma_pago_filtro.join(', ')}</strong></>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => toggleActivo(trigger)}
                  className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  {trigger.activo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => abrirFormEditar(trigger)}
                  className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => eliminar(trigger.id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
