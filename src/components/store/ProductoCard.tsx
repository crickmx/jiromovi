import { ShoppingCart, TriangleAlert as AlertTriangle } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';

interface Props {
  producto: StoreProducto;
  onVerDetalle: (producto: StoreProducto) => void;
}

export function ProductoCard({ producto, onVerDetalle }: Props) {
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

  const sinStock = producto.stock === 0;
  const pocasExistencias = producto.stock > 0 && producto.stock <= producto.stock_umbral;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${sinStock ? 'opacity-75' : ''}`}>
      <div
        className="aspect-square w-full bg-gray-100 cursor-pointer overflow-hidden relative"
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
        {sinStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
              Agotado
            </span>
          </div>
        )}
        {pocasExistencias && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Pocas existencias
            </span>
          </div>
        )}
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
            onClick={() => onVerDetalle(producto)}
            disabled={sinStock}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
              sinStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{sinStock ? 'Agotado' : 'Agregar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
