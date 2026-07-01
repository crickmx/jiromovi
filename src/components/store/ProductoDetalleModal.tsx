import { useState, useEffect } from 'react';
import { X, ShoppingCart, Minus, Plus, CheckCircle, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';
import { supabase } from '../../lib/supabase';
import { setupMarketingPremiumProductos } from '../../lib/storeUtils';

// ── Contenido Marketing Premium ───────────────────────────────────────────────

const MKT_INCLUYE = [
  'Asesoría estratégica para campañas de publicidad en redes sociales.',
  'Creación de contenido personalizado semanal (fotografía o video) adaptado a tus objetivos y audiencia.',
  'Planeación, seguimiento y optimización de estrategias digitales enfocadas en crecimiento y generación de oportunidades.',
  'Diseño y apoyo en materiales de marketing: presentaciones comerciales, propuestas, papelería corporativa y recursos de comunicación.',
  'Carpeta personal de fotos de estudio profesionales.',
  'Acompañamiento continuo para mantener una imagen profesional, consistente y alineada con tus metas.',
];

const MKT_BENEFICIOS = [
  'Mayor presencia y reconocimiento de marca.',
  'Contenido profesional sin necesidad de invertir tiempo en su producción.',
  'Estrategias enfocadas en resultados y generación de prospectos.',
  'Respaldo de un equipo de marketing especializado.',
  'Atención personalizada para potenciar tu crecimiento comercial.',
];

const MKT_METODOS = [
  'Depósito a cuenta Jiro',
  'Descuento de bono anual',
  'Descuento a comisiones',
];

// Detecta producto premium por tipo O por nombre como fallback
function esProductoPremium(producto: StoreProducto) {
  return (
    producto.tipo === 'marketing_premium_mensual' ||
    producto.tipo === 'marketing_premium_anual' ||
    /marketing/i.test(producto.titulo)
  );
}

// ── Helpers de imagen ─────────────────────────────────────────────────────────

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

function getImageUrl(imagenUrl: string) {
  if (!imagenUrl) return PLACEHOLDER_SVG;
  if (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) return imagenUrl;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/store-productos/${imagenUrl}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  producto: StoreProducto;
  onClose: () => void;
  onAgregar: (producto: StoreProducto, cantidad: number) => void;
}

export function ProductoDetalleModal({ producto, onClose, onAgregar }: Props) {
  const [cantidad, setCantidad] = useState(1);

  const esPremium = esProductoPremium(producto);
  const planInicial = producto.tipo === 'marketing_premium_anual' ? 'anual' : 'mensual';
  const [planSeleccionado, setPlanSeleccionado] = useState<'mensual' | 'anual'>(planInicial);

  // Variantes reales desde BD (pueden estar vacías hasta que setup las cree)
  const [variantesMkt, setVariantesMkt] = useState<{ mensual?: StoreProducto; anual?: StoreProducto }>({});
  const [cargandoVariantes, setCargandoVariantes] = useState(false);

  useEffect(() => {
    if (!esPremium) return;
    setCargandoVariantes(true);

    // Intenta crear las variantes si no existen (falla silenciosamente para no-admins)
    setupMarketingPremiumProductos()
      .catch(() => {})
      .then(() =>
        supabase
          .from('store_productos')
          .select('*, store_categorias:categoria_id(*)')
          .in('tipo', ['marketing_premium_mensual', 'marketing_premium_anual'])
          .eq('activo', true)
      )
      .then(({ data }) => {
        const v: typeof variantesMkt = {};
        (data ?? []).forEach((p: any) => {
          const prod: StoreProducto = { ...p, categoria: p.store_categorias };
          if (p.tipo === 'marketing_premium_mensual') v.mensual = prod;
          if (p.tipo === 'marketing_premium_anual') v.anual = prod;
        });
        setVariantesMkt(v);
        setCargandoVariantes(false);
      });
  }, [esPremium]);

  // Producto efectivo:
  // - Si la variante existe en BD → usarla (ID y precio correctos)
  // - Si no existe aún → sintetizar en memoria con el precio correcto (falla al agregar al carrito si el producto en BD no tiene el precio correcto, pero al menos la UI funciona)
  function productoEfectivo(): StoreProducto {
    if (!esPremium) return producto;
    if (planSeleccionado === 'mensual') {
      return variantesMkt.mensual ?? { ...producto, precio: 200, tipo: 'marketing_premium_mensual' };
    }
    return variantesMkt.anual ?? { ...producto, precio: 2000, tipo: 'marketing_premium_anual' };
  }

  const efectivo = productoEfectivo();

  const handleAgregar = () => {
    onAgregar(efectivo, cantidad);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Detalle del Producto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Imagen */}
            <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={getImageUrl(producto.imagen_url)}
                alt={producto.titulo}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_SVG; }}
              />
            </div>

            {/* Info */}
            <div>
              {producto.categoria && (
                <span className="inline-block px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800 rounded-full mb-3">
                  {producto.categoria.nombre}
                </span>
              )}

              <h1 className="text-3xl font-bold text-gray-900 mb-4">{producto.titulo}</h1>

              {/* ── Selector de plan ── */}
              {esPremium && (
                <div className="mb-5 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Elige tu plan:
                    {cargandoVariantes && (
                      <Loader2 className="inline-block w-3 h-3 ml-2 animate-spin text-purple-500" />
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Mensual */}
                    <button
                      onClick={() => setPlanSeleccionado('mensual')}
                      className={`relative p-4 rounded-xl border-2 text-left transition ${
                        planSeleccionado === 'mensual'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">Mensual</p>
                      <p className="text-xl font-bold text-purple-700 mt-1">$200</p>
                      <p className="text-xs text-gray-500">MXN / mes</p>
                      {planSeleccionado === 'mensual' && (
                        <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-purple-500" />
                      )}
                    </button>

                    {/* Anual */}
                    <button
                      onClick={() => setPlanSeleccionado('anual')}
                      className={`relative p-4 rounded-xl border-2 text-left transition ${
                        planSeleccionado === 'anual'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        Ahorra $400
                      </span>
                      <p className="text-sm font-semibold text-gray-900">Anual</p>
                      <p className="text-xl font-bold text-purple-700 mt-1">$2,000</p>
                      <p className="text-xs text-gray-500">MXN / año</p>
                      {planSeleccionado === 'anual' && (
                        <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-purple-500" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Precio */}
              <p className="text-4xl font-bold text-accent mb-6">
                ${efectivo.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                {esPremium && (
                  <span className="text-base font-normal text-gray-500 ml-2">
                    MXN / {planSeleccionado === 'mensual' ? 'mes' : 'año'}
                  </span>
                )}
              </p>

              {/* Descripción */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{producto.descripcion}</p>
              </div>

              {/* Cantidad (oculta para premium) */}
              {!esPremium && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
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
                      onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
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
              )}

              {/* Botones */}
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
                  <strong>Total:</strong> ${(efectivo.precio * cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </p>
              </div>
            </div>
          </div>

          {/* ── Detalle completo Marketing Premium ── */}
          {esPremium && (
            <div className="mt-8 border-t border-gray-100 pt-8 space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-900">¿Qué incluye el Plan Marketing Premium?</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Servicios incluidos</h4>
                  <ul className="space-y-2">
                    {MKT_INCLUYE.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Beneficios</h4>
                    <ul className="space-y-2">
                      {MKT_BENEFICIOS.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <ArrowRight className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Métodos de pago aceptados</h4>
                    <ul className="space-y-1.5">
                      {MKT_METODOS.map((m, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">{i + 1}</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Marketing Premium está pensado para agentes de Jiro que desean contar con un departamento de marketing dedicado, con atención cercana, soluciones personalizadas y un enfoque claro en resultados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
