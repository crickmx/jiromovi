/**
 * Utilidad de compresión y optimización de imágenes (Avatares y Fotos de Perfil)
 * Convierte cualquier formato de imagen (PNG, JPEG, WebP, etc.) a un JPEG/WebP optimizado,
 * redimensiona a dimensiones estándar (máx 512x512) y comprime a calidad 0.85 (~60-120 KB).
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp';
  squareCrop?: boolean;
}

export async function optimizarImagenAvatar(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<{ file: File; dataUrl: string; width: number; height: number; sizeBytes: number }> {
  const {
    maxWidth = 512,
    maxHeight = 512,
    quality = 0.85,
    format = 'image/jpeg',
    squareCrop = true,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('El archivo no es una imagen válida o está dañado.'));

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          let destWidth = img.width;
          let destHeight = img.height;

          if (squareCrop) {
            // Recorte cuadrado centrado
            const minDim = Math.min(img.width, img.height);
            sourceX = (img.width - minDim) / 2;
            sourceY = (img.height - minDim) / 2;
            sourceWidth = minDim;
            sourceHeight = minDim;
            destWidth = Math.min(maxWidth, minDim);
            destHeight = Math.min(maxHeight, minDim);
          } else {
            // Ajuste proporcional manteniendo aspecto
            if (destWidth > maxWidth || destHeight > maxHeight) {
              const ratio = Math.min(maxWidth / destWidth, maxHeight / destHeight);
              destWidth = Math.round(destWidth * ratio);
              destHeight = Math.round(destHeight * ratio);
            }
          }

          canvas.width = destWidth;
          canvas.height = destHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('No se pudo obtener el contexto 2D del canvas.');
          }

          // Suavizado de imagen de alta calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fondo blanco en caso de transparencias en JPEG
          if (format === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, destWidth, destHeight);
          }

          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            destWidth,
            destHeight
          );

          const dataUrl = canvas.toDataURL(format, quality);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Error al generar blob comprimido.'));
              }

              const ext = format === 'image/webp' ? 'webp' : 'jpg';
              const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
              const fileName = `avatar_${Date.now()}_${cleanName}.${ext}`;

              const optimizedFile = new File([blob], fileName, {
                type: format,
                lastModified: Date.now(),
              });

              resolve({
                file: optimizedFile,
                dataUrl,
                width: destWidth,
                height: destHeight,
                sizeBytes: blob.size,
              });
            },
            format,
            quality
          );
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
