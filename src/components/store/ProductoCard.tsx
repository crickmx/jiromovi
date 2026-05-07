import { ShoppingCart } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';

interface Props {
  producto: StoreProducto;
  onAgregar: (producto: StoreProducto) => void;
  onVerDetalle: (producto: StoreProducto) => void;
}

export function ProductoCard({ producto, onAgregar, onVerDetalle }: Props) {
  const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

  const getImageUrl = (imagenUrl: string) => {
    if (!imagenUrl) {
      return PLACEHOLDER_SVG;
    }

    if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) {
      return imagenUrl;
    }

    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="aspect-square w-full bg-gray-100 cursor-pointer overflow-hidden"
        onClick={() => onVerDetalle(producto)}
      >
        <img
          src={getImageUrl(producto.imagen_url)}
          alt={producto.titulo}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = PLACEHOLDER_SVG;
          }}
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
          className="text-base sm:text-lg font-semibold text-gray-900 mb-2 cursor-pointer hover:text-accent transition-colors line-clamp-2"
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
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm sm:text-base"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
