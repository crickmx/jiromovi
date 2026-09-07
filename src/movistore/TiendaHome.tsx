import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Search,
  SlidersHorizontal,
  Package,
  Wrench,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Layers,
  CheckCircle2,
  X,
  Clock,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreCategoria, StoreProducto, TipoItem } from '@/lib/storeTypes';

const BRAND = '#164281';
const BRAND_BRIGHT = '#1e70d1';
const BRAND_BG = '#040c1f';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Cpath d='M160 240l40-60 40 60M220 240l30-40 30 40' stroke='%23cbd5e1' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='180' cy='160' r='16' fill='%23cbd5e1'/%3E%3Crect x='120' y='120' width='160' height='160' rx='12' stroke='%23cbd5e1' stroke-width='4' fill='none'/%3E%3C/svg%3E";

interface Catalogo {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_portada_url: string | null;
}

export function TiendaHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filters & Search
  const catParam = searchParams.get('categoria') || '';
  const searchParam = searchParams.get('q') || '';
  const tipoParam = (searchParams.get('tipo') as TipoItem | '') || '';
  const sortParam = searchParams.get('orden') || 'recomendados';

  const [busqueda, setBusqueda] = useState(searchParam);
  const [catActiva, setCatActiva] = useState<string>(catParam);
  const [tipoFiltro, setTipoFiltro] = useState<TipoItem | ''>(tipoParam);
  const [orden, setOrden] = useState<string>(sortParam);

  useEffect(() => {
    document.title = 'MOVI Store — Catálogo y Tienda Oficial';
    Promise.all([
      supabase
        .from('store_categorias')
        .select('*')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('store_catalogos')
        .select('id, nombre, slug, descripcion, imagen_portada_url')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('store_productos')
        .select('*, categoria:store_categorias(id, nombre)')
        .eq('activo', true)
        .order('orden', { ascending: true })
    ]).then(([resCat, resCatalogos, resProd]) => {
      setCategorias((resCat.data ?? []) as StoreCategoria[]);
      setCatalogos((resCatalogos.data ?? []) as Catalogo[]);
      setProductos((resProd.data ?? []) as StoreProducto[]);
      setCargando(false);
    });
  }, []);

  // Sync state to URL params cleanly
  const actualizarFiltros = (nuevos: {
    cat?: string;
    q?: string;
    tipo?: TipoItem | '';
    sort?: string;
  }) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nuevos.cat !== undefined) {
      setCatActiva(nuevos.cat);
      if (nuevos.cat) nextParams.set('categoria', nuevos.cat);
      else nextParams.delete('categoria');
    }
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
    setCatActiva('');
    setTipoFiltro('');
    setOrden('recomendados');
    setSearchParams({}, { replace: true });
  };

  // Filter & sort logic
  const productosFiltrados = useMemo(() => {
    let list = [...productos];

    if (catActiva) {
      list = list.filter(p => p.categoria_id === catActiva);
    }

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
    } else {
      list.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    }

    return list;
  }, [productos, catActiva, tipoFiltro, busqueda, orden]);

  const totalProductosCount = productos.filter(p => p.tipo_item === 'producto').length;
  const totalServiciosCount = productos.filter(p => p.tipo_item === 'servicio').length;
  const hayFiltrosActivos = Boolean(catActiva || busqueda.trim() || tipoFiltro || orden !== 'recomendados');
  const catActivaData = categorias.find(c => c.id === catActiva) ?? null;

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 flex flex-col font-sans selection:bg-[#164281] selection:text-white">
      <Helmet>
        <title>MOVI Store — Catálogo y Tienda Oficial</title>
        <meta property="og:title" content="MOVI Store — Catálogo y Tienda Oficial" />
        <meta
          property="og:description"
          content="Explora el catálogo de productos, herramientas y servicios oficiales de MOVI Digital para agentes de seguros."
        />
        <meta property="og:image" content="https://app.movi.digital/movirecurso_7.png" />
        <meta property="og:url" content="https://tienda.movi.digital/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Store — Catálogo Oficial" />
        <meta name="twitter:image" content="https://app.movi.digital/movirecurso_7.png" />
        <meta name="theme-color" content="#164281" />
      </Helmet>

      {/* Top Navbar */}
      <header className="bg-[#040c1f]/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link to="/" onClick={limpiarFiltros} className="flex items-center gap-3 group shrink-0">
            <img
              src="/movirecurso_7.png"
              alt="MOVI"
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">
                MOVI
              </span>
              <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold bg-blue-500/10 border border-blue-400/20 px-2 py-0.5 rounded-md">
                Store
              </span>
            </div>
          </Link>

          {/* Quick Stats / Direct MOVI App CTA */}
          <div className="flex items-center gap-3">
            <a
              href="https://app.movi.digital/store"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all shadow-sm"
            >
              <span>Ir a Mi Carrito en MOVI</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
            </a>
            <a
              href="https://app.movi.digital"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-[#164281] hover:bg-[#1e5fac] text-white transition-all shadow-md shadow-blue-900/40"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Acceder a MOVI</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#040c1f] via-[#081a38] to-[#164281] text-white py-12 sm:py-16 border-b border-white/10">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold mb-4 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{catActivaData ? catActivaData.nombre : 'Catálogo Oficial de Productos & Servicios'}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-3">
              {catActivaData
                ? (catActivaData.descripcion || `Todo lo que necesitas en ${catActivaData.nombre}.`)
                : 'Todo lo que necesitas para potenciar tu marca y operación.'}
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-6">
              {catActivaData
                ? `Explora los productos y servicios disponibles en la categoría ${catActivaData.nombre}.`
                : 'Explora artículos oficiales, servicios exclusivos y soluciones diseñadas para agentes y aliados MOVI Digital.'}
            </p>

            {/* Live Search Bar */}
            <div className="relative max-w-2xl">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => actualizarFiltros({ q: e.target.value })}
                  placeholder="Buscar productos, servicios, marketing, papelería..."
                  className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white/95 text-slate-900 placeholder:text-slate-400 font-medium text-sm sm:text-base shadow-lg shadow-black/30 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                />
                {busqueda && (
                  <button
                    onClick={() => actualizarFiltros({ q: '' })}
                    className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Catalogs Carousel/Grid */}
      {catalogos.length > 0 && !busqueda.trim() && (
        <section className="bg-white border-b border-surface-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#164281]" />
                <h2 className="text-lg font-bold text-surface-900 tracking-tight">Colecciones y Catálogos</h2>
              </div>
              <span className="text-xs text-surface-500 font-medium">{catalogos.length} colecciones activas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {catalogos.map(cat => (
                <Link
                  key={cat.id}
                  to={`/catalogo/${cat.slug}`}
                  className="group relative overflow-hidden rounded-2xl aspect-[16/9] bg-surface-900 shadow-sm hover:shadow-lg transition-all duration-300 border border-surface-200/60"
                >
                  {cat.imagen_portada_url ? (
                    <img
                      src={cat.imagen_portada_url}
                      alt={cat.nombre}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#164281] to-[#040c1f] flex items-center justify-center">
                      <Layers className="w-10 h-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent group-hover:from-black/90 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col justify-end">
                    <span className="text-[10px] uppercase font-bold text-blue-300 tracking-widest mb-1 flex items-center gap-1">
                      Catálogo <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                    <p className="text-white text-base font-bold line-clamp-1 leading-snug">{cat.nombre}</p>
                    {cat.descripcion && (
                      <p className="text-white/75 text-xs mt-0.5 line-clamp-1">{cat.descripcion}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content: Filters + Product Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Controls Bar: Categories & Quick Filter Chips */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-200 mb-8">
          {/* Item Type & Categories Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector (Todos / Productos / Servicios) */}
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
              <button
                onClick={() => actualizarFiltros({ tipo: 'producto' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  tipoFiltro === 'producto'
                    ? 'bg-white text-surface-900 shadow-sm'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Productos ({totalProductosCount})</span>
              </button>
              <button
                onClick={() => actualizarFiltros({ tipo: 'servicio' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  tipoFiltro === 'servicio'
                    ? 'bg-white text-surface-900 shadow-sm'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                <span>Servicios ({totalServiciosCount})</span>
              </button>
            </div>

            <div className="h-5 w-px bg-surface-300 hidden sm:block mx-1" />

            {/* Category Dropdown/Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              <button
                onClick={() => actualizarFiltros({ cat: '' })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  !catActiva
                    ? 'bg-[#164281] text-white shadow-sm'
                    : 'bg-white text-surface-700 border border-surface-200 hover:bg-surface-100'
                }`}
              >
                Todas las categorías
              </button>
              {categorias.map(c => (
                <button
                  key={c.id}
                  onClick={() => actualizarFiltros({ cat: c.id })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    catActiva === c.id
                      ? 'bg-[#164281] text-white shadow-sm'
                      : 'bg-white text-surface-700 border border-surface-200 hover:bg-surface-100'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Sorter & Clear */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-surface-200 shadow-sm">
              <SlidersHorizontal className="w-3.5 h-3.5 text-surface-400" />
              <select
                value={orden}
                onChange={e => actualizarFiltros({ sort: e.target.value })}
                className="bg-transparent text-xs font-semibold text-surface-700 focus:outline-none cursor-pointer"
              >
                <option value="recomendados">Destacados</option>
                <option value="precio_asc">Precio: Menor a Mayor</option>
                <option value="precio_desc">Precio: Mayor a Menor</option>
                <option value="nombre_asc">Nombre: A - Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Results */}
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-[3px] border-surface-200 border-t-[#164281] rounded-full animate-spin mb-4" />
            <p className="text-surface-500 text-sm font-medium">Cargando catálogo...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-surface-200 p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-1">No encontramos resultados</h3>
            <p className="text-surface-500 text-sm mb-6">
              {busqueda
                ? `No hay productos o servicios que coincidan con "${busqueda}".`
                : 'No hay artículos disponibles con los filtros seleccionados.'}
            </p>
            <button
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#164281] text-white text-xs font-bold hover:bg-[#1e5fac] transition-colors shadow-md"
            >
              <span>Ver todos los productos</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">
                Mostrando {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'}
              </p>
            </div>

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
                    {/* Image Area */}
                    <Link to={`/producto/${p.id}`} className="block relative aspect-square bg-surface-100 overflow-hidden">
                      <img
                        src={p.imagen_url || PLACEHOLDER_SVG}
                        alt={p.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={e => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                        }}
                      />
                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
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

                    {/* Content Info */}
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

                    {/* Quick Order in MOVI button */}
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#040c1f] text-slate-400 text-xs py-12 border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/movirecurso_7.png" alt="MOVI" className="h-7 w-auto object-contain" />
              <span className="text-white font-bold text-sm">MOVI Store — Grupo Jiro</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <a
                href="https://app.movi.digital"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Plataforma MOVI
              </a>
              <a
                href="https://tienda.movi.digital"
                className="text-white font-semibold"
              >
                Catálogo Público
              </a>
              <a
                href="https://app.movi.digital/store"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Mis Pedidos
              </a>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
            <p>© {new Date().getFullYear()} MOVI Digital · Grupo Jiro. Todos los derechos reservados.</p>
            <p className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-blue-400" /> Catálogo oficial y compras seguras dentro de MOVI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
