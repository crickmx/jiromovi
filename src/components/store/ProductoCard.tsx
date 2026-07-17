import { useState } from 'react';
import { ShoppingCart, TriangleAlert as AlertTriangle, Sparkles, Wrench, Minus, Plus } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';
import { parsearPersonalizacion } from '../../lib/storeUtils';

interface Props {
  producto: StoreProducto;
  onAgregar: (producto: StoreProducto, cantidad?: number) => void;
  onVerDetalle: (producto: StoreProducto) => void;
}

export function ProductoCard({ producto, onAgregar, onVerDetalle }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const esPremium =
    producto.tipo === 'marketing_premium_mensual' || producto.tipo === 'marketing_premium_anual';
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

  const esPorPedido = producto.disponibilidad === 'por_pedido';
  const sinStock = !esPorPedido && producto.stock === 0;
  const pocasExistencias = !esPorPedido && producto.stock > 0 && producto.stock <= producto.stock_umbral;
  // Si tiene variantes o personalización libre, se manda al modal de detalle.
  const tieneVariantes = (producto.atributos || []).some(a => (a.opciones || []).length > 0);
  const { activo: tienePersonalizacion } = parsearPersonalizacion(producto.atributos);
  const requiereModal = tieneVariantes || tienePersonalizacion;

  return (
    <div className={`bg-white dark:bg-white/5 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden hover:shadow-md transition-shadow ${sinStock ? 'opacity-75' : ''}`}>
      <div
        className="aspect-square w-full bg-gray-100 dark:bg-white/5 cursor-pointer overflow-hidden relative"
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
        {producto.tipo_item === 'servicio' && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Wrench className="w-3 h-3" />
              Servicio
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {producto.categoria && (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 dark:bg-accent/10 dark:text-accent rounded-full">
              {producto.categoria.nombre}
            </span>
          )}
          {(producto.tipo === 'marketing_premium_mensual' || producto.tipo === 'marketing_premium_anual') && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
              <Sparkles className="w-3 h-3" />
              {producto.tipo === 'marketing_premium_mensual' ? 'MKT Premium · Mensual' : 'MKT Premium · Anual'}
            </span>
          )}
        </div>

        <h3
          className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:text-accent transition-colors line-clamp-2"
          onClick={() => onVerDetalle(producto)}
        >
          {producto.titulo}
        </h3>

        <p className="text-sm text-gray-600 dark:text-white/60 mb-3 sm:mb-4 line-clamp-2">
          {producto.descripcion}
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            ${producto.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {!esPremium && !sinStock && !requiereModal && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCantidad(c => Math.max(1, c - 1))}
                  disabled={cantidad <= 1}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 dark:border-white/20 rounded hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={cantidad}
                  onChange={e => setCantidad(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                  className="w-10 text-center text-sm font-medium text-gray-900 dark:text-white border border-gray-200 dark:border-white/15 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={() => setCantidad(c => Math.min(999, c + 1))}
                  disabled={cantidad >= 999}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 dark:border-white/20 rounded hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (esPremium || requiereModal) { onVerDetalle(producto); return; }
                if (sinStock) return;
                onAgregar(producto, cantidad);
                setCantidad(1);
              }}
              disabled={!esPremium && sinStock}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                !esPremium && sinStock
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-accent-hover'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{esPremium ? 'Ver Planes' : sinStock ? 'Agotado' : requiereModal ? 'Elegir opciones' : producto.tipo_item === 'servicio' ? 'Solicitar' : 'Agregar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
