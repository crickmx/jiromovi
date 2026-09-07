import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft,
  Layers,
  Search,
  Package,
  Wrench,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  X,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreProducto, TipoItem } from '@/lib/storeTypes';

const BRAND = '#164281';
const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Cpath d='M160 240l40-60 40 60M220 240l30-40 30 40' stroke='%23cbd5e1' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='180' cy='160' r='16' fill='%23cbd5e1'/%3E%3Crect x='120' y='120' width='160' height='160' rx='12' stroke='%23cbd5e1' stroke-width='4' fill='none'/%3E%3C/svg%3E";

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface Catalogo {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_portada_url: string | null;
}

export function TiendaCatalogo() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [cargando, setCargando] = useState(true);

  // Search and filters within this catalog
  const searchParam = searchParams.get('q') || '';
  const tipoParam = (searchParams.get('tipo') as TipoItem | '') || '';
  const sortParam = searchParams.get('orden') || 'recomendados';

  const [busqueda, setBusqueda] = useState(searchParam);
  const [tipoFiltro, setTipoFiltro] = useState<TipoItem | ''>(tipoParam);
  const [orden, setOrden] = useState<string>(sortParam);

  useEffect(() => {
    if (!slug) return;
    setCargando(true);

    supabase
      .from('store_catalogos')
      .select('id, nombre, slug, descripcion, imagen_portada_url')
      .eq('slug', slug)
      .eq('activo', true)
      .maybeSingle()
      .then(async ({ data: cat }) => {
        if (!cat) {
          navigate('/');
          return;
        }
        setCatalogo(cat);
        document.title = `${cat.nombre} — Catálogo MOVI Store`;

        const { data: rels } = await supabase
          .from('store_catalogo_productos')
          .select('producto_id, orden, producto:store_productos(*, categoria:store_categorias(id, nombre))')
          .eq('catalogo_id', cat.id)
          .order('orden', { ascending: true });

        const prods = (rels ?? [])
          .map((r: any) => r.producto)
          .filter(Boolean) as StoreProducto[];

        setProductos(prods);
        setCargando(false);
      });
  }, [slug, navigate]);

  const actualizarFiltros = (nuevos: {
    q?: string;
    tipo?: TipoItem | '';
    sort?: string;
  }) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nuevos.q !== undefined) {
      setBusqueda(nuevos.q);
      if (nuevos.q.trim()) nextParams.set('q', nuevos.q.trim());
      else nextParams.delete('q');
    }
    if (nuevos.tipo !== undefined) {
      setTipoFiltro(nuevos.tipo);
      if (nuevos.tipo) nextParams.set('tipo', nuevos.tipo);
      else nextParams.delete('tipo');
    }
    if (nuevos.sort !== undefined) {
      setOrden(nuevos.sort);
      if (nuevos.sort && nuevos.sort !== 'recomendados') nextParams.set('orden', nuevos.sort);
      else nextParams.delete('orden');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setTipoFiltro('');
    setOrden('recomendados');
    setSearchParams({}, { replace: true });
  };

  const productosFiltrados = useMemo(() => {
    let list = [...productos];

    if (tipoFiltro) {
      list = list.filter(p => p.tipo_item === tipoFiltro);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      list = list.filter(p => {
        const t = (p.titulo || '').toLowerCase();
        const d = (p.descripcion || '').toLowerCase();
        const c = (p.categoria?.nombre || '').toLowerCase();
        return t.includes(q) || d.includes(q) || c.includes(q);
      });
    }

    if (orden === 'precio_asc') {
      list.sort((a, b) => (a.precio || 0) - (b.precio || 0));
    } else if (orden === 'precio_desc') {
      list.sort((a, b) => (b.precio || 0) - (a.precio || 0));
    } else if (orden === 'nombre_asc') {
      list.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    }

    return list;
  }, [productos, tipoFiltro, busqueda, orden]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-[3px] border-surface-200 border-t-[#164281] rounded-full animate-spin mb-4" />
        <p className="text-surface-500 text-sm font-medium">Cargando catálogo...</p>
      </div>
    );
  }

  if (!catalogo) return null;

  const totalProductos = productos.filter(p => p.tipo_item === 'producto').length;
  const totalServicios = productos.filter(p => p.tipo_item === 'servicio').length;
  const hayFiltrosActivos = Boolean(busqueda.trim() || tipoFiltro || orden !== 'recomendados');

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 flex flex-col font-sans selection:bg-[#164281] selection:text-white">
      <Helmet>
        <title>{catalogo.nombre} — MOVI Store</title>
        <meta property="og:title" content={`${catalogo.nombre} — MOVI Store`} />
        {catalogo.descripcion && <meta property="og:description" content={catalogo.descripcion} />}
        {catalogo.imagen_portada_url && <meta property="og:image" content={catalogo.imagen_portada_url} />}
        <meta property="og:url" content={`https://tienda.movi.digital/catalogo/${catalogo.slug}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${catalogo.nombre} — MOVI Store`} />
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
              <span>Tienda General</span>
            </Link>
          </div>

          <Link to="/" className="flex items-center gap-2">
            <img src="/movirecurso_7.png" alt="MOVI" className="h-7 w-auto object-contain" />
            <span className="text-white font-bold text-lg tracking-tight">MOVI</span>
            <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold bg-blue-500/10 border border-blue-400/20 px-1.5 py-0.5 rounded">
              Store
            </span>
          </Link>

          <a
            href="https://app.movi.digital/store"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#164281] hover:bg-[#1e5fac] text-white transition-all shadow-sm"
          >
            <span>Ir a MOVI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Hero del catálogo */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#040c1f] via-[#081a38] to-[#164281] text-white py-12 sm:py-16 border-b border-white/10">
        {catalogo.imagen_portada_url && (
          <img
            src={catalogo.imagen_portada_url}
            alt={catalogo.nombre}
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#040c1f] via-transparent to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold mb-4 backdrop-blur-sm">
              <Layers className="w-3.5 h-3.5" />
              <span>Colección Especial</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-3">
              {catalogo.nombre}
            </h1>
            {catalogo.descripcion && (
              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-6">
                {catalogo.descripcion}
              </p>
            )}

            {/* In-catalog live search */}
            <div className="relative max-w-xl">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => actualizarFiltros({ q: e.target.value })}
                  placeholder={`Buscar dentro de ${catalogo.nombre}...`}
                  className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/95 text-slate-900 placeholder:text-slate-400 font-medium text-sm shadow-lg shadow-black/30 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                />
                {busqueda && (
                  <button
                    onClick={() => actualizarFiltros({ q: '' })}
                    className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Filter & Sort Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-200 mb-8">
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-surface-200/70 rounded-xl">
              <button
                onClick={() => actualizarFiltros({ tipo: '' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !tipoFiltro
                    ? 'bg-white text-surface-900 shadow-sm'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                Todos ({productos.length})
              </button>
              {totalProductos > 0 && (
                <button
                  onClick={() => actualizarFiltros({ tipo: 'producto' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    tipoFiltro === 'producto'
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Productos ({totalProductos})</span>
                </button>
              )}
              {totalServicios > 0 && (
                <button
                  onClick={() => actualizarFiltros({ tipo: 'servicio' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    tipoFiltro === 'servicio'
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-purple-600" />
                  <span>Servicios ({totalServicios})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-surface-200 shadow-sm">
              <SlidersHorizontal className="w-3.5 h-3.5 text-surface-400" />
              <select
                value={orden}
                onChange={e => actualizarFiltros({ sort: e.target.value })}
                className="bg-transparent text-xs font-semibold text-surface-700 focus:outline-none cursor-pointer"
              >
                <option value="recomendados">Orden del catálogo</option>
                <option value="precio_asc">Precio: Menor a Mayor</option>
                <option value="precio_desc">Precio: Mayor a Menor</option>
                <option value="nombre_asc">Nombre: A - Z</option>
              </select>
            </div>
          </div>
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-surface-200 p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-1">No encontramos artículos</h3>
            <p className="text-surface-500 text-sm mb-6">
              {busqueda
                ? `No hay coincidencias para "${busqueda}" en este catálogo.`
                : 'No hay productos disponibles actualmente en este catálogo.'}
            </p>
            {hayFiltrosActivos ? (
              <button
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#164281] text-white text-xs font-bold hover:bg-[#1e5fac] transition-colors shadow-md"
              >
                Ver todos los de este catálogo
              </button>
            ) : (
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#164281] text-white text-xs font-bold hover:bg-[#1e5fac] transition-colors shadow-md"
              >
                Explorar otros catálogos
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productosFiltrados.map(p => {
              const esServicio = p.tipo_item === 'servicio';
              const esPorPedido = p.disponibilidad === 'por_pedido';
              const comprarUrl = `https://app.movi.digital/store?producto=${p.id}`;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-200/80 group flex flex-col hover:-translate-y-1"
                >
                  <Link to={`/producto/${p.id}`} className="block relative aspect-square bg-surface-100 overflow-hidden">
                    <img
                      src={p.imagen_url || PLACEHOLDER_SVG}
                      alt={p.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={e => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                      }}
                    />
                    <div className="absolute top-2.5 left-2.5">
                      {p.categoria && (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-surface-800 shadow-sm backdrop-blur-sm">
                          {p.categoria.nombre}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      {esServicio ? (
                        <span className="inline-flex items-center gap-1 bg-purple-600/90 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          <Wrench className="w-3 h-3" /> Servicio
                        </span>
                      ) : esPorPedido ? (
                        <span className="inline-flex items-center gap-1 bg-blue-600/90 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          <Clock className="w-3 h-3" /> Por pedido
                        </span>
                      ) : null}
                    </div>
                  </Link>

                  <div className="p-4 pb-2 flex-1 flex flex-col justify-between">
                    <div>
                      <Link to={`/producto/${p.id}`} className="block group-hover:text-[#164281] transition-colors">
                        <h3 className="text-sm font-bold text-surface-900 line-clamp-2 leading-snug">
                          {p.titulo}
                        </h3>
                      </Link>
                      {p.descripcion && (
                        <p className="text-xs text-surface-500 line-clamp-2 mt-1.5 leading-relaxed">
                          {p.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-surface-400 block">Precio</span>
                        <span className="text-lg font-black text-[#164281]">{fmt(p.precio)}</span>
                        <span className="text-[10px] text-surface-500 ml-1">MXN</span>
                      </div>
                      <Link
                        to={`/producto/${p.id}`}
                        className="text-xs font-bold text-[#164281] hover:underline flex items-center gap-0.5"
                      >
                        Detalles <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <a
                      href={comprarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-[#164281] hover:bg-[#1e5fac] active:scale-[0.98] text-white transition-all shadow-sm"
                    >
                      <span>{esServicio ? 'Solicitar en MOVI' : 'Comprar en MOVI'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#040c1f] text-slate-400 text-xs py-10 border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
