// Caché en memoria (a nivel de módulo, persiste mientras viva la pestaña) para
// el correo nativo. Evita re-consultar IMAP —cada consulta abre una conexión
// nueva a IONOS— al cambiar de carpeta, volver atrás o reabrir un mensaje.
//
// - Listas (carpeta+página): TTL corto, porque pueden llegar correos nuevos.
// - Cuerpos de mensaje (por uid): inmutables dentro de la sesión ⇒ sin TTL,
//   sólo un tope de tamaño (LRU simple).
// - Contactos IONOS: TTL medio (se derivan del buzón, cambian poco).

interface Entry<T> { data: T; ts: number; }

const LIST_TTL = 60_000;        // 1 min
const CONTACTS_TTL = 10 * 60_000; // 10 min
const MAX_BODIES = 60;

const listCache = new Map<string, Entry<unknown>>();
// Clave = `${carpeta}:${uid}` — los UID de IMAP son únicos por carpeta, no
// globalmente, así que dos carpetas pueden repetir uid.
const bodyCache = new Map<string, unknown>();
let contactsCache: Entry<unknown> | null = null;

function listKey(folder: string, page: number): string {
  return `${folder}::${page}`;
}

export const emailCache = {
  getList<T>(folder: string, page: number): T | null {
    const e = listCache.get(listKey(folder, page));
    if (!e) return null;
    if (Date.now() - e.ts > LIST_TTL) { listCache.delete(listKey(folder, page)); return null; }
    return e.data as T;
  },
  setList<T>(folder: string, page: number, data: T): void {
    listCache.set(listKey(folder, page), { data, ts: Date.now() });
  },
  invalidateFolder(folder: string): void {
    for (const k of [...listCache.keys()]) {
      if (k.startsWith(`${folder}::`)) listCache.delete(k);
    }
  },

  getBody<T>(key: string): T | null {
    return (bodyCache.has(key) ? (bodyCache.get(key) as T) : null);
  },
  setBody<T>(key: string, data: T): void {
    if (!bodyCache.has(key) && bodyCache.size >= MAX_BODIES) {
      const oldest = bodyCache.keys().next().value;
      if (oldest !== undefined) bodyCache.delete(oldest);
    }
    bodyCache.set(key, data);
  },
  deleteBody(key: string): void {
    bodyCache.delete(key);
  },

  getContacts<T>(): T | null {
    if (!contactsCache) return null;
    if (Date.now() - contactsCache.ts > CONTACTS_TTL) { contactsCache = null; return null; }
    return contactsCache.data as T;
  },
  setContacts<T>(data: T): void {
    contactsCache = { data, ts: Date.now() };
  },

  clearAll(): void {
    listCache.clear();
    bodyCache.clear();
    contactsCache = null;
  },
};
