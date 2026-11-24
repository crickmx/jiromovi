// Borradores de correo en el navegador. El texto va en localStorage (como
// antes, con la misma clave para los correos nuevos); los adjuntos van en
// IndexedDB porque pueden pesar varios MB y localStorage no los aguanta.

export interface AdjuntoBorrador { name: string; type: string; size: number; base64: string }
export interface Borrador {
  to: string[]; cc: string[]; bcc: string[];
  subject: string; bodyHtml: string;
  inReplyTo?: string; references?: string;
  savedAt: number;
}

const DB = 'movi_correo';
const STORE = 'adjuntos_borrador';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('sin IndexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await abrir();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const r = fn(tx.objectStore(STORE));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    });
  } catch { return undefined; }
}

export function leerBorrador(clave: string): Borrador | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function leerAdjuntos(clave: string): Promise<AdjuntoBorrador[]> {
  return (await idb<AdjuntoBorrador[]>('readonly', s => s.get(clave))) || [];
}

export async function guardarBorrador(clave: string, b: Borrador, adjuntos: AdjuntoBorrador[]): Promise<boolean> {
  let ok = true;
  try { localStorage.setItem(clave, JSON.stringify(b)); } catch { ok = false; }
  if (adjuntos.length) { if ((await idb('readwrite', s => s.put(adjuntos, clave))) === undefined) ok = false; }
  else await idb('readwrite', s => s.delete(clave));
  return ok;
}

export async function borrarBorrador(clave: string): Promise<void> {
  try { localStorage.removeItem(clave); } catch { /* ignore */ }
  await idb('readwrite', s => s.delete(clave));
}

export function base64AFile(a: AdjuntoBorrador): File {
  const bin = atob(a.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], a.name, { type: a.type });
}
