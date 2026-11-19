// Lotes de UIDs y tope de uso del gestor de correo.
//
// Puro, sin Deno ni red, para poder probarlo con
//   npx tsx supabase/functions/ionos-webmail/lotes.test.mjs
//
// Vive aparte a propósito. Cada acción del gestor abre y cierra su propia
// conexión TLS contra imap.ionos.mx —no hay pool ni caché de mensajes— e IONOS
// limita las conexiones simultáneas POR BUZÓN. Operar sobre N correos tiene que
// costar UNA conexión, no N, y una ráfaga tiene que tener tope. Las dos reglas
// se deciden aquí, donde se pueden probar sin un buzón de verdad de por medio.

/** Cuántas acciones por minuto tolera un usuario antes de recibir 429. */
export const LIMITE_POR_MINUTO = 90;

/** Cuántos UIDs caben en un solo comando IMAP (el conjunto viaja en la línea). */
export const UIDS_POR_COMANDO = 200;

export function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

/**
 * Acepta `uids: number[]` (lote, una sola conexión) y, por compatibilidad, el
 * `uid` suelto que mandaban los clientes anteriores. Descarta lo que no sea un
 * UID utilizable en vez de mandarlo al servidor.
 */
export function uidsDe(body: Record<string, unknown>): number[] {
  const crudos = Array.isArray(body.uids) ? body.uids : [body.uid];
  return crudos
    .map((u) => Number(u))
    .filter((u) => Number.isInteger(u) && u > 0);
}

/** ¿Los eventos del último minuto ya llegan al tope? */
export function llegoAlTope(eventosUltimoMinuto: number): boolean {
  return eventosUltimoMinuto >= LIMITE_POR_MINUTO;
}
