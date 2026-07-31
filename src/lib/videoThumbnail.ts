// Genera una miniatura JPEG a partir del primer frame decodificado de un
// archivo de video, para usarla como thumbnail_url en publicidad_disenos
// (los videos no se pueden mostrar dentro de un <img>).
//
// Nota: un <video> desprendido del DOM (nunca insertado) es poco confiable
// para seek+captura en varios navegadores — el evento 'seeked' puede
// dispararse antes de que el frame este realmente pintado, produciendo un
// error silencioso o un frame en negro. Por eso se adjunta oculto al DOM,
// se usa 'loadeddata' (garantiza el primer frame decodificado) en vez de
// seek, y se espera un par de frames de pintado antes de capturar.

export async function generarThumbnailVideo(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.position = 'fixed';
  video.style.top = '-9999px';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => {
        const err = video.error;
        reject(new Error(`No se pudo leer el video (codigo ${err?.code ?? '?'}: ${err?.message || 'formato no soportado por el navegador'})`));
      }, { once: true });
      video.src = objectUrl;
      video.load();
    });

    // Da un par de frames de pintado para asegurar que el buffer interno
    // del video ya tiene pixeles capturables (evita frames en negro).
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el canvas');
    ctx.drawImage(video, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la miniatura del video (toBlob devolvio null)'));
      }, 'image/jpeg', 0.85);
    });
  } finally {
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
