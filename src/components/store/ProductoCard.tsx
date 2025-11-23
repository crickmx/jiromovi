import { ShoppingCart } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';

interface Props {
  producto: StoreProducto;
  onAgregar: (producto: StoreProducto) => void;
  onVerDetalle: (producto: StoreProducto) => void;
}

export function ProductoCard({ producto, onAgregar, onVerDetalle }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="aspect-square w-full bg-gray-100 cursor-pointer overflow-hidden"
        onClick={() => onVerDetalle(producto)}
      >
        <img
          src={producto.imagen_url}
          alt={producto.titulo}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-4">
        <div className="mb-2">
          {producto.categoria && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {producto.categoria.nombre}
            </span>
          )}
        </div>

        <h3
          className="text-lg font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
          onClick={() => onVerDetalle(producto)}
        >
          {producto.titulo}
        </h3>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {producto.descripcion}
        </p>

        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-gray-900">
            ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>

          <button
            onClick={() => onAgregar(producto)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
