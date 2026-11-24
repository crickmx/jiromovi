// Filtros de la lista de correos (sobre lo que ya está cargado).

export type FiltroFecha = 'todas' | 'hoy' | '7d' | '30d';
export interface FiltrosCorreo { noLeidos: boolean; conAdjuntos: boolean; fecha: FiltroFecha; remitente: string }
export const FILTROS_VACIOS: FiltrosCorreo = { noLeidos: false, conAdjuntos: false, fecha: 'todas', remitente: '' };

export interface CorreoFiltrable { seen: boolean; hasAttachments: boolean; date: string; from: string; fromEmail: string }

export function hayFiltros(f: FiltrosCorreo): boolean {
  return f.noLeidos || f.conAdjuntos || f.fecha !== 'todas' || !!f.remitente.trim();
}

export function aplicarFiltros<T extends CorreoFiltrable>(lista: T[], f: FiltrosCorreo, ahora = new Date()): T[] {
  const rem = f.remitente.trim().toLowerCase();
  let desde: number | null = null;
  if (f.fecha === 'hoy') { const d = new Date(ahora); d.setHours(0, 0, 0, 0); desde = d.getTime(); }
  if (f.fecha === '7d') desde = ahora.getTime() - 7 * 864e5;
  if (f.fecha === '30d') desde = ahora.getTime() - 30 * 864e5;
  return lista.filter(m =>
    (!f.noLeidos || !m.seen) &&
    (!f.conAdjuntos || m.hasAttachments) &&
    (desde === null || (Date.parse(m.date) || 0) >= desde) &&
    (!rem || m.from.toLowerCase().includes(rem) || m.fromEmail.toLowerCase().includes(rem)),
  );
}

/** Partes de un texto con las coincidencias marcadas, para resaltar resultados. */
export function resaltar(texto: string, consulta: string): { t: string; hit: boolean }[] {
  const q = consulta.trim();
  if (!q || !texto) return [{ t: texto, hit: false }];
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // La normalización NFD + quitar acentos conserva la longitud de cada letra base
  // sólo si se hace carácter por carácter; se mapea índice a índice.
  const base = [...texto].map(ch => n(ch));
  const plano = base.join('');
  const nq = n(q);
  const out: { t: string; hit: boolean }[] = [];
  let i = 0;
  let desde = 0;
  // Índice en `plano` → índice de carácter original
  const mapa: number[] = [];
  base.forEach((b, idx) => { for (let k = 0; k < b.length; k++) mapa.push(idx); });
  const chars = [...texto];
  while ((i = plano.indexOf(nq, desde)) !== -1) {
    const a = mapa[i];
    const b = mapa[i + nq.length - 1] + 1;
    const prev = mapa[desde] ?? chars.length;
    if (a > prev) out.push({ t: chars.slice(prev, a).join(''), hit: false });
    out.push({ t: chars.slice(a, b).join(''), hit: true });
    desde = i + nq.length;
    if (desde >= plano.length) break;
  }
  const resto = desde < plano.length ? mapa[desde] : chars.length;
  if (resto < chars.length) out.push({ t: chars.slice(resto).join(''), hit: false });
  return out.length ? out : [{ t: texto, hit: false }];
}

/** Fecha relativa corta en español. */
export function fechaRelativa(dateStr: string, ahora = new Date()): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr || '';
  const min = Math.round((ahora.getTime() - d.getTime()) / 60000);
  if (min >= 0 && min < 1) return 'Ahora';
  if (min >= 0 && min < 60) return `Hace ${min} min`;
  if (d.toDateString() === ahora.toDateString()) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  const dias = (ahora.getTime() - d.getTime()) / 864e5;
  if (dias > 0 && dias < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
  if (d.getFullYear() === ahora.getFullYear()) return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '');
}
