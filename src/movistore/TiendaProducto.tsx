import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Sparkles, Clock, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreProducto } from '@/lib/storeTypes';

const BRAND = '#2285de';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 120l20-30 20 30M110 120l15-20 15 20' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3Ccircle cx='90' cy='80' r='8' fill='%239ca3af'/%3E%3Crect x='60' y='60' width='80' height='80' rx='4' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";

function esProductoPremium(p: StoreProducto) {
  return p.tipo === 'marketing_premium_mensual' || p.tipo === 'marketing_premium_anual' || /marketing/i.test(p.titulo);
}

export function TiendaProducto() {
  const { id } = useParams<{ id: string }>();
  const [producto, setProducto] = useState<StoreProducto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [planSeleccionado, setPlanSeleccionado] = useState<'mensual' | 'anual'>('anual');
  const [variantesMkt, setVariantesMkt] = useState<{ mensual?: StoreProducto; anual?: StoreProducto }>({});

  useEffect(() => {
    if (!id) return;
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
    document.title = producto ? `${producto.titulo} — MOVI Tienda` : 'MOVI Tienda';
    return () => { document.title = 'MOVI Tienda'; };
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Tienda
          </Link>
          <span className="flex-1" />
          <span className="text-xl font-bold tracking-tight" style={{ color: BRAND }}>MOVI</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {cargando ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-gray-200 rounded-full animate-spin" style={{ borderTopColor: BRAND }} />
          </div>
        ) : !producto ? (
          <div className="text-center py-24">
            <p className="text-gray-400 mb-4">Producto no encontrado.</p>
            <Link to="/" className="font-medium hover:underline" style={{ color: BRAND }}>
              Ver todos los productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

            {/* Imagen */}
            <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative">
              <img
                src={producto.imagen_url || PLACEHOLDER_SVG}
                alt={producto.titulo}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_SVG; }}
              />
              {esServicio && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1.5 bg-purple-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                    <Wrench className="w-4 h-4" /> Servicio
                  </span>
                </div>
              )}
              {esPorPedido && !esServicio && (
                <div className="absolute top-3 right-3">
                  <span className="bg-blue-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                    Por pedido
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-4">
              {producto.categoria && (
                <span className="inline-block self-start px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                  {producto.categoria.nombre}
                </span>
              )}

              <h1 className="text-3xl font-bold text-gray-900 leading-tight">{producto.titulo}</h1>

              {/* Selector de plan — solo premium */}
              {esPremium && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Elige tu plan:</p>
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
              <div>
                <p className="text-4xl font-bold leading-none" style={{ color: BRAND }}>
                  {fmt(precioEfectivo)}
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

              {/* Por pedido */}
              {esPorPedido && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium text-blue-800">
                    {esServicio ? 'Este servicio se solicita por pedido' : 'Siempre disponible — se solicita por pedido'}
                  </span>
                </div>
              )}

              {/* Atributos (productos no-premium con variantes) */}
              {!esPremium && atributosConOpciones.length > 0 && (
                <div className="space-y-3">
                  {atributosConOpciones.map(attr => (
                    <div key={attr.id}>
                      <p className="text-sm font-semibold text-gray-700 mb-1.5">{attr.nombre}</p>
                      <div className="flex flex-wrap gap-2">
                        {(attr.opciones ?? []).filter(o => o.activo).map(opt => (
                          <span
                            key={opt.id}
                            className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-700"
                          >
                            {opt.valor}
                            {opt.precio != null && (
                              <span className="ml-1 text-xs text-gray-400">
                                ${opt.precio.toLocaleString('es-MX')}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">Selecciona opciones al completar tu pedido en MOVI</p>
                </div>
              )}

              {/* Descripción */}
              {producto.descripcion && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h2>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{producto.descripcion}</p>
                </div>
              )}

              {/* Botón */}
              <a
                href={comprarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3.5 px-8 rounded-2xl text-white font-bold text-base transition-opacity hover:opacity-90 active:opacity-80"
                style={{ backgroundColor: BRAND }}
              >
                {esServicio
                  ? (esPremium ? `Solicitar Plan ${planSeleccionado === 'mensual' ? 'Mensual' : 'Anual'}` : 'Solicitar Servicio')
                  : 'Comprar en MOVI'}
              </a>
              <p className="text-xs text-gray-400 text-center -mt-2">
                Se abrirá la app MOVI donde puedes iniciar sesión y completar tu pedido
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-300">
        © {new Date().getFullYear()} MOVI — Grupo Jiro
      </footer>
    </div>
  );
}
