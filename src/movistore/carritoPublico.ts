import { useEffect, useState } from 'react';
import type { StoreProducto } from '@/lib/storeTypes';

/**
 * Carrito de invitado para tienda.movi.digital.
 * Solo admite productos de categorías con `permite_pedido_publico`.
 * Vive en localStorage del navegador; el precio real lo recalcula el servidor
 * en `store_crear_pedido_publico`, aquí solo se muestra como referencia.
 */

export interface ItemCarritoPublico {
  key: string;
  producto_id: string;
  titulo: string;
  imagen_url: string | null;
  precio: number;
  cantidad: number;
  atributos: Record<string, string>;
}

const STORAGE_KEY = 'movi_tienda_carrito_publico_v1';
const EVENTO = 'movi-tienda-carrito';

export function esProductoPublico(p: Pick<StoreProducto, 'categoria'> | null | undefined): boolean {
  return Boolean(p?.categoria?.permite_pedido_publico);
}

function leer(): ItemCarritoPublico[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function escribir(items: ItemCarritoPublico[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* almacenamiento bloqueado: el carrito vive solo en memoria de esta pestaña */
  }
  memoria = items;
  window.dispatchEvent(new Event(EVENTO));
}

let memoria: ItemCarritoPublico[] | null = null;
function actuales(): ItemCarritoPublico[] {
  if (memoria === null) memoria = leer();
  return memoria;
}

function claveItem(productoId: string, atributos: Record<string, string>) {
  const attrs = Object.keys(atributos).sort().map(k => `${k}=${atributos[k]}`).join('|');
  return `${productoId}::${attrs}`;
}

/** Precio de referencia; el servidor siempre cobra el precio vigente del producto. */
export function precioConVariante(producto: StoreProducto): number {
  return producto.precio;
}

export function agregarAlCarritoPublico(producto: StoreProducto, cantidad = 1, atributos: Record<string, string> = {}) {
  const items = [...actuales()];
  const key = claveItem(producto.id, atributos);
  const existente = items.find(i => i.key === key);
  if (existente) {
    existente.cantidad = Math.min(999, existente.cantidad + cantidad);
  } else {
    items.push({
      key,
      producto_id: producto.id,
      titulo: producto.titulo,
      imagen_url: producto.imagen_url || null,
      precio: precioConVariante(producto),
      cantidad: Math.min(999, Math.max(1, cantidad)),
      atributos,
    });
  }
  escribir(items);
}

export function actualizarCantidadPublico(key: string, cantidad: number) {
  escribir(
    actuales()
      .map(i => (i.key === key ? { ...i, cantidad: Math.min(999, Math.max(1, cantidad)) } : i))
  );
}

export function quitarDelCarritoPublico(key: string) {
  escribir(actuales().filter(i => i.key !== key));
}

export function vaciarCarritoPublico() {
  escribir([]);
}

export function useCarritoPublico() {
  const [items, setItems] = useState<ItemCarritoPublico[]>(() => actuales());
  useEffect(() => {
    const sync = () => setItems(actuales());
    const syncStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        memoria = leer();
        sync();
      }
    };
    window.addEventListener(EVENTO, sync);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener(EVENTO, sync);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);
  const totalPiezas = items.reduce((s, i) => s + i.cantidad, 0);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  return { items, totalPiezas, total };
}
