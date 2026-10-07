/**
 * Utilidad Integral de Compresión y Optimización de Imágenes en MOVI Digital
 * - Para Avatares: Recorte cuadrado centrado 1:1, máx 512x512 px (~60-90 KB).
 * - Para Documentos / Pólizas / Comprobantes: Conserva proporciones completas sin cortes,
 *   mantiene nitidez y legibilidad de texto a alta resolución (máx 2048x2048 px, ~200-350 KB).
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp';
  squareCrop?: boolean;
}

export interface OptimizedResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
  ahorroPorcentaje: number;
}

/**
 * Optimiza avatares y fotos de perfil (proporción cuadrada 1:1)
 */
export async function optimizarImagenAvatar(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedResult> {
  return optimizarImagenGenerica(file, {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.85,
    squareCrop: true,
    format: 'image/jpeg',
    ...options,
  });
}

/**
 * Optimiza fotografías de documentos, identificaciones (INE), pólizas y comprobantes
 * - NO recorta la imagen (conserva 100% de los bordes y datos).
 * - Conserva alta resolución (hasta 2048px) para nitidez en letras pequeñas y firmas.
 * - Reduce el peso de fotos móviles de ~8-12 MB a ~200-350 KB.
 */
export async function optimizarDocumentoImagen(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedResult> {
  // Si no es imagen (ej. es PDF), no procesar con Canvas
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen procesable.');
  }

  return optimizarImagenGenerica(file, {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.88, // Mayor fidelidad para texto y sellos
    squareCrop: false,
    format: 'image/jpeg',
    ...options,
  });
}

/**
 * Función central de procesamiento por Canvas
 */
export async function optimizarImagenGenerica(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    format = 'image/jpeg',
    squareCrop = false,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida o está dañado.'));

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
            // Recorte cuadrado centrado para perfiles
            const minDim = Math.min(img.width, img.height);
            sourceX = (img.width - minDim) / 2;
            sourceY = (img.height - minDim) / 2;
            sourceWidth = minDim;
            sourceHeight = minDim;
            destWidth = Math.min(maxWidth, minDim);
            destHeight = Math.min(maxHeight, minDim);
          } else {
            // Documentos: Proporción original exacta, redimensionando solo si excede los límites máximos
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
            throw new Error('No se pudo inicializar el motor de renderizado 2D.');
          }

          // Suavizado bicúbico de alta fidelidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fondo blanco para imágenes transparentes en JPEG
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
                return reject(new Error('Error al generar la imagen comprimida.'));
              }

              const ext = format === 'image/webp' ? 'webp' : 'jpg';
              const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
              const fileName = `doc_${Date.now()}_${cleanName}.${ext}`;

              const optimizedFile = new File([blob], fileName, {
                type: format,
                lastModified: Date.now(),
              });

              const ahorroPorcentaje = Math.max(
                0,
                Math.round(((file.size - blob.size) / file.size) * 100)
              );

              resolve({
                file: optimizedFile,
                dataUrl,
                width: destWidth,
                height: destHeight,
                sizeBytes: blob.size,
                originalSizeBytes: file.size,
                ahorroPorcentaje,
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
