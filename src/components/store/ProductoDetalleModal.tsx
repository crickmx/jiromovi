import { useState } from 'react';
import { X, ShoppingCart, Minus, Plus } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';

interface Props {
  producto: StoreProducto;
  onClose: () => void;
  onAgregar: (producto: StoreProducto, cantidad: number) => void;
}

export function ProductoDetalleModal({ producto, onClose, onAgregar }: Props) {
  const [cantidad, setCantidad] = useState(1);

  const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

  const getImageUrl = (imagenUrl: string) => {
    if (!imagenUrl) return PLACEHOLDER_SVG;

    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
      return imagenUrl;
    }

    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
  };

  const handleAgregar = () => {
    onAgregar(producto, cantidad);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Detalle del Producto</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={getImageUrl(producto.imagen_url)}
                alt={producto.titulo}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = PLACEHOLDER_SVG;
                }}
              />
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

              <p className="text-4xl font-bold text-accent mb-6">
                ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{producto.descripcion}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad
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
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={() => setCantidad(cantidad + 1)}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAgregar}
                  className="flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-semibold text-lg"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Agregar al Carrito
                </button>

                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Continuar Comprando
                </button>
              </div>

              <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Subtotal:</strong> ${(producto.precio * cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
