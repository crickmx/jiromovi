import { Link } from 'react-router-dom';
import { UserX, MousePointerClick, ClipboardList, MessageCircle } from 'lucide-react';
import type { StoreProducto } from '@/lib/storeTypes';
import { CtaPedidoPublico } from './PedidoPublicoUI';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const PASOS = [
  { icon: MousePointerClick, titulo: 'Elige tus productos', texto: 'Agrega al pedido lo que necesites.' },
  { icon: ClipboardList, titulo: 'Déjanos tus datos', texto: 'Nombre, correo, WhatsApp y oficina.' },
  { icon: MessageCircle, titulo: 'Te contactamos', texto: 'Mercadotecnia confirma pago y entrega.' },
];

/**
 * Hero de productos "Temporales / Públicos": se pueden pedir sin cuenta MOVI.
 * Se muestra arriba del catálogo en tienda.movi.digital.
 */
export function HeroPedidoPublico({ productos }: { productos: StoreProducto[] }) {
  return (
    <section
      aria-labelledby="hero-sin-registro"
      className="relative overflow-hidden bg-[#040c1f] text-white border-b-4 border-amber-400"
    >
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-[#1e70d1]/25 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-[#040c1f] text-xs font-black uppercase tracking-wider mb-4">
              <UserX className="w-3.5 h-3.5" /> Sin registro
            </span>
            <h2 id="hero-sin-registro" className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
              Pide sin necesidad de <span className="text-amber-400">cuenta MOVI</span>
            </h2>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-6">
              Estos productos de temporada están abiertos para todos. Haz tu pedido en minutos con tus datos de contacto
              y nosotros lo damos de alta por ti.
            </p>

            <ol className="space-y-3">
              {PASOS.map((paso, i) => (
                <li key={paso.titulo} className="flex items-start gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300">
                    <paso.icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">
                      {i + 1}. {paso.titulo}
                    </p>
                    <p className="text-xs text-neutral-400">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-7 min-w-0">
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {productos.map(p => (
                <article
                  key={p.id}
                  className="snap-start shrink-0 w-[220px] sm:w-[240px] bg-white text-surface-900 rounded-2xl overflow-hidden shadow-xl shadow-black/40 flex flex-col"
                >
                  <Link to={`/producto/${p.id}`} className="block aspect-[4/3] bg-surface-100 overflow-hidden">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.titulo}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    ) : null}
                  </Link>
                  <div className="p-3.5 flex-1 flex flex-col gap-3">
                    <div className="flex-1">
                      <Link to={`/producto/${p.id}`}>
                        <h3 className="text-sm font-bold leading-snug line-clamp-2 hover:text-[#164281]">{p.titulo}</h3>
                      </Link>
                      <p className="text-lg font-black text-accent-ink mt-1">
                        {fmt(p.precio)} <span className="text-[11px] font-semibold text-surface-500">MXN</span>
                      </p>
                    </div>
                    <CtaPedidoPublico producto={p} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
