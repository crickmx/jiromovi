const PDF_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDF_JS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import(/* @vite-ignore */ PDF_JS_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    if (pageText.trim()) {
      pages.push(pageText);
    }
  }

  return pages.join('\n\n');
}
