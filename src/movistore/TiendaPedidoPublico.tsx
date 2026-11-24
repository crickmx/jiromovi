import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, UserX, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  useCarritoPublico,
  actualizarCantidadPublico,
  quitarDelCarritoPublico,
  vaciarCarritoPublico,
} from './carritoPublico';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-white text-surface-900 text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';

interface Resultado {
  folio: string;
  total: number;
}

export function TiendaPedidoPublico() {
  const { items, total } = useCarritoPublico();
  const [oficinas, setOficinas] = useState<{ id: string; nombre: string }[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [oficinaId, setOficinaId] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    supabase.rpc('store_oficinas_publicas').then(({ data, error: err }) => {
      if (err) console.error('Error cargando oficinas:', err);
      setOficinas((data ?? []) as { id: string; nombre: string }[]);
    });
  }, []);

  const digitosWhatsapp = whatsapp.replace(/\D/g, '');
  const formularioValido =
    nombre.trim().split(/\s+/).length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    digitosWhatsapp.length >= 10 &&
    Boolean(oficinaId);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioValido || items.length === 0) return;
    setEnviando(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('store_crear_pedido_publico', {
      p_nombre: nombre.trim(),
      p_email: email.trim(),
      p_whatsapp: digitosWhatsapp,
      p_oficina_id: oficinaId,
      p_items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, atributos: i.atributos })),
      p_notas: notas.trim() || null,
    });
    setEnviando(false);
    if (err) {
      setError(err.message || 'No se pudo enviar tu pedido. Intenta de nuevo.');
      return;
    }
    const r = data as { folio: string; total: number };
    setResultado({ folio: r.folio, total: Number(r.total) });
    vaciarCarritoPublico();
  };

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 flex flex-col font-sans">
      <Helmet>
        <title>Tu pedido — MOVI Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="bg-[#040c1f]/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Seguir comprando</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src="/movirecurso_7.png" alt="MOVI" className="h-7 w-auto object-contain" />
            <span className="text-white font-bold text-lg tracking-tight">MOVI</span>
            <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold bg-blue-500/10 border border-blue-400/20 px-1.5 py-0.5 rounded">
              Store
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        {resultado ? (
          <div className="max-w-lg mx-auto text-center bg-surface-card rounded-3xl border border-surface-200 p-8 shadow-card">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black mb-2">¡Recibimos tu pedido!</h1>
            <p className="text-surface-600 text-sm mb-5">
              El equipo de Mercadotecnia lo revisará y te contactará por WhatsApp o correo para confirmar pago y entrega.
            </p>
            <div className="bg-surface-50 border border-surface-200 rounded-2xl p-4 mb-6">
              <p className="text-[11px] uppercase font-bold tracking-wider text-surface-500">Folio de tu orden</p>
              <p className="text-xl font-black text-accent-ink tracking-wide mt-1">{resultado.folio}</p>
              <p className="text-xs text-surface-500 mt-1">Total estimado: {fmt(resultado.total)} MXN</p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-[#1e5fac] transition-colors"
            >
              Volver a la tienda
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-lg mx-auto text-center bg-surface-card rounded-3xl border border-surface-200 p-8 shadow-card">
            <ShoppingBag className="w-12 h-12 mx-auto text-surface-300 mb-3" />
            <h1 className="text-xl font-bold mb-1">Tu pedido está vacío</h1>
            <p className="text-surface-500 text-sm mb-6">
              Agrega productos marcados como <strong>Sin registro</strong> para pedirlos sin cuenta MOVI.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-[#1e5fac] transition-colors"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Resumen */}
            <section className="lg:col-span-2 lg:order-2 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-surface-600">Tu pedido</h2>
              {items.map(item => (
                <div key={item.key} className="bg-surface-card rounded-2xl border border-surface-200 p-3 flex gap-3">
                  {item.imagen_url && (
                    <img src={item.imagen_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug line-clamp-2">{item.titulo}</p>
                    {Object.keys(item.atributos).length > 0 && (
                      <p className="text-[11px] text-surface-500 mt-0.5">
                        {Object.entries(item.atributos).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Quitar una pieza"
                          onClick={() => actualizarCantidadPublico(item.key, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                          className="w-7 h-7 rounded-lg border border-surface-300 flex items-center justify-center disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold">{item.cantidad}</span>
                        <button
                          type="button"
                          aria-label="Agregar una pieza"
                          onClick={() => actualizarCantidadPublico(item.key, item.cantidad + 1)}
                          className="w-7 h-7 rounded-lg border border-surface-300 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar producto"
                          onClick={() => quitarDelCarritoPublico(item.key)}
                          className="ml-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-black">{fmt(item.precio * item.cantidad)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-surface-card rounded-2xl border border-surface-200 p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-surface-600">Total estimado</span>
                <span className="text-xl font-black text-accent-ink">{fmt(total)}</span>
              </div>
            </section>

            {/* Formulario */}
            <form onSubmit={enviar} className="lg:col-span-3 lg:order-1 bg-surface-card rounded-3xl border border-surface-200 p-5 sm:p-7 shadow-card space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <UserX className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  <strong>No necesitas cuenta MOVI.</strong> Déjanos tus datos y el equipo de Mercadotecnia te contactará para confirmar tu orden.
                </p>
              </div>

              <div>
                <label htmlFor="pp-nombre" className="block text-xs font-bold text-surface-700 mb-1.5">Nombre completo *</label>
                <input id="pp-nombre" className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" placeholder="Nombre y apellidos" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pp-email" className="block text-xs font-bold text-surface-700 mb-1.5">Correo electrónico *</label>
                  <input id="pp-email" type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" required />
                </div>
                <div>
                  <label htmlFor="pp-wa" className="block text-xs font-bold text-surface-700 mb-1.5">WhatsApp *</label>
                  <div className="relative">
                    <MessageCircle className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input id="pp-wa" type="tel" inputMode="tel" className={`${inputCls} pl-9`} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} autoComplete="tel" placeholder="10 dígitos" required />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="pp-oficina" className="block text-xs font-bold text-surface-700 mb-1.5">Oficina a la que perteneces *</label>
                <select id="pp-oficina" className={inputCls} value={oficinaId} onChange={e => setOficinaId(e.target.value)} required>
                  <option value="">Selecciona tu oficina…</option>
                  {oficinas.map(o => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pp-notas" className="block text-xs font-bold text-surface-700 mb-1.5">Notas (opcional)</label>
                <textarea id="pp-notas" rows={3} maxLength={1000} className={inputCls} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Instrucciones especiales, personalización…" />
              </div>

              {error && (
                <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={!formularioValido || enviando}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent hover:bg-[#1e5fac] text-accent-foreground font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                {enviando ? 'Enviando pedido…' : 'Enviar pedido'}
              </button>
              <p className="text-[11px] text-surface-500 text-center">
                Al enviar aceptas que usemos estos datos solo para dar seguimiento a tu orden. El precio final se confirma al validar tu pedido.
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
