// Qué significa cada clasificación de estatus, en un solo lugar.
//
// Un estatus puede marcarse en el FormBuilder como 'inicio', 'terminacion' o
// 'en_espera' (o ninguna). Esa marca tiene consecuencias reales —'terminacion'
// cierra el trámite— pero en pantalla todas las opciones se veían iguales: había
// que elegir una para enterarse. Aquí viven el color y la frase que lo explican,
// porque el mapa de colores estaba copiado en cuatro lugares del detalle y ya
// empezaba a divergir.

/**
 * Las marcas que entiende el sistema son 'inicio', 'terminacion' y 'en_espera',
 * pero la columna es texto libre y las filas viejas traen cualquier cosa: el
 * tipo se deja abierto a propósito y lo desconocido cae en el caso neutro.
 */
export type Clasificacion = string | null | undefined;

export function colorDeClasificacion(c: Clasificacion): string {
  switch (c) {
    case 'inicio':      return '#3B82F6'; // azul
    case 'terminacion': return '#059669'; // verde
    case 'en_espera':   return '#F59E0B'; // ámbar
    default:            return '#6B7280'; // gris
  }
}

/** Clase de Tailwind para el punto de color, donde no se puede usar estilo inline. */
export function clasePuntoClasificacion(c: Clasificacion): string {
  switch (c) {
    case 'inicio':      return 'bg-blue-500';
    case 'terminacion': return 'bg-green-500';
    case 'en_espera':   return 'bg-amber-500';
    default:            return 'bg-neutral-400';
  }
}

/** Qué le pasa al trámite al elegir ese estatus. Se muestra junto a la opción. */
export const EFECTO_CLASIFICACION: Record<string, string> = {
  inicio: 'Arranca el trámite',
  terminacion: 'Cierra el trámite',
  en_espera: 'Lo deja en espera',
  '': 'Sigue en proceso',
};

export function efectoDeClasificacion(c: Clasificacion): string {
  return EFECTO_CLASIFICACION[c ?? ''] ?? EFECTO_CLASIFICACION[''];
}
