import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { StoreProducto } from '@/lib/storeTypes';

const BRAND = '#2285de';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export function TiendaProducto() {
  const { id } = useParams<{ id: string }>();
  const [producto, setProducto] = useState<StoreProducto | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('store_productos')
      .select('*, categoria:store_categorias(id, nombre)')
      .eq('id', id)
      .eq('activo', true)
      .maybeSingle()
      .then(({ data }) => {
        setProducto(data as StoreProducto | null);
        setCargando(false);
      });
  }, [id]);

  useEffect(() => {
    document.title = producto ? `${producto.titulo} — MOVI Tienda` : 'MOVI Tienda';
    return () => { document.title = 'MOVI Tienda'; };
  }, [producto]);

  const comprarUrl = `https://app.movi.digital/store${producto ? `?producto=${producto.id}` : ''}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Tienda
          </Link>
          <span className="flex-1" />
          <span className="text-xl font-bold tracking-tight" style={{ color: BRAND }}>MOVI</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
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
          <div className="sm:flex sm:gap-8 items-start">
            {/* Image */}
            <div className="sm:w-80 shrink-0">
              <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.titulo} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-200 text-7xl">📦</div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="mt-5 sm:mt-0 flex flex-col">
              {producto.categoria && (
                <span className="text-sm text-gray-400 font-medium mb-1">{producto.categoria.nombre}</span>
              )}
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">{producto.titulo}</h1>
              <p className="text-3xl font-bold mt-2" style={{ color: BRAND }}>{fmt(producto.precio)}</p>

              {producto.descripcion && (
                <p className="text-gray-500 mt-3 text-sm leading-relaxed">{producto.descripcion}</p>
              )}

              <div className="mt-6">
                <a
                  href={comprarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-3.5 px-8 rounded-2xl text-white font-bold text-base transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ backgroundColor: BRAND }}
                >
                  Comprar en MOVI
                </a>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Se abrirá la app MOVI donde puedes iniciar sesión y completar tu compra
                </p>
              </div>
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
