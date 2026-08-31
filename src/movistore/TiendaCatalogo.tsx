import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabase';
import type { StoreProducto } from '@/lib/storeTypes';

const BRAND = '#2285de';

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
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [cargando, setCargando] = useState(true);

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
        if (!cat) { navigate('/'); return; }
        setCatalogo(cat);
        document.title = `${cat.nombre} — MOVI Tienda`;

        const { data: rels } = await supabase
          .from('store_catalogo_productos')
          .select('producto_id, orden, producto:store_productos(*, categoria:store_categorias(id, nombre))')
          .eq('catalogo_id', cat.id)
          .order('orden', { ascending: true });

        setProductos(
          (rels ?? [])
            .map((r: any) => r.producto)
            .filter(Boolean) as StoreProducto[]
        );
        setCargando(false);
      });
  }, [slug]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-gray-200 rounded-full animate-spin" style={{ borderTopColor: BRAND }} />
      </div>
    );
  }

  if (!catalogo) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{catalogo.nombre} — MOVI Tienda</title>
        <meta property="og:title" content={`${catalogo.nombre} — MOVI Tienda`} />
        {catalogo.descripcion && <meta property="og:description" content={catalogo.descripcion} />}
        {catalogo.imagen_portada_url && <meta property="og:image" content={catalogo.imagen_portada_url} />}
        <meta property="og:url" content={`https://tienda.movi.digital/catalogo/${catalogo.slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-2xl font-bold tracking-tight" style={{ color: BRAND }}>MOVI</Link>
          <span className="text-gray-300 text-xl font-light">|</span>
          <Link to="/" className="text-gray-500 font-medium hover:text-gray-700 transition">Tienda</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-800 font-semibold truncate">{catalogo.nombre}</span>
        </div>
      </header>

      {/* Hero del catálogo */}
      <div className="relative overflow-hidden" style={{ background: BRAND }}>
        {catalogo.imagen_portada_url && (
          <img
            src={catalogo.imagen_portada_url}
            alt={catalogo.nombre}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-12 text-white">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{catalogo.nombre}</h1>
          {catalogo.descripcion && (
            <p className="text-white/80 text-lg max-w-2xl">{catalogo.descripcion}</p>
          )}
          <p className="mt-3 text-white/60 text-sm">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>
      </div>

      {/* Productos */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {productos.length === 0 ? (
          <p className="text-center text-gray-400 py-20">Este catálogo no tiene productos aún.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productos.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 group flex flex-col"
              >
                <Link to={`/producto/${p.id}`} className="block">
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200 text-5xl">📦</div>
                    )}
                  </div>
                  <div className="p-3 pb-2">
                    {(p as any).categoria && (
                      <span className="text-xs text-gray-400 font-medium">{(p as any).categoria.nombre}</span>
                    )}
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 mt-0.5 leading-snug">{p.titulo}</p>
                    <p className="text-base font-bold mt-1.5" style={{ color: BRAND }}>{fmt(p.precio)}</p>
                  </div>
                </Link>
                <div className="px-3 pb-3 mt-auto">
                  <a
                    href={`https://app.movi.digital/store?producto=${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND }}
                  >
                    Comprar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-300">
        © {new Date().getFullYear()} MOVI — Grupo Jiro
      </footer>
    </div>
  );
}
