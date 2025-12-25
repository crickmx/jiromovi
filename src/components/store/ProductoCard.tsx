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

      <div className="p-3 sm:p-4">
        <div className="mb-2">
          {producto.categoria && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
              {producto.categoria.nombre}
            </span>
          )}
        </div>

        <h3
          className="text-base sm:text-lg font-semibold text-gray-900 mb-2 cursor-pointer hover:text-primary-600 transition-colors line-clamp-2"
          onClick={() => onVerDetalle(producto)}
        >
          {producto.titulo}
        </h3>

        <p className="text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2">
          {producto.descripcion}
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>

          <button
            onClick={() => onAgregar(producto)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm sm:text-base"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
