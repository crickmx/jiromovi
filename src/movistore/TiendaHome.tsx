import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { StoreCategoria, StoreProducto } from '@/lib/storeTypes';

const BRAND = '#2285de';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export function TiendaHome() {
  const [categorias, setCategorias] = useState<StoreCategoria[]>([]);
  const [productos, setProductos] = useState<StoreProducto[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    document.title = 'MOVI Tienda';
    supabase
      .from('store_categorias')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setCategorias(data ?? []));
  }, []);

  useEffect(() => {
    setCargando(true);
    let q = supabase
      .from('store_productos')
      .select('*, categoria:store_categorias(id, nombre)')
      .eq('activo', true)
      .order('created_at', { ascending: false });
    if (catActiva) q = q.eq('categoria_id', catActiva);
    q.then(({ data }) => {
      setProductos((data ?? []) as StoreProducto[]);
      setCargando(false);
    });
  }, [catActiva]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold tracking-tight" style={{ color: BRAND }}>MOVI</span>
          <span className="text-gray-300 text-xl font-light">|</span>
          <span className="text-gray-500 font-medium">Tienda</span>
        </div>
      </header>

      {categorias.length > 0 && (
        <div className="bg-white border-b border-gray-100 overflow-x-auto">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex gap-2 whitespace-nowrap">
            <button
              onClick={() => setCatActiva(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                catActiva === null ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={catActiva === null ? { backgroundColor: BRAND } : undefined}
            >
              Todos
            </button>
            {categorias.map(c => (
              <button
                key={c.id}
                onClick={() => setCatActiva(c.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  catActiva === c.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={catActiva === c.id ? { backgroundColor: BRAND } : undefined}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {cargando ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-gray-200 rounded-full animate-spin" style={{ borderTopColor: BRAND }} />
          </div>
        ) : productos.length === 0 ? (
          <p className="text-center text-gray-400 py-24">No hay productos disponibles.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productos.map(p => (
              <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 group flex flex-col">
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
                    {p.categoria && (
                      <span className="text-xs text-gray-400 font-medium">{p.categoria.nombre}</span>
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
