import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// Cachea por URL para no re-renderizar el mismo PDF si el componente se desmonta/monta
// de nuevo (ej. al filtrar o re-ordenar la lista de archivos).
const cache = new Map<string, Promise<string | null>>();

/** Renderiza la primera pagina de un PDF a un data URL de imagen, para usar como thumbnail. */
export function getPdfThumbnail(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = renderFirstPage(url);
  cache.set(url, promise);
  return promise;
}

async function renderFirstPage(url: string): Promise<string | null> {
  try {
    const pdf = await getDocument(url).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}
