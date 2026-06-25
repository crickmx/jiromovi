import { useState } from 'react';
import { X, ShoppingCart, Minus, Plus, TriangleAlert as AlertTriangle, Wrench } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';

interface Props {
  producto: StoreProducto;
  onClose: () => void;
  onAgregar: (producto: StoreProducto, cantidad: number, atributos?: Record<string, string>) => void;
}

export function ProductoDetalleModal({ producto, onClose, onAgregar }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [atributosSeleccionados, setAtributosSeleccionados] = useState<Record<string, string>>({});

  const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

  const getImageUrl = (imagenUrl: string) => {
    if (!imagenUrl) return PLACEHOLDER_SVG;

    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
      return imagenUrl;
    }

    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
  };

  const esPorPedido = producto.disponibilidad === 'por_pedido';
  const esServicio = producto.tipo_item === 'servicio';
  const sinStock = !esPorPedido && producto.stock === 0;
  const pocasExistencias = !esPorPedido && producto.stock > 0 && producto.stock <= producto.stock_umbral;
  const maxCantidad = esPorPedido ? 99 : producto.stock;

  const atributosConOpciones = (producto.atributos || []).filter(a => (a.opciones || []).length > 0);
  const todosAtributosSeleccionados = atributosConOpciones.length === 0 ||
    atributosConOpciones.every(a => atributosSeleccionados[a.nombre]);

  const handleAgregar = () => {
    if (sinStock || !todosAtributosSeleccionados) return;
    const attrs = atributosConOpciones.length > 0 ? atributosSeleccionados : undefined;
    onAgregar(producto, cantidad, attrs);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {esServicio ? 'Detalle del Servicio' : 'Detalle del Producto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden relative">
              <img
                src={getImageUrl(producto.imagen_url)}
                alt={producto.titulo}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = PLACEHOLDER_SVG;
                }}
              />
              {sinStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-lg font-bold px-6 py-2 rounded-full">
                    Agotado
                  </span>
                </div>
              )}
              {esServicio && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1.5 bg-purple-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                    <Wrench className="w-4 h-4" />
                    Servicio
                  </span>
                </div>
              )}
              {esPorPedido && !esServicio && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                    Por pedido
                  </span>
                </div>
              )}
            </div>

            <div>
              {producto.categoria && (
                <span className="inline-block px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800 rounded-full mb-3">
                  {producto.categoria.nombre}
                </span>
              )}

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {producto.titulo}
              </h1>

              <p className="text-4xl font-bold text-accent mb-4">
                ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>

              {sinStock && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-red-800">
                    {esServicio ? 'Servicio no disponible' : 'Producto agotado'}
                  </span>
                </div>
              )}

              {pocasExistencias && (
                <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-amber-800">
                    Pocas existencias ({producto.stock} disponibles)
                  </span>
                </div>
              )}

              {esPorPedido && (
                <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-blue-800">
                    {esServicio ? 'Este servicio se solicita por pedido' : 'Siempre disponible - se solicita por pedido'}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripcion</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{producto.descripcion}</p>
              </div>

              {/* Attribute selectors */}
              {!sinStock && atributosConOpciones.length > 0 && (
                <div className="mb-6 space-y-4">
                  {atributosConOpciones.map(attr => (
                    <div key={attr.id}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {attr.nombre} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(attr.opciones || []).filter(o => o.activo).map(opt => {
                          const isSelected = atributosSeleccionados[attr.nombre] === opt.valor;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setAtributosSeleccionados(prev => ({ ...prev, [attr.nombre]: opt.valor }))}
                              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                isSelected
                                  ? 'border-accent bg-primary-50 text-accent'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {opt.valor}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!sinStock && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad {!esPorPedido && maxCantidad > 0 && <span className="text-gray-400 font-normal">(max: {maxCantidad})</span>}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={cantidad <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max={maxCantidad}
                      value={cantidad}
                      onChange={(e) => setCantidad(Math.max(1, Math.min(maxCantidad, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      onClick={() => setCantidad(Math.min(maxCantidad, cantidad + 1))}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={cantidad >= maxCantidad}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAgregar}
                  disabled={sinStock || !todosAtributosSeleccionados}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                    sinStock || !todosAtributosSeleccionados
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-accent text-white hover:bg-accent-hover'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {sinStock
                    ? 'No disponible'
                    : !todosAtributosSeleccionados
                      ? 'Selecciona las opciones'
                      : esServicio
                        ? 'Solicitar Servicio'
                        : 'Agregar al Carrito'}
                </button>

                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Continuar Comprando
                </button>
              </div>

              {!sinStock && (
                <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                  <p className="text-sm text-primary-800">
                    <strong>Subtotal:</strong> ${(producto.precio * cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
