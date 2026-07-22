import { useState, useEffect } from 'react';
import { X, ShoppingCart, Minus, Plus, TriangleAlert as AlertTriangle, CheckCircle, ArrowRight, Sparkles, Loader2, Wrench, Clock, Image as ImageIcon } from 'lucide-react';
import type { StoreProducto } from '../../lib/storeTypes';
import { supabase } from '../../lib/supabase';
import { setupMarketingPremiumProductos, parsearPersonalizacion, CAPAS_PERSONALIZACION_KEY, IMAGEN_FINAL_PERSONALIZACION_KEY, type StorePersonalizacionCapa } from '../../lib/storeUtils';
import { useAuth } from '../../contexts/AuthContext';
import { PersonalizarLogoScreen } from './PersonalizarLogoScreen';

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
  onAgregar: (producto: StoreProducto, cantidad: number, atributos?: Record<string, string>) => void;
}

export function ProductoDetalleModal({ producto, onClose, onAgregar }: Props) {
  const { usuario } = useAuth();
  const [cantidad, setCantidad] = useState(1);
  const [atributosSeleccionados, setAtributosSeleccionados] = useState<Record<string, string>>({});
  const [personalizacion, setPersonalizacion] = useState('');
  const [capasPersonalizacion, setCapasPersonalizacion] = useState<StorePersonalizacionCapa[]>([]);
  const [imagenFinalPersonalizacion, setImagenFinalPersonalizacion] = useState<string | null>(null);
  const [mostrarEditorLogo, setMostrarEditorLogo] = useState(false);

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

  const esPorPedido = producto.disponibilidad === 'por_pedido';
  const esServicio = producto.tipo_item === 'servicio';
  // Stock visual: sin bloquear pedido — backorders permitidos con entrega diferida
  const agotado = !esPorPedido && !esServicio && producto.stock === 0;
  const pocasExistencias = !esPorPedido && !esServicio && producto.stock > 0 && producto.stock <= producto.stock_umbral;
  const maxCantidad = 999;
  const esBackorder = !esPorPedido && !esServicio && cantidad > producto.stock;

  const atributosConOpciones = (producto.atributos || []).filter(a => (a.opciones || []).length > 0);
  const todosAtributosSeleccionados = atributosConOpciones.length === 0 ||
    atributosConOpciones.every(a => atributosSeleccionados[a.nombre]);
  const { activo: permitePersonalizacion, label: labelPersonalizacion } = parsearPersonalizacion(producto.atributos);

  // Precio efectivo: usa el precio de la opción seleccionada si tiene uno
  const precioVariante = (() => {
    for (const attr of atributosConOpciones) {
      const selectedValor = atributosSeleccionados[attr.nombre];
      if (!selectedValor) continue;
      const opt = (attr.opciones || []).find(o => o.valor === selectedValor);
      if (opt?.precio != null) return opt.precio;
    }
    return null;
  })();
  const precioMostrado = precioVariante ?? efectivo.precio;

  const handleAgregar = () => {
    if (!esPremium && !todosAtributosSeleccionados) return;
    let attrs: Record<string, string> | undefined =
      (atributosConOpciones.length > 0 || permitePersonalizacion)
        ? { ...atributosSeleccionados }
        : undefined;
    if (attrs && precioVariante != null) attrs._precio = String(precioVariante);
    if (permitePersonalizacion && personalizacion.trim()) {
      attrs ??= {};
      attrs._personalizacion = personalizacion.trim();
    }
    if (permitePersonalizacion && capasPersonalizacion.length > 0) {
      attrs ??= {};
      attrs[CAPAS_PERSONALIZACION_KEY] = JSON.stringify(capasPersonalizacion);
      if (imagenFinalPersonalizacion) attrs[IMAGEN_FINAL_PERSONALIZACION_KEY] = imagenFinalPersonalizacion;
    }
    onAgregar(efectivo, cantidad, attrs);
    onClose();
  };

  return (
    <>
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
            {/* Imagen */}
            <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden relative">
              <img
                src={getImageUrl(producto.imagen_url)}
                alt={producto.titulo}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_SVG; }}
              />
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

            {/* Info */}
            <div>
              {producto.categoria && (
                <span className="inline-block px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800 rounded-full mb-3">
                  {producto.categoria.nombre}
                </span>
              )}

              <div className="flex items-center gap-3 flex-wrap mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{producto.titulo}</h1>
                {agotado && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-300 whitespace-nowrap">
                    Sin existencias
                  </span>
                )}
                {pocasExistencias && !agotado && (
                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-orange-300 whitespace-nowrap">
                    Pocas existencias ({producto.stock})
                  </span>
                )}
              </div>

              {/* ── Selector de plan (solo para premium) ── */}
              {esPremium && (
                <div className="mb-5 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Elige tu plan:
                    {cargandoVariantes && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Mensual */}
                    <button
                      onClick={() => setPlanSeleccionado('mensual')}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        planSeleccionado === 'mensual'
                          ? 'border-purple-500 bg-purple-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mensual</p>
                      <p className="text-2xl font-bold text-purple-700 leading-none">$200</p>
                      <p className="text-xs text-gray-400 mt-1">MXN / mes</p>
                      {planSeleccionado === 'mensual' && (
                        <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-purple-500" />
                      )}
                    </button>

                    {/* Anual */}
                    <button
                      onClick={() => setPlanSeleccionado('anual')}
                      className={`relative pt-5 pb-4 px-4 rounded-xl border-2 text-left transition-all ${
                        planSeleccionado === 'anual'
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <span className="absolute -top-2.5 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap tracking-wide">
                        AHORRA 17%
                      </span>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Anual</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl font-bold text-emerald-600 leading-none">$167</p>
                        <p className="text-xs text-gray-400">/mes</p>
                      </div>
                      <p className="text-xs text-gray-400 line-through mt-0.5">$200/mes</p>
                      <p className="text-xs font-medium text-emerald-700 mt-1">$2,000 MXN / año</p>
                      {planSeleccionado === 'anual' && (
                        <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-emerald-500" />
                      )}
                    </button>
                  </div>

                  {planSeleccionado === 'anual' && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-800 font-medium">
                        Ahorras <span className="font-bold">$400 MXN</span> vs pago mensual · equivale a 2 meses gratis
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Precio */}
              <div className="mb-4">
                <p className="text-4xl font-bold text-accent leading-none">
                  ${precioMostrado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  {esPremium && (
                    <span className="text-base font-normal text-gray-500 ml-2">
                      MXN / {planSeleccionado === 'mensual' ? 'mes' : 'año'}
                    </span>
                  )}
                </p>
                {esPremium && planSeleccionado === 'anual' && (
                  <p className="text-sm text-gray-500 mt-1">Equivale a $167 MXN/mes · facturación anual</p>
                )}
              </div>

              {(esBackorder || agotado) && (
                <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Entrega diferida</p>
                    <p>{agotado
                      ? 'Sin stock en bodega.'
                      : `Stock disponible: ${producto.stock} uds · Faltante: ${cantidad - producto.stock} uds.`
                    } Entrega estimada: <strong>7 días hábiles + tiempo de envío.</strong></p>
                  </div>
                </div>
              )}

{esPorPedido && (
                <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-blue-800">
                    {esServicio ? 'Este servicio se solicita por pedido' : 'Siempre disponible - se solicita por pedido'}
                  </span>
                </div>
              )}

              {/* Descripción */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripcion</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{producto.descripcion}</p>
              </div>

              {/* Attribute selectors (solo para productos normales) */}
              {!esPremium && !agotado && atributosConOpciones.length > 0 && (
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
                              {opt.precio != null && (
                                <span className="block text-xs font-normal mt-0.5 opacity-75">
                                  ${opt.precio.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Personalización */}
              {!esPremium && permitePersonalizacion && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {labelPersonalizacion}
                    {' '}<span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={personalizacion}
                    onChange={e => setPersonalizacion(e.target.value)}
                    placeholder="Describe cómo deseas personalizar este producto…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {usuario && producto.imagen_personalizacion_url && (
                    <button
                      type="button"
                      onClick={() => setMostrarEditorLogo(true)}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" />
                      {capasPersonalizacion.length > 0 ? 'Editar tu logo/texto' : 'Personalizar con tu logo o texto'}
                    </button>
                  )}
                </div>
              )}

              {/* Cantidad (oculta para premium) */}
              {!esPremium && !agotado && (
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

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAgregar}
                  disabled={!todosAtributosSeleccionados}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                    !todosAtributosSeleccionados
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-accent text-white hover:bg-accent-hover'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {!todosAtributosSeleccionados
                    ? 'Selecciona las opciones'
                    : esPremium
                      ? `Solicitar Plan ${planSeleccionado === 'mensual' ? 'Mensual' : 'Anual'}`
                      : esServicio
                        ? 'Solicitar Servicio'
                        : esBackorder || agotado
                          ? 'Agregar (entrega diferida)'
                          : 'Agregar al Carrito'}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Continuar Comprando
                </button>
              </div>

              {(esPremium || !agotado) && (
                <div className={`mt-6 p-4 rounded-lg ${esPremium && planSeleccionado === 'anual' ? 'bg-emerald-50 border border-emerald-200' : 'bg-primary-50'}`}>
                  <p className={`text-sm font-medium ${esPremium && planSeleccionado === 'anual' ? 'text-emerald-900' : 'text-primary-800'}`}>
                    <strong>{esPremium ? 'Total:' : 'Subtotal:'}</strong>{' '}
                    ${(precioMostrado * cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    {esPremium && planSeleccionado === 'anual' && (
                      <span className="ml-2 text-emerald-700 font-normal">(en lugar de $2,400)</span>
                    )}
                  </p>
                </div>
              )}
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

    {mostrarEditorLogo && usuario && producto.imagen_personalizacion_url && (
      <PersonalizarLogoScreen
        imagenProducto={getImageUrl(producto.imagen_personalizacion_url)}
        usuarioId={usuario.id}
        capasIniciales={capasPersonalizacion}
        onCancelar={() => setMostrarEditorLogo(false)}
        onGuardar={(capas, imagenFinalUrl) => {
          setCapasPersonalizacion(capas);
          setImagenFinalPersonalizacion(imagenFinalUrl);
          setMostrarEditorLogo(false);
        }}
      />
    )}
    </>
  );
}
