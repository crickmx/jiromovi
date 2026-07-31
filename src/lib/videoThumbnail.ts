// Genera una miniatura JPEG a partir del primer segundo de un archivo de
// video, para usarla como thumbnail_url en publicidad_disenos (los videos
// no se pueden mostrar dentro de un <img>).

export async function generarThumbnailVideo(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('No se pudo leer el video'));
    });

    video.currentTime = Math.min(1, (video.duration || 2) / 2);

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('No se pudo generar la miniatura del video'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el canvas');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la miniatura del video'));
      }, 'image/jpeg', 0.85);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
