import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Descargas dentro de la app nativa.
 *
 * Un WebView no tiene carpeta de "Descargas": un <a download> o un blob: no hace
 * nada. En la web hay ~50 lugares que descargan (Excel con XLSX.writeFile, PDF con
 * jsPDF.save, ZIPs, CSV, archivos de Storage con <a download>), así que en vez de
 * tocar cada uno se interceptan aquí los cuatro caminos por los que salen todos:
 *
 *   1. HTMLAnchorElement.prototype.click()   ← <a download> creado por código, XLSX
 *   2. HTMLAnchorElement.prototype.dispatchEvent(click) ← jsPDF / FileSaver
 *   3. clic del usuario en un <a download> de la página
 *   4. window.open(blob:/data:)              ← "ver PDF" generado en el navegador
 *
 * El archivo se escribe en la caché de la app y se abre la hoja del sistema
 * (Compartir / Guardar en Archivos / abrir con otra app). Si no se puede bajar
 * (p. ej. CORS), se abre la URL en el navegador del sistema.
 */

const nombreSeguro = (n: string) =>
  (n || 'archivo').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'archivo';

const EXT_POR_TIPO: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => mal(r.error);
    r.readAsDataURL(blob);
  });
}

function nombreDesdeUrl(href: string): string {
  try {
    const u = new URL(href);
    if (u.protocol === 'blob:' || u.protocol === 'data:') return '';
    return decodeURIComponent(u.pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

let ocupado = false;

export async function guardarYCompartir(href: string, nombre?: string): Promise<void> {
  if (ocupado) return; // un doble toque no abre dos hojas
  ocupado = true;
  try {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    let archivo = nombreSeguro(nombre || nombreDesdeUrl(href));
    const ext = EXT_POR_TIPO[blob.type.split(';')[0]];
    if (ext && !/\.[a-z0-9]{2,5}$/i.test(archivo)) archivo += `.${ext}`;
    const escrito = await Filesystem.writeFile({
      path: `descargas/${Date.now()}-${archivo}`,
      data: await blobABase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: archivo, url: escrito.uri, dialogTitle: 'Guardar o compartir' });
  } catch (e) {
    // Cancelar la hoja de compartir también llega aquí: no es un error.
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return;
    console.error('[descargas] no se pudo guardar:', msg);
    if (/^https?:/i.test(href)) Browser.open({ url: href }).catch(() => {});
  } finally {
    ocupado = false;
  }
}

const esDescarga = (a: HTMLAnchorElement) =>
  a.hasAttribute('download') || /^(blob|data):/i.test(a.href);

export function initDescargasNativas(): void {
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (esDescarga(this)) { void guardarYCompartir(this.href, this.getAttribute('download') || ''); return; }
    return clickOriginal.call(this);
  };

  const dispatchOriginal = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, ev: Event) {
    if (ev.type === 'click' && esDescarga(this)) {
      void guardarYCompartir(this.href, this.getAttribute('download') || '');
      return false;
    }
    return dispatchOriginal.call(this, ev);
  };

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !esDescarga(a)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void guardarYCompartir(a.href, a.getAttribute('download') || '');
  }, true);
}

/** Para el parche de window.open en initNative: true si se encargó. */
export function abrirBlobNativo(href: string): boolean {
  if (!/^(blob|data):/i.test(href)) return false;
  void guardarYCompartir(href, 'documento');
  return true;
}
