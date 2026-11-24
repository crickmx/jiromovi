import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Check, Plus, ArrowRight, UserX } from 'lucide-react';
import type { StoreProducto } from '@/lib/storeTypes';
import { agregarAlCarritoPublico, useCarritoPublico } from './carritoPublico';

/** Botón del encabezado: lleva a /pedido y muestra cuántas piezas hay. */
export function BotonCarritoPublico() {
  const { totalPiezas } = useCarritoPublico();
  if (totalPiezas === 0) return null;
  return (
    <Link
      to="/pedido"
      aria-label={`Mi pedido (${totalPiezas} piezas)`}
      className="relative inline-flex shrink-0 items-center gap-1.5 sm:gap-2 text-xs font-bold px-2.5 sm:px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#040c1f] transition-all shadow-md"
    >
      <ShoppingBag className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Mi pedido</span>
      <span className="min-w-[20px] h-5 px-1 rounded-full bg-[#040c1f] text-white text-[11px] flex items-center justify-center">
        {totalPiezas}
      </span>
    </Link>
  );
}

/** Insignia para tarjetas de productos que se pueden pedir sin registro. */
export function InsigniaSinRegistro() {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-400 text-[#040c1f] text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
      <UserX className="w-3 h-3" /> Sin registro
    </span>
  );
}

/**
 * CTA de tarjeta para productos públicos. Si el producto tiene variantes
 * (talla, color…) manda a la ficha para elegirlas; si no, lo agrega directo.
 */
export function CtaPedidoPublico({ producto }: { producto: StoreProducto }) {
  const [agregado, setAgregado] = useState(false);
  const tieneVariantes = (producto.atributos ?? []).some(a => (a.opciones ?? []).some(o => o.activo));

  if (tieneVariantes) {
    return (
      <Link
        to={`/producto/${producto.id}`}
        className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#040c1f] transition-all shadow-sm"
      >
        <span>Elegir opciones y pedir</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        agregarAlCarritoPublico(producto, 1);
        setAgregado(true);
        setTimeout(() => setAgregado(false), 1800);
      }}
      className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#040c1f] transition-all shadow-sm"
    >
      {agregado ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
      <span>{agregado ? 'Agregado a tu pedido' : 'Agregar al pedido'}</span>
    </button>
  );
}
