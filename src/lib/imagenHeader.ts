// Recorte y compresión de la imagen de fondo del encabezado de un trámite.
//
// El encabezado es una franja ancha y baja que se pinta con `background-size:
// cover`, así que una imagen con otra proporción se recorta sola —y el recorte
// lo decide el navegador, no quien la sube. Aquí se decide antes: se recorta a
// la proporción real del encabezado y se reescala al ancho con el que se va a
// ver, que de paso resuelve el peso (una foto de celular de 6 MB sale en ~200 KB).

/** Proporción ancho:alto de la franja del encabezado. */
export const RELACION_HEADER = 4;
/** Ancho al que se guarda. Cubre pantallas grandes sin pasarse de peso. */
export const ANCHO_HEADER = 1600;
export const ALTO_HEADER = ANCHO_HEADER / RELACION_HEADER;
export const MEDIDA_SUGERIDA = `${ANCHO_HEADER} × ${ALTO_HEADER} px`;

export interface Medida { ancho: number; alto: number }

/**
 * Escala mínima para que la imagen tape el marco completo. Es el mismo criterio
 * de `background-size: cover`; el zoom del usuario multiplica sobre esto.
 */
export function escalaCover(img: Medida, marco: Medida): number {
  return Math.max(marco.ancho / img.ancho, marco.alto / img.alto);
}

/**
 * Acota el desplazamiento para que nunca quede un hueco dentro del marco.
 * `dibujo` es el tamaño ya escalado de la imagen.
 */
export function limitarOffset(offset: { x: number; y: number }, dibujo: Medida, marco: Medida) {
  const acotar = (v: number, dibujado: number, visible: number) => {
    const min = Math.min(0, visible - dibujado); // dibujado >= visible siempre que venga de escalaCover
    return Math.max(min, Math.min(0, v));
  };
  return {
    x: acotar(offset.x, dibujo.ancho, marco.ancho),
    y: acotar(offset.y, dibujo.alto, marco.alto),
  };
}

/** Qué pedazo de la imagen original quedó dentro del marco. */
export function rectFuente(offset: { x: number; y: number }, escala: number, marco: Medida) {
  return {
    x: -offset.x / escala,
    y: -offset.y / escala,
    ancho: marco.ancho / escala,
    alto: marco.alto / escala,
  };
}

/** Lee un archivo como <img> ya cargada. */
export function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/**
 * Recorta ese pedazo y lo devuelve como JPEG al tamaño del encabezado.
 * JPEG y no PNG a propósito: son fotos/fondos, y un PNG del mismo recorte pesa
 * varias veces más sin verse mejor.
 */
export function recortarAHeader(img: HTMLImageElement, rect: ReturnType<typeof rectFuente>): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO_HEADER;
  canvas.height = ALTO_HEADER;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('El navegador no permitió procesar la imagen'));
  ctx.drawImage(img, rect.x, rect.y, rect.ancho, rect.alto, 0, 0, ANCHO_HEADER, ALTO_HEADER);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', 0.85);
  });
}
