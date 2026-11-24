// Filtro de la lista de WhatsApp por buzón (WA MOVI / WA personal), estado y
// texto. Puro y sin Supabase para poder comprobarlo con
//   npx tsx src/lib/buzonWhatsApp.test.mjs
//
// El buzón es una vista: no cambia qué se carga ni qué se guarda. Los
// contadores de las pestañas se calculan sobre el buzón elegido para que lo
// que dice la pestaña y lo que se ve debajo no puedan contradecirse.

export type Buzon = 'all' | 'wa_movi' | 'wa_personal';
export type EstadoLista = 'open' | 'unread' | 'archived';

export interface ConvFiltrable {
  channel: string;
  status: string;
  unreadCount: number;
  contactPhone?: string | null;
  lastMessage?: string | null;
}

export const BUZONES: { value: Buzon; label: string; corto: string }[] = [
  { value: 'all', label: 'Todos los buzones', corto: 'Todos' },
  { value: 'wa_movi', label: 'WA MOVI', corto: 'MOVI' },
  { value: 'wa_personal', label: 'WA personal', corto: 'Personal' },
];

export function esBuzon(v: unknown): v is Buzon {
  return v === 'all' || v === 'wa_movi' || v === 'wa_personal';
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function enBuzon<T extends ConvFiltrable>(lista: T[], buzon: Buzon): T[] {
  return buzon === 'all' ? lista : lista.filter(c => c.channel === buzon);
}

export function filtrarConversaciones<T extends ConvFiltrable>(
  lista: T[],
  opts: { buzon: Buzon; estado: EstadoLista; busqueda: string; nombre: (c: T) => string },
): T[] {
  let out = enBuzon(lista, opts.buzon);
  if (opts.estado === 'unread') out = out.filter(c => c.status !== 'archived' && c.unreadCount > 0);
  else out = out.filter(c => c.status === opts.estado);
  const q = normalizar(opts.busqueda.trim());
  if (q) {
    const qDigitos = q.replace(/\D/g, '');
    out = out.filter(c =>
      normalizar(opts.nombre(c)).includes(q) ||
      (!!c.lastMessage && normalizar(c.lastMessage).includes(q)) ||
      (!!c.contactPhone && (c.contactPhone.toLowerCase().includes(q) ||
        (qDigitos.length >= 3 && c.contactPhone.replace(/\D/g, '').includes(qDigitos)))),
    );
  }
  return out;
}

export function contadores(lista: ConvFiltrable[], buzon: Buzon) {
  const delBuzon = enBuzon(lista, buzon);
  const abiertas = delBuzon.filter(c => c.status === 'open');
  return {
    abiertas: abiertas.length,
    conNoLeidos: delBuzon.filter(c => c.status !== 'archived' && c.unreadCount > 0).length,
    mensajesNoLeidos: abiertas.reduce((s, c) => s + c.unreadCount, 0),
    archivadas: delBuzon.filter(c => c.status === 'archived').length,
  };
}

/** No leídos por buzón, para los distintivos del selector. */
export function noLeidosPorBuzon(lista: ConvFiltrable[]): Record<Buzon, number> {
  const r: Record<Buzon, number> = { all: 0, wa_movi: 0, wa_personal: 0 };
  for (const c of lista) {
    if (c.status === 'archived' || c.unreadCount <= 0) continue;
    r.all += 1;
    if (c.channel === 'wa_movi' || c.channel === 'wa_personal') r[c.channel] += 1;
  }
  return r;
}
