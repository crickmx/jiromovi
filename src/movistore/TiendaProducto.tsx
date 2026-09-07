import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  CheckCircle,
  Sparkles,
  Clock,
  Wrench,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Package,
  Layers,
  ChevronRight,
  Truck,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreProducto } from '@/lib/storeTypes';

const BRAND = '#164281';
const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f1f5f9'/%3E%3Cpath d='M240 360l60-90 60 90M330 360l45-60 45 60' stroke='%23cbd5e1' stroke-width='6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='270' cy='240' r='24' fill='%23cbd5e1'/%3E%3Crect x='180' y='180' width='240' height='240' rx='16' stroke='%23cbd5e1' stroke-width='6' fill='none'/%3E%3C/svg%3E";

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

function esProductoPremium(p: StoreProducto) {
  return p.tipo === 'marketing_premium_mensual' || p.tipo === 'marketing_premium_anual' || /marketing/i.test(p.titulo);
}

export function TiendaProducto() {
  const { id } = useParams<{ id: string }>();
  const [producto, setProducto] = useState<StoreProducto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [planSeleccionado, setPlanSeleccionado] = useState<'mensual' | 'anual'>('anual');
  const [variantesMkt, setVariantesMkt] = useState<{ mensual?: StoreProducto; anual?: StoreProducto }>({});
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    supabase
      .from('store_productos')
      .select('*, categoria:store_categorias(id, nombre), atributos:store_producto_atributos(*, opciones:store_producto_atributo_opciones(*))')
      .eq('id', id)
      .eq('activo', true)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as StoreProducto | null;
        setProducto(p);
        if (p && esProductoPremium(p)) {
          setPlanSeleccionado(p.tipo === 'marketing_premium_mensual' ? 'mensual' : 'anual');
          supabase
            .from('store_productos')
            .select('*, store_categorias:categoria_id(*)')
            .in('tipo', ['marketing_premium_mensual', 'marketing_premium_anual'])
            .eq('activo', true)
            .then(({ data: vars }) => {
              const v: typeof variantesMkt = {};
              (vars ?? []).forEach((vp: any) => {
                const prod: StoreProducto = { ...vp, categoria: vp.store_categorias };
                if (vp.tipo === 'marketing_premium_mensual') v.mensual = prod;
                if (vp.tipo === 'marketing_premium_anual') v.anual = prod;
              });
              setVariantesMkt(v);
            });
        }
        setCargando(false);
      });
  }, [id]);

  useEffect(() => {
    document.title = producto ? `${producto.titulo} — MOVI Store` : 'MOVI Store';
    return () => {
      document.title = 'MOVI Store';
    };
  }, [producto]);

  const esPremium = producto ? esProductoPremium(producto) : false;
  const esPorPedido = producto?.disponibilidad === 'por_pedido';
  const esServicio = producto?.tipo_item === 'servicio';

  const precioEfectivo = (() => {
    if (!esPremium || !producto) return producto?.precio ?? 0;
    if (planSeleccionado === 'mensual') return variantesMkt.mensual?.precio ?? 200;
    return variantesMkt.anual?.precio ?? 2000;
  })();

  const productoEfectivoId = (() => {
    if (!esPremium) return producto?.id;
    if (planSeleccionado === 'mensual') return variantesMkt.mensual?.id ?? producto?.id;
    return variantesMkt.anual?.id ?? producto?.id;
  })();

  const comprarUrl = `https://app.movi.digital/store${productoEfectivoId ? `?producto=${productoEfectivoId}` : ''}`;

  const atributosConOpciones = (producto?.atributos ?? []).filter(a => (a.opciones ?? []).length > 0);

  const ogImage = producto?.imagen_url || 'https://app.movi.digital/movirecurso_7.png';
  const ogTitle = producto ? `${producto.titulo} — MOVI Store` : 'MOVI Store';
  const ogDesc = producto?.descripcion
    ? producto.descripcion.slice(0, 160)
    : 'Descubre los productos y servicios oficiales de MOVI Digital.';
  const ogUrl = typeof window !== 'undefined' ? window.location.href : '';

  const compartir = () => {
    if (navigator.share) {
      navigator.share({ title: ogTitle, text: ogDesc, url: ogUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(ogUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 flex flex-col font-sans selection:bg-[#164281] selection:text-white">
      <Helmet>
        <title>{ogTitle}</title>
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="theme-color" content="#164281" />
      </Helmet>

      {/* Header */}
      <header className="bg-[#040c1f]/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Tienda</span>
            </Link>
          </div>

          <Link to="/" className="flex items-center gap-2">
            <img src="/movirecurso_7.png" alt="MOVI" className="h-7 w-auto object-contain" />
            <span className="text-white font-bold text-lg tracking-tight">MOVI</span>
            <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold bg-blue-500/10 border border-blue-400/20 px-1.5 py-0.5 rounded">
              Store
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={compartir}
              className="p-2 rounded-lg bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 transition-colors text-xs font-medium flex items-center gap-1.5"
              title="Compartir producto"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiado ? '¡Copiado!' : 'Compartir'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Details Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 w-full">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-[3px] border-surface-200 border-t-[#164281] rounded-full animate-spin mb-4" />
            <p className="text-surface-500 text-sm font-medium">Cargando detalles del producto...</p>
          </div>
        ) : !producto ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-surface-200 p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              <Package className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-surface-900 mb-2">Producto no encontrado</h2>
            <p className="text-surface-500 text-sm mb-6">
              El artículo que buscas ya no está disponible o ha sido retirado.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#164281] text-white text-xs font-bold hover:bg-[#1e5fac] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Ver catálogo completo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Gallery / Image Area (Left) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="aspect-square bg-white rounded-3xl overflow-hidden shadow-sm border border-surface-200/80 relative">
                <img
                  src={producto.imagen_url || PLACEHOLDER_SVG}
                  alt={producto.titulo}
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                  }}
                />
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {esServicio && (
                    <span className="inline-flex items-center gap-1.5 bg-purple-600/95 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      <Wrench className="w-3.5 h-3.5" /> Servicio
                    </span>
                  )}
                  {esPorPedido && !esServicio && (
                    <span className="inline-flex items-center gap-1.5 bg-blue-600/95 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      <Clock className="w-3.5 h-3.5" /> Por pedido
                    </span>
                  )}
                </div>
              </div>

              {/* Guarantees Box */}
              <div className="bg-white rounded-2xl p-4 border border-surface-200/70 shadow-sm grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-surface-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Compra respaldada en MOVI</span>
                </div>
                <div className="flex items-center gap-2.5 text-surface-700">
                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Entrega oficial Grupo Jiro</span>
                </div>
              </div>
            </div>

            {/* Product Meta & Purchase Actions (Right) */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div>
                {/* Category & Badge */}
                {producto.categoria && (
                  <span className="inline-block px-3 py-1 text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200/60 rounded-lg mb-3">
                    {producto.categoria.nombre}
                  </span>
                )}

                <h1 className="text-2xl sm:text-3xl font-black text-surface-900 leading-tight">
                  {producto.titulo}
                </h1>
              </div>

              {/* Pricing Display */}
              <div className="bg-white p-5 rounded-2xl border border-surface-200/80 shadow-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-[#164281] leading-none">
                    {fmt(precioEfectivo)}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
                    MXN {esPremium ? `/ ${planSeleccionado === 'mensual' ? 'mes' : 'año'}` : ''}
                  </span>
                </div>
                {esPremium && planSeleccionado === 'anual' && (
                  <p className="text-xs font-semibold text-emerald-700 mt-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Equivale a $167 MXN al mes (ahorras $400 al año)
                  </p>
                )}
              </div>

              {/* Selector de Plan para Marketing Premium */}
              {esPremium && (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-surface-700 block">
                    Elige la modalidad de suscripción:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Mensual */}
                    <button
                      type="button"
                      onClick={() => setPlanSeleccionado('mensual')}
                      className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                        planSeleccionado === 'mensual'
                          ? 'border-[#164281] bg-blue-50/50 shadow-sm'
                          : 'border-surface-200 bg-white hover:border-surface-300'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1">Mensual</p>
                      <p className="text-2xl font-black text-surface-900 leading-none">$200</p>
                      <p className="text-[11px] text-surface-400 mt-1">MXN / mes</p>
                      {planSeleccionado === 'mensual' && (
                        <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-[#164281]" />
                      )}
                    </button>

                    {/* Anual */}
                    <button
                      type="button"
                      onClick={() => setPlanSeleccionado('anual')}
                      className={`relative pt-5 pb-4 px-4 rounded-2xl border-2 text-left transition-all ${
                        planSeleccionado === 'anual'
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                          : 'border-surface-200 bg-white hover:border-surface-300'
                      }`}
                    >
                      <span className="absolute -top-2.5 left-3 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                        Ahorra 17%
                      </span>
                      <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1">Anual</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-black text-emerald-700 leading-none">$167</p>
                        <p className="text-[11px] text-surface-400">/mes</p>
                      </div>
                      <p className="text-[11px] font-bold text-emerald-700 mt-1">$2,000 MXN / año</p>
                      {planSeleccionado === 'anual' && (
                        <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Notice por pedido */}
              {esPorPedido && (
                <div className="flex items-center gap-2.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs font-medium text-blue-900">
                  <Clock className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    {esServicio
                      ? 'Este servicio se procesa por pedido y se coordina a través de la plataforma MOVI.'
                      : 'Producto bajo pedido oficial. Se coordinará producción al confirmar tu solicitud.'}
                  </span>
                </div>
              )}

              {/* Attributes / Options preview */}
              {!esPremium && atributosConOpciones.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-surface-200/80 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-surface-700">
                    Opciones y Variantes Disponibles:
                  </h3>
                  {atributosConOpciones.map(attr => (
                    <div key={attr.id} className="space-y-1.5">
                      <span className="text-xs font-semibold text-surface-600">{attr.nombre}:</span>
                      <div className="flex flex-wrap gap-2">
                        {(attr.opciones ?? [])
                          .filter(o => o.activo)
                          .map(opt => (
                            <span
                              key={opt.id}
                              className="px-3 py-1 rounded-xl text-xs font-semibold border border-surface-200 bg-surface-50 text-surface-800"
                            >
                              {opt.valor}
                              {opt.precio != null && (
                                <span className="ml-1 text-surface-500 font-normal">
                                  (${opt.precio.toLocaleString('es-MX')})
                                </span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-surface-400 mt-2">
                    Podrás personalizar tus opciones exactas al iniciar sesión en MOVI.
                  </p>
                </div>
              )}

              {/* Description */}
              {producto.descripcion && (
                <div className="bg-white p-5 rounded-2xl border border-surface-200/80 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-surface-700 mb-2">
                    Descripción del Producto
                  </h3>
                  <p className="text-surface-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {producto.descripcion}
                  </p>
                </div>
              )}

              {/* Purchase CTA */}
              <div className="space-y-3 pt-2">
                <a
                  href={comprarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-8 rounded-2xl text-white font-bold text-base bg-[#164281] hover:bg-[#1e5fac] active:scale-[0.99] transition-all shadow-lg shadow-blue-900/30"
                >
                  <span>
                    {esServicio
                      ? esPremium
                        ? `Solicitar Plan ${planSeleccionado === 'mensual' ? 'Mensual' : 'Anual'} en MOVI`
                        : 'Solicitar Servicio en MOVI'
                      : 'Comprar en Plataforma MOVI'}
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[11px] text-surface-400 text-center font-medium">
                  Se abrirá tu sesión en MOVI Digital para confirmar métodos de pago, personalización y entrega.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#040c1f] text-slate-400 text-xs py-10 border-t border-white/10 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/movirecurso_7.png" alt="MOVI" className="h-6 w-auto object-contain" />
            <span className="text-white font-bold text-xs">MOVI Store · Grupo Jiro</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            © {new Date().getFullYear()} MOVI Digital. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
