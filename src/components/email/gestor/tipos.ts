import { Inbox, Send, FileText, Trash2, CircleAlert as AlertCircle, Archive, FolderOpen } from 'lucide-react';
import { tokenDeSesion } from '@/lib/sesionActiva';

// ── Tipos (los mismos que ya devolvía ionos-webmail; los campos nuevos son opcionales) ──

export interface ImapFolder {
  name: string;
  path: string;
  flags: string[];
  total: number;
  unseen: number;
}

export interface EmailHeader {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  size: number;
  snippet?: string;
  inReplyTo?: string;
  references?: string;
  folder?: string;
}

export interface EmailFull {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: { filename: string; contentType: string; size: number; partId: string }[];
  inReplyTo?: string;
  references?: string;
}

// ── Servidor de correo ─────────────────────────────────────────────

export async function callWebmail(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const accessToken = await tokenDeSesion();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ionos-webmail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.message || 'Error del servidor');
  return data;
}

// ── Carpetas ───────────────────────────────────────────────────────

export type RolCarpeta = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive' | 'otra';

const POR_NOMBRE: Record<string, RolCarpeta> = {
  inbox: 'inbox',
  sent: 'sent', 'sent items': 'sent', 'sent messages': 'sent', enviados: 'sent', 'inbox.sent': 'sent', 'elementos enviados': 'sent',
  drafts: 'drafts', borradores: 'drafts', 'inbox.drafts': 'drafts',
  spam: 'spam', junk: 'spam', 'junk e-mail': 'spam', 'correo no deseado': 'spam', 'inbox.spam': 'spam', 'inbox.junk': 'spam',
  trash: 'trash', papelera: 'trash', 'deleted items': 'trash', 'deleted messages': 'trash', 'inbox.trash': 'trash',
  archive: 'archive', archivo: 'archive', archivos: 'archive', 'inbox.archive': 'archive',
};
const POR_FLAG: Record<string, RolCarpeta> = {
  '\\sent': 'sent', '\\drafts': 'drafts', '\\junk': 'spam', '\\trash': 'trash', '\\archive': 'archive',
};

// Marcas internas que pone normalizarCarpetas (no vienen del servidor).
const SIN_ROL = '\\MoviSinRol';
const NOMBRE_REAL = '\\MoviNombreReal';

export function rolCarpeta(f: Pick<ImapFolder, 'path' | 'flags'>): RolCarpeta {
  if ((f.flags || []).includes(SIN_ROL)) return 'otra';
  for (const fl of f.flags || []) {
    const r = POR_FLAG[fl.toLowerCase()];
    if (r) return r;
  }
  return POR_NOMBRE[f.path.toLowerCase()] || 'otra';
}

const META: Record<RolCarpeta, { label: string; icon: typeof Inbox; orden: number }> = {
  inbox: { label: 'Recibidos', icon: Inbox, orden: 0 },
  sent: { label: 'Enviados', icon: Send, orden: 1 },
  drafts: { label: 'Borradores', icon: FileText, orden: 2 },
  spam: { label: 'Spam', icon: AlertCircle, orden: 3 },
  trash: { label: 'Papelera', icon: Trash2, orden: 4 },
  archive: { label: 'Archivo', icon: Archive, orden: 5 },
  otra: { label: '', icon: FolderOpen, orden: 9 },
};

const NOMBRES_COMUNES: Record<string, string> = { notes: 'Notas', starred: 'Destacados', templates: 'Plantillas' };

/**
 * IMAP guarda los nombres de carpeta con acentos en "UTF-7 modificado"
 * (RFC 3501): "Mar&AO0-a" es "María". Solo para mostrar: la ruta no se toca.
 */
export function decodificarNombreImap(s: string): string {
  return s.replace(/&([^-]*)-/g, (_m, b64: string) => {
    if (b64 === '') return '&';
    try {
      const bin = atob(b64.replace(/,/g, '/') + '==='.slice((b64.length + 3) % 4));
      let out = '';
      for (let i = 0; i + 1 < bin.length; i += 2) out += String.fromCharCode((bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1));
      return out;
    } catch { return `&${b64}-`; }
  });
}

/** Nombre real de la carpeta, con las subcarpetas como «Padre › Hija». */
function nombreReal(path: string): string {
  // IONOS separa subcarpetas con "/"; los servidores tipo Courier usan "INBOX.".
  const sinInbox = path.replace(/^INBOX[./]/i, '');
  const partes = (/^INBOX\./i.test(path) ? sinInbox.split('.') : sinInbox.split('/')).filter(Boolean).map(decodificarNombreImap);
  if (partes.length <= 1) return NOMBRES_COMUNES[sinInbox.toLowerCase()] || partes[0] || sinInbox;
  return partes.join(' › ');
}

export function etiquetaCarpeta(f: Pick<ImapFolder, 'path' | 'flags'>): string {
  if ((f.flags || []).includes(NOMBRE_REAL)) return nombreReal(f.path);
  const r = rolCarpeta(f);
  if (r !== 'otra') return META[r].label;
  return nombreReal(f.path);
}

/**
 * Si el buzón tiene dos carpetas del mismo tipo (p. ej. "Archive" y "Archivo"),
 * antes las dos salían como "Archivo". Solo una conserva el papel —la que el
 * servidor marca con su bandera, o la de nombre estándar— y, cuando hay
 * varias, todas se muestran con su nombre real para poder distinguirlas.
 */
export function normalizarCarpetas(fs: ImapFolder[]): ImapFolder[] {
  const porRol = new Map<RolCarpeta, ImapFolder[]>();
  for (const f of fs) {
    const r = rolCarpeta(f);
    if (r === 'otra' || r === 'inbox') continue;
    porRol.set(r, [...(porRol.get(r) || []), f]);
  }
  const marcas = new Map<string, string[]>();
  for (const [, grupo] of porRol) {
    if (grupo.length < 2) continue;
    const conBandera = grupo.find(f => (f.flags || []).some(fl => POR_FLAG[fl.toLowerCase()]));
    const principal = conBandera || grupo[0];
    for (const f of grupo) marcas.set(f.path, f === principal ? [NOMBRE_REAL] : [NOMBRE_REAL, SIN_ROL]);
  }
  return fs.map(f => (marcas.has(f.path) ? { ...f, flags: [...(f.flags || []), ...marcas.get(f.path)!] } : f));
}
export function iconoCarpeta(f: Pick<ImapFolder, 'path' | 'flags'>) { return META[rolCarpeta(f)].icon; }

export function ordenarCarpetas(fs: ImapFolder[]): ImapFolder[] {
  return [...fs].sort((a, b) => {
    const d = META[rolCarpeta(a)].orden - META[rolCarpeta(b)].orden;
    return d !== 0 ? d : etiquetaCarpeta(a).localeCompare(etiquetaCarpeta(b), 'es');
  });
}

export function carpetaPorRol(fs: ImapFolder[], rol: RolCarpeta): ImapFolder | undefined {
  return fs.find(f => rolCarpeta(f) === rol);
}

// ── Utilidades de presentación ─────────────────────────────────────

export function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getInitials(name: string) {
  return (name || '').replace(/["<>]/g, '').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
}

export function formatFullDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

/** Color estable por remitente para el avatar (tonos suaves del sistema). */
const TONOS = [
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
];
export function tonoAvatar(seed: string): string {
  let h = 0;
  for (const ch of seed || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

// Mismos límites que tenía la ventana de redactar.
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
